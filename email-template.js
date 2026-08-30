/**
 * email-template.js
 * ------------------------------------------------------------------
 * Builds the registration confirmation email — the one sent
 * automatically once payment succeeds.
 *
 * Updated to use the client's final registration email design while
 * preserving all dynamic registration data:
 * - Organization
 * - Contact
 * - Tier
 * - Seat count
 * - Individual attendee names/emails
 * - Zoom information
 *
 * ------------------------------------------------------------------
 */

const TIER_LABELS = {
  grassroots: 'Grassroots ($149)',
  growing: 'Growing ($249)',
  established: 'Established ($349)',
};


// ------------------------------------------------------------------
// HTML escaping
// ------------------------------------------------------------------
//
// Attendee names, organization names, etc. come from form input.
// Escape them before placing them into email HTML.
// ------------------------------------------------------------------

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ------------------------------------------------------------------
// Confirmation email
// ------------------------------------------------------------------

function buildConfirmationEmail({
  orgName,
  contactName,
  tier,
  attendees,
  attendeesList
}) {

  const safeOrgName =
    escapeHtml(orgName || 'your organization');

  const safeContactName =
    escapeHtml(contactName || 'there');

  const tierLabel =
    escapeHtml(TIER_LABELS[tier] || tier || '—');

  const attendeeCount =
    escapeHtml(attendees || '—');


  // ---------------------------------------------------------------
  // Registered attendees
  // ---------------------------------------------------------------

  const validAttendees =
    (attendeesList || [])
      .filter(
        attendee =>
          attendee &&
          (attendee.name || attendee.email)
      );


  const attendeesBlock =
    validAttendees.length
      ? `
        <tr>
          <td style="padding:28px 32px 4px 32px;" class="pad-mobile">
            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
            >
              <tr>
                <td
                  style="
                    font-family:Arial, Helvetica, sans-serif;
                    font-size:11px;
                    font-weight:bold;
                    letter-spacing:2px;
                    text-transform:uppercase;
                    color:#9b2d3a;
                    padding-bottom:14px;
                  "
                >
                  Registered Attendees
                </td>
              </tr>

              ${validAttendees
                .map(attendee => {

                  const name =
                    escapeHtml(attendee.name || '—');

                  const email =
                    escapeHtml(attendee.email || '—');

                  return `
                    <tr>
                      <td
                        style="
                          font-family:Arial, Helvetica, sans-serif;
                          font-size:14px;
                          line-height:22px;
                          color:#20272f;
                          padding-bottom:8px;
                        "
                      >
                        <strong>${name}</strong>
                        <span style="color:#5b6470;">
                          — ${email}
                        </span>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </table>
          </td>
        </tr>
      `
      : '';


  // ---------------------------------------------------------------
  // Zoom information
  // ---------------------------------------------------------------

  const zoomLink =
    process.env.ZOOM_LINK || '';


  const zoomBlock =
    zoomLink
      ? `
        <tr>
          <td
            style="
              padding:8px 32px 0 32px;
            "
            class="pad-mobile"
          >
            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              style="
                background-color:#f8ebef;
                border-radius:10px;
              "
            >
              <tr>
                <td
                  style="
                    padding:20px 22px;
                    font-family:Arial, Helvetica, sans-serif;
                    font-size:14px;
                    line-height:22px;
                    color:#20272f;
                  "
                >
                  <strong>Zoom</strong><br />

                  <a
                    href="${escapeHtml(zoomLink)}"
                    target="_blank"
                    style="
                      color:#1c3a5e;
                      font-weight:bold;
                      text-decoration:underline;
                    "
                  >
                    Join the Intensive on Zoom
                  </a>

                  <br />

                  <span
                    style="
                      color:#5b6470;
                      font-size:12px;
                    "
                  >
                    Same link both Saturdays.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : `
        <tr>
          <td
            style="
              padding:8px 32px 0 32px;
            "
            class="pad-mobile"
          >
            <p
              style="
                margin:0;
                font-family:Arial, Helvetica, sans-serif;
                font-size:13px;
                line-height:22px;
                color:#5b6470;
              "
            >
              You will receive an email with the Zoom link closer
              to the date of the event, on November 2, 2026.
              Be sure to check your spam folder.
            </p>
          </td>
        </tr>
      `;


  // ---------------------------------------------------------------
  // Subject
  // ---------------------------------------------------------------

  const subject =
    `You're registered for the Nonprofit Leadership Intensive`;


  // ---------------------------------------------------------------
  // Email HTML
  // ---------------------------------------------------------------

  const html = `
<!DOCTYPE html>

<html
  lang="en"
  xmlns="http://www.w3.org/1999/xhtml"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
>

<head>

  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <meta
    http-equiv="X-UA-Compatible"
    content="IE=edge"
  />

  <title>
    Nonprofit Leadership Intensive — Registration Confirmation
  </title>


  <!--[if mso]>

  <noscript>

    <xml>

      <o:OfficeDocumentSettings>

        <o:PixelsPerInch>
          96
        </o:PixelsPerInch>

      </o:OfficeDocumentSettings>

    </xml>

  </noscript>

  <style>

    table {
      border-collapse: collapse;
    }

    td,
    th,
    p,
    span,
    a {
      font-family: Arial, Helvetica, sans-serif;
    }

  </style>

  <![endif]-->


  <style>

    body,
    table,
    td {
      -webkit-text-size-adjust:100%;
      -ms-text-size-adjust:100%;
    }

    body {
      margin:0;
      padding:0;
      width:100% !important;
      background-color:#eef0e7;
    }

    img {
      border:0;
      outline:none;
      text-decoration:none;
      -ms-interpolation-mode:bicubic;
    }

    a {
      text-decoration:none;
    }

    table {
      border-spacing:0;
      mso-table-lspace:0pt;
      mso-table-rspace:0pt;
    }


    @media only screen and (max-width:600px) {

      .email-container {
        width:100% !important;
      }

      .stack-col {
        display:block !important;
        width:100% !important;
        box-sizing:border-box;
      }

      .pad-mobile {
        padding-left:22px !important;
        padding-right:22px !important;
      }

      .tier-cell {
        display:block !important;
        width:100% !important;
        border-right:none !important;
        border-bottom:1px solid #e6e2d6 !important;
      }

      .tier-cell:last-child {
        border-bottom:none !important;
      }

      .h1-mobile {
        font-size:26px !important;
        line-height:32px !important;
      }

    }

  </style>

</head>


<body
  style="
    margin:0;
    padding:0;
    background-color:#eef0e7;
  "
>


  <!-- Preheader -->

  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      mso-hide:all;
      font-size:1px;
      line-height:1px;
      color:#eef0e7;
    "
  >
    You're registered for the Nonprofit Leadership Intensive.
    Two Saturdays. Three pillars.
  </div>


  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="
      background-color:#eef0e7;
    "
  >

    <tr>

      <td
        align="center"
        style="
          padding:32px 16px;
        "
      >


        <table
          role="presentation"
          class="email-container"
          width="600"
          cellpadding="0"
          cellspacing="0"
          style="
            width:600px;
            max-width:600px;
            background-color:#ffffff;
          "
        >


          <!-- =====================================================
               HEADER
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#12273f;
                padding:28px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
              >

                <tr>

                  <td
                    width="44"
                    valign="middle"
                    style="
                      padding-right:12px;
                    "
                  >

                    <!--
                      This image will work once
                      nli-mark-reversed.png exists on Render.
                    -->

                    <img
                      src="https://nli-stripe-integration.onrender.com/nli-mark-reversed.png"
                      alt="Oversight Management"
                      width="40"
                      height="40"
                      style="
                        display:block;
                        width:40px;
                        height:40px;
                        border:0;
                      "
                    />

                  </td>


                  <td valign="middle">

                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                    >

                      <tr>

                        <td
                          style="
                            font-family:Georgia, 'Times New Roman', serif;
                            font-size:19px;
                            font-weight:bold;
                            color:#ffffff;
                            letter-spacing:0.5px;
                          "
                        >
                          OVERSIGHT MANAGEMENT
                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            font-family:Arial, Helvetica, sans-serif;
                            font-size:11px;
                            letter-spacing:2px;
                            text-transform:uppercase;
                            color:#9fb0c4;
                            padding-top:3px;
                          "
                        >
                          Nonprofit Leadership Intensive
                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =====================================================
               HERO
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#12273f;
                padding:8px 32px 40px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
              >

                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:12px;
                      font-weight:bold;
                      letter-spacing:2px;
                      text-transform:uppercase;
                      color:#c94a5b;
                      padding-bottom:14px;
                    "
                  >
                    Registration Confirmed
                  </td>

                </tr>


                <tr>

                  <td
                    class="h1-mobile"
                    style="
                      font-family:Georgia, 'Times New Roman', serif;
                      font-size:30px;
                      line-height:36px;
                      color:#ffffff;
                      font-weight:bold;
                    "
                  >
                    You're
                    <span
                      style="
                        color:#c94a5b;
                        font-style:italic;
                        font-weight:normal;
                      "
                    >
                      registered.
                    </span>
                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:15px;
                      line-height:23px;
                      color:#dce4ee;
                      padding-top:16px;
                    "
                  >
                    Hi ${safeContactName}! Thank you for registering
                    <strong>${safeOrgName}</strong>
                    for the Nonprofit Leadership Intensive.
                    Your registration is confirmed.
                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =====================================================
               REGISTRATION DETAILS
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#ffffff;
                padding:32px 32px 8px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="
                  border:1px solid #e4e7ec;
                  border-radius:10px;
                "
              >

                <tr>

                  <td
                    style="
                      padding:22px 24px 6px 24px;
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:11px;
                      font-weight:bold;
                      letter-spacing:2px;
                      text-transform:uppercase;
                      color:#9b2d3a;
                    "
                  >
                    Your Registration
                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      padding:6px 24px 22px 24px;
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:14px;
                      line-height:25px;
                      color:#20272f;
                    "
                  >

                    <strong>Organization:</strong>
                    ${safeOrgName}
                    <br />

                    <strong>Fee tier:</strong>
                    ${tierLabel}
                    <br />

                    <strong>Seats registered:</strong>
                    ${attendeeCount}
                    <br />

                    <strong>Dates:</strong>
                    Saturday, November 7 &amp;
                    Saturday, November 14, 2026
                    <br />

                    <strong>Time:</strong>
                    9:00 AM – 1:00 PM ET, both days
                    <br />

                    <strong>Platform:</strong>
                    Live on Zoom

                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      border-top:1px solid #e4e7ec;
                      padding:12px 24px 20px 24px;
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:12px;
                      color:#5b6470;
                    "
                  >
                    Two Saturday mornings ·
                    8 hours total
                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =====================================================
               ATTENDEES
          ====================================================== -->

          ${attendeesBlock}


          <!-- =====================================================
               ZOOM
          ====================================================== -->

          ${zoomBlock}


          <!-- =====================================================
               FACILITATORS
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#ffffff;
                padding:28px 32px 4px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
              >

                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:11px;
                      font-weight:bold;
                      letter-spacing:2px;
                      text-transform:uppercase;
                      color:#9b2d3a;
                      padding-bottom:14px;
                    "
                  >
                    Led by Practitioners, Not Just Presenters
                  </td>

                </tr>


                <!-- Malauna -->

                <tr>

                  <td
                    style="
                      padding-bottom:18px;
                    "
                  >

                    <a
                      href="https://www.oversightmanagement.com"
                      target="_blank"
                      rel="noopener"
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:16px;
                        font-weight:bold;
                        color:#1c3a5e;
                        text-decoration:underline;
                      "
                    >
                      Malauna Steele
                    </a>

                    <br />

                    <span
                      style="
                        font-family:Arial, Helvetica, sans-serif;
                        font-size:13px;
                        color:#5b6470;
                        line-height:20px;
                      "
                    >
                      Founding Principal, Oversight Management —
                      over two decades in the nonprofit sector,
                      in roles spanning from global nonprofit
                      accounting to interim executive leadership.
                    </span>

                  </td>

                </tr>


                <!-- Jesse -->

                <tr>

                  <td
                    style="
                      padding-bottom:18px;
                    "
                  >

                    <span
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:16px;
                        font-weight:bold;
                        color:#1c3a5e;
                      "
                    >
                      Jesse Raney Bridges
                    </span>

                    <br />

                    <span
                      style="
                        font-family:Arial, Helvetica, sans-serif;
                        font-size:13px;
                        color:#5b6470;
                        line-height:20px;
                      "
                    >

                      <a
                        href="https://rmpg-jrb.base44.app/"
                        target="_blank"
                        rel="noopener"
                        style="
                          color:#5b6470;
                          text-decoration:underline;
                        "
                      >
                        Systems Strategist
                      </a>

                      &amp; Founder, Good Measure —
                      over 20 years of leadership across philanthropy,
                      higher education and mission-driven companies,
                      turning social impact goals into credible action.

                    </span>

                  </td>

                </tr>


                <!-- Reginald -->

                <tr>

                  <td
                    style="
                      padding-bottom:8px;
                    "
                  >

                    <a
                      href="https://www.thegrantadvisorygrp.com/"
                      target="_blank"
                      rel="noopener"
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:16px;
                        font-weight:bold;
                        color:#1c3a5e;
                        text-decoration:underline;
                      "
                    >
                      Reginald M. Grant
                    </a>

                    <br />

                    <span
                      style="
                        font-family:Arial, Helvetica, sans-serif;
                        font-size:13px;
                        color:#5b6470;
                        line-height:20px;
                      "
                    >
                      Founder &amp; Principal, Grant Advisory Group —
                      a former nonprofit Chief Operating Officer
                      who has built his career helping community-based
                      nonprofits build stronger, more effective boards.
                    </span>

                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =====================================================
               WHAT'S INCLUDED
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#ffffff;
                padding:24px 32px 4px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="
                  background-color:#f8ebef;
                  border-radius:10px;
                "
              >

                <tr>

                  <td
                    style="
                      padding:20px 22px;
                    "
                  >

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                    >

                      <tr>

                        <td
                          style="
                            font-family:Arial, Helvetica, sans-serif;
                            font-size:11px;
                            font-weight:bold;
                            letter-spacing:2px;
                            text-transform:uppercase;
                            color:#9b2d3a;
                            padding-bottom:10px;
                          "
                        >
                          What's Included
                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            font-family:Arial, Helvetica, sans-serif;
                            font-size:13px;
                            line-height:23px;
                            color:#20272f;
                          "
                        >
                          ✓ Both Saturdays, live and interactive on Zoom
                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            font-family:Arial, Helvetica, sans-serif;
                            font-size:13px;
                            line-height:23px;
                            color:#20272f;
                          "
                        >
                          ✓ 2 seats per organization
                          (additional seats $49 each)
                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            font-family:Arial, Helvetica, sans-serif;
                            font-size:13px;
                            line-height:23px;
                            color:#20272f;
                          "
                        >
                          ✓ Resource docs and materials from every session
                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            font-family:Arial, Helvetica, sans-serif;
                            font-size:13px;
                            line-height:23px;
                            color:#20272f;
                          "
                        >
                          ✓ Referrals to capacity-building
                          service providers on request
                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =====================================================
               PRICING
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#ffffff;
                padding:28px 32px 4px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
              >

                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:11px;
                      font-weight:bold;
                      letter-spacing:2px;
                      text-transform:uppercase;
                      color:#9b2d3a;
                      padding-bottom:6px;
                    "
                  >
                    Registration Fees
                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:13px;
                      line-height:20px;
                      color:#5b6470;
                      padding-bottom:16px;
                    "
                  >
                    Priced by annual budget, so cost is never
                    the reason a board goes without training.
                  </td>

                </tr>

              </table>


              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="
                  border:1px solid #e4e7ec;
                  border-radius:10px;
                "
              >

                <tr>


                  <!-- Grassroots -->

                  <td
                    class="tier-cell"
                    width="33%"
                    valign="top"
                    style="
                      padding:20px 18px;
                      border-right:1px solid #e4e7ec;
                    "
                  >

                    <span
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:16px;
                        font-weight:bold;
                        color:#1c3a5e;
                      "
                    >
                      Grassroots
                    </span>

                    <br />

                    <span
                      style="
                        font-family:Arial, Helvetica, sans-serif;
                        font-size:11px;
                        color:#5b6470;
                      "
                    >
                      Under $250K
                    </span>

                    <br /><br />

                    <span
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:26px;
                        font-weight:bold;
                        color:#9b2d3a;
                      "
                    >
                      $149
                    </span>

                  </td>


                  <!-- Growing -->

                  <td
                    class="tier-cell"
                    width="33%"
                    valign="top"
                    style="
                      padding:20px 18px;
                      border-right:1px solid #e4e7ec;
                      background-color:#f8ebef;
                    "
                  >

                    <span
                      style="
                        font-family:Arial, Helvetica, sans-serif;
                        font-size:9px;
                        font-weight:bold;
                        letter-spacing:1px;
                        text-transform:uppercase;
                        color:#ffffff;
                        background-color:#9b2d3a;
                        padding:3px 8px;
                        border-radius:10px;
                      "
                    >
                      Most Common
                    </span>

                    <br /><br />

                    <span
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:16px;
                        font-weight:bold;
                        color:#1c3a5e;
                      "
                    >
                      Growing
                    </span>

                    <br />

                    <span
                      style="
                        font-family:Arial, Helvetica, sans-serif;
                        font-size:11px;
                        color:#5b6470;
                      "
                    >
                      $250K–$1M
                    </span>

                    <br /><br />

                    <span
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:26px;
                        font-weight:bold;
                        color:#9b2d3a;
                      "
                    >
                      $249
                    </span>

                  </td>


                  <!-- Established -->

                  <td
                    class="tier-cell"
                    width="33%"
                    valign="top"
                    style="
                      padding:20px 18px;
                    "
                  >

                    <span
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:16px;
                        font-weight:bold;
                        color:#1c3a5e;
                      "
                    >
                      Established
                    </span>

                    <br />

                    <span
                      style="
                        font-family:Arial, Helvetica, sans-serif;
                        font-size:11px;
                        color:#5b6470;
                      "
                    >
                      Over $1M
                    </span>

                    <br /><br />

                    <span
                      style="
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:26px;
                        font-weight:bold;
                        color:#9b2d3a;
                      "
                    >
                      $349
                    </span>

                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =====================================================
               CONFIRMATION MESSAGE
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#ffffff;
                padding:28px 32px 8px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
              >

                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:14px;
                      line-height:23px;
                      color:#5b6470;
                    "
                  >
                    Your payment has been received successfully.
                    A confirmation receipt has been sent to the
                    registered email address.
                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      padding-top:16px;
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:14px;
                      line-height:23px;
                      color:#5b6470;
                    "
                  >
                    We look forward to seeing you at the
                    Nonprofit Leadership Intensive.
                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =====================================================
               QUESTIONS
          ====================================================== -->

          <tr>

            <td
              align="center"
              style="
                background-color:#ffffff;
                padding:24px 32px 36px 32px;
                font-family:Arial, Helvetica, sans-serif;
                font-size:12px;
                color:#5b6470;
              "
              class="pad-mobile"
            >

              Questions? Reply to this email or write to

              <a
                href="mailto:workshops@oversightmanagement.com"
                style="
                  color:#1c3a5e;
                  font-weight:bold;
                "
              >
                workshops@oversightmanagement.com
              </a>

            </td>

          </tr>


          <!-- =====================================================
               FOOTER
          ====================================================== -->

          <tr>

            <td
              style="
                background-color:#12273f;
                padding:26px 32px;
              "
              class="pad-mobile"
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
              >

                <tr>

                  <td
                    style="
                      font-family:Georgia, 'Times New Roman', serif;
                      font-size:14px;
                      font-weight:bold;
                      color:#ffffff;
                      padding-bottom:4px;
                    "
                  >
                    Oversight Management
                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:11px;
                      line-height:18px;
                      color:#9fb0c4;
                      padding-bottom:14px;
                    "
                  >
                    A woman- and Black-owned firm providing
                    accounting, administrative and capacity-building
                    support to small and mid-size nonprofits serving
                    Black and brown communities.
                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:11px;
                      line-height:18px;
                      color:#6e7f95;
                    "
                  >

                    Washington, DC
                    <br />

                    <a
                      href="https://www.oversightmanagement.com"
                      target="_blank"
                      rel="noopener"
                      style="
                        color:#9fb0c4;
                      "
                    >
                      www.oversightmanagement.com
                    </a>

                  </td>

                </tr>

              </table>

            </td>

          </tr>


        </table>

      </td>

    </tr>

  </table>

</body>

</html>
`;


  return {
    subject,
    html
  };
}


module.exports = {
  buildConfirmationEmail
};
