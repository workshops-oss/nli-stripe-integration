/**
 * setup-products.js
 * ------------------------------------------------------------------
 * Run this ONCE (per Stripe account / mode) to create the three
 * registration-fee Products in Stripe, each priced by annual budget,
 * plus one "extra seat" add-on Product. Each tier Product uses its
 * matching icon (grassroots / growing / established) as its Stripe
 * product image.
 *
 * IMPORTANT — about the icons:
 * Stripe's Products API only accepts *public HTTPS URLs* for images;
 * it cannot read local files. Before running this script:
 *   1. Upload the three PNGs in /public/icons to somewhere public
 *      (your own site, e.g. https://oversightmanagement.com/icons/…,
 *      or any static host / CDN / S3 bucket / GitHub Pages, etc.)
 *   2. Set ICON_BASE_URL in your .env to that public folder's URL.
 * If you'd rather skip that step for now, just leave ICON_BASE_URL
 * unset — the script will create the products without images, and
 * you can attach the icons later by uploading them directly in the
 * Stripe Dashboard (Product → Edit → Image).
 *
 * Usage:
 *   npm install
 *   cp .env.example .env      # then fill in STRIPE_SECRET_KEY etc.
 *   npm run setup-products
 *
 * Output:
 *   Prints the created Price IDs and writes them to price-ids.json,
 *   which server.js reads at startup.
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY. Copy .env.example to .env and fill it in first.');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const iconBase = process.env.ICON_BASE_URL; // may be undefined — handled below

const TIERS = [
  {
    key: 'grassroots',
    name: 'Grassroots — Nonprofit Leadership Intensive',
    description: 'Registration for both Saturdays. Annual budget under $250K. Includes up to 2 seats, resource docs, and provider referrals on request.',
    unitAmount: 14900, // $149.00, in cents
    icon: 'grassroots-icon-512.png',
  },
  {
    key: 'growing',
    name: 'Growing — Nonprofit Leadership Intensive',
    description: 'Registration for both Saturdays. Annual budget $250K–$1M. Includes up to 2 seats, resource docs, and provider referrals on request.',
    unitAmount: 24900, // $249.00
    icon: 'growing-icon-512.png',
  },
  {
    key: 'established',
    name: 'Established — Nonprofit Leadership Intensive',
    description: 'Registration for both Saturdays. Annual budget over $1M. Includes up to 2 seats, resource docs, and provider referrals on request.',
    unitAmount: 34900, // $349.00
    icon: 'established-icon-512.png',
  },
];

const EXTRA_SEAT = {
  key: 'extra_seat',
  name: 'Additional attendee seat',
  description: 'One extra seat beyond the 2 included with registration.',
  unitAmount: 4900, // $49.00
};

async function upsertProductAndPrice(def) {
  const images = iconBase ? [`${iconBase.replace(/\/$/, '')}/${def.icon}`] : undefined;

  const product = await stripe.products.create({
    name: def.name,
    description: def.description,
    images, // omitted entirely if ICON_BASE_URL isn't set
    metadata: { tier: def.key },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: def.unitAmount,
    currency: 'usd',
    // One-time fee, not a subscription:
    metadata: { tier: def.key },
  });

  console.log(`✔ ${def.name}`);
  console.log(`   product: ${product.id}`);
  console.log(`   price:   ${price.id}${images ? '' : '   (no image set — see note above)'}`);
  return price.id;
}

async function main() {
  console.log('Creating Stripe products & prices...\n');
  if (!iconBase) {
    console.log('⚠ ICON_BASE_URL is not set — creating products without images.');
    console.log('  You can attach icons later in the Stripe Dashboard, or set');
    console.log('  ICON_BASE_URL in .env and re-run this script.\n');
  }

  const priceIds = {};
  for (const tier of TIERS) {
    priceIds[tier.key] = await upsertProductAndPrice(tier);
  }
  priceIds[EXTRA_SEAT.key] = await upsertProductAndPrice(EXTRA_SEAT);

  const outPath = path.join(__dirname, 'price-ids.json');
  fs.writeFileSync(outPath, JSON.stringify(priceIds, null, 2));
  console.log(`\nSaved price IDs to ${outPath}`);
  console.log('server.js will read this file automatically — no further setup needed.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
