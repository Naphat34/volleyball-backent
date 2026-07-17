-- Preflight before running:
-- SELECT team_entry_id, number, COUNT(*) AS duplicate_count
-- FROM team_entry_players
-- WHERE number IS NOT NULL
-- GROUP BY team_entry_id, number
-- HAVING COUNT(*) > 1;

ALTER TABLE team_entry_players
  ADD CONSTRAINT uq_team_entry_players_entry_number
  UNIQUE (team_entry_id, number);
