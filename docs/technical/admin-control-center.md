# Competition administration: first implementation stage

This stage implements the blueprint's initial navigation and UI foundation.
It does not introduce the proposed new roles, approval states, result reopening,
or database migrations. Existing authorization and scorer workflows remain intact.

## Delivered behavior

- Admin opens on a control center with competition scope, monitoring date in
  Asia/Bangkok, official activity counters and work queues.
- Scope/date preferences are remembered per account and Bangkok calendar day
  in session storage, so returning from fixture management retains context.
- Account approval counts are global and explicitly independent of competition.
- Readiness checks identify missing/same teams, schedule, venue and referee
  assignments. Checks are advisory; they do not start, finish or confirm matches.
- Conflict checks compare identical start dates/times and shared teams or venue
  names. Finished and cancelled records are excluded. Match duration, aliases and
  sub-courts require a future scheduling model and are explicitly not inferred.
- Separate match and VIMS work queues retain the distinction between official
  results and statistics activity. An offline lease is not a pending queue count.
- Fixture links select the related competition and highlight the target row;
  they do not automatically edit or save a match. Fixture management now includes
  all competition statuses, allowing historical records to be found.
- Reports hub offers the existing CSV and Excel exports, and links to filtered
  VIMS summaries and match P-2 exports. General exports are not competition-filtered;
  audit exports retain the existing 1,000-entry limit. Exporting does not approve data.
- New UI copy is Thai/English. The shell theme is persisted locally and passed to
  VIMS to avoid competing theme switches. Existing detail screens retain their
  original forms; scoped styles improve their table and surface consistency.
- Previous HomeTab remains available as Competition details. Existing tab keys
  remain valid. Unknown/deprecated saved tabs fall back to the control center.
- The placeholder coaches menu is hidden until a functioning management screen
  is implemented. No inactive permissions/settings menus have been added.

## Data and errors

The control center loads approved admin services for competitions, VIMS snapshot
and pending users. Independent failures retain successful sources and clearly mark
cached data as potentially stale. Unloaded sources display a dash, not a zero.
The last fully successful refresh is shown; visible views refresh every 60 seconds.

The VIMS snapshot additionally exposes referee IDs for readiness checks, without
including authentication or offline checkout secrets. Reports now preserve Unicode
CSV via a UTF-8 BOM and neutralize formula-like string values in spreadsheet exports.

## Checks

```
cd client
npm.cmd run test:admin-center
npm.cmd run lint
npm.cmd run build

cd ../backend
npm.cmd run test:admin-center
node --check controllers/reportController.js
node --check utils/adminVisSnapshot.js
```

Browser acceptance should cover both languages/themes, mobile navigation, filtered
queues, fixture targeting, downloads and failure states. Build/unit checks alone
do not prove visual correctness or interaction behavior in an authenticated browser.

## Subsequent stages

1. Complete dedicated coaches/staff administration before restoring that menu.
2. Define and migrate explicit approval/reopening states with conflict handling.
3. Replace role aliases with reviewed assignment-scoped permissions and audit.
4. Add duration-aware court scheduling and full competition readiness validation.
5. Exercise end-to-end user workflows, offline sync, and backup/restore procedures.
