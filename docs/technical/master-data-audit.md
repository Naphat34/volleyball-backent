# Read-only Master Data audit

The audit requires an explicit environment file and local output path; it never selects a database implicitly. Confirm the intended database before running when multiple configurations exist.

From `backend` on Windows:

```powershell
npm.cmd run audit:master-data -- --env-file .env --output ../tmp/master-data-audit/mysql.json
# Only after choosing the Online PostgreSQL target:
npm.cmd run audit:master-data -- --env-file '../Connection postgres Online.txt' --output ../tmp/master-data-audit/postgres.json
npm.cmd run test:master-data-audit
```

Both providers use a repeatable-read, read-only transaction and roll it back. PostgreSQL queries have a 20-second statement timeout and a 3-second lock timeout; MySQL queries have a 25-second client timeout. No migrations, seeders, application adapter startup hooks or application writes run. TLS verification stays enabled for TLS connections; supply the configured CA file when needed.

PostgreSQL accepts either `DATABASE_URL` or the separate `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` settings. URL configuration takes precedence. Always set `DB_PROVIDER=postgres` explicitly. The current local server on loopback does not support TLS, so its local environment explicitly uses `DB_SSL=false`. This does not change TLS verification for Online configurations.

The report contains table counts, column/index/constraint metadata, migration history where available, role/status distributions, selected orphan relations, duplicate group counts, selected missing fields and registration mirror mismatches. Samples contain internal IDs only, at most 20 per applicable check. Counts describe rows or duplicate groups as named; overlapping checks must not be added as distinct affected records.

Names, usernames, password hashes, national IDs, document content and duplicate key values are not exported. Treat the local report as internal operational information. Store reports under the ignored `tmp/` directory; do not commit connection files or reports containing live operational IDs.

The PostgreSQL baseline is a reference for missing tables/columns, not a complete migration or type compatibility validator. Later additive migrations may legitimately add fields. Constraints/indexes are inventoried for review, not all semantically compared. The orphan checks are a selected application relationship list, not an exhaustive foreign-key audit. Missing schema and query failures appear in `skipped`; a partial report is not a clean bill of health. MySQL non-InnoDB tables cannot guarantee snapshot consistency. Absence of birth dates and unknown roles are review candidates, not automatically invalid records. No determination of historical non-use or automatic merge is made.

The integration test uses an in-memory PostgreSQL engine and checks mirror detection, role inventory, absence of application writes, schema parsing and redaction of fixture identity values. Live MySQL connectivity and dialect behavior require verification against the chosen MySQL target.
