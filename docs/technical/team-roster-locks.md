# Team-specific roster locks

Team registers remain editable. Competition rosters sync until registration closes
(`competitions.status` leaves `open`) or the team explicitly confirms its roster.
Match setup, match history, lineup acceptance, and the competition start date do
not automatically freeze the competition roster.

The team dashboard roster dialog provides **Confirm competition roster**. Its
`POST /api/my-team/entries/:entryId/confirm-roster` endpoint verifies ownership,
syncs the latest eligible athletes, rejects validation errors or fewer than six
players, and freezes the entry atomically. Repeated confirmation is idempotent.
Existing locks remain frozen when registration reopens and are not cleared by
this policy change; legacy locks need a separate reviewed repair.

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
