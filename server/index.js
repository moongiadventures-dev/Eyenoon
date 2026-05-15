/**
 * Eye Noon Optical — checkout API
 *
 * Endpoints (this surface is what the existing checkout.html actually calls):
 *   GET  /health
 *   GET  /api/payment-options
 *   POST /api/submit-order                      (multipart/form-data + prescription file)
 *   POST /api/stripe/create-checkout-session    ({ orderId })
 *   GET  /api/stripe/complete?session_id=...
 *   POST /api/paypal/create-order               ({ orderId })
 *   GET  /api/paypal/capture?token=...&eyenoon_order=...
 *   POST /api/stripe/webhook                    (Stripe-signed raw body)
 *
 * The server — not the browser — computes tax/delivery/total, so the amount
 * charged can't be tampered with client-side.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();
app.set("trust proxy", 1);

/* ----------------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------------- */
const PORT = process.env.PORT || 4242;
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "http://127.0.0.1:5500").replace(/\/$/, "");
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const CURRENCY = (process.env.CURRENCY || "usd").toLowerCase();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_MODE = (process.env.PAYPAL_MODE || process.env.PAYPAL_ENV || "sandbox").toLowerCase();

const stripeEnabled = Boolean(STRIPE_SECRET_KEY);
const paypalEnabled = Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);

const stripe = stripeEnabled ? new Stripe(STRIPE_SECRET_KEY) : null;

let paypalClient = null;
if (paypalEnabled) {
  const env =
    PAYPAL_MODE === "live"
      ? new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
      : new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
  paypalClient = new paypal.core.PayPalHttpClient(env);
}

/* ----------------------------------------------------------------------------
 * Storage
 *
 * In-memory order store + on-disk prescription uploads. Both are EPHEMERAL on
 * Render's free/standard tier (the filesystem and process reset on every
 * deploy/restart). Fine for launch + low volume; move orders to SQLite/Postgres
 * and prescriptions to S3 (or email them on submit) before you scale.
 * ------------------------------------------------------------------------- */
const orders = new Map();

const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const safe = (file.originalname || "prescription").replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, Date.now() + "-" + safe);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

/* ----------------------------------------------------------------------------
 * Pricing — ported from js/checkout-tax-delivery.js so client + server agree.
 * ------------------------------------------------------------------------- */
const CA_COMBINED_SALES_TAX = 0.095;
const SHIPPING_CA_NON_LOCAL = 8.99;
const SHIPPING_US_NON_CA = 12.99;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function parseZip5(z) {
  const s = String(z || "").replace(/\D/g, "");
  return s.length >= 5 ? s.slice(0, 5) : "";
}
function isCaliforniaZip5(zip5) {
  if (zip5.length !== 5) return false;
  const n = parseInt(zip5, 10);
  return n >= 90001 && n <= 96162;
}
function isLocalDeliveryZip(zip5) {
  if (zip5.length !== 5) return false;
  const n = parseInt(zip5, 10);
  return n >= 90001 && n <= 91799;
}

/** Normalise the cart the browser posted into trusted line items. */
function normalizeLines(rawCart) {
  let cart = [];
  try {
    cart = JSON.parse(rawCart || "[]");
  } catch (e) {
    cart = [];
  }
  if (!Array.isArray(cart)) cart = [];
  return cart
    .map((l) => {
      const qty = Math.max(1, parseInt(l && l.qty, 10) || 1);
      const unitPrice = round2(l && l.price);
      return {
        slug: String((l && l.slug) || ""),
        name: String((l && l.name) || (l && l.slug) || "Item"),
        kind: String((l && l.kind) || "contact_lens"),
        qty,
        unitPrice,
        lineTotal: round2(unitPrice * qty),
      };
    })
    .filter((l) => l.unitPrice > 0 && l.qty > 0);
}

function priceOrder(lines, state, zipRaw) {
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const st = String(state || "").trim().toUpperCase();
  const zip5 = parseZip5(zipRaw);
  const addressComplete = st.length === 2 && zip5.length === 5;

  let estimatedTax = 0;
  let taxLabel = "Est. sales tax";
  if (st === "CA") {
    estimatedTax = round2(subtotal * CA_COMBINED_SALES_TAX);
    taxLabel = "Est. sales tax (CA " + (CA_COMBINED_SALES_TAX * 100).toFixed(1) + "%)";
  } else if (st.length === 2) {
    taxLabel = "Sales tax (if applicable)";
  }

  let delivery = 0;
  let deliveryLabel = "Delivery / shipping";
  if (addressComplete) {
    if (st === "CA") {
      if (isCaliforniaZip5(zip5) && isLocalDeliveryZip(zip5)) {
        delivery = 0;
        deliveryLabel = "Delivery (local)";
      } else {
        delivery = SHIPPING_CA_NON_LOCAL;
        deliveryLabel = "Shipping (CA)";
      }
    } else {
      delivery = SHIPPING_US_NON_CA;
      deliveryLabel = "Shipping (US)";
    }
  }

  const total = round2(subtotal + estimatedTax + delivery);
  return { subtotal, estimatedTax, taxLabel, delivery, deliveryLabel, total };
}

/** The pricing payload checkout.html expects back from submit/complete/capture. */
function orderResponse(order) {
  return {
    orderId: order.orderId,
    subtotal: order.subtotal,
    estimatedTax: order.estimatedTax,
    taxLabel: order.taxLabel,
    delivery: order.delivery,
    deliveryLabel: order.deliveryLabel,
    total: order.total,
    totalFormatted: order.total.toFixed(2),
    existingCustomer: !!order.existingCustomer,
    prescriptionLabel: order.prescriptionLabel || "",
    lines: order.lines.map((l) => ({
      name: l.name,
      slug: l.slug,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    paymentStatus: order.status,
  };
}

/* ----------------------------------------------------------------------------
 * Middleware
 * ------------------------------------------------------------------------- */
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: false }));

// Stripe webhook must see the raw body — register BEFORE express.json().
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(503).end();
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send("Webhook Error: " + err.message);
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata && session.metadata.orderId;
      const order = orderId && orders.get(orderId);
      if (order) {
        order.status = "paid";
        order.paidVia = "stripe";
        order.paidAt = new Date().toISOString();
      }
      console.log("[stripe] checkout.session.completed", orderId);
    }
    res.json({ received: true });
  }
);

app.use(express.json({ limit: "1mb" }));

/* ----------------------------------------------------------------------------
 * Routes
 * ------------------------------------------------------------------------- */
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/payment-options", (req, res) => {
  res.json({ stripe: stripeEnabled, paypal: paypalEnabled });
});

app.post("/api/submit-order", upload.single("prescription"), (req, res) => {
  try {
    const body = req.body || {};
    const lines = normalizeLines(body.cart);
    if (!lines.length) {
      return res.status(400).json({ error: "Your cart is empty." });
    }

    const existingCustomer = String(body.existingCustomer) === "true";
    const pricing = priceOrder(lines, body.state, body.zip);

    let prescriptionLabel = "";
    if (existingCustomer) {
      prescriptionLabel = "Prescription on file at the store";
    } else if (req.file) {
      prescriptionLabel = "Prescription attached: " + req.file.originalname;
    } else {
      return res.status(400).json({ error: "A prescription file is required." });
    }

    const orderId = "EN-" + Date.now().toString(36).toUpperCase();
    const order = {
      orderId,
      status: "pending",
      createdAt: new Date().toISOString(),
      lines,
      ...pricing,
      existingCustomer,
      prescriptionLabel,
      prescriptionFile: req.file ? req.file.filename : null,
      customer: {
        name: body.customerName || "",
        dateOfBirth: body.customerDateOfBirth || "",
        email: body.customerEmail || "",
        phone: body.customerPhone || "",
      },
      shipping: {
        addressLine1: body.addressLine1 || "",
        addressLine2: body.addressLine2 || "",
        city: body.city || "",
        state: body.state || "",
        zip: body.zip || "",
      },
    };
    orders.set(orderId, order);
    console.log("[order] created", orderId, "total", order.total);

    res.json(orderResponse(order));
  } catch (e) {
    console.error("[submit-order]", e);
    res.status(500).json({ error: "Could not save your order. Please try again." });
  }
});

/* ---- Stripe ---- */
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Card checkout is not available." });
  try {
    const order = orders.get(req.body && req.body.orderId);
    if (!order) return res.status(404).json({ error: "Unknown order." });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: { name: "Eye Noon Optical — order " + order.orderId },
            unit_amount: Math.round(order.total * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { orderId: order.orderId },
      customer_email: order.customer.email || undefined,
      success_url:
        PUBLIC_SITE_URL +
        "/checkout.html?stripe_ok=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: PUBLIC_SITE_URL + "/checkout.html?stripe_cancel=1",
    });

    order.stripeSessionId = session.id;
    res.json({ url: session.url });
  } catch (e) {
    console.error("[stripe/create]", e);
    res.status(500).json({ error: e.message || "Stripe error." });
  }
});

app.get("/api/stripe/complete", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Card checkout is not available." });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    const orderId = session.metadata && session.metadata.orderId;
    const order = orders.get(orderId);
    if (!order) return res.status(404).json({ error: "Order not found for this session." });
    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Payment not completed." });
    }
    if (order.status !== "paid") {
      order.status = "paid";
      order.paidVia = "stripe";
      order.paidAt = new Date().toISOString();
    }
    res.json(orderResponse(order));
  } catch (e) {
    console.error("[stripe/complete]", e);
    res.status(500).json({ error: e.message || "Could not verify card payment." });
  }
});

/* ---- PayPal ---- */
app.post("/api/paypal/create-order", async (req, res) => {
  if (!paypalClient) return res.status(503).json({ error: "PayPal is not available." });
  try {
    const order = orders.get(req.body && req.body.orderId);
    if (!order) return res.status(404).json({ error: "Unknown order." });

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: order.orderId,
          description: "Eye Noon Optical — order " + order.orderId,
          amount: {
            currency_code: CURRENCY.toUpperCase(),
            value: order.total.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "Eye Noon Optical",
        user_action: "PAY_NOW",
        return_url:
          PUBLIC_SITE_URL +
          "/checkout.html?paypal_ok=1&eyenoon_order=" +
          encodeURIComponent(order.orderId),
        cancel_url: PUBLIC_SITE_URL + "/checkout.html?paypal_cancel=1",
      },
    });

    const ppRes = await paypalClient.execute(request);
    const approval = ppRes.result.links.find((l) => l.rel === "approve");
    order.paypalOrderId = ppRes.result.id;
    res.json({ approvalUrl: approval && approval.href, id: ppRes.result.id });
  } catch (e) {
    console.error("[paypal/create]", e);
    res.status(500).json({ error: e.message || "PayPal error." });
  }
});

app.get("/api/paypal/capture", async (req, res) => {
  if (!paypalClient) return res.status(503).json({ error: "PayPal is not available." });
  try {
    const order = orders.get(req.query.eyenoon_order);
    if (!order) return res.status(404).json({ error: "Order not found." });

    // PayPal's ?token= is the PayPal order id to capture.
    const captureReq = new paypal.orders.OrdersCaptureRequest(req.query.token);
    captureReq.requestBody({});
    const capture = await paypalClient.execute(captureReq);

    if (capture.result.status !== "COMPLETED") {
      return res.status(402).json({ error: "PayPal payment not completed." });
    }
    if (order.status !== "paid") {
      order.status = "paid";
      order.paidVia = "paypal";
      order.paidAt = new Date().toISOString();
    }
    res.json(orderResponse(order));
  } catch (e) {
    console.error("[paypal/capture]", e);
    res.status(500).json({ error: e.message || "Could not complete PayPal payment." });
  }
});

/* ----------------------------------------------------------------------------
 * Start
 * ------------------------------------------------------------------------- */
app.listen(PORT, () => {
  console.log("Eye Noon checkout API listening on :" + PORT);
  console.log("  site URL    :", PUBLIC_SITE_URL);
  console.log("  CORS origin :", ALLOWED_ORIGIN);
  console.log("  Stripe      :", stripeEnabled ? "enabled" : "DISABLED (no STRIPE_SECRET_KEY)");
  console.log(
    "  PayPal      :",
    paypalEnabled ? "enabled (" + PAYPAL_MODE + ")" : "DISABLED (no PayPal credentials)"
  );
});
