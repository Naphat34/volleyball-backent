# Team-specific roster locks

Team registers remain editable. A competition entry freezes only when a match for
that team and age category has database status `live`. Registration closure,
the competition start date, match setup, lineup approval and explicit roster
confirmation do not freeze entries before Live.

The start-set handler syncs both teams before changing the match to Live, then
freezes their applicable entries. Existing frozen entries remain frozen after
that match completes. A legacy lock with no Live or completed match is cleared
and re-synced during the next team-entry refresh. A deleted/reset match therefore
no longer leaves an unused roster permanently frozen.

The former confirmation button has been removed. The compatibility endpoint
`POST /api/my-team/entries/:entryId/confirm-roster` cannot create a pre-Live lock;
it returns HTTP 409 explaining the Live requirement, or the already locked entry.

Lineup saves keep names and jersey numbers in `match_lineups.player_positions`
using a versioned snapshot. Lineup reads prefer that snapshot so later team-register
or competition-roster edits cannot rewrite the accepted six. Existing lineup rows
without snapshots retain their legacy fallback; their original metadata cannot be
reconstructed automatically.

The roster editor can fill an empty scheduled-match side from its competition roster.
Nonempty saved rosters and official scoresheet snapshots keep their existing behavior.

To repair an empty legacy lock, inspect one entry first:

```powershell
cd backend
node scripts/repairUnusedEntryRoster.js --entry-id=86
node scripts/repairUnusedEntryRoster.js --entry-id=86 --apply
```

The repair requires an empty locked entry, open registration, a future start date,
and no match history belonging to that team. It rolls back if roster validation
fails or no eligible athletes can be registered. It leaves match setups and lineups
unchanged. Restart the backend with the corrected lock logic before reopening the UI.

Verification:

```powershell
node --test tests/automaticEntryRoster.test.js tests/matchSettings.test.js tests/teamRosterLock.postgres.test.js
```

The PostgreSQL integration test uses an isolated local PGlite database by default.
