-- Add bilingual names without changing existing name columns.
SET @names_ddl=IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams' AND COLUMN_NAME='name_th'),'SELECT 1','ALTER TABLE teams ADD COLUMN name_th VARCHAR(100) NULL');
PREPARE names_stmt FROM @names_ddl; EXECUTE names_stmt; DEALLOCATE PREPARE names_stmt;
SET @names_ddl=IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams' AND COLUMN_NAME='name_en'),'SELECT 1','ALTER TABLE teams ADD COLUMN name_en VARCHAR(100) NULL');
PREPARE names_stmt FROM @names_ddl; EXECUTE names_stmt; DEALLOCATE PREPARE names_stmt;
SET @names_ddl=IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='first_name_th'),'SELECT 1','ALTER TABLE players ADD COLUMN first_name_th VARCHAR(50) NULL');
PREPARE names_stmt FROM @names_ddl; EXECUTE names_stmt; DEALLOCATE PREPARE names_stmt;
SET @names_ddl=IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='last_name_th'),'SELECT 1','ALTER TABLE players ADD COLUMN last_name_th VARCHAR(50) NULL');
PREPARE names_stmt FROM @names_ddl; EXECUTE names_stmt; DEALLOCATE PREPARE names_stmt;
SET @names_ddl=IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='first_name_en'),'SELECT 1','ALTER TABLE players ADD COLUMN first_name_en VARCHAR(50) NULL');
PREPARE names_stmt FROM @names_ddl; EXECUTE names_stmt; DEALLOCATE PREPARE names_stmt;
SET @names_ddl=IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='last_name_en'),'SELECT 1','ALTER TABLE players ADD COLUMN last_name_en VARCHAR(50) NULL');
PREPARE names_stmt FROM @names_ddl; EXECUTE names_stmt; DEALLOCATE PREPARE names_stmt;
UPDATE teams SET name_th=name WHERE name_th IS NULL AND name REGEXP '[ก-๙]';
UPDATE teams SET name_en=name WHERE name_en IS NULL AND name NOT REGEXP '[ก-๙]' AND name REGEXP '[A-Za-z]';
UPDATE players SET first_name_th=first_name WHERE first_name_th IS NULL AND first_name REGEXP '[ก-๙]';
UPDATE players SET first_name_en=first_name WHERE first_name_en IS NULL AND first_name NOT REGEXP '[ก-๙]' AND first_name REGEXP '[A-Za-z]';
UPDATE players SET last_name_th=last_name WHERE last_name_th IS NULL AND last_name REGEXP '[ก-๙]';
UPDATE players SET last_name_en=last_name WHERE last_name_en IS NULL AND last_name NOT REGEXP '[ก-๙]' AND last_name REGEXP '[A-Za-z]';
