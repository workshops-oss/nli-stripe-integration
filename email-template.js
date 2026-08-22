/**
 * email-template.js
 * ------------------------------------------------------------------
 * Builds the registration confirmation email — the one sent
 * automatically once payment succeeds (see the webhook handler in
 * server.js). Kept in its own file so the copy can be edited without
 * touching the server logic.
 * ------------------------------------------------------------------
 */

const TIER_LABELS = {
  grassroots: 'Grassroots ($149)',
  growing: 'Growing ($249)',
  established: 'Established ($349)',
};

function buildConfirmationEmail({ orgName, contactName, tier, attendees }) {
  const tierLabel = TIER_LABELS[tier] || tier;

  // If you have a standing/recurring Zoom link, set ZOOM_LINK in your
  // environment variables and it'll be included directly below. If
  // it's not set (the default), the email tells people the link is
  // coming separately instead — which is genuinely the more common
  // practice anyway (sending join links 24–48h out, not at signup,
  // both for security and so the link doesn't get lost in an inbox
  // over several weeks).
  const zoomLink = process.env.ZOOM_LINK || '';
  const zoomBlock = zoomLink
    ? `<p style="margin:0 0 20px;"><strong>Join link:</strong> <a href="${zoomLink}" style="color:#1c3a5e;">${zoomLink}</a><br /><span style="color:#5b6470; font-size:13px;">Same link both Saturdays.</span></p>`
    : `<p style="margin:0 0 20px; color:#5b6470;">Your Zoom joining details will be emailed separately, closer to the event — no action needed from you right now.</p>`;

  const subject = `You're registered — Nonprofit Leadership Intensive`;

  const html = `
  <meta charset="utf-8" />
  <div style="font-family:Arial, Helvetica, sans-serif; max-width:560px; margin:0 auto; color:#20272f;">
    <div style="background-color:#12273f; padding:28px 32px; border-radius:10px 10px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="40" valign="middle" style="padding-right:12px;">
          <!-- Placeholder URL — upload nli-mark-reversed-1024.png to your
               own site/CDN first, then update this src to match. -->
          <img src="https://nli-stripe-integration.onrender.com/nli-mark-reversed.png"
               alt="Oversight Management" width="36" height="36"
               style="display:block; width:36px; height:36px; border:0;" />
        </td>
        <td valign="middle">
          <div style="font-family:Georgia, 'Times New Roman', serif; font-size:18px; font-weight:bold; color:#ffffff;">Oversight Management</div>
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#9fb0c4; margin-top:4px;">Nonprofit Leadership Intensive</div>
        </td>
      </tr></table>
    </div>

    <div style="border:1px solid #e4e7ec; border-top:none; padding:32px; border-radius:0 0 10px 10px;">
      <h1 style="font-family:Georgia, 'Times New Roman', serif; font-size:22px; color:#1c3a5e; margin:0 0 16px;">You're registered! 🎉</h1>

      <p style="font-size:15px; line-height:23px; margin:0 0 20px;">
        Hi ${contactName || 'there'}, thanks for registering <strong>${orgName || 'your organization'}</strong> for the Nonprofit Leadership Intensive. Here's your confirmation.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8ebef; border-radius:10px; margin-bottom:20px;">
        <tr>
          <td style="padding:20px 22px; font-size:14px; line-height:24px;">
            <strong>Organization:</strong> ${orgName || '—'}<br />
            <strong>Fee tier:</strong> ${tierLabel}<br />
            <strong>Seats registered:</strong> ${attendees}<br />
            <strong>Dates:</strong> Saturday, Nov 7 &amp; Saturday, Nov 14, 2026<br />
            <strong>Time:</strong> 9:00 AM – 1:00 PM ET, both days<br />
            <strong>Platform:</strong> Live on Zoom
          </td>
        </tr>
      </table>

      ${zoomBlock}

      <p style="font-size:14px; line-height:22px; color:#5b6470; margin:0 0 20px;">
        You'll also receive resource docs and materials from both sessions, and referrals to capacity-building service providers are available on request.
      </p>

      <p style="font-size:14px; line-height:22px; margin:0;">
        Questions? Just reply to this email, or reach us at
        <a href="mailto:workshops@oversightmanagement.com" style="color:#1c3a5e; font-weight:600;">workshops@oversightmanagement.com</a>.
      </p>
    </div>

    <p style="font-size:11px; color:#9fb0c4; text-align:center; margin-top:20px;">
      Oversight Management · Washington, DC
    </p>
  </div>`;

  return { subject, html };
}

module.exports = { buildConfirmationEmail };
