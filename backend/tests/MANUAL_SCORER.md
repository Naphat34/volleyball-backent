# Manual Scorer matches

Apply migration `34_add_manual_scorer_matches.sql` with the normal migration
workflow before starting the updated backend. The migration adds nullable manual
metadata to matches and a marker for private team copies. Existing competition
matches are unchanged.

On `/adminscorer`, choose **สร้างแมตช์เอง**. Enter match information, rules and team
names, then add players or copy a roster from an already fetched match. Copies
belong only to this match; the source roster and competition entries are untouched.

- Drafts may have empty rosters. Ready matches need at least six non-libero
  players and exactly one captain per side, at most two liberos and unique jersey
  numbers (1–999). Names and colors are validated on the server.
- Rules support best of three/five, regular/deciding set targets and Challenge.
  All sets require a two-point margin. Deciding-set side changes occur at half
  the configured target, rounded up.
- Metadata/roster editing from the dashboard stops when the toss is recorded or
  play starts. In-console lineup and referee preparation uses the existing flow.
- Private by default. Only the owner or an active admin with scoring permission
  can manage the match. HTTP viewer/report/roster routes and socket rooms enforce
  visibility. Revoking publication removes public sockets from the match room.
- Match completion enters review. Confirming checks finished set records against
  the rules before locking scorer writes. Confirmation does not add the result
  to an official competition or its standings.
- PDF uses the existing scoresheet. JSON is a snapshot for backup/export;
  importing/restoring this new format is not part of this version.
- Manual matches in this version are online only. They do not participate in
  Scorer/VIS offline checkout. Server-fetched official matches continue to require
  an explicit Fetch action; the owner's manual matches load independently.

## Verification

```powershell
cd backend
npm.cmd run test:manual-scorer
$env:RUN_MYSQL_MANUAL_SCORER_TESTS='1'
npm.cmd run test:manual-scorer
```

The opt-in MySQL test creates connection-local temporary tables cloned from the
migrated schema, then tests drafts, ready state, idempotent creation, owner
isolation, public/revoked reads, custom set rules, roster retrieval, confirmation
and backup. It drops only its temporary tables. It never inserts real matches,
teams or players. Run against a migrated development database.

Also run client `npm.cmd run lint` and `npm.cmd run build`, plus `node --check` on
the changed backend modules.

During implementation, the complete backend suite reported 15 failures in the
existing login, secret-validation and VIS tests. Running the unmodified HEAD
snapshot with the same environment produced the same 15 failing tests. The new
manual scorer unit/MySQL tests pass independently.
