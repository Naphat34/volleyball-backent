# Athlete data ownership

- `players` stores master identity and defaults for new registrations. Changing a master jersey number or role does not update existing competition entries.
- `team_entry_players` stores the number and role for that competition. The team roster screen edits these explicitly. Existing values survive selection-only roster saves. Registration edits are rejected after the competition/team has match activity.
- Removing a player through Admin or Team archives the master (`is_active=0`, `is_playing=0`). Archived athletes disappear from master selection lists; existing entry and match references remain.
- Master and entry Libero flags must agree with their position/role. A roster has one captain, one L1, and one L2. An athlete cannot be L1 and L2 simultaneously. Master role uniqueness applies to active athletes.
- Entry jersey numbers are unique within an entry. Optional national IDs are unique when present. Neither identity nor statistics are matched by names.
- Match history foreign keys use `RESTRICT`; destructive deletes of referenced athletes fail instead of nulling historical IDs.
- Custom VIMS match players keep their original local IDs and JSON snapshots. Admins can explicitly link a saved match player to an active master through the roster's identity panel. The independent `custom_vis_player_links` table is authoritative, not imported JSON. Rankings combine only these verified identities; team rankings remain separate. Changing/reordering a custom roster invalidates affected links. Linking is unavailable while an offline device holds the match lease.

## Installation and validation

Run `npm.cmd run migrate:athletes` for a read-only conflict check. After reviewing it, run `npm.cmd run migrate:athletes -- --apply`. This applies **only migration 36**, without applying unrelated pending migrations. MySQL DDL is not transactionally rolled back; the migration checks metadata and supports rerunning after an interruption. Existing conflicts stop preflight and are never silently repaired.

Run `npm.cmd run test:athletes` for unit tests. To include MySQL checks in PowerShell, set `$env:RUN_ATHLETE_MYSQL='1'` before running that command. The database test inserts fixtures in a transaction and always rolls them back. Auto-increment gaps can remain.

No legacy custom roster is automatically linked, and no previously removed historical player identity is reconstructed.

## Bilingual names

Migration 37 adds teams.name_th/name_en and players.first_name_th/last_name_th/first_name_en/last_name_en. Existing name/first_name/last_name remain compatible display fields. Backfill copies existing Thai or Latin names into the matching field only; it does not translate or transliterate. Missing translations remain optional and displays fall back to the existing name.

Team and athlete forms accept both languages. English-only updates preserve stored Thai values. VIMS lineup and P-2 report data carry both languages; P-2 uses the selected interface language with legacy fallback. Custom match JSON and offline engine retain both languages.

Use npm.cmd run migrate:names -- --apply to install only migration 37. Use npm.cmd run test:names for unit tests, or set RUN_BILINGUAL_MYSQL=1 to include the rollback-only MySQL API test.
