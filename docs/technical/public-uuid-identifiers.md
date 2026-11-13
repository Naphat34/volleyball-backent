# Public UUID identifiers — phase 1

Migration `003_public_uuid_identifiers.sql` adds `public_id UUID NOT NULL DEFAULT
gen_random_uuid()` with a unique constraint to all 20 application tables whose
primary key is an integer `id`. It backfills existing rows and generates UUIDs on
new inserts. Existing integer PKs/FKs, ID sequences, JWT claims, scoring histories,
JSON snapshots and offline IndexedDB/journals are unchanged.

The four other tables keep their existing identifiers: `custom_vis_matches` already
uses string IDs; `custom_vis_player_links` and `team_competitions` have composite keys;
`scorer_offline_sessions` uses the match ID. This is not a conversion of every PK to
UUID and does not migrate the current frontend/offline identifiers.

## API support

Public competitions, teams, players, staff and matches expose `public_id` alongside
the existing integer `id`. Competition-team results also include
`team_entry_public_id`. Login user metadata and `/api/me` expose the user's UUID;
JWTs continue carrying the internal integer user ID.

These existing public GET routes accept either an integer or the corresponding
entity's UUID in the indicated identifier:

| Route | UUID identifier |
|---|---|
| `/api/public/competitions/:competitionId/teams` | Competition |
| `/api/public/teams/:teamId/players` | Team; optional `competitionId` query filter also accepts a competition UUID |
| `/api/public/players/:id/stats` | Player |
| `/api/public/matches?competitionId=...` | Competition query filter |
| `/api/public/teams/:teamId/staff` | Team |
| `/api/public/statistics/:competitionId` | Competition |

UUIDs are resolved using parameterized SQL before the existing controller executes.
Numeric URLs retain their original path. Invalid formats return 400; unknown UUIDs
return 404. The resolver preserves Express 5 query getters and other query filters.
It does not change authorization rules or make UUIDs a replacement for access checks.

Protected write routes, body foreign keys, Socket.IO room IDs, frontend navigation
and offline payloads continue using integers in this phase. UUID URL resolution
requires the PostgreSQL public-ID migration; the original MySQL fallback has no
UUID mappings. A future frontend/API rollout can adopt these aliases gradually.

## Verified

- Backfilled rows retain integer IDs and password hashes; all original PK/FK
  definitions are unchanged. New inserts generate UUIDs; duplicates and NULL fail.
- Resolver tests cover bound parameters, numeric compatibility, invalid/missing
  UUIDs, table whitelisting and Express 5 query behavior: 4 tests passed.
- PostgreSQL adapter/planner/workflow suite: 16 passed, 2 skipped (live-only checks).
  Login verifies a public UUID is returned while its JWT ID remains integer.
- Full backend suite with `DB_PROVIDER=mysql` for legacy mocks: 191 passed,
  28 pre-existing failures, 15 skipped. Failure names match the recorded baseline;
  no additional failures were introduced.
- Migration applied on Supabase staging. Independent source-snapshot verification
  still passes for all 119 rows across 24 tables, including original password hashes
  and integer sequence state.
- Live HTTP checks compared integer/UUID responses in 9 cases across team players,
  staff, player statistics, competition statistics and match query filters. Results
  matched; malformed IDs returned 400 and unknown UUIDs returned 404.
- All 20 UUID tables were checked live for populated, unique UUIDs. The INT/UUID map
  was saved in the ignored `tmp/data-migration/public-id-map.json` for reference.

Keep public UUID values in future PostgreSQL backups/restores. Regenerating them
would break URLs adopted after this rollout. Do not edit an already applied
migration; use a new numbered migration for future identifier changes.

Commands from `backend`:

```powershell
npm.cmd run test:public-id
npm.cmd run test:postgres
npm.cmd run migrate:postgres:staging
npm.cmd run migrate:data:verify-imported
```
