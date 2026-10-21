# Standalone VIS matches

## Setup

Run `npm.cmd install` in client and `node scripts/migrateCustomVis.js` in backend. This installs only additive migration 32, without running older pending migrations. Restart Express after deploying the routes. ExcelJS loads only when importing or downloading a roster template.

## Workflow

1. Open `/adminvis`, select **สร้างแมตช์ VIS**. Enter title, date/time, location and best-of-3/best-of-5 format.
2. Enter team names. Copy rosters from an accessible previous match, upload `.xlsx`, or paste a tab-separated Excel table with headers.
3. Review the roster and save a private draft, or save and open the scorer. Select P1-P6, first server and court side.
4. Record rallies. On completion, review statistics and Undo if necessary, then select **ตรวจสอบแล้ว · ยืนยันผล**.
5. From **จัดการ / เผยแพร่**, explicitly enable publication. Public data includes team names, athlete names/jerseys, scores and scoring statistics. Switch publication off to revoke access. The viewer refreshes every 3 seconds and clears revoked data.
6. Confirmed results are read-only. The owner or administrator can reopen them for review. Cancellation retains history and disables publication.

Excel columns: `number`, `first_name`, `last_name`, optional `position`, optional `captain`. Thai headers are supported. Positions: S/OH/MB/OPP/OP/L. Captain: 1/true/yes/C. Maximum 30 players per team, one captain. Duplicate/invalid jerseys or missing names are rejected. `.xlsx` only, maximum 5 MB. Formula, hyperlink and rich-text cells are rejected. Template worksheets: `home`, `away`.

## Boundaries

`custom_vis_matches` stores owner, random public token, publication flag and a JSON snapshot of teams, roster, lineups, events, operations and lifecycle. No official match, master team/player, competition standing or public competition-statistics record is changed. Authenticated endpoints check active account, scoring permission and owner/admin access. The public endpoint returns a whitelist, never the owner, operations or private snapshot.

Match creation/scoring retries are idempotent. Score changes use a transaction, row lock, revision and context checks. Each rally awards one point, rotates only on side-out, and Undo removes the entire rally. Existing VIS JSON/PDF exports support custom matches; their scoring source is `custom-vis`.

## Checks

Client: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:unit`.
Backend: `node --test tests/customVis.test.js tests/customVisController.test.js`.
MySQL integration: set `RUN_MYSQL_CUSTOM_VIS_TESTS=1` and run `node --test tests/customVis.mysql.test.js`. Uses a temporary table, without persisting sample matches.

Manual check: create/import/reload a draft, start, score/Undo, export PDF, publish and open in an unsigned browser, unpublish and verify access disappears, finish two sets in best-of-3, confirm and reopen.

## Dashboard and backup files

The dashboard provides a dark table with search, competition/status/team filters, sortable columns and 10/25/50-row pagination. Settings, statistics, PDF and JSON export are available per match. Thai/English follow the existing language context; Mongolian is shown as unavailable rather than displaying untranslated controls as a supported locale. No offline recording period is advertised.

JSON backup exports use `format: volley-vis`, version 1, with a native `backup` containing the configuration, initial set lineups and VIS actions. Import replays supported rally/control events into a new private custom match; it does not trust stored score snapshots, original ownership, publication settings or confirmed status. Completed imports await review. Legacy single-event VIS files without rally IDs are rejected. `.seava` is accepted only when its contents use this JSON backup format; proprietary files from other applications are not automatically compatible. Web-file loading uses HTTPS with omitted credentials and requires the origin to permit CORS.
