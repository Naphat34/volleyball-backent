# Supabase PostgreSQL migration

Status: schema and application SQL converted and verified on local PostgreSQL
(PGlite) and Supabase staging PostgreSQL 17.11. The staging workflow suite passed
12 tests and the planner suite validated 439 static SQL literals. See
`../docs/technical/supabase-migration-validation.md` for scope and limits.
MySQL remains the code's fallback provider; the local backend is now configured
for Supabase staging using the private `volley` schema. Both migrations and the
default age-group seed are installed. The source MySQL snapshot (119 rows across
24 tables, including six users) has now been imported and independently reconciled
after commit. See `../docs/technical/supabase-data-migration.md`. No production
deployment cutover was performed. React, existing JWT/bcrypt authentication and
upload directories remain unchanged.

Migration `003_public_uuid_identifiers.sql` adds unique public UUIDs alongside
integer IDs in 20 tables. Public read APIs accept both identifier forms in the
routes listed in `../docs/technical/public-uuid-identifiers.md`; protected write
paths and offline identifiers still use integers. Original records were verified
against the source snapshot again after this additive migration.

## Implementation

- `migrations/postgres/001_baseline.sql` was generated from read-only metadata of
  the configured MySQL database: 25 source tables, including the MySQL migration
  tracking table. The 24 application tables, primary/foreign keys, unique indexes,
  enum/check constraints, generated roster columns and timestamp update behavior
  are represented in the baseline. MySQL migration history is intentionally excluded.
- Application tables live in the private `volley` schema, outside Supabase's default
  public Data API schema. Do not add it to exposed schemas. Express connects with a
  backend database role; users keep their existing Express JWT identities.
- `sqlDialect(mysql, postgres)` explicitly selects reviewed query alternatives;
  queries are not automatically rewritten between dialects at runtime. Alternatives
  include schema inspection, dates, aggregations, JSON, upserts, INSERT RETURNING,
  numeric flags, locking outer joins and nullable parameter casts.
- The adapter preserves rows/affectedRows/insertId, converts boolean bind values to
  source-compatible numeric flags, retains calendar dates and checks bigint ID
  precision. SQLSTATE is retained in `pgCode` when mapped to the error codes existing
  controllers use. Native PostgreSQL JSON operators containing `?` are not supported
  by the legacy placeholder interface; use functions such as `jsonb_exists` instead.
- `config/mysql.js` retains the original adapter. Historical MySQL migrations and
  one-off MySQL scripts remain separate from the new PostgreSQL migration history.

## Local verification

From `backend` in PowerShell:

```powershell
npm.cmd run test:postgres
npm.cmd test
```

The PostgreSQL suite plans complete static SQL literals from the actual controllers,
utilities and middleware with EXPLAIN against the baseline. EXPLAIN does not execute
writes. Dynamic SQL is exercised through real controller workflows using synthetic
data: login, registration, roster snapshots, jersey/captain/libero constraints,
custom VIS scoring/replay/stale revisions/undo/publishing, manual scorer, Scorer
offline atomic rollback/retry/release, official VIS offline sync/retry/undo and
public/team/admin aggregates. All local data is disposable; no source rows are read.

The full pre-existing backend suite has known failures; compare its failure list to
the baseline instead of reporting the entire suite as passing. Adapter mocks and
PGlite do not certify Supabase networking, TLS, permissions, concurrent connections,
Socket.IO, browser/PWA behavior or production performance.

## Configure a dedicated staging project

Create a separate Supabase project, then set these values in the untracked
`backend/.env` (keep current MySQL and JWT settings):

```dotenv
STAGING_DATABASE_URL=postgresql://USER:PERCENT_ENCODED_PASSWORD@SESSION_POOLER_HOST:5432/postgres
# Absolute path to the bundled public Supabase CA on this machine.
DB_SSL_CA_FILE=D:/webapp/volley/backend/config/certs/supabase-prod-ca-2021.crt
```

Copy the exact URL from Connect, choosing Session pooler for IPv4 environments.
Certificate verification is mandatory for staging commands. Never use the
database password or service-role credentials in the client or in chat.

```powershell
npm.cmd run test:supabase:staging
```

This command runs both the SQL planner and workflow suites. It requires
`STAGING_DATABASE_URL`; it never falls back to production
`DATABASE_URL`. It creates a random `volley_test_<hex>` schema, applies the baseline
there, runs the workflow suite and drops only that schema in cleanup. On Supabase,
it additionally checks simultaneous checkouts and duplicate creation using separate
pooled connections. Failed assertions cause a nonzero exit. The local PostgreSQL
planner tests remain separate; a local pass is not a staging pass.

To provision the persistent staging application schema after disposable tests:

```powershell
npm.cmd run migrate:postgres:status
npm.cmd run migrate:postgres:staging
npm.cmd run seed:postgres:staging
```

Migrations use a transaction and advisory lock, with checksums in the private
`volley_meta` schema. Changed applied migration files fail validation. Seeds have
their own tracking table. The first migration refuses an existing `volley` schema;
it never silently overwrites an existing installation.

If the baseline was installed manually without migration history, run
`npm.cmd run migrate:postgres:adopt-baseline` first. This compares actual columns,
constraints, indexes, triggers and baseline function definitions to a fresh
reference schema inside a transaction. It records the baseline checksum only if
they match, without modifying application rows. Then run the normal migration
command to install remaining migrations. It refuses a mismatched existing schema.

Run a separate backend instance against staging with:

```dotenv
DB_PROVIDER=postgres
DB_POSTGRES_PREVIEW=true
DATABASE_URL=postgresql://USER:ENCODED_PASSWORD@STAGING_HOST:5432/postgres
DB_PG_SCHEMA=volley
DB_SSL=true
DB_POOL_MAX=10
```

`DB_POSTGRES_PREVIEW` stays required until the production cutover review is complete.
Use a dedicated database role with required schema/table/sequence privileges.
Keep `volley` private and Supabase Data API disabled if unused. If browser access
is added later, design RLS separately; the existing Express JWT is not Supabase Auth.

## Source metadata and data transfer

```powershell
npm.cmd run schema:export:mysql
npm.cmd run schema:build:postgres
```

The exporter reads only information_schema and writes an ignored metadata file in
`tmp/mysql-schema.json`; it does not export application records or credentials.
The baseline builder fails for source views/triggers/types/index shapes it cannot
translate. Regeneration is for review before first apply; never edit a migration
already applied to a shared target. Add numbered PostgreSQL migrations instead.

The verified transfer tool is `scripts/migrateMysqlData.js`; source credentials are
read separately from ignored `backend/mysql-source.env`. It takes a read-only
consistent snapshot, saves it under ignored `tmp/data-migration`, and copies into
an empty staging target in one PostgreSQL transaction. It refuses existing
application rows, reconciles every table before commit and resets identity
sequences transactionally. Run `npm.cmd run migrate:data:verify-imported` for a
separate read-only post-commit comparison. The existing source snapshot has been
copied successfully; do not rerun an import over the populated target.

For future transfers, exclude generated columns and MySQL migration histories. Preserve
IDs and password hashes; insert parents before children (users/teams form a cycle,
so set their linking fields after both exist). Reset all identity sequences to
the imported maxima before writes. Do not run seeds before importing fixed IDs.
Reconcile row counts, primary/foreign keys, hashes of critical records, Thai/English
text, dates, JSON snapshots, roster history and match totals. Do not run pgloader's
default schema-creation/drop mode over the reviewed PostgreSQL baseline.

MySQL `_ci` collations and PostgreSQL text comparisons are not universally identical.
Login uses explicit casefold matching and a unique lower(username) index. Verify
accent/case/trailing-space behavior in other unique text fields with representative
staging data before production, especially team/stadium codes and age-group names.
MySQL TIMESTAMP becomes timestamptz; DATETIME remains timestamp without timezone.
Confirm the source timezone and test boundary timestamps when transferring rows.

## Production cutover and rollback

Before cutover, verify a restorable MySQL backup and run browser/PWA, role/access,
Socket.IO reconnect, scoring, reports and offline-device acceptance on staging.
Measure latency/load and configure backups, monitoring and least-privilege access.
Schedule outside a live competition. Stop all writers (HTTP, sockets, jobs and
offline sync), copy the final snapshot, reconcile, then switch the backend and smoke
test before reopening traffic. Database migration does not move upload/private
document files; preserve their storage and backups.

Before target writes, rollback is `DB_PROVIDER=mysql` and a backend restart against
the untouched source. After PostgreSQL receives new writes, stop traffic and
reconcile/replay those changes before switching back; toggling the provider alone
would lose data. Keep source backups through acceptance.

## References

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/kb/guides/migrate-from-mysql
- https://supabase.com/docs/guides/api/securing-your-api
