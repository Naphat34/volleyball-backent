SET @has_competition_max_sets := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competitions'
    AND COLUMN_NAME = 'max_sets'
);

SET @add_competition_max_sets_sql := IF(
  @has_competition_max_sets = 0,
  'ALTER TABLE competitions ADD COLUMN max_sets INT NULL DEFAULT 3',
  'SELECT 1'
);

PREPARE add_competition_max_sets_stmt FROM @add_competition_max_sets_sql;
EXECUTE add_competition_max_sets_stmt;
DEALLOCATE PREPARE add_competition_max_sets_stmt;

UPDATE competitions
SET max_sets = 3
WHERE max_sets IS NULL OR max_sets NOT IN (3, 5);
