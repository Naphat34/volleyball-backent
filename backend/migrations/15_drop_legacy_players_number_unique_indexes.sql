-- Player numbers are now unique per competition roster in team_entry_players.
-- Drop legacy players-level unique indexes that still block number reuse across categories.

SET @add_players_team_id_index_sql := IF(
  EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'players'
      AND INDEX_NAME = 'idx_players_team_id'
  ),
  'SELECT 1',
  'ALTER TABLE players ADD INDEX idx_players_team_id (team_id)'
);

PREPARE add_players_team_id_index_stmt FROM @add_players_team_id_index_sql;
EXECUTE add_players_team_id_index_stmt;
DEALLOCATE PREPARE add_players_team_id_index_stmt;

SET @drop_legacy_players_number_unique_indexes_sql := (
  SELECT CONCAT(
    'ALTER TABLE players ',
    GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(INDEX_NAME, '`', '``'), '`') SEPARATOR ', ')
  )
  FROM (
    SELECT
      INDEX_NAME,
      GROUP_CONCAT(COLUMN_NAME ORDER BY COLUMN_NAME SEPARATOR ',') AS column_set
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'players'
      AND NON_UNIQUE = 0
      AND INDEX_NAME <> 'PRIMARY'
    GROUP BY INDEX_NAME
    HAVING column_set IN ('number,team_id', 'gender,number,team_id')
  ) legacy_unique_indexes
);

SET @drop_legacy_players_number_unique_indexes_sql := IF(
  @drop_legacy_players_number_unique_indexes_sql IS NULL,
  'SELECT 1',
  @drop_legacy_players_number_unique_indexes_sql
);

PREPARE drop_legacy_players_number_unique_indexes_stmt FROM @drop_legacy_players_number_unique_indexes_sql;
EXECUTE drop_legacy_players_number_unique_indexes_stmt;
DEALLOCATE PREPARE drop_legacy_players_number_unique_indexes_stmt;
