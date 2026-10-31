/**
 * Korean Hours — Apps Script backend.
 *
 * Paste this into the Log sheet's Apps Script editor (Extensions -> Apps Script),
 * replacing whatever is there, then redeploy:
 *   Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy
 * Saving the script alone does NOT change what the live /exec URL serves.
 *
 * Sheet tab must be named 'Log' with these headers in row 1:
 *   A Date | B Hours | C Note | D Logged | E Type
 *
 * To confirm which code is actually live, open the /exec URL with ?probe=1
 * appended. It returns this version number. If it does not match SCRIPT_VERSION
 * below, the deployment is still serving older code and needs a NEW VERSION.
 */

const SHEET_NAME = 'Log';
const SCRIPT_VERSION = 3;

function doGet(e) {
  if (e && e.parameter && e.parameter.probe === '1') {
    return jsonOut({ version: SCRIPT_VERSION });
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  rows.shift(); // drop the header row
  const out = rows
    .filter(r => r[0] !== '' && r[1] !== '')
    .map(r => ({
      date: asDateString(r[0]),
      hours: Number(r[1]) || 0,
      note: r[2] ? String(r[2]) : '',
      logged: r[3] ? new Date(r[3]).toISOString() : '',
      type: r[4] ? String(r[4]) : ''
    }));
  return jsonOut(out);
}

function doPost(e) {
  const entry = JSON.parse(e.postData.contents);
  const hours = Number(entry.hours);
  if (!entry.date || !isFinite(hours) || hours <= 0 || hours > 24) {
    return jsonOut({ ok: false, error: 'bad entry' });
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  sheet.appendRow([entry.date, hours, entry.note || '', new Date(), entry.type || '']);
  return jsonOut({ ok: true });
}

/**
 * The client needs a plain YYYY-MM-DD. Anything else lands in no chart bucket.
 *
 * Sheets stores column A as a real Date, but Apps Script has been seen to fail
 * BOTH `v instanceof Date` and the duck-type below for those values. When that
 * happens the naive fallback -- String(v).slice(0, 10) -- runs on
 * "Sat Oct 31 2026 00:00:00 GMT-0700" and keeps "Sat Oct 31", silently throwing
 * away the year. So every branch here either formats a real date or re-parses a
 * string that still contains its year; the bare slice is the last resort only.
 */
function asDateString(v) {
  if (v && typeof v.getTime === 'function') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s.slice(0, 10);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
