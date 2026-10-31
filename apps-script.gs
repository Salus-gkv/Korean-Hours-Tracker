/**
 * Korean Hours — Apps Script backend.
 *
 * Paste this into the Log sheet's Apps Script editor (Extensions -> Apps Script),
 * replacing whatever is there, then Deploy -> New deployment -> Web app,
 * Execute as: Me, Who has access: Anyone with the link.
 *
 * Sheet tab must be named 'Log' with these headers in row 1:
 *   A Date | B Hours | C Note | D Logged | E Type
 *
 * After ANY edit here: Deploy -> Manage deployments -> Edit -> New version.
 * Editing the code alone does not change what the live /exec URL serves.
 */

const SHEET_NAME = 'Log';

function doGet() {
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

function asDateString(v) {
  // Sheets stores the date cell as a real Date, but Apps Script's V8 runtime does
  // not reliably report those values as `instanceof Date`. When that check failed,
  // the fallback ran on "Sat Oct 31 2026 ..." and sliced off the YEAR, so every row
  // came back as "Sat Oct 31" and the client dropped it from every chart bucket.
  // Duck-type instead; it holds whichever way the runtime reports the value.
  if (v && typeof v.getTime === 'function') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).slice(0, 10);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
