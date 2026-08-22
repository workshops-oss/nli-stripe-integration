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

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY. Copy .env.example to .env and fill it in first.');
  process.exit(1);
}

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

const app = express();
app.use(cors());
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
