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
 *          submission
 *        - builds a Stripe Checkout Session
 *        - returns the Checkout URL
 *   4. The front end redirects the browser to Stripe Checkout.
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
const { appendRegistrantRows } = require('./google-sheets');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error(
    'Missing STRIPE_SECRET_KEY. Copy .env.example to .env and fill it in first.'
  );
  process.exit(1);
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    '⚠ STRIPE_WEBHOOK_SECRET is not set — confirmation emails will not fire. See README.md.'
  );
}

if (!process.env.RESEND_API_KEY) {
  console.warn(
    '⚠ RESEND_API_KEY is not set — confirmation emails will not fire. See README.md.'
  );
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PORT = process.env.PORT || 4242;

const INCLUDED_SEATS = 2;

// Price IDs created by setup-products.js
const priceIdsPath = path.join(__dirname, 'price-ids.json');

if (!fs.existsSync(priceIdsPath)) {
  console.error(
    'price-ids.json not found. Run `npm run setup-products` first.'
  );
  process.exit(1);
}

const PRICE_IDS = JSON.parse(
  fs.readFileSync(priceIdsPath, 'utf8')
);

const VALID_TIERS = [
  'grassroots',
  'growing',
  'established'
];

const TIER_LABELS_FOR_SUCCESS = {
  grassroots: 'Grassroots',
  growing: 'Growing',
  established: 'Established'
};


// -----------------------------------------------------------------
// Lightweight durable record of each registration
// -----------------------------------------------------------------

const LOG_PATH = path.join(
  __dirname,
  'registrations.log'
);

function appendRegistrationLog(record) {
  fs.promises
    .appendFile(
      LOG_PATH,
      JSON.stringify(record) + '\n'
    )
    .catch(err =>
      console.error(
        'Failed to write registration log:',
        err.message
      )
    );
}


function findRegistrationBySessionId(sessionId) {
  if (!fs.existsSync(LOG_PATH)) {
    return null;
  }

  const lines = fs
    .readFileSync(LOG_PATH, 'utf8')
    .split('\n')
    .filter(Boolean);

  for (
    let i = lines.length - 1;
    i >= 0;
    i--
  ) {
    try {
      const record = JSON.parse(lines[i]);

      if (record.sessionId === sessionId) {
        return record;
      }

    } catch (e) {
      // Skip malformed lines.
    }
  }

  return null;
}


// -----------------------------------------------------------------
// Confirmation email
// -----------------------------------------------------------------

async function sendConfirmationEmail(
  session,
  attendeesList
) {
  if (!resend) {
    console.warn(
      'Skipping confirmation email — RESEND_API_KEY not configured.'
    );

    return;
  }


  // Send the confirmation to every registered attendee.
  // Fall back to the primary contact for older registrations.
  const attendeeEmails = (attendeesList || [])
    .map(a =>
      String(a?.email || '').trim()
    )
    .filter(Boolean);


  const fallbackEmail = String(
    session.customer_details?.email ||
    session.metadata?.contact_email ||
    ''
  ).trim();


  const toEmails = [
    ...new Set(
      attendeeEmails.length
        ? attendeeEmails
        : (
            fallbackEmail
              ? [fallbackEmail]
              : []
          )
    )
  ];


  if (!toEmails.length) {
    console.error(
      'No recipient email found on session',
      session.id
    );

    return;
  }


  const {
    subject,
    html
  } = buildConfirmationEmail({
    orgName:
      session.metadata?.org_name,

    contactName:
      session.metadata?.contact_name,

    tier:
      session.metadata?.tier,

    attendees:
      session.metadata?.attendees,

    attendeesList
  });


  const result =
    await resend.emails.send({
      from:
        'Oversight Management <workshops@oversightmanagement.com>',

      to: toEmails,

      subject,

      html
    });


  if (result.error) {
    throw new Error(
      `Resend rejected the send: ${
        result.error.message ||
        JSON.stringify(result.error)
      }`
    );
  }
}


// -----------------------------------------------------------------
// Express
// -----------------------------------------------------------------

const app = express();

app.use(cors());


// -----------------------------------------------------------------
// Stripe webhook
// MUST be registered before express.json()
// -----------------------------------------------------------------

app.post(
  '/webhook/stripe',
  express.raw({
    type: 'application/json'
  }),
  async (req, res) => {

    const sig =
      req.headers['stripe-signature'];

    let event;


    try {

      event =
        stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );

    } catch (err) {

      console.error(
        'Webhook signature verification failed:',
        err.message
      );

      return res
        .status(400)
        .send(
          `Webhook Error: ${err.message}`
        );
    }


    if (
      event.type ===
      'checkout.session.completed'
    ) {

      const session =
        event.data.object;

      const m =
        session.metadata || {};


      const fullRecord =
        findRegistrationBySessionId(
          session.id
        );


      let attendeesList = [];


      // New registrations carry the attendee list
      // directly in Stripe metadata.

      if (m.attendees_json) {

        try {

          attendeesList =
            JSON.parse(
              m.attendees_json
            );

        } catch (err) {

          console.error(
            'Could not parse attendees_json from Stripe metadata:',
            err.message
          );
        }
      }


      // Fallback for older registrations.

      if (
        !attendeesList.length &&
        fullRecord?.attendeesList?.length
      ) {

        attendeesList =
          fullRecord.attendeesList;
      }


      console.log(
        `Attendee data found for ${session.id}: ${attendeesList.length} attendee(s)`
      );


      if (
        !fullRecord &&
        !attendeesList.length
      ) {

        console.warn(
          'No matching registration or attendee metadata found for session',
          session.id
        );
      }


      // -------------------------------------------------------------
      // Confirmation email
      // -------------------------------------------------------------

      try {

        await sendConfirmationEmail(
          session,
          attendeesList
        );

      } catch (err) {

        console.error(
          'Confirmation email failed to send:',
          err.message
        );
      }


      // -------------------------------------------------------------
      // Google Sheets
      // -------------------------------------------------------------

      try {

        await appendRegistrantRows({

          sessionId:
            session.id,

          tier:
            m.tier,

          attendees:
            m.attendees,

          orgName:
            m.org_name,

          orgEin:
            m.org_ein,

          orgType:
            m.org_type,

          mission:
            m.mission,

          address1:
            m.address1,

          city:
            m.city,

          state:
            m.state,

          zip:
            m.zip,

          website:
            m.website,

          contactName:
            m.contact_name,

          contactRole:
            m.contact_role,

          contactEmail:
            m.contact_email,

          contactPhone:
            m.contact_phone,

          contact2Name:
            m.contact2_name,

          contact2Email:
            m.contact2_email,

          contact2Phone:
            m.contact2_phone,

          attendeesList
        });

      } catch (err) {

        console.error(
          'Google Sheets rows failed to append:',
          err.message
        );
      }
    }


    res.json({
      received: true
    });
  }
);


app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);


// -----------------------------------------------------------------
// Create Stripe Checkout Session
// -----------------------------------------------------------------

app.post(
  '/create-checkout-session',
  async (req, res) => {

    try {

      const {
        tier,
        attendees,

        orgName,
        ein,
        orgType,
        mission,
        address1,
        city,
        state,
        zip,
        website,

        contactName,
        role,
        email,
        phone,

        contact2Name,
        contact2Email,
        contact2Phone,

        attendeesList

      } = req.body;


      if (
        !VALID_TIERS.includes(tier)
      ) {

        return res
          .status(400)
          .json({
            error:
              `tier must be one of: ${VALID_TIERS.join(', ')}`
          });
      }


      const attendeeCount =
        Math.max(
          1,
          parseInt(attendees, 10) ||
          INCLUDED_SEATS
        );


      const extraSeats =
        Math.max(
          0,
          attendeeCount -
          INCLUDED_SEATS
        );


      const line_items = [

        {
          price:
            PRICE_IDS[tier],

          quantity: 1
        }

      ];


      if (extraSeats > 0) {

        line_items.push({

          price:
            PRICE_IDS.extra_seat,

          quantity:
            extraSeats
        });
      }


      // -------------------------------------------------------------
      // Store attendee list in Stripe metadata when it fits.
      // -------------------------------------------------------------

      const attendeesJson =
        JSON.stringify(
          Array.isArray(attendeesList)
            ? attendeesList
            : []
        );


      const attendeeMetadata =
        attendeesJson.length <= 490
          ? attendeesJson
          : '';


      // -------------------------------------------------------------
      // Create Stripe Checkout Session
      // -------------------------------------------------------------

      const session =
        await stripe.checkout.sessions.create({

          mode: 'payment',

          line_items,

          success_url:
            process.env.SUCCESS_URL ||
            'http://localhost:4242/success?session_id={CHECKOUT_SESSION_ID}',

          cancel_url:
            process.env.CANCEL_URL ||
            'http://localhost:4242/#pricing',


          branding_settings: {

            background_color:
              '#F3F4F6',

            button_color:
              '#9B2D3A',

            border_style:
              'pill',

            font_family:
              'inter',

            icon: {

              type: 'url',

              url:
                process.env.LOGO_URL ||
                'https://nli-stripe-integration.onrender.com/nli-mark.png'
            }
          },


          metadata: {

            attendees_json:
              attendeeMetadata,

            tier,

            attendees:
              String(attendeeCount),

            org_name:
              (orgName || '')
                .slice(0, 480),

            org_ein:
              (ein || '')
                .slice(0, 480),

            org_type:
              (orgType || '')
                .slice(0, 480),

            mission:
              (mission || '')
                .slice(0, 480),

            address1:
              (address1 || '')
                .slice(0, 480),

            city:
              (city || '')
                .slice(0, 480),

            state:
              (state || '')
                .slice(0, 480),

            zip:
              (zip || '')
                .slice(0, 480),

            website:
              (website || '')
                .slice(0, 480),

            contact_name:
              (contactName || '')
                .slice(0, 480),

            contact_role:
              (role || '')
                .slice(0, 480),

            contact_email:
              (email || '')
                .slice(0, 480),

            contact_phone:
              (phone || '')
                .slice(0, 480),

            contact2_name:
              (contact2Name || '')
                .slice(0, 480),

            contact2_email:
              (contact2Email || '')
                .slice(0, 480),

            contact2_phone:
              (contact2Phone || '')
                .slice(0, 480)
          },


          customer_email:
            email || undefined

        });


      // -------------------------------------------------------------
      // Save complete registration record.
      // -------------------------------------------------------------

      appendRegistrationLog({

        sessionId:
          session.id,

        tier,

        attendees:
          attendeeCount,

        attendeesList,

        org: {

          name:
            orgName,

          ein,

          type:
            orgType,

          mission,

          address1,

          city,

          state,

          zip,

          website
        },


        primaryContact: {

          name:
            contactName,

          role,

          email,

          phone
        },


        secondaryContact: {

          name:
            contact2Name,

          email:
            contact2Email,

          phone:
            contact2Phone
        },


        createdAt:
          new Date().toISOString()

      });


      res.json({
        url:
          session.url
      });


    } catch (err) {

      console.error(
        'Checkout session error:',
        err.message
      );

      res
        .status(400)
        .json({
          error:
            err.message ||
            'Could not start checkout. Please try again.'
        });
    }
  }
);


// -----------------------------------------------------------------
// Success page
// -----------------------------------------------------------------

function successPage({
  heading,
  lines,
  isError
}) {

  return `
    <!doctype html>

    <html>

    <head>

      <meta charset="UTF-8" />

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
      />

      <title>
        ${
          isError
            ? 'Registration status'
            : "You're registered"
        }
        — Nonprofit Leadership Intensive
      </title>

    </head>


    <body
      style="
        margin:0;
        padding:0;
        background-color:#F3F4F6;
        font-family:Arial, Helvetica, sans-serif;
      "
    >

      <div
        style="
          max-width:480px;
          margin:80px auto;
          background:#ffffff;
          border-radius:10px;
          box-shadow:0 4px 20px rgba(28,58,94,0.08);
          overflow:hidden;
        "
      >

        <div
          style="
            background-color:#12273F;
            padding:28px 32px;
          "
        >

          <div
            style="
              font-family:Georgia, 'Times New Roman', serif;
              font-size:18px;
              font-weight:bold;
              color:#ffffff;
            "
          >
            Oversight Management
          </div>


          <div
            style="
              font-size:11px;
              letter-spacing:2px;
              text-transform:uppercase;
              color:#9fb0c4;
              margin-top:4px;
            "
          >
            Nonprofit Leadership Intensive
          </div>

        </div>


        <div
          style="
            padding:36px 32px;
            text-align:center;
          "
        >

          <h1
            style="
              font-family:Georgia, 'Times New Roman', serif;
              font-size:24px;
              color:${
                isError
                  ? '#9b2d3a'
                  : '#1c3a5e'
              };
              margin:0 0 16px;
            "
          >
            ${heading}
          </h1>


          ${
            lines
              .map(
                l => `
                  <p
                    style="
                      font-size:15px;
                      line-height:24px;
                      color:${
                        l.muted
                          ? '#5b6470'
                          : '#20272f'
                      };
                      margin:0 0 8px;
                    "
                  >
                    ${l.text}
                  </p>
                `
              )
              .join('')
          }

        </div>

      </div>

    </body>

    </html>
  `;
}


// -----------------------------------------------------------------
// Stripe success verification
// -----------------------------------------------------------------

app.get(
  '/success',
  async (req, res) => {

    const sessionId =
      req.query.session_id;


    // No session ID.
    if (!sessionId) {

      return res
        .status(400)
        .send(
          successPage({

            heading:
              "We can't confirm a registration here.",

            isError:
              true,

            lines: [

              {
                text:
                  "This page didn't receive a valid session — if you just completed checkout, please check your email for confirmation instead."
              },

              {
                text:
                  "Still not sure? Email workshops@oversightmanagement.com and we'll look into it.",

                muted:
                  true
              }

            ]

          })
        );
    }


    try {

      // Ask Stripe directly whether this
      // specific session was actually paid.

      const session =
        await stripe.checkout.sessions.retrieve(
          sessionId
        );


      if (
        session.payment_status !== 'paid'
      ) {

        return res
          .status(200)
          .send(
            successPage({

              heading:
                'Payment not yet complete.',

              isError:
                true,

              lines: [

                {
                  text:
                    `Status: ${session.payment_status}. If you completed payment and are seeing this, please email workshops@oversightmanagement.com with this reference:`
                },

                {
                  text:
                    sessionId,

                  muted:
                    true
                }

              ]

            })
          );
      }


      const orgName =
        session.metadata?.org_name ||
        'your organization';


      const tierLabel =
        TIER_LABELS_FOR_SUCCESS[
          session.metadata?.tier
        ] ||
        session.metadata?.tier ||
        '';


      const amount =
        typeof session.amount_total === 'number'

          ? `$${(
              session.amount_total /
              100
            ).toFixed(2)}`

          : '';


      res.send(
        successPage({

          heading:
            'You have registered.',

          lines: [

            {
              text:
                `<strong>${orgName}</strong> is confirmed for the Nonprofit Leadership Intensive${
                  tierLabel
                    ? ` — ${tierLabel} tier`
                    : ''
                }${
                  amount
                    ? `, ${amount} paid`
                    : ''
                }.`
            },

            {
              text:
                'A receipt has been emailed to you.',

              muted:
                true
            },

            {
              text:
                'Looking forward to seeing you at the Nonprofit Leadership Intensive.',

              muted:
                true
            }

          ]

        })
      );


    } catch (err) {

      console.error(
        'Could not verify checkout session on /success:',
        err.message
      );


      res
        .status(500)
        .send(
          successPage({

            heading:
              "We couldn't verify this registration.",

            isError:
              true,

            lines: [

              {
                text:
                  'If you just completed payment, please check your email for confirmation — your registration may still have gone through.'
              },

              {
                text:
                  "If you don't receive one shortly, email workshops@oversightmanagement.com for help.",

                muted:
                  true
              }

            ]

          })
        );
    }
  }
);


// -----------------------------------------------------------------
// JSON error handler
// -----------------------------------------------------------------

app.use(
  (err, req, res, next) => {

    if (err) {

      return res
        .status(400)
        .json({
          error:
            err.message ||
            'Something went wrong.'
        });
    }

    next();
  }
);


// -----------------------------------------------------------------
// Start server
// -----------------------------------------------------------------

app.listen(
  PORT,
  () => {

    console.log(
      `Checkout server running at http://localhost:${PORT}`
    );

  }
);
