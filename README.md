# Stripe integration — Nonprofit Leadership Intensive registration

Backend for the three registration fee tiers (Grassroots $149 / Growing $249 /
Established $349), plus a $49 extra-seat add-on. Each tier's Stripe Product
uses its matching icon from the site's brand set. Also accepts the
registration form's full intake — organization details, primary and
secondary contacts — and sends an automatic confirmation email once
payment actually succeeds.

```
stripe-integration/
├── package.json
├── .env.example          copy to .env and fill in your keys
├── setup-products.js     run once — creates Products & Prices in Stripe
├── server.js             Express server — creates Checkout Sessions,
│                         handles the post-payment webhook
├── email-template.js     the confirmation email's subject + HTML
├── google-sheets.js      appends each registration to a Google Sheet
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

**POST `/webhook/stripe`**

Called by Stripe itself, not by the front end — see "Confirmation emails"
below for how to set this up. Verifies the request is genuinely from
Stripe (using `STRIPE_WEBHOOK_SECRET`), then sends the confirmation email
when the event type is `checkout.session.completed`.

## Confirmation emails

Once someone completes payment, the server automatically emails them a
confirmation — organization name, tier, seat count, event dates/times, and
a note about Zoom. This does **not** fire from the browser reaching the
`/success` page (that's not reliable — someone could close the tab a
second after paying, before that page even loads). Instead, it fires from
a **Stripe webhook**: Stripe calls your server directly, server-to-server,
the moment it confirms payment actually went through.

Two things to set up before this works:

**1. Get a Resend API key and verify a sending domain.**
Sign up free at [resend.com](https://resend.com) (3,000 emails/month,
free permanently — plenty for this). In the Resend dashboard, add
`oversightmanagement.com` (or whichever domain the `from` address in
`email-template.js` uses) under **Domains**, and add the DNS records
Resend gives you (SPF/DKIM, usually 2–3 TXT/CNAME records). Until that
domain is verified, Resend will only let you send test emails to your
own account's email address — not to real registrants. Once verified,
copy your API key from **API Keys** into `RESEND_API_KEY` in `.env`.

**2. Add a Stripe webhook pointing at your deployed server.**
In the [Stripe Dashboard](https://dashboard.stripe.com/webhooks), click
**Add endpoint**. For the URL, use your real deployed server's address
plus `/webhook/stripe` — e.g.
`https://nli-stripe-integration.onrender.com/webhook/stripe`. This **only works
once the server is actually deployed somewhere public** — Stripe can't
reach a `localhost` address, so this step has to wait until after you've
deployed (see "Going live" below). For the event to listen for, select
**`checkout.session.completed`**. Once created, Stripe shows you a
**Signing secret** starting with `whsec_...` — copy that into
`STRIPE_WEBHOOK_SECRET` in `.env`.

Without either of these set, the server still runs and still takes
payments — it just logs a warning and skips sending the email, rather
than breaking checkout over a missing email setup.

**About the Zoom link:** this project doesn't have a real Zoom link on
file, so the email either includes the standing link you set in
`ZOOM_LINK` (`.env`), or — if that's left blank, the default — tells
people their joining details will be sent separately closer to the
event. That's not a placeholder to feel bad about; sending join links
24–48 hours out rather than at signup is genuinely the more common
practice, both for security and so the link doesn't get buried in
someone's inbox for the six weeks between registering and the event.

**To edit what the email actually says:** everything is in
`email-template.js` — subject line, wording, and the HTML layout — kept
separate from `server.js` so you can adjust the copy without touching
the checkout logic.

## Checkout page branding

By default, Stripe's hosted Checkout page is unbranded. Two ways to fix that.

**Dashboard (no code) —** [dashboard.stripe.com/settings/branding/checkout](https://dashboard.stripe.com/settings/branding/checkout).
Applies to every Checkout session automatically, and is the fastest way
to confirm branding is actually working, independent of whatever's
currently deployed. Use these exact values to match the site:

| Setting | Value |
|---|---|
| Icon/logo | Upload `public/nli-mark.png` (the navy/rose version — **not** `nli-mark-reversed.png`, which is white and made for dark backgrounds; it would be invisible on Checkout's light background) |
| Background color | `#F3F4F6` |
| Button color | `#9B2D3A` |
| Corner style | Pill / fully rounded |
| Font | Closest available match to Public Sans — Inter, if offered |

**Code (`branding_settings` on the Checkout Session, already wired up in
`server.js`) —** same values as above, applied per-session instead of
account-wide. Points the icon at `LOGO_URL` in `.env`, which should be
`nli-mark.png` (not the reversed one) at wherever it's hosted — e.g.
`https://nli-stripe-integration.onrender.com/nli-mark.png` once you've
pushed the file in `public/nli-mark.png` to your repo.

One real limitation, not a bug: Stripe's `font_family` option only
supports a fixed list of about two dozen fonts. Neither Newsreader nor
Public Sans (the site's actual fonts) are on that list. `inter` is set
as the closest match to Public Sans; swap it for `lora` in `server.js`
if you'd rather lean toward the site's serif feel instead.

## Registrant directory (Google Sheets)

Every time a payment actually succeeds (the same `checkout.session.completed`
webhook that triggers the confirmation email), **one row per attendee**
gets appended to a Google Sheet — so a 3-seat registration adds 3 rows,
each with that person's own name and email, alongside the shared
organization/contact context. This exists because Stripe's own dashboard
only shows a limited subset of this data (notably: no secondary contact
email, and no per-attendee email at all), and `registrations.log` on the
server isn't something you can actually browse or share.

**One-time setup, in order:**

1. **Create a Google Cloud project.** At [console.cloud.google.com](https://console.cloud.google.com),
   create a new project (or use an existing one).
2. **Enable the Google Sheets API.** In that project, go to APIs &
   Services → Library, search "Google Sheets API," and enable it.
3. **Create a service account.** APIs & Services → Credentials →
   Create Credentials → Service Account. Give it any name (e.g.
   "nli-registrant-sheet"). No special roles needed.
4. **Generate a key for it.** Open the service account you just made →
   Keys → Add Key → Create new key → JSON. This downloads a `.json`
   file — open it, you need two values from it:
   - `client_email` → this is `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → this is `GOOGLE_PRIVATE_KEY` (paste the whole
     thing, including the `-----BEGIN PRIVATE KEY-----` /
     `-----END PRIVATE KEY-----` lines)
5. **Create the actual Google Sheet.** Make a new spreadsheet, rename
   the first tab to exactly `Registrants` (case-sensitive — this must
   match `SHEET_TAB` in `google-sheets.js`), and paste the column
   headers from `SHEET_HEADERS` in that same file into row 1.
6. **Share the sheet with the service account.** Click Share on the
   spreadsheet, and add the `client_email` address from step 4 as an
   **Editor** — this is the step people most often miss. Without it,
   every append attempt fails with a permissions error, since the
   service account is otherwise a stranger to your sheet.
7. **Copy the Sheet ID.** It's the long string in the sheet's URL,
   between `/d/` and `/edit` — that's `GOOGLE_SHEET_ID`.
8. **Add all three values to Render's environment variables** (not a
   `.env` file — same as every other secret in this project, these go
   in the Render dashboard → your web service → Environment).

Like the email and the branding, this fails gracefully if unconfigured
— checkout and the confirmation email both work fine without it; you
just won't get directory rows until all three variables are set.

## Going live

- Swap the `sk_test_…` / `pk_test_…` keys for live keys.
- Re-run `npm run setup-products` in **live mode** (Stripe test and live
  data are entirely separate — test-mode Products/Prices don't carry over).
- Deploy `server.js` somewhere reachable over HTTPS (Render, Fly.io,
  Railway, a VPS, etc.) and update `CHECKOUT_ENDPOINT` in `index.html`
  and `SUCCESS_URL` / `CANCEL_URL` in `.env` to match.
- **Now that you have a real deployed URL**, go back and finish the two
  "Confirmation emails" setup steps above if you haven't already — the
  Stripe webhook specifically can't be created until this URL exists.
- **Move `registrations.log` to a real database** once you're past
  testing — a flat file works for checking a handful of signups by hand,
  but doesn't scale and has no query/backup story of its own.
- Never commit `registrations.log` to version control — it contains
  personal information. It's already in `.gitignore`.
