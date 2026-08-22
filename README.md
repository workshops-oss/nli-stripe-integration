# Stripe integration — Nonprofit Leadership Intensive registration

Backend for the three registration fee tiers (Grassroots $149 / Growing $249 /
Established $349), plus a $49 extra-seat add-on. Each tier's Stripe Product
uses its matching icon from the site's brand set. Also accepts the
registration form's full intake — organization details, primary and
secondary contacts.

```
stripe-integration/
├── package.json
├── .env.example          copy to .env and fill in your keys
├── setup-products.js     run once — creates Products & Prices in Stripe
├── server.js             Express server — creates Checkout Sessions
├── public/icons/         the three tier icons (also used as product images)
├── registrations.log     created at runtime — one JSON line per
│                         submission (NOT committed to git)
└── README.md
```

## 1. Install

```bash
cd stripe-integration
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` — from
  [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys).
  Use the `sk_test_…` / `pk_test_…` keys while building; switch to live
  keys only when you're ready to accept real payments.
- `SUCCESS_URL` / `CANCEL_URL` — where Stripe sends people back to
  afterward. Point these at your deployed site once it's live.

## 2. Give the icons a public URL (optional but recommended)

Stripe's API can only use images that are already publicly reachable over
HTTPS — it can't read files off your computer. To have each tier show its
icon on the Stripe-hosted checkout page:

1. Upload the three files in `public/icons/` somewhere public — your own
   site (e.g. `oversightmanagement.com/icons/…`), GitHub Pages, S3, or any
   CDN all work.
2. Set `ICON_BASE_URL` in `.env` to that folder's URL.

If you'd rather skip this for now, leave `ICON_BASE_URL` blank — the
products will be created without images, and you can attach each icon
later by opening the product in the Stripe Dashboard and uploading it
directly (Products → select product → Edit → Image).

## 3. Create the Products & Prices (run once)

```bash
npm run setup-products
```

This creates three one-time Prices ($149 / $249 / $349) plus the $49
extra-seat Price, and writes their IDs to `price-ids.json`. Re-run this
only if you need to change a price — Stripe Prices are immutable, so
changing an amount means creating a new Price (the script always makes
new ones; it won't edit existing Prices).

## 4. Run the server

```bash
npm start
```

This starts the Checkout endpoint at `http://localhost:4242`.

## 5. Wire it into the registration form

The site's registration form (`index.html`) already calls this endpoint —
look for `CHECKOUT_ENDPOINT` near the bottom of the file's `<script>` block.
It currently points at `http://localhost:4242/create-checkout-session` for
local testing; update it to your deployed server's URL before going live.

On submit, the form POSTs the selected tier, seat count, and organization
info as JSON, then redirects the browser to the Stripe Checkout URL that
comes back. Card details are entered on Stripe's own hosted page — they
never pass through your server, so you stay out of PCI scope.

## Endpoint reference

**POST `/create-checkout-session`**

Content type: `application/json`.

| Field | Required | Notes |
|---|---|---|
| `tier` | yes | `grassroots`, `growing`, or `established` |
| `attendees` | yes | total seat count; beyond the 2 included, each extra is billed at $49 |
| `orgName` | recommended | |
| `ein` | | |
| `orgType` | | |
| `mission` | | |
| `address1`, `city`, `state`, `zip` | | |
| `website` | | |
| `contactName`, `role`, `email`, `phone` | `email` recommended | primary contact |
| `contact2Name`, `contact2Email`, `contact2Phone` | | optional secondary/backup contact |

Returns:
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_..." }
```

On success, the full submission is appended as one line to
`registrations.log`. Only a short summary (name, EIN, contact) is attached
to the Stripe Checkout Session's metadata, since Stripe metadata fields are
capped in both count and length.

## Going live

- Swap the `sk_test_…` / `pk_test_…` keys for live keys.
- Re-run `npm run setup-products` in **live mode** (Stripe test and live
  data are entirely separate — test-mode Products/Prices don't carry over).
- Deploy `server.js` somewhere reachable over HTTPS (Render, Fly.io,
  Railway, a VPS, etc.) and update `CHECKOUT_ENDPOINT` in `index.html`
  and `SUCCESS_URL` / `CANCEL_URL` in `.env` to match.
- Consider adding a Stripe webhook (`checkout.session.completed`) if you
  want to trigger your own confirmation email or save the registration
  to a database the moment payment succeeds, rather than relying only on
  the success-page redirect.
- **Move `registrations.log` to a real database** once you're past
  testing — a flat file works for checking a handful of signups by hand,
  but doesn't scale and has no query/backup story of its own.
- Never commit `registrations.log` to version control — it contains
  personal information. It's already in `.gitignore`.
