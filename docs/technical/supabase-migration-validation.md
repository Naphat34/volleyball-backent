# Supabase migration validation — 2026-11-13

Status: local PostgreSQL and Supabase staging SQL/workflow validation passed. Production cutover has not been performed.

## Verified locally

- Read-only MySQL metadata export: 25 source tables; no application rows exported.
- PostgreSQL baseline: 24 application tables in a private schema; source migration history excluded.
- Static SQL planning: 439 complete SQL literals from controllers/utilities/middleware, against the actual converted schema.
- PostgreSQL suite: 16 passed, 0 failed, 2 skipped. Skips require a live PostgreSQL connection and Supabase concurrent sessions.
- Workflow coverage: bcrypt/casefold login; registration and roster snapshots; generated jersey/captain/libero constraints; JSON/enum validation; custom VIS scoring, replay, stale revision, undo, owner isolation and publish/revoke; manual scorer create/retry; Scorer offline rollback/retry/release; official VIS offline sync/retry/undo preserving official score; locked roster history and FK restriction; public/team/admin aggregates.
- Full backend suite: 184 passed, 28 failed, 15 skipped (227 total). The failure names match the previously recorded baseline exactly; no new failures.
- Syntax checks passed for all changed/new JavaScript files.

## Staging status

Verified on Supabase PostgreSQL **17.11**, through the configured Session pooler with certificate-chain and hostname verification enabled:

- Workflow suite: **12 passed, 0 failed, 0 skipped**, approximately 142 seconds. This includes 11 workflow scenarios and the parent suite.
- SQL planner suite: **1 passed, 0 failed, 0 skipped**, approximately 106 seconds. All **439** complete static SQL literals planned successfully on the real staging PostgreSQL version.
- The suites used separate random private schemas and synthetic fixtures. Cleanup was verified after both suites; no temporary test schemas remain.
- Real concurrent connections verified that only one device can acquire a scorer checkout, duplicate custom creation returns the same match, and simultaneous delivery of the same rally does not double-count the point.
- The tested database role can create the baseline and execute the tested DDL/DML. This does not certify a future restricted production role.
- TLS initially failed because the Supabase CA was absent. The public CA was downloaded from the exact production URL referenced by the official Dashboard source, validated as an X.509 CA and saved under `backend/config/certs/`. `DB_SSL_CA_FILE` is set in the local, untracked environment. Certificate verification remains enabled.
- The connection URL still contained placeholder brackets around the password. Only those enclosing brackets were removed, after which authentication succeeded. No credential values are included in this report.

The workflow suite was run through `npm.cmd run test:supabase:staging`; after adding staging coverage to the planner suite, that file was run separately with `RUN_SUPABASE_STAGING_TESTS=1`. The standard staging command now includes both test files for future runs.

The disposable tests did not provision a persistent application schema. Subsequently,
while diagnosing local API HTTP 500 responses, an existing manually installed
`volley` baseline was found. Its columns, constraints, indexes, triggers and baseline
functions were verified against a fresh reference schema before recording migration
history. `002_json_helpers.sql` and `01_default_age_groups.sql` were then applied.
Both schema migrations are now recorded as applied; the age-group seed contains
five defaults. At that point source records had not yet been migrated. Public-schema
tables were not changed.

The local backend environment now explicitly selects PostgreSQL, the staging URL,
the private `volley` schema, preview mode and verified TLS. Previously it fell back
to MySQL while its MySQL connection variables were absent. The existing nodemon
backend was reloaded after configuration; no other app process was stopped.

Verified against the running HTTP server on localhost:5000:

- `/api/public/competitions`: HTTP 200 (empty array).
- `/api/public/teams`: HTTP 200 (empty array).
- `/api/public/matches`: HTTP 200 (empty array).
- `/api/age-groups`: HTTP 200 (five rows).
- `/api/auth/login`, random nonexistent username: HTTP 401, rather than HTTP 500.

The subsequent data migration imported 119 source rows across 24 tables, including
all six original users with unchanged password hashes. All rows and identity
sequences were independently verified after commit. See
[the data migration report](supabase-data-migration.md). No administrator or test
account was created by the HTTP 500 fix.

Source snapshot transfer/reconciliation is now verified for the actual 119 rows,
including timestamps and JSON. Not yet verified: behavior with additional
case/accent/trailing-space collisions; a restricted production database role;
browser/PWA/Socket.IO acceptance; load and latency. Production cutover remains
disabled by the preview guard.

## Existing backend failure names

These were present before the current conversion and are not represented as passing:

- rejects missing IDs before querying
- returns 404 for a missing match
- rejects teams outside the match
- saves valid teams with an atomic match-status guard
- returns conflict when the match starts or changes before the update
- retries of already saved results are idempotent after start
- authController.login returns user payload and sets auth cookie
- competitionsController.toggleCompetitionStatus updates and returns the competition
- only owner/admin can read or publish a private custom match
- validateRequest rejects VIS stats without a player
- Admin VIS: checkout keeps original identities; sync/retry/release updates the same match without changing eScore
- Admin VIS: a failure after an inserted rally rolls back the whole sync batch and leaves receipts retryable
- Admin VIS: substitution, side-out and Undo agree with the offline engine across successive batches
- getJwtSecret rejects missing or default production secrets
- S21\# persists statistics at official 8-4 and never updates any official field or scorer socket
- retry is idempotent even after an official score change
- Undo deletes only its VIS action despite a newer official point; cannot delete scorer points
- stale scoring context, stale VIS revision and foreign players fail before writing
- failed insertion rolls back statistics and never commits
- old official match-control requests to VIS are rejected on the server
- public best scorers exclude perfect reception and setting while preserving skill rankings
- every VIS skill/grade preserves all official state, including a set-winning statistic
- VIS rejects every official match-control command
- Undo removes only the statistics history, never a score, lineup or finished status
- an official score/lineup change invalidates the current context; timer ticks do not
- historical official rallies use their saved lineup and never trust supplied scores
- VIS can record before eScoreControl starts, without taking ownership of official scores
- official Undo invalidates removed rally references without rewriting VIS statistics

See [SUPABASE_MIGRATION.md](../../backend/SUPABASE_MIGRATION.md) for staging commands and cutover/rollback procedure.
