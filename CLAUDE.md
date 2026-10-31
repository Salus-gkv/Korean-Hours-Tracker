# Korean Hours (Korean-Hours-Tracker)

Single-page app for logging Korean study sessions. Sessions are typed in MINUTES and stored as
decimal hours; the Trends screen buckets those hours by day/week/fortnight/month.
Static site on GitHub Pages, no login, one user (Grace).
Meant to be "Added to Home Screen" on iOS for a ~2-tap logging flow.

- Live: https://salus-gkv.github.io/Korean-Hours-Tracker/
- Repo: github.com/Salus-gkv/Korean-Hours-Tracker. Pages serves from the root of `main`,
  no build step and no CI. Pushing to `main` redeploys.
- Sibling app, same architecture and palette: R-Weight-Tracker (~/Documents/Claude/R-Weight-Tracker).

## Files (repo root)
- `index.html`: the whole app (HTML/CSS/JS, no framework). Chart.js 4.4.1 from cdnjs, the only dependency.
- `manifest.json`: PWA manifest.
- `favicon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`: 한 glyph, paper-white on the accent-green tile, no other ornament.
- `icon-source.svg`: the source the PNGs were rendered from. To regenerate:
  `qlmanage -t -s 512 -o . icon-source.svg` then `sips -z <n> <n> ... --out <file>`.
- `apps-script.gs`: a copy of the backend code, kept here for reference. The live copy lives in
  Grace's Google account and is NOT deployed from this repo.

## Data backend: Google Sheet via Apps Script
- Sheet tab `Log`, columns: A Date | B Hours | C Note | D Logged | E Type.
- Column E holds ONE OR MORE types, comma-joined in TYPES order, e.g. `Vocab, Speaking`.
  A session is always one row; it is never split into a row per type.
- `const SHEET_URL` at the top of index.html holds the deployed `/exec` URL. The repo is PUBLIC,
  so that URL is public too, and it grants read AND write on the sheet. Grace agreed to this
  tradeoff on 2026-10-31 for free Pages hosting; if the link ever needs revoking, redeploy the
  Apps Script as a new deployment and paste the new URL here.
  - `doGet` returns `[{date, hours, note, logged, type}, ...]`
  - `doPost` takes `{date, hours, note, type}` and ALWAYS appends a row.
- Every save appends. Four sessions in one day are four rows; the Trends screen sums them per day.
  This is the deliberate difference from the Weight Log, where a second save for a date overwrites.
- POSTs from the browser MUST use `Content-Type: text/plain;charset=utf-8`. Any other content type
  triggers a CORS preflight Apps Script does not answer, and the save fails silently.
  Do not "fix" this to `application/json`.
- Only Grace can edit or redeploy the Apps Script (Deploy → Manage deployments → Edit → New version).
  Claude Code cannot. Editing the script alone does not change what the live URL serves.

## Date handling
All dates are built from LOCAL calendar parts. Never call `toISOString()` on a raw `new Date()` to get
a date string — it rolls over at 5 or 7pm Pacific and files evening study under tomorrow.
`dayNumFromISO` compares whole days as UTC midnights, which keeps bucketing DST-safe.
The Weight Log still has the rollover bug; do not copy its `todayStr`.

## The date bug that will come back if asDateString is "simplified"
`doGet` must duck-type the date cell with `typeof v.getTime === 'function'`, NOT `v instanceof Date`.
Apps Script's V8 runtime does not reliably report sheet date values as `instanceof Date`; when that
check fails the fallback `String(v).slice(0, 10)` runs on `Sat Oct 31 2026 00:00:00 GMT-0700` and
keeps `Sat Oct 31` — the YEAR IS GONE. The client then buckets the row nowhere, the chart shows
nothing, and the session list renders `NaN/NaN/`. Caught on the first live write, 2026-10-31.
`loadEntries` now drops non-`YYYY-MM-DD` rows and shows a banner saying how many, so if this ever
recurs it is loud rather than silent. The banner is the symptom; the script is the cause.

The duck-type was seen to fail too, so `asDateString` no longer trusts any single check: it formats
a real date, passes through an already-ISO string, and otherwise RE-PARSES the string (which still
contains its year) before falling back to the bare slice. Never reduce it to one branch.

`doGet` answers `?probe=1` with `{version: SCRIPT_VERSION}`. Curl that before debugging anything
else — if the number is behind `SCRIPT_VERSION` in this repo's apps-script.gs, the deployment is
serving stale code and the only fix is Manage deployments -> Edit -> New version.

## Trends bucketing
- Day = last 30 days, Week = last 12 weeks, 2 Weeks = last 12 fortnights, Month = last 12 calendar months.
- Weeks and fortnights start Monday, anchored on epoch day 4 (1970-01-05 was a Monday), so buckets
  stay stable regardless of when the app is opened.
- Trend line is a 3-bucket simple moving average, partial at the start so the line is continuous.
- Empty buckets render as zero-height bars, not gaps. Seeing the zeros is the point.
- Streak counts consecutive days with at least one entry. If today has nothing logged yet it counts
  back from yesterday, so an alive streak isn't shown as broken before the day's session happens.

## Design tokens (shared with the Weight Log; keep them in sync)
`--ink #1F2A24`, `--paper #F6F4EF`, `--line #D8D2C4`, `--accent #4B6358`, `--accent-dark #37493F`,
`--gold #E7B45A` (trend line only), `--clay #B5654A` (errors only), `--muted #7C7566`.
System font stack, content capped at 480px, cards white with 1px `--line` and 14px radius,
tap targets at least 44px.

## Deliberate choices, don't "fix" without asking
- No login. Anyone with the link can read and write; the link isn't published anywhere.
  Fine for study hours, would not be for health data.
- Every load fetches live from Apps Script, so a cold open takes a second or two on mobile.
  Logging does not wait for the fetch, so only Trends feels it.
- Hours are decimals (1.5), not `1h 30m`. One number per entry, easy to sum.
- Entry is in minutes, storage is in hours. `saveBtn` divides by 60 and rounds to 4 decimals before
  POSTing, so the sheet stays in the decimal hours the Trends screen and the Apps Script expect.
  Typing "45" is less thought after a session than converting to 0.75 in your head.
- `fmtDuration` shows a sub-hour span as "45 min" and anything longer as hours, on the Log screen's
  today line and in the Recent sessions rows only. Charts, stats and the by-type breakdown are
  always hours, so the axis stays comparable across buckets.
- No quick-add hour chips. They were in the original spec and were cut; minutes are typed directly.
- Type chip order is Vocab, Studying, Speaking, and the default when nothing is stored is Studying.
- Type chips are MULTI-select. Picking several means the session counted toward all of them, and the
  by-type breakdown divides that session's hours equally between them (60 min on Vocab + Speaking is
  30 min each). The chart bars, the Total card and the Recent sessions row all still show the whole
  session, so the breakdown sums to the window total rather than double-counting.
- At least one chip is always lit. Clicking the only active chip is a deliberate no-op, which keeps
  an untyped session off the save path without adding an error the two-tap flow would have to clear.
- Selection persists in localStorage `khTypes` (a JSON array). The older single-select key `khType`
  is read once and migrated; it can be deleted from this file once Grace's phone has loaded the app.
- Study type defaults to the last one used (localStorage `khType`), so the usual case is still
  zero extra taps while the column stays populated.
- No weekly goal line and no `% of goal` card. Considered and skipped; add only if asked.

## Known limitation
`autofocus` on the hours field does not reliably raise the iOS keyboard without a user gesture.
That's a WebKit rule, not a bug here. Logging is still two taps.

## Can't be a claude.ai Artifact
Artifact CSP blocks fetch to script.google.com, same as the Weight Log.
