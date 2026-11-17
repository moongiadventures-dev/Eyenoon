/**
 * EYE:NOON Optical — eye-exam booking, backed by the store's Google Calendar.
 *
 * The store already runs its exam book in Google Calendar like this:
 *   - every bookable 30-min exam time is an event titled "Eye Exam" (an open slot)
 *   - when someone books, staff rename that event to the patient's name
 *   - "Lunch Break", days off etc. are their own events
 * The website follows the same convention:
 *   - it offers ONLY "Eye Exam" events (case-insensitive) that nothing else overlaps
 *   - booking renames that event to "[WEB] Name / Phone / Service"
 *   - cancelling renames it back to "Eye Exam"
 * So staff decide the days and hours simply by which "Eye Exam" slots exist.
 *
 * Endpoints (mounted under /api/booking):
 *   GET  /config                 → services, booking window, days that have open slots
 *   GET  /slots?date=YYYY-MM-DD  → open start times for that day (store time)
 *   POST /                       → book { start, service, name, phone, email, notes }
 *   GET  /lookup?id=&token=      → booking details for the cancel page
 *   POST /cancel  { id, token }  → cancel a web booking
 *
 * Double-booking protection: the rename is a conditional update (If-Match on the
 * event's etag). If staff renamed or moved the slot since we read it, Google
 * answers 412 and the customer is asked to pick another time — staff win.
 *
 * Backends:
 *   - Google Calendar when GOOGLE_CALENDAR_ID + service-account creds are set.
 *   - Otherwise (local dev only) a JSON file that simulates "Eye Exam" slots from
 *     BOOKING_HOURS_JSON / the defaults below.
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
 * LOCAL DEV ONLY: which "Eye Exam" slots the simulated calendar has, per weekday
 * (0 = Sunday). On Google the real calendar decides. Mirrors the store's book:
 * Wed/Fri/Sat 9:30–17:30 with lunch 13:00–14:00.
 */
const DEFAULT_HOURS = {
  0: "",
  1: "",
  2: "",
  3: "09:30-13:00,14:00-17:30",
  4: "",
  5: "09:30-13:00,14:00-17:30",
  6: "09:30-13:00,14:00-17:30",
};
const OPEN_SLOT_TITLE = "Eye Exam";
const isOpenTitle = (t) => /^\s*eye\s*exam\s*$/i.test(String(t || ""));
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

async function gcal(method, pathAndQuery, body, extraHeaders) {
  const token = await googleToken();
  const url =
    "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(CALENDAR_ID) + pathAndQuery;
  const res = await fetch(url, {
    method,
    headers: Object.assign({ Authorization: "Bearer " + token, "Content-Type": "application/json" }, extraHeaders || {}),
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
  return {
    id: ev.id,
    start,
    end,
    title: ev.summary || "",
    etag: ev.etag || "",
    allDay: !ev.start.dateTime,
    bookingId: priv.eyenoonBookingId || "",
  };
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
  /** Rename an open "Eye Exam" slot to the web booking. false = slot changed meanwhile. */
  async claim(slot, b) {
    try {
      await gcal(
        "PATCH",
        "/events/" + encodeURIComponent(slot.id),
        {
          summary: "[WEB] " + b.name + " / " + b.phone + " / " + b.serviceLabel,
          description:
            "Booked on the website.\n" +
            "Name: " + b.name + "\nPhone: " + b.phone + "\nEmail: " + b.email +
            "\nService: " + b.serviceLabel + (b.notes ? "\nNotes: " + b.notes : "") +
            "\nBooking ID: " + b.id,
          colorId: "10",
          extendedProperties: { private: { eyenoonBookingId: b.id, source: "web", customerEmail: b.email } },
        },
        slot.etag ? { "If-Match": slot.etag } : undefined
      );
      return true;
    } catch (e) {
      if (e.status === 412 || e.status === 404 || e.status === 410) return false;
      throw e;
    }
  },
  /** Turn a web booking back into an open "Eye Exam" slot. */
  async release(eventId) {
    await gcal("PATCH", "/events/" + encodeURIComponent(eventId), {
      summary: OPEN_SLOT_TITLE,
      description: "",
      colorId: null,
      extendedProperties: { private: { eyenoonBookingId: "", source: "", customerEmail: "" } },
    });
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
      title: n.title,
      start: n.start,
      end: n.end,
      name: field("Name"),
      email: priv.customerEmail || field("Email"),
      serviceLabel: field("Service"),
    };
  },
};

/* ----------------------------------------------------------------------------
 * Local dev backend — simulates the store calendar: an "Eye Exam" event for
 * every slot in DEFAULT_HOURS / BOOKING_HOURS_JSON, with changes (bookings,
 * staff renames) kept in server/.bookings-dev.json as { [slotId]: {...} }.
 * To simulate staff booking a slot by phone, add e.g.
 *   { "ph_2026-11-18T18:00:00.000Z": { "title": "Jane Doe", "v": 1 } }
 * ------------------------------------------------------------------------- */
const DEV_FILE = path.join(__dirname, ".bookings-dev.json");
function devRead() {
  try {
    const j = JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
    return j && !Array.isArray(j) ? j : {};
  } catch (e) {
    return {};
  }
}
function devWrite(map) {
  fs.writeFileSync(DEV_FILE, JSON.stringify(map, null, 2));
}
function devEvent(slot, over) {
  const id = "ph_" + slot.start.toISOString();
  const o = over[id] || {};
  return {
    id,
    start: slot.start,
    end: slot.end,
    title: o.title || OPEN_SLOT_TITLE,
    etag: String(o.v || 0),
    allDay: false,
    bookingId: o.bookingId || "",
  };
}
const devStore = {
  async list(timeMin, timeMax) {
    const over = devRead();
    const out = [];
    const last = addDaysStr(todayInStore(), DAYS_AHEAD + 1);
    for (let ds = todayInStore(); ds <= last; ds = addDaysStr(ds, 1)) {
      for (const c of candidateSlots(ds)) {
        if (overlaps(c.start, c.end, timeMin, timeMax)) out.push(devEvent(c, over));
      }
    }
    return out;
  },
  async claim(slot, b) {
    const over = devRead();
    const cur = over[slot.id] || {};
    if (String(cur.v || 0) !== slot.etag) return false;
    over[slot.id] = {
      v: (cur.v || 0) + 1,
      title: "[WEB] " + b.name + " / " + b.phone + " / " + b.serviceLabel,
      bookingId: b.id,
      name: b.name,
      email: b.email,
      serviceLabel: b.serviceLabel,
    };
    devWrite(over);
    return true;
  },
  async release(eventId) {
    const over = devRead();
    const cur = over[eventId] || {};
    over[eventId] = { v: (cur.v || 0) + 1 };
    devWrite(over);
  },
  async findByBookingId(bookingId) {
    const over = devRead();
    const id = Object.keys(over).find((k) => over[k].bookingId === bookingId);
    if (!id) return null;
    const start = new Date(id.slice(3));
    return {
      eventId: id,
      id: bookingId,
      title: over[id].title,
      start,
      end: new Date(start.getTime() + SLOT_MINUTES * 60000),
      name: over[id].name || "",
      email: over[id].email || "",
      serviceLabel: over[id].serviceLabel || "",
    };
  },
};

const store = useGoogle ? googleStore : devStore;

/* ----------------------------------------------------------------------------
 * Availability
 * ------------------------------------------------------------------------- */
/** Open "Eye Exam" slots among events, honoring min notice and overlaps. */
function openSlotsFrom(events) {
  const earliest = Date.now() + MIN_NOTICE_MINUTES * 60000;
  const isSlot = (e) => isOpenTitle(e.title) && !e.allDay;
  const blockers = events.filter((e) => !isSlot(e));
  const seen = new Set();
  return events
    .filter(isSlot)
    .filter((e) => e.start.getTime() >= earliest)
    .filter((e) => !blockers.some((x) => overlaps(e.start, e.end, x.start, x.end)))
    .sort((a, b) => a.start - b.start)
    .filter((e) => {
      const k = e.start.getTime();
      if (seen.has(k)) return false; // two "Eye Exam" events at the same time = one slot
      seen.add(k);
      return true;
    });
}

function storeDate(d) {
  const p = zonedParts(d);
  return p.y + "-" + pad(p.m) + "-" + pad(p.d);
}

async function freeSlots(dateStr) {
  if (!parseDateStr(dateStr) || !dateInWindow(dateStr)) return [];
  const { start, end } = dayBounds(dateStr);
  return openSlotsFrom(await store.list(start, end)).filter((e) => storeDate(e.start) === dateStr);
}

/** Store-local dates in the booking window that have at least one open slot. */
let daysCache = { at: 0, days: [] };
async function openDays() {
  if (Date.now() - daysCache.at < 30000) return daysCache.days;
  const today = todayInStore();
  const last = addDaysStr(today, DAYS_AHEAD);
  const events = await store.list(dayBounds(today).start, dayBounds(last).end);
  const days = Array.from(new Set(openSlotsFrom(events).map((e) => storeDate(e.start))))
    .filter((d) => d >= today && d <= last)
    .sort();
  daysCache = { at: Date.now(), days };
  return days;
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

  r.get("/config", async (req, res) => {
    const out = {
      timezone: TZ,
      daysAhead: DAYS_AHEAD,
      today: todayInStore(),
      services: SERVICES,
      backend: useGoogle ? "google" : "dev",
      enabled: BOOKING_ENABLED,
      openDays: [],
    };
    res.set("Cache-Control", "no-store");
    if (!BOOKING_ENABLED) return res.json(out);
    try {
      out.openDays = await openDays();
      res.json(out);
    } catch (e) {
      console.error("[booking/config]", e);
      res.status(502).json({ error: "Could not load availability. Please call us at " + STORE_PHONE + "." });
    }
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

    const dateStr = storeDate(start);
    if (!dateInWindow(dateStr)) return res.status(400).json({ error: "That time isn't bookable." });

    const booking = {
      id: crypto.randomBytes(9).toString("base64url"),
      start,
      end: start,
      name,
      phone,
      email,
      notes,
      serviceLabel: service.label,
    };

    try {
      const result = await withLock(start.toISOString(), async () => {
        // Re-read the day and find the open "Eye Exam" slot at this time.
        const slot = (await freeSlots(dateStr)).find((f) => f.start.getTime() === start.getTime());
        if (!slot) return { conflict: true };
        booking.end = slot.end;
        // Conditional rename — fails if staff changed the slot since we read it.
        const ok = await store.claim(slot, booking);
        return ok ? { eventId: slot.id } : { conflict: true };
      });
      daysCache.at = 0;

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
      if (!b || isOpenTitle(b.title)) return res.status(404).json({ error: "This appointment was already cancelled or not found." });
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
      if (!/^\[WEB\]/i.test(b.title || "")) {
        // Staff already edited this booking in the calendar — don't undo their change.
        return res.status(409).json({ error: "This appointment was changed by the store. Please call us at " + STORE_PHONE + "." });
      }
      await store.release(b.eventId);
      daysCache.at = 0;
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
  return "LOCAL DEV (simulated 'Eye Exam' slots in " + path.basename(DEV_FILE) + ")";
}

if (useGoogle && !BOOKING_SECRET) {
  console.error("[booking] BOOKING_SECRET is not set — online booking stays OFF (checkout is unaffected).");
}

module.exports = { createBookingRouter, bookingStatusLine, _test: { candidateSlots, zonedToUtc, openSlotsFrom, isOpenTitle } };
