-- Allow the same team to reuse player numbers across different age groups.
-- Roster-level uniqueness remains enforced by uq_team_entry_players_entry_number.

SET @players_number_gender_unique := (
  SELECT INDEX_NAME
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'players'
    AND NON_UNIQUE = 0
  GROUP BY INDEX_NAME
  HAVING GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') = 'team_id,number,gender'
  LIMIT 1
);

SET @drop_players_number_gender_unique_sql := IF(
  @players_number_gender_unique IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE players DROP INDEX `', REPLACE(@players_number_gender_unique, '`', '``'), '`')
);

PREPARE drop_players_number_gender_unique_stmt FROM @drop_players_number_gender_unique_sql;
EXECUTE drop_players_number_gender_unique_stmt;
DEALLOCATE PREPARE drop_players_number_gender_unique_stmt;
