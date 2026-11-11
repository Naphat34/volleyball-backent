-- Active players share one jersey-number namespace per team, regardless of category.
-- Archived athletes keep their original number and historical references.
-- The unique index deliberately fails if existing active duplicates need correction.
SET @number_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='players' AND COLUMN_NAME='integrity_active_number'), 'SELECT 1',
  'ALTER TABLE players ADD COLUMN integrity_active_number INT GENERATED ALWAYS AS (CASE WHEN COALESCE(is_active,1)=1 THEN number ELSE NULL END) VIRTUAL');
PREPARE number_stmt FROM @number_ddl; EXECUTE number_stmt; DEALLOCATE PREPARE number_stmt;
SET @number_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='players' AND INDEX_NAME='uq_players_team_active_number'), 'SELECT 1',
  'ALTER TABLE players ADD UNIQUE KEY uq_players_team_active_number (team_id,integrity_active_number)');
PREPARE number_stmt FROM @number_ddl; EXECUTE number_stmt; DEALLOCATE PREPARE number_stmt;
