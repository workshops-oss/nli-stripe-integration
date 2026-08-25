/**
 * google-sheets.js
 * ------------------------------------------------------------------
 * Appends one row PER ATTENDEE to a Google Sheet, every time a
 * registration's payment completes — so every individual person has
 * their own row, with their own email, not just a name buried in a
 * shared text list. Org and contact details repeat across each
 * attendee's row from the same registration. Called from the webhook
 * handler in server.js, alongside the confirmation email, every time
 * checkout.session.completed fires.
 *
 * Requires a Google Cloud service account with access to the target
 * sheet — see README.md "Registrant directory (Google Sheets)" for the
 * full one-time setup. Without it configured, this silently no-ops
 * (logs a warning) rather than breaking checkout or the email.
 * ------------------------------------------------------------------
 */

const { google } = require('googleapis');
// Temporary startup diagnostic
const crypto = require('crypto');

const startupPrivateKey = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : '';

if (startupPrivateKey) {
  try {
    crypto.createPrivateKey({
      key: startupPrivateKey,
      format: 'pem',
      type: 'pkcs8',
    });

    console.log('GOOGLE_PRIVATE_KEY STARTUP TEST: OK');
  } catch (error) {
    console.error(
      'GOOGLE_PRIVATE_KEY STARTUP TEST: FAILED —',
      error.message
    );
  }
} else {
  console.warn('GOOGLE_PRIVATE_KEY STARTUP TEST: MISSING');
}

const SHEET_TAB = 'Registrants';
// Must match the number/order of columns in the row below.
const SHEET_RANGE = `${SHEET_TAB}!A:V`;

async function appendRegistrantRows(record) {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    console.warn('Skipping Google Sheets rows — Google Sheets env vars not configured.');
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

  const timestamp = new Date().toISOString();
  const sharedFields = [
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
  ];

  // One row per named attendee. If for some reason no attendee list
  // came through (e.g. a registration from before this field existed),
  // fall back to a single row with blank attendee name/email — so the
  // registration itself is never silently missing from the directory.
  const attendeesList = (record.attendeesList || []).filter(a => a && (a.name || a.email));
  const rowsToWrite = attendeesList.length ? attendeesList : [{ name: '', email: '' }];

  const values = rowsToWrite.map((attendee, i) => [
    timestamp,
    `${i + 1} of ${rowsToWrite.length}`,
    ...sharedFields,
    attendee.name || '',
    attendee.email || '',
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

// Column headers, in the same order as the row above — paste these
// into row 1 of the "Registrants" tab once, so the sheet is
// self-explanatory to anyone who opens it later.
const SHEET_HEADERS = [
  'Timestamp', 'Seat', 'Stripe Session ID', 'Tier', 'Attendees', 'Organization',
  'EIN', 'Org Type', 'Mission', 'Address', 'City', 'State', 'ZIP', 'Website',
  'Primary Contact Name', 'Primary Contact Role', 'Primary Contact Email', 'Primary Contact Phone',
  'Secondary Contact Name', 'Secondary Contact Email', 'Secondary Contact Phone',
  'Attendee Name', 'Attendee Email',
];

module.exports = { appendRegistrantRows, SHEET_HEADERS };
