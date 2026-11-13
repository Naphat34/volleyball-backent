# Team-specific roster locks

Automatic competition rosters freeze independently for each team. A scheduled match
uses a team's roster when its own saved setup contains players, or its own team ID
appears in a lineup, action, or event. The opponent's setup and lineup do not freeze
an empty side. Match history is scoped to the entry's age category.

Registration closure, the competition start date, and a match leaving `scheduled`
still freeze applicable rosters. Existing locks remain frozen when registration is
reopened; they are never automatically cleared.

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
