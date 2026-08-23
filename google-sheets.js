/**
 * google-sheets.js
 * ------------------------------------------------------------------
 * Appends one row per completed (paid) registration to a Google Sheet,
 * so you have a real, searchable, shareable directory of registrants —
 * not just a log file on the server or Stripe's own limited metadata
 * view. Called from the webhook handler in server.js, alongside the
 * confirmation email, every time checkout.session.completed fires.
 *
 * Requires a Google Cloud service account with access to the target
 * sheet — see README.md "Registrant directory (Google Sheets)" for the
 * full one-time setup. Without it configured, this silently no-ops
 * (logs a warning) rather than breaking checkout or the email.
 * ------------------------------------------------------------------
 */

const { google } = require('googleapis');

const SHEET_TAB = 'Registrants';
// Must match the number/order of columns in the row below.
const SHEET_RANGE = `${SHEET_TAB}!A:U`;

async function appendRegistrantRow(record) {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    console.warn('Skipping Google Sheets row — Google Sheets env vars not configured.');
    return;
  }

  // Render (like most hosts) can't store a multi-line PEM key cleanly
  // in a single-line environment variable, so the standard workaround
  // is storing it with literal \n sequences and un-escaping them here.
  const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT(
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });

  const row = [
    new Date().toISOString(),
    record.sessionId || '',
    record.tier || '',
    record.attendees || '',
    record.orgName || '',
    record.orgEin || '',
    record.orgType || '',
    record.mission || '',
    record.address1 || '',
    record.city || '',
    record.state || '',
    record.zip || '',
    record.website || '',
    record.contactName || '',
    record.contactRole || '',
    record.contactEmail || '',
    record.contactPhone || '',
    record.contact2Name || '',
    record.contact2Email || '',
    record.contact2Phone || '',
    record.attendeeNames || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Column headers, in the same order as the row above — paste these
// into row 1 of the "Registrants" tab once, so the sheet is
// self-explanatory to anyone who opens it later.
const SHEET_HEADERS = [
  'Timestamp', 'Stripe Session ID', 'Tier', 'Attendees', 'Organization',
  'EIN', 'Org Type', 'Mission', 'Address', 'City', 'State', 'ZIP', 'Website',
  'Primary Contact Name', 'Primary Contact Role', 'Primary Contact Email', 'Primary Contact Phone',
  'Secondary Contact Name', 'Secondary Contact Email', 'Secondary Contact Phone',
  'Attendee Names',
];

module.exports = { appendRegistrantRow, SHEET_HEADERS };
