# Data migration result — 2026-11-13

Status: committed to Supabase staging and independently verified after commit.

- Source snapshot captured: 2026-11-13T04:53:08.114Z.
- 24 application tables, 119 rows copied; all per-table row counts and canonical row hashes match the source snapshot.
- Six users retain their original IDs, usernames, roles, statuses, team links and bcrypt password hashes. No password was reset or converted to plaintext.
- Numeric IDs and foreign keys are preserved. The users/teams cycle was resolved by restoring users.team_id after parent rows were inserted.
- JSON was compared independent of key order and numeric scale, preserving large JSON integer precision. Calendar/date-time values and generated integrity columns were included in reconciliation.
- Identity sequences were reset transactionally and verified after commit without consuming new IDs.
- Source MySQL was accessed using a read-only consistent snapshot; source records were not modified or deleted.
- A full source snapshot and machine-readable reconciliation report are stored in the ignored tmp/data-migration directory. Source credentials remain in ignored backend/mysql-source.env. Neither is included in Git.

| Table | Source rows | Imported rows |
|---|---:|---:|
| age_groups | 5 | 5 |
| audit_logs | 28 | 28 |
| competitions | 2 | 2 |
| custom_vis_matches | 0 | 0 |
| custom_vis_player_links | 0 | 0 |
| line_judges | 0 | 0 |
| match_actions | 0 | 0 |
| matches | 1 | 1 |
| match_events | 3 | 3 |
| match_lineups | 2 | 2 |
| match_requests | 0 | 0 |
| match_sets | 0 | 0 |
| players | 31 | 31 |
| referees | 6 | 6 |
| scorer_offline_sessions | 0 | 0 |
| scorers | 2 | 2 |
| stadiums | 3 | 3 |
| team_competitions | 2 | 2 |
| team_entries | 2 | 2 |
| team_entry_players | 14 | 14 |
| team_entry_staff | 4 | 4 |
| teams | 4 | 4 |
| team_staff | 4 | 4 |
| users | 6 | 6 |

## Verification

- Unit tests cover canonical JSON (including large integers), password-hash/ID sensitivity and parent-first insertion ordering.
- A full dry run copied and reconciled every table, then rolled back.
- The actual import committed only after every table reconciled successfully.
- A separate read-only verification checked every row against the saved source snapshot after commit and confirmed identity sequence state.

The destination was empty except for the five known age-group seed rows, which were replaced with source age groups to preserve original IDs. The importer refuses to overwrite nonempty application tables. It never changes public-schema tables or imports MySQL migration tracking into PostgreSQL history.

Live HTTP verification after import returned 200 for competitions (two visible),
teams (two visible), public matches (zero visible) and age groups (five).
The stored totals are four teams and one match: two teams belong to manual scorer
matches, and the one manual match is unpublished, so the public API intentionally
filters them. These rows were imported and verified. An original active account
correctly rejected an incorrect random password with HTTP 401.

Original account statuses are preserved: pending/inactive users remain subject to the same access rules. Actual successful login with a user's original plaintext password has not been attempted; preservation of the original password hashes is verified.

Backend uploads and private document directories remain in their existing location; this operation copies database records and their stored file references.

## Commands

From backend:

```powershell
npm.cmd run migrate:data:inspect
npm.cmd run migrate:data:verify     # copies, reconciles and rolls back
npm.cmd run migrate:data:staging    # commits only into an empty target
npm.cmd run migrate:data:verify-imported
npm.cmd run test:data-migration
```
