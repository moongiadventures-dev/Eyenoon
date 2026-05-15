# Eye Noon — Deployment & Payments Guide

Last updated: 2026-05-05

This guide walks you from "files on my laptop" to "live site at the client's Wix-registered domain, taking real Stripe + PayPal payments."

---

## 1. The shape of what you're deploying

Your site is **not** purely static. It's two pieces:

| Piece | What it is | Where it goes |
|---|---|---|
| **Frontend** | All the `.html`, `.css`, `/js/`, `/images/`, `/data/`, `/*.mp4` files | Static host (Render Static Site or Netlify) |
| **Backend** | A small Node.js Express server (you'll build it — the `server/` folder is empty) that exposes the `/api/*` endpoints `checkout.html` already calls | Node host (Render Web Service) |

The existing checkout code expects this API surface — it's already wired up:

- `GET  /api/payment-options` → returns which methods are enabled
- `POST /api/submit-order` → saves the order, returns an order id
- `POST /api/stripe/create-checkout-session` → creates a Stripe Checkout Session
- `GET  /api/stripe/complete?session_id=...` → verifies payment after Stripe redirect
- `POST /api/paypal/create-order` → creates a PayPal order
- `GET  /api/paypal/capture?token=...` → captures the PayPal order after redirect

**Recommended host: Render.com.** One platform, free tier covers both the static site and the Node service, and Stripe/PayPal redirects work cleanly. Alternatives: Railway (paid), Vercel (split static + serverless functions — more rewriting required).

**Recommended DNS strategy:** Keep the domain registered at Wix, change DNS records to point to Render. No domain transfer needed.

---

## 2. Accounts & credentials you need before deploying

Create these first. None require a credit card to set up; Stripe and PayPal need a bank account before you can withdraw funds.

### 2.1 Stripe (credit/debit cards)

1. Go to https://dashboard.stripe.com/register and create an account. Use the client's business email if it's their store; otherwise yours and transfer ownership later.
2. Activate the account (business name, address, tax ID, bank account for payouts). Until activation, you can only run **test mode**.
3. From the dashboard, grab two keys (Developers → API keys):
   - **Publishable key** — `pk_live_...` (and `pk_test_...` for testing)
   - **Secret key** — `sk_live_...` (and `sk_test_...` for testing) — *keep secret, never put in frontend code*
4. Set up a **webhook endpoint** (Developers → Webhooks → Add endpoint):
   - URL: `https://api.eyenoon.com/api/stripe/webhook` (use whatever subdomain you choose for the backend)
   - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
   - After creating, copy the **Signing secret** — `whsec_...`

### 2.2 PayPal (PayPal balance + cards via PayPal Checkout)

1. Sign up at https://www.paypal.com/business — pick **Business account** (Personal accounts can't do Checkout integration).
2. Verify the business (bank link, identity).
3. Go to https://developer.paypal.com → Apps & Credentials.
4. Toggle **Live** (not Sandbox) and create an app: "Eye Noon Web Checkout."
5. Copy:
   - **Client ID**
   - **Secret**
6. Note: PayPal Checkout includes the "Pay with Debit or Credit Card" button automatically — you don't need separate card processing if you use PayPal. But Stripe is cheaper per transaction (~2.9% + $0.30 vs PayPal's ~3.49% + $0.49 for cards), so most stores offer both.

### 2.3 Render

1. Sign up at https://render.com (GitHub login is easiest — you'll want the repo connected anyway).
2. No payment info required for the free tier.

### 2.4 Git repo

The site needs to live in a Git repo for Render auto-deploys. From the project folder:

```bash
cd "C:\Users\Christine\Documents\Eye Noon\Website"
git init
git add .
git commit -m "Initial commit"
```

Push to a private GitHub repo (https://github.com/new). **Add `.gitignore`** with at minimum:

```
server/.env
server/node_modules/
.DS_Store
.claude/
```

The `.env` file holds your secret keys and must **never** be committed.

---

## 3. Build the backend

Create these files inside `server/`:

### 3.1 `server/package.json`

```json
{
  "name": "eyenoon-checkout-api",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@paypal/checkout-server-sdk": "^1.0.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "stripe": "^14.25.0"
  }
}
```

### 3.2 `server/.env` (local only — never commit)

```
PORT=4242
PUBLIC_SITE_URL=https://eyenoon.com
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_ENV=sandbox
ALLOWED_ORIGIN=https://eyenoon.com
```

Switch `PAYPAL_ENV` to `live` and the Stripe keys to `sk_live_...` when going to production.

### 3.3 `server/index.js`

```javascript
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// PayPal client
const paypalEnv =
  process.env.PAYPAL_ENV === "live"
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      );
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

// CORS — only allow your real frontend
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    credentials: false,
  })
);

// Stripe webhook needs the raw body — register BEFORE express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // TODO: mark order as paid in your storage
      console.log("Stripe paid:", session.id, session.metadata);
    }
    res.json({ received: true });
  }
);

app.use(express.json({ limit: "1mb" }));

// In-memory order store. Replace with a real DB (SQLite, Postgres) before scale.
const orders = new Map();

app.get("/api/payment-options", (req, res) => {
  res.json({
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    paypal: Boolean(process.env.PAYPAL_CLIENT_ID),
  });
});

app.post("/api/submit-order", (req, res) => {
  const orderId = "EN-" + Date.now().toString(36).toUpperCase();
  orders.set(orderId, { ...req.body, status: "pending", createdAt: new Date() });
  res.json({ orderId });
});

app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { orderId, amountCents, currency = "usd", description } = req.body;
    const order = orders.get(orderId);
    if (!order) return res.status(404).json({ error: "Unknown order" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: description || `Eye Noon order ${orderId}` },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: { orderId },
      success_url: `${process.env.PUBLIC_SITE_URL}/checkout.html?stripe_ok=1&session_id={CHECKOUT_SESSION_ID}&eyenoon_order=${orderId}`,
      cancel_url: `${process.env.PUBLIC_SITE_URL}/checkout.html?stripe_cancel=1`,
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/stripe/complete", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    res.json({
      paid: session.payment_status === "paid",
      orderId: session.metadata && session.metadata.orderId,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { orderId, amount, currency = "USD" } = req.body;
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: orderId,
          amount: { currency_code: currency, value: amount },
        },
      ],
      application_context: {
        return_url: `${process.env.PUBLIC_SITE_URL}/checkout.html?paypal_ok=1&eyenoon_order=${orderId}`,
        cancel_url: `${process.env.PUBLIC_SITE_URL}/checkout.html?paypal_cancel=1`,
      },
    });
    const order = await paypalClient.execute(request);
    const approval = order.result.links.find((l) => l.rel === "approve");
    res.json({ url: approval.href, id: order.result.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/paypal/capture", async (req, res) => {
  try {
    const captureReq = new paypal.orders.OrdersCaptureRequest(req.query.token);
    captureReq.requestBody({});
    const capture = await paypalClient.execute(captureReq);
    res.json({ paid: capture.result.status === "COMPLETED" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`API running on ${PORT}`));
```

Test locally:

```bash
cd server
npm install
npm start
# In another terminal, serve the site at port 5500 (Live Server / VS Code extension)
# Open http://127.0.0.1:5500/checkout.html and run a test card: 4242 4242 4242 4242
```

---

## 4. Deploy the backend to Render

1. Push the repo to GitHub (with `server/.env` in `.gitignore`).
2. In Render dashboard → **New** → **Web Service**.
3. Connect your repo. Settings:
   - **Name:** `eyenoon-api`
   - **Root directory:** `server`
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free (fine for low traffic; upgrade to Starter $7/mo when ready — free tier sleeps after 15 min idle, which adds a 30-sec wakeup delay on the first checkout click).
4. Add environment variables (Render dashboard → Environment):
   - `STRIPE_SECRET_KEY` = `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - `PAYPAL_CLIENT_ID` = `...`
   - `PAYPAL_CLIENT_SECRET` = `...`
   - `PAYPAL_ENV` = `live`
   - `PUBLIC_SITE_URL` = `https://eyenoon.com` (no trailing slash)
   - `ALLOWED_ORIGIN` = `https://eyenoon.com`
5. Deploy. Render gives you a URL like `https://eyenoon-api.onrender.com`.
6. Optional but recommended: add a custom subdomain `api.eyenoon.com` in Render → Settings → Custom Domains. You'll then add a CNAME at Wix (see DNS section).

**Update Stripe webhook URL** to your final production endpoint: `https://api.eyenoon.com/api/stripe/webhook` (or the `.onrender.com` URL).

---

## 5. Deploy the frontend

### 5.1 Update the frontend config to point at the live API

Edit `js/checkout-config.js` — change the fallback so production uses your real API:

```javascript
(function () {
  if (typeof window.EYE_NOON_CHECKOUT_API !== "undefined") return;
  var isLocalhost =
    location.hostname === "127.0.0.1" || location.hostname === "localhost";
  window.EYE_NOON_CHECKOUT_API = isLocalhost
    ? "http://127.0.0.1:4242"
    : "https://api.eyenoon.com"; // your Render API URL
})();
```

Edit `js/payment-config.js` — set the real PayPal.me handle and Venmo username (these are the *fallback* manual payment links; the main flow goes through PayPal Checkout).

### 5.2 Deploy as a Render Static Site

1. Render dashboard → **New** → **Static Site**.
2. Same GitHub repo. Settings:
   - **Name:** `eyenoon-web`
   - **Root directory:** *(leave blank — site files are at repo root)*
   - **Build command:** *(leave blank — no build step)*
   - **Publish directory:** `.`
3. Deploy. Render gives you `https://eyenoon-web.onrender.com`.

(If you'd rather use Netlify: drag the entire Website folder onto https://app.netlify.com/drop. It's literally one drag. Then connect a custom domain.)

---

## 6. Point the Wix domain at Render

This is where the client's domain stops resolving to Wix and starts resolving to your site. **Coordinate the moment of cutover with the client** — there will be a short window (usually <1 hour, sometimes up to 48 hours for global DNS) where things may flap.

### 6.1 In the Render dashboard

1. Open `eyenoon-web` (the static site) → **Settings** → **Custom Domains** → **Add**.
2. Add `eyenoon.com` and `www.eyenoon.com` (use the real domain).
3. Render shows you the DNS records to create. Typically:
   - For apex (`eyenoon.com`): an **A record** to a Render IP, or an `ALIAS`/`ANAME` to `eyenoon-web.onrender.com`.
   - For `www`: a **CNAME** to `eyenoon-web.onrender.com`.
4. Repeat the process for `api.eyenoon.com` on the API service if you want a clean API subdomain.

### 6.2 In Wix (where the domain is registered)

1. Log in at https://www.wix.com → click the domain in the dashboard → **Advanced** → **DNS Records**.
2. **Delete** the existing A records pointing to Wix's hosting and the existing CNAME for `www`.
3. **Add** the records Render gave you:
   - `A` `@` → Render IP (Render shows the current value)
   - `CNAME` `www` → `eyenoon-web.onrender.com`
   - `CNAME` `api` → `eyenoon-api.onrender.com`
4. Save. Allow up to 48 hours; usually live within an hour.
5. Verify with `dig eyenoon.com +short` or https://dnschecker.org.
6. Back in Render, the SSL certificate provisions automatically once DNS resolves (usually <10 min).

**Important:** Disconnect the domain from Wix's site builder so Wix stops trying to serve a Wix site at it. In the Wix dashboard: domain → **Connect to a different site** → choose **External / not a Wix site**, or simply disconnect from any Wix site.

---

## 7. Final test before going live

Run this checklist with **Stripe in test mode** (`sk_test_`, `pk_test_`) and **PayPal sandbox** (`PAYPAL_ENV=sandbox`):

1. Open the live site at `https://eyenoon.com/checkout.html` (or whatever the URL is).
2. Add an item to cart, fill the form, choose Stripe → use test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. Confirm redirect to `checkout-success.html`.
4. Check Stripe dashboard → **Payments** for the test charge.
5. Repeat with PayPal sandbox (use a sandbox buyer account from developer.paypal.com).
6. Verify the Stripe webhook fires (Stripe dashboard → Webhooks → recent events).

Once all green, swap to live keys in Render's environment variables, redeploy, and run **one real $1 transaction** to verify production. Refund yourself in the dashboard.

---

## 8. Costs & ongoing notes

| Item | Cost |
|---|---|
| Render free tier (frontend static + backend) | $0 — backend sleeps after 15 min idle |
| Render Starter (recommended for production) | $7/month (no sleep) |
| Stripe per transaction | 2.9% + $0.30 |
| PayPal per transaction | 3.49% + $0.49 (US) |
| Domain (already at Wix) | whatever the client pays Wix annually |
| Wix hosting | **You can downgrade to "domain only" — the client doesn't need to keep paying for Wix Premium hosting after cutover.** |

The in-memory order store in the example backend will lose orders on every restart. For real use, replace `const orders = new Map()` with SQLite (cheap, file-based) or a managed Postgres on Render (free tier available). Order data is your record of what was bought before payment confirms.

---

## 9. What to send the client

> Hi [client] — your site is live at eyenoon.com. A few things you should bookmark:
>
> - **Stripe dashboard** (cards): https://dashboard.stripe.com — see payments, refund customers, payouts go to your bank.
> - **PayPal dashboard:** https://www.paypal.com/businessmanage — same thing for PayPal payments.
> - **Render dashboard** (the host): https://dashboard.render.com — only needed for technical changes.
>
> Wix: you can downgrade to a domain-only plan (~$15/year vs whatever you're paying now). Don't cancel the domain itself — that's how the site stays reachable.

---

## Appendix: Files I changed in your project

When you implement this, you'll touch:

- `js/checkout-config.js` — set the production API URL
- `js/payment-config.js` — real PayPal.me / Venmo handles
- `server/package.json` — *new*
- `server/index.js` — *new*
- `server/.env` — *new, local only, do not commit*
- `.gitignore` — *new*
