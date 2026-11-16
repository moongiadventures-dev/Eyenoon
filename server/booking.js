/**
 * EYE:NOON Optical — eye-exam booking, backed by the store's Google Calendar.
 *
 * The Google Calendar is the ONE booking ledger. Phone staff add events to it
 * directly; the website reads it and writes to it. Rule for staff:
 *   ANY event on the calendar (timed or all-day) blocks that time on the web.
 *
 * Endpoints (mounted under /api/booking):
 *   GET  /config                 → hours, slot length, services, booking window
 *   GET  /slots?date=YYYY-MM-DD  → free start times for that day (store time)
 *   POST /                       → create a booking { start, service, name, phone, email, notes }
 *   GET  /lookup?id=&token=      → booking details for the cancel page
 *   POST /cancel  { id, token }  → cancel a web booking
 *
 * Double-booking protection (one exam per time slot):
 *   1. /slots only shows times with nothing on the calendar.
 *   2. POST re-reads the calendar under a per-slot lock right before inserting.
 *   3. After inserting, it reads the slot again; if anything else is there
 *      (e.g. staff typed a phone booking in the same second), it deletes its
 *      own event and answers 409 — the phone booking wins.
 *
 * Backends:
 *   - Google Calendar when GOOGLE_CALENDAR_ID + service-account creds are set.
 *   - Otherwise a local JSON file (server/.bookings-dev.json) so the flow can be
 *     built and tested before the store shares its calendar.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

/* ----------------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------------- */
const TZ = process.env.BOOKING_TIMEZONE || "America/Los_Angeles";
const SLOT_MINUTES = parseInt(process.env.BOOKING_SLOT_MINUTES || "30", 10);
const MIN_NOTICE_MINUTES = parseInt(process.env.BOOKING_MIN_NOTICE_MINUTES || "120", 10);
const DAYS_AHEAD = parseInt(process.env.BOOKING_DAYS_AHEAD || "60", 10);

/**
 * Exam hours per weekday (0 = Sunday). Format "HH:MM-HH:MM", comma-separated
 * ranges allowed (e.g. lunch break "10:00-13:00,14:00-18:00"). Empty = closed.
 * Default matches contact.html: exams Mon, Wed, Fri, Sat, 10:00–18:00.
 */
const DEFAULT_HOURS = {
  0: "",
  1: "10:00-18:00",
  2: "",
  3: "10:00-18:00",
  4: "",
  5: "10:00-18:00",
  6: "10:00-18:00",
};
function loadHours() {
  const raw = process.env.BOOKING_HOURS_JSON;
  if (!raw) return DEFAULT_HOURS;
  try {
    const parsed = JSON.parse(raw);
    const out = {};
    for (let d = 0; d < 7; d++) out[d] = String(parsed[d] || parsed[String(d)] || "");
    return out;
  } catch (e) {
    console.error("[booking] BOOKING_HOURS_JSON is not valid JSON — using defaults");
    return DEFAULT_HOURS;
  }
}
const HOURS = loadHours();

const SERVICES = [
  { id: "eye-exam", label: "Comprehensive eye exam" },
  { id: "contact-lens-exam", label: "Contact lens exam / fitting" },
  { id: "frame-styling", label: "Frame styling consultation" },
];

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
const SA = loadServiceAccount();
const useGoogle = Boolean(CALENDAR_ID && SA);

const BOOKING_SECRET =
  process.env.BOOKING_SECRET ||
  (useGoogle ? "" : "dev-only-booking-secret"); // required in production
// On a real host (Render sets RENDER=true) the local JSON file must never take
// bookings: it isn't the calendar and is wiped on every deploy. Until Google is
// connected the page tells customers to call instead.
const DEV_FILE_ALLOWED = !process.env.RENDER && process.env.NODE_ENV !== "production";
const BOOKING_ENABLED = useGoogle ? Boolean(BOOKING_SECRET) : DEV_FILE_ALLOWED;
const NOTIFY_EMAIL = process.env.BOOKING_NOTIFY_EMAIL || process.env.BCC_EMAIL || "";
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "http://127.0.0.1:4242").replace(/\/$/, "");
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "EYE:NOON Optical <onboarding@resend.dev>";
const STORE_PHONE = "213-388-1447";
const STORE_ADDRESS = "301 S Western Ave. #103, Los Angeles, CA 90020";

function loadServiceAccount() {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const j = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return { email: j.client_email, key: j.private_key };
    }
    if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
      const j = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_FILE, "utf8"));
      return { email: j.client_email, key: j.private_key };
    }
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      return {
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };
    }
  } catch (e) {
    console.error("[booking] could not read Google service account:", e.message);
  }
  return null;
}

/* ----------------------------------------------------------------------------
 * Time-zone helpers (store wall clock ⇄ UTC) — no external libs.
 * ------------------------------------------------------------------------- */
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function zonedParts(date) {
  const p = {};
  for (const x of partsFmt.formatToParts(date)) p[x.type] = x.value;
  return {
    y: +p.year,
    m: +p.month,
    d: +p.day,
    h: +p.hour,
    mi: +p.minute,
    s: +p.second,
    wd: WEEKDAYS[p.weekday],
  };
}

/** Store-local wall time → UTC Date (handles DST). */
function zonedToUtc(y, m, d, h, mi) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ts = guess;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(ts));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    ts = ts - (asUtc - guess);
  }
  return new Date(ts);
}

function pad(n) {
  return String(n).padStart(2, "0");
}
function todayInStore() {
  const p = zonedParts(new Date());
  return p.y + "-" + pad(p.m) + "-" + pad(p.d);
}
function parseDateStr(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, m: mo, d, wd: check.getUTCDay() };
}
function addDaysStr(s, n) {
  const p = parseDateStr(s);
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
}

const labelFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const longFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** All candidate slot starts for a store-local date, per HOURS. */
function candidateSlots(dateStr) {
  const p = parseDateStr(dateStr);
  if (!p) return [];
  const spec = HOURS[p.wd] || "";
  const out = [];
  for (const range of spec.split(",").map((r) => r.trim()).filter(Boolean)) {
    const mm = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(range);
    if (!mm) continue;
    const open = +mm[1] * 60 + +mm[2];
    const close = +mm[3] * 60 + +mm[4];
    for (let t = open; t + SLOT_MINUTES <= close; t += SLOT_MINUTES) {
      const start = zonedToUtc(p.y, p.m, p.d, Math.floor(t / 60), t % 60);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60000);
      out.push({ start, end });
    }
  }
  return out;
}

function dateInWindow(dateStr) {
  const today = todayInStore();
  return dateStr >= today && dateStr <= addDaysStr(today, DAYS_AHEAD);
}

/** Day bounds in UTC for a store-local date (whole day, for all-day events). */
function dayBounds(dateStr) {
  const p = parseDateStr(dateStr);
  const next = parseDateStr(addDaysStr(dateStr, 1));
  return {
    start: zonedToUtc(p.y, p.m, p.d, 0, 0),
    end: zonedToUtc(next.y, next.m, next.d, 0, 0),
  };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/* ----------------------------------------------------------------------------
 * Google Calendar backend (service account JWT → REST; no googleapis dep)
 * ------------------------------------------------------------------------- */
let tokenCache = { token: "", exp: 0 };

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function googleToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && tokenCache.exp - 60 > now) return tokenCache.token;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: SA.email,
      scope: "https://www.googleapis.com/auth/calendar.events",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(header + "." + claim);
  const sig = b64url(signer.sign(SA.key));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: header + "." + claim + "." + sig,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error("Google auth failed: " + (j.error_description || j.error || res.status));
  tokenCache = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return tokenCache.token;
}

async function gcal(method, pathAndQuery, body) {
  const token = await googleToken();
  const url =
    "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(CALENDAR_ID) + pathAndQuery;
  const res = await fetch(url, {
    method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error("Google Calendar " + method + " failed: " + ((j.error && j.error.message) || res.status));
    err.status = res.status;
    throw err;
  }
  return j;
}

/** Normalise a Google event to { id, start, end, bookingId } (Dates in UTC). */
function normGoogleEvent(ev) {
  let start, end;
  if (ev.start && ev.start.dateTime) {
    start = new Date(ev.start.dateTime);
    end = new Date(ev.end.dateTime);
  } else if (ev.start && ev.start.date) {
    // All-day event: blocks whole store-local day(s).
    start = dayBounds(ev.start.date).start;
    end = dayBounds(ev.end.date).start; // end.date is exclusive
  } else {
    return null;
  }
  const priv = (ev.extendedProperties && ev.extendedProperties.private) || {};
  return { id: ev.id, start, end, bookingId: priv.eyenoonBookingId || "", raw: ev };
}

const googleStore = {
  async list(timeMin, timeMax) {
    const out = [];
    let pageToken = "";
    do {
      const q = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        showDeleted: "false",
        maxResults: "250",
      });
      if (pageToken) q.set("pageToken", pageToken);
      const j = await gcal("GET", "/events?" + q.toString());
      for (const ev of j.items || []) {
        if (ev.status === "cancelled") continue;
        const n = normGoogleEvent(ev);
        if (n) out.push(n);
      }
      pageToken = j.nextPageToken || "";
    } while (pageToken);
    return out;
  },
  async insert(b) {
    const ev = await gcal("POST", "/events", {
      summary: "[WEB] " + b.name + " / " + b.phone + " / " + b.serviceLabel,
      description:
        "Booked on the website.\n" +
        "Name: " + b.name + "\nPhone: " + b.phone + "\nEmail: " + b.email +
        "\nService: " + b.serviceLabel + (b.notes ? "\nNotes: " + b.notes : "") +
        "\nBooking ID: " + b.id,
      start: { dateTime: b.start.toISOString(), timeZone: TZ },
      end: { dateTime: b.end.toISOString(), timeZone: TZ },
      colorId: "10",
      extendedProperties: {
        private: { eyenoonBookingId: b.id, source: "web", customerEmail: b.email },
      },
    });
    return ev.id;
  },
  async remove(eventId) {
    try {
      await gcal("DELETE", "/events/" + encodeURIComponent(eventId));
    } catch (e) {
      if (e.status !== 404 && e.status !== 410) throw e;
    }
  },
  async findByBookingId(bookingId) {
    const q = new URLSearchParams({
      privateExtendedProperty: "eyenoonBookingId=" + bookingId,
      singleEvents: "true",
      showDeleted: "false",
    });
    const j = await gcal("GET", "/events?" + q.toString());
    const ev = (j.items || []).find((e) => e.status !== "cancelled");
    if (!ev) return null;
    const n = normGoogleEvent(ev);
    const priv = (ev.extendedProperties && ev.extendedProperties.private) || {};
    const lines = String(ev.description || "").split("\n");
    const field = (k) => {
      const l = lines.find((x) => x.startsWith(k + ": "));
      return l ? l.slice(k.length + 2) : "";
    };
    return {
      eventId: ev.id,
      id: bookingId,
      start: n.start,
      end: n.end,
      name: field("Name"),
      email: priv.customerEmail || field("Email"),
      serviceLabel: field("Service"),
    };
  },
};

/* ----------------------------------------------------------------------------
 * Local dev backend (JSON file) — same interface as googleStore.
 * Add a "staff" block by hand in the file to simulate a phone booking:
 *   { "id": "x1", "start": "2026-11-16T18:00:00.000Z", "end": "...", "title": "[PHONE] Kim" }
 * ------------------------------------------------------------------------- */
const DEV_FILE = path.join(__dirname, ".bookings-dev.json");
function devRead() {
  try {
    return JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}
function devWrite(list) {
  fs.writeFileSync(DEV_FILE, JSON.stringify(list, null, 2));
}
const devStore = {
  async list(timeMin, timeMax) {
    return devRead()
      .map((e) => ({ id: e.id, start: new Date(e.start), end: new Date(e.end), bookingId: e.bookingId || "" }))
      .filter((e) => overlaps(e.start, e.end, timeMin, timeMax));
  },
  async insert(b) {
    const list = devRead();
    const id = "dev_" + crypto.randomBytes(6).toString("hex");
    list.push({
      id,
      bookingId: b.id,
      title: "[WEB] " + b.name + " / " + b.phone + " / " + b.serviceLabel,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      name: b.name,
      email: b.email,
      serviceLabel: b.serviceLabel,
    });
    devWrite(list);
    return id;
  },
  async remove(eventId) {
    devWrite(devRead().filter((e) => e.id !== eventId));
  },
  async findByBookingId(bookingId) {
    const e = devRead().find((x) => x.bookingId === bookingId);
    if (!e) return null;
    return {
      eventId: e.id,
      id: bookingId,
      start: new Date(e.start),
      end: new Date(e.end),
      name: e.name || "",
      email: e.email || "",
      serviceLabel: e.serviceLabel || "",
    };
  },
};

const store = useGoogle ? googleStore : devStore;

/* ----------------------------------------------------------------------------
 * Availability
 * ------------------------------------------------------------------------- */
async function freeSlots(dateStr) {
  if (!parseDateStr(dateStr) || !dateInWindow(dateStr)) return [];
  const cands = candidateSlots(dateStr);
  if (!cands.length) return [];
  const { start, end } = dayBounds(dateStr);
  const events = await store.list(start, end);
  const earliest = Date.now() + MIN_NOTICE_MINUTES * 60000;
  return cands.filter(
    (c) => c.start.getTime() >= earliest && !events.some((e) => overlaps(c.start, c.end, e.start, e.end))
  );
}

/* Per-slot lock so two web customers can't race inside this process. */
const locks = new Map();
async function withLock(key, fn) {
  while (locks.has(key)) await locks.get(key).catch(() => {});
  const p = (async () => fn())();
  locks.set(key, p);
  try {
    return await p;
  } finally {
    locks.delete(key);
  }
}

/* ----------------------------------------------------------------------------
 * Tokens, validation, rate limit
 * ------------------------------------------------------------------------- */
function cancelToken(bookingId) {
  return crypto.createHmac("sha256", BOOKING_SECRET).update("cancel:" + bookingId).digest("hex").slice(0, 32);
}
function tokenOk(bookingId, token) {
  const a = Buffer.from(cancelToken(bookingId));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const clean = (s, max) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60 * 60000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 6; // 6 booking attempts per hour per IP
}

/* ----------------------------------------------------------------------------
 * Email (Resend) — same provider as order receipts.
 * ------------------------------------------------------------------------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sendEmail(to, subject, html, text) {
  if (!RESEND_API_KEY || !to) {
    console.log("[booking-email] skipped (" + (RESEND_API_KEY ? "no recipient" : "RESEND_API_KEY not set") + "):", subject);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, text }),
    });
    if (!res.ok) console.error("[booking-email] failed", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("[booking-email] error", e);
  }
}

function confirmationEmail(b, cancelUrl) {
  const when = longFmt.format(b.start);
  const text =
    "Hi " + b.name + ",\n\nYour appointment at EYE:NOON Optical is confirmed.\n\n" +
    "When: " + when + " (Los Angeles time)\nService: " + b.serviceLabel + "\nWhere: " + STORE_ADDRESS +
    "\n\nNeed to cancel? " + cancelUrl + "\nTo reschedule, call us at " + STORE_PHONE + ".\n\nSee you soon,\nEYE:NOON Optical";
  const html =
    '<div style="font-family:Helvetica,Arial,sans-serif;color:#0A0A0A;max-width:520px">' +
    '<p style="color:#E0115F;font-weight:700;letter-spacing:.2em;font-size:12px">EYE:NOON OPTICAL</p>' +
    "<h2 style=\"margin:0 0 16px\">Your appointment is confirmed</h2>" +
    "<p>Hi " + esc(b.name) + ",</p>" +
    '<table style="border-collapse:collapse;margin:12px 0">' +
    '<tr><td style="padding:4px 16px 4px 0;opacity:.6">When</td><td><b>' + esc(when) + "</b> (Los Angeles time)</td></tr>" +
    '<tr><td style="padding:4px 16px 4px 0;opacity:.6">Service</td><td>' + esc(b.serviceLabel) + "</td></tr>" +
    '<tr><td style="padding:4px 16px 4px 0;opacity:.6">Where</td><td>' + esc(STORE_ADDRESS) + "</td></tr></table>" +
    '<p>Need to cancel? <a href="' + esc(cancelUrl) + '" style="color:#E0115F">Cancel this appointment</a>.<br>' +
    "To reschedule, call us at " + STORE_PHONE + ".</p></div>";
  return { subject: "Appointment confirmed — " + when, html, text };
}

/* ----------------------------------------------------------------------------
 * Router
 * ------------------------------------------------------------------------- */
function createBookingRouter() {
  const r = express.Router();

  r.use((req, res, next) => {
    if (BOOKING_ENABLED || req.path === "/config") return next();
    res.status(503).json({ error: "Online booking isn't open yet. Please call us at " + STORE_PHONE + "." });
  });

  r.get("/config", (req, res) => {
    const openWeekdays = Object.keys(HOURS).filter((d) => HOURS[d]).map(Number);
    res.json({
      timezone: TZ,
      slotMinutes: SLOT_MINUTES,
      daysAhead: DAYS_AHEAD,
      today: todayInStore(),
      openWeekdays,
      services: SERVICES,
      backend: useGoogle ? "google" : "dev",
      enabled: BOOKING_ENABLED,
    });
  });

  r.get("/slots", async (req, res) => {
    const date = String(req.query.date || "");
    if (!parseDateStr(date)) return res.status(400).json({ error: "Use date=YYYY-MM-DD." });
    try {
      const slots = await freeSlots(date);
      res.set("Cache-Control", "no-store");
      res.json({
        date,
        slots: slots.map((s) => ({ start: s.start.toISOString(), label: labelFmt.format(s.start) })),
      });
    } catch (e) {
      console.error("[booking/slots]", e);
      res.status(502).json({ error: "Could not load availability. Please call us at " + STORE_PHONE + "." });
    }
  });

  r.post("/", async (req, res) => {
    const body = req.body || {};
    if (body.website) return res.json({ ok: true }); // honeypot: silently drop bots
    if (rateLimited(req.ip)) return res.status(429).json({ error: "Too many attempts. Please call us." });

    const start = new Date(body.start);
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 30);
    const email = clean(body.email, 120);
    const notes = clean(body.notes, 500);
    const service = SERVICES.find((s) => s.id === body.service) || SERVICES[0];

    if (isNaN(start.getTime())) return res.status(400).json({ error: "Pick a time." });
    if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (phone.replace(/\D/g, "").length < 10) return res.status(400).json({ error: "Please enter a valid phone number." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });

    const p = zonedParts(start);
    const dateStr = p.y + "-" + pad(p.m) + "-" + pad(p.d);
    // The requested start must be one of the store's real slots.
    const slot = candidateSlots(dateStr).find((c) => c.start.getTime() === start.getTime());
    if (!slot || !dateInWindow(dateStr)) return res.status(400).json({ error: "That time isn't bookable." });

    const booking = {
      id: crypto.randomBytes(9).toString("base64url"),
      start: slot.start,
      end: slot.end,
      name,
      phone,
      email,
      notes,
      serviceLabel: service.label,
    };

    try {
      const result = await withLock(slot.start.toISOString(), async () => {
        // 2. re-check right before writing
        const free = await freeSlots(dateStr);
        if (!free.some((f) => f.start.getTime() === slot.start.getTime())) return { conflict: true };

        const eventId = await store.insert(booking);

        // 3. verify — if anything else landed in this slot, back out
        const after = await store.list(slot.start, slot.end);
        const others = after.filter((e) => e.id !== eventId);
        if (others.length) {
          await store.remove(eventId);
          return { conflict: true };
        }
        return { eventId };
      });

      if (result.conflict) {
        return res.status(409).json({ error: "Sorry — that time was just taken. Please pick another." });
      }

      const token = cancelToken(booking.id);
      const cancelUrl = PUBLIC_SITE_URL + "/book.html?cancel=" + encodeURIComponent(booking.id) + "&t=" + token;
      const mail = confirmationEmail(booking, cancelUrl);
      sendEmail(booking.email, mail.subject, mail.html, mail.text);
      if (NOTIFY_EMAIL) {
        sendEmail(
          NOTIFY_EMAIL,
          "New web booking — " + longFmt.format(booking.start),
          "<p>New web booking:</p><pre>" +
            esc([booking.name, booking.phone, booking.email, booking.serviceLabel, booking.notes].filter(Boolean).join("\n")) +
            "</pre>",
          [booking.name, booking.phone, booking.email, booking.serviceLabel, booking.notes].filter(Boolean).join("\n")
        );
      }
      console.log("[booking] created", booking.id, booking.start.toISOString());
      res.json({
        ok: true,
        id: booking.id,
        start: booking.start.toISOString(),
        when: longFmt.format(booking.start),
        service: booking.serviceLabel,
        cancelUrl,
      });
    } catch (e) {
      console.error("[booking/create]", e);
      res.status(502).json({ error: "We couldn't save your booking. Please call us at " + STORE_PHONE + "." });
    }
  });

  r.get("/lookup", async (req, res) => {
    const id = String(req.query.id || "");
    if (!id || !tokenOk(id, req.query.token)) return res.status(403).json({ error: "Invalid link." });
    try {
      const b = await store.findByBookingId(id);
      if (!b) return res.status(404).json({ error: "This appointment was already cancelled or not found." });
      res.json({ id, start: b.start.toISOString(), when: longFmt.format(b.start), service: b.serviceLabel, name: b.name });
    } catch (e) {
      console.error("[booking/lookup]", e);
      res.status(502).json({ error: "Could not load this appointment." });
    }
  });

  r.post("/cancel", async (req, res) => {
    const id = String((req.body && req.body.id) || "");
    if (!id || !tokenOk(id, req.body && req.body.token)) return res.status(403).json({ error: "Invalid link." });
    try {
      const b = await store.findByBookingId(id);
      if (!b) return res.status(404).json({ error: "This appointment was already cancelled or not found." });
      await store.remove(b.eventId);
      console.log("[booking] cancelled", id);
      if (NOTIFY_EMAIL) {
        const t = "Cancelled by customer: " + b.name + " — " + longFmt.format(b.start);
        sendEmail(NOTIFY_EMAIL, "Web booking cancelled — " + longFmt.format(b.start), "<p>" + esc(t) + "</p>", t);
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[booking/cancel]", e);
      res.status(502).json({ error: "Could not cancel. Please call us at " + STORE_PHONE + "." });
    }
  });

  return r;
}

function bookingStatusLine() {
  if (useGoogle && !BOOKING_SECRET) return "OFF — Google Calendar set but BOOKING_SECRET missing";
  if (useGoogle) return "Google Calendar (" + CALENDAR_ID + ")";
  if (!BOOKING_ENABLED) return "OFF (page shows 'call us') — set GOOGLE_CALENDAR_ID + service account + BOOKING_SECRET";
  return "LOCAL DEV FILE (" + path.basename(DEV_FILE) + ") — set GOOGLE_CALENDAR_ID + service account for real calendar";
}

if (useGoogle && !BOOKING_SECRET) {
  throw new Error("BOOKING_SECRET must be set when using Google Calendar (signs cancel links).");
}

module.exports = { createBookingRouter, bookingStatusLine, _test: { candidateSlots, zonedToUtc } };
