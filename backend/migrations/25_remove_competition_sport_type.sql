SET @has_competition_sport_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competitions'
    AND COLUMN_NAME = 'sport_type'
);

SET @drop_competition_sport_type_sql := IF(
  @has_competition_sport_type > 0,
  'ALTER TABLE competitions DROP COLUMN sport_type',
  'SELECT 1'
);
PREPARE drop_competition_sport_type_stmt FROM @drop_competition_sport_type_sql;
EXECUTE drop_competition_sport_type_stmt;
DEALLOCATE PREPARE drop_competition_sport_type_stmt;
