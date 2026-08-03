SET @has_competition_logo_url := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competitions'
    AND COLUMN_NAME = 'logo_url'
);

SET @add_competition_logo_url_sql := IF(
  @has_competition_logo_url = 0,
  'ALTER TABLE competitions ADD COLUMN logo_url VARCHAR(500) NULL',
  'SELECT 1'
);

PREPARE add_competition_logo_url_stmt FROM @add_competition_logo_url_sql;
EXECUTE add_competition_logo_url_stmt;
DEALLOCATE PREPARE add_competition_logo_url_stmt;
