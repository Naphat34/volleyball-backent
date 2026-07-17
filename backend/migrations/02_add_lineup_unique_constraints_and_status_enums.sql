-- Add database-level guards for one lineup per match/team/set and constrain
-- status columns to the values currently used by the application.
--
-- Preflight before running:
-- SELECT match_id, team_id, set_number, COUNT(*) AS duplicate_count
-- FROM match_lineups
-- GROUP BY match_id, team_id, set_number
-- HAVING COUNT(*) > 1;
--
-- If this returns rows, resolve the duplicates before applying the unique key.

ALTER TABLE match_lineups
  ADD CONSTRAINT uq_match_lineups_match_team_set
  UNIQUE (match_id, team_id, set_number);

ALTER TABLE competitions
  MODIFY COLUMN status ENUM('open', 'closed') NULL DEFAULT 'closed';

ALTER TABLE matches
  MODIFY COLUMN status ENUM('scheduled', 'live', 'completed', 'cancelled') NULL DEFAULT 'scheduled';

ALTER TABLE match_requests
  MODIFY COLUMN status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NULL DEFAULT 'PENDING';

ALTER TABLE teams
  MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NULL DEFAULT 'pending';

ALTER TABLE team_competitions
  MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'withdrawn') NULL DEFAULT 'pending';

ALTER TABLE users
  MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NULL DEFAULT 'pending';
