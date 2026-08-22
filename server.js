/**
 * server.js
 * ------------------------------------------------------------------
 * Backend for the registration form: builds a Stripe Checkout Session
 * from the selected tier + seat count, and captures the organization's
 * full intake info.
 *
 * Flow:
 *   1. Person fills out the registration form on the site — org info,
 *      contacts, fee tier, and seat count.
 *   2. The front end POSTs all of that as JSON to
 *      /create-checkout-session.
 *   3. This server:
 *        - writes one line to registrations.log recording the full
 *          submission (a lightweight durable record, since this
 *          project doesn't include a database)
 *        - builds a Stripe Checkout Session — the tier's price as one
 *          line item, plus the $49 extra-seat price repeated for
 *          every seat beyond the 2 included — with the org/contact
 *          details attached as session metadata
 *        - returns the Checkout URL
 *   4. The front end redirects the browser to that URL. Stripe hosts
 *      the actual payment page, so card data never touches this
 *      server (keeps you out of PCI scope).
 *
 * Run:
 *   npm install
 *   npm run setup-products     # once, to create Products/Prices
 *   npm start
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { Resend } = require('resend');
const { buildConfirmationEmail } = require('./email-template');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY. Copy .env.example to .env and fill it in first.');
  process.exit(1);
}

// These two are needed specifically for the confirmation-email feature.
// They're checked softly (a warning, not a crash) so the server still
// runs and takes payments even before email sending is fully set up —
// see README.md "Confirmation emails" for how to get both values.
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠ STRIPE_WEBHOOK_SECRET is not set — confirmation emails will not fire. See README.md.');
}
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠ RESEND_API_KEY is not set — confirmation emails will not fire. See README.md.');
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 4242;
const INCLUDED_SEATS = 2; // matches the site's registration copy

// Price IDs created by setup-products.js
const priceIdsPath = path.join(__dirname, 'price-ids.json');
if (!fs.existsSync(priceIdsPath)) {
  console.error('price-ids.json not found. Run `npm run setup-products` first.');
  process.exit(1);
}
const PRICE_IDS = JSON.parse(fs.readFileSync(priceIdsPath, 'utf8'));
const VALID_TIERS = ['grassroots', 'growing', 'established'];

// -----------------------------------------------------------------
// Lightweight durable record of each registration
// -----------------------------------------------------------------
// This project doesn't include a database. Each submission gets one
// JSON line appended here, so nothing is lost even though Stripe's
// metadata alone (limited field count / length) isn't a real record
// store. Swap this for a proper database when you're ready to scale
// past "one small team checking a log file."
const LOG_PATH = path.join(__dirname, 'registrations.log');
function appendRegistrationLog(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
}

// -----------------------------------------------------------------
// Confirmation email — fires from the webhook above once Stripe
// confirms payment actually succeeded (not from the browser reaching
// the /success page, which isn't a reliable signal on its own).
// -----------------------------------------------------------------
async function sendConfirmationEmail(session) {
  if (!resend) {
    console.warn('Skipping confirmation email — RESEND_API_KEY not configured.');
    return;
  }
  const toEmail = session.customer_details?.email || session.metadata?.contact_email;
  if (!toEmail) {
    console.error('No recipient email found on session', session.id);
    return;
  }

  const { subject, html } = buildConfirmationEmail({
    orgName: session.metadata?.org_name,
    contactName: session.metadata?.contact_name,
    tier: session.metadata?.tier,
    attendees: session.metadata?.attendees,
  });

  await resend.emails.send({
    // Must be an address on a domain you've verified with Resend —
    // see README.md "Confirmation emails" before this will work.
    from: 'Oversight Management <workshops@oversightmanagement.com>',
    to: toEmail,
    subject,
    html,
  });
}

const app = express();
app.use(cors());

// ---------------------------------------------------------------------
// Stripe webhook — this MUST be registered before express.json() below.
// Stripe signs each webhook request using the exact raw request body;
// verifying that signature requires the untouched bytes, not a
// JSON-parsed object. express.raw() here (route-specific) preserves
// that raw body for this one route; express.json() further down only
// applies to every other route registered after it.
// ---------------------------------------------------------------------
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      await sendConfirmationEmail(session);
    } catch (err) {
      // Don't fail the webhook response over an email problem — Stripe
      // retries webhooks that return non-2xx, and the payment itself
      // already succeeded regardless of whether the email goes out.
      console.error('Confirmation email failed to send:', err.message);
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      tier, attendees,
      orgName, ein, orgType, mission, address1, city, state, zip, website,
      contactName, role, email, phone,
      contact2Name, contact2Email, contact2Phone,
    } = req.body;

    if (!VALID_TIERS.includes(tier)) {
      return res.status(400).json({ error: `tier must be one of: ${VALID_TIERS.join(', ')}` });
    }
    const attendeeCount = Math.max(1, parseInt(attendees, 10) || INCLUDED_SEATS);
    const extraSeats = Math.max(0, attendeeCount - INCLUDED_SEATS);

    const line_items = [
      { price: PRICE_IDS[tier], quantity: 1 },
    ];
    if (extraSeats > 0) {
      line_items.push({ price: PRICE_IDS.extra_seat, quantity: extraSeats });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: process.env.SUCCESS_URL || 'http://localhost:4242/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: process.env.CANCEL_URL || 'http://localhost:4242/#pricing',
      // Matches the site's navy/red palette and pill-shaped buttons.
      // logo/icon point at the same file already hosted in /public —
      // see LOGO_URL note below. font_family is Stripe's closest match
      // to the site's Public Sans; Stripe's font list doesn't include
      // it or Newsreader directly (~24 fixed options only).
      branding_settings: {
        background_color: '#F3F4F6',
        button_color: '#9B2D3A',
        border_style: 'pill',
        font_family: 'inter',
        icon: {
          type: 'url',
          url: process.env.LOGO_URL || 'https://nli-stripe-integration.onrender.com/nli-mark-reversed.png',
        },
      },
      // Stripe metadata values must be short strings — full detail
      // lives in registrations.log via appendRegistrationLog() below.
      // This metadata is just enough to recognize the registration
      // from the Stripe Dashboard at a glance.
      metadata: {
        tier,
        attendees: String(attendeeCount),
        org_name: (orgName || '').slice(0, 480),
        org_ein: (ein || '').slice(0, 480),
        contact_name: (contactName || '').slice(0, 480),
        contact_email: (email || '').slice(0, 480),
      },
      customer_email: email || undefined,
    });

    appendRegistrationLog({
      sessionId: session.id,
      tier,
      attendees: attendeeCount,
      org: { name: orgName, ein, type: orgType, mission, address1, city, state, zip, website },
      primaryContact: { name: contactName, role, email, phone },
      secondaryContact: { name: contact2Name, email: contact2Email, phone: contact2Phone },
      createdAt: new Date().toISOString(),
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    res.status(400).json({ error: err.message || 'Could not start checkout. Please try again.' });
  }
});

// Simple landing page after a successful payment. Swap this for a
// redirect back to your real site's confirmation section if you'd
// rather keep everything on one domain.
app.get('/success', (req, res) => {
  res.send(`
    <!doctype html><html><body style="font-family:sans-serif;max-width:520px;margin:80px auto;text-align:center;">
      <h1 style="color:#1c3a5e;">You're registered 🎉</h1>
      <p>Thank you — a confirmation email is on its way.</p>
    </body></html>
  `);
});

// Clean JSON error responses instead of a raw HTML error page.
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Something went wrong.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Checkout server running at http://localhost:${PORT}`);
});
