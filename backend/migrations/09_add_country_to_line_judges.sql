SET @has_line_judges_country := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'line_judges'
    AND COLUMN_NAME = 'country'
);

SET @add_line_judges_country_sql := IF(
  @has_line_judges_country = 0,
  'ALTER TABLE line_judges ADD COLUMN country VARCHAR(100) NULL',
  'SELECT 1'
);

PREPARE add_line_judges_country_stmt FROM @add_line_judges_country_sql;
EXECUTE add_line_judges_country_stmt;
DEALLOCATE PREPARE add_line_judges_country_stmt;
