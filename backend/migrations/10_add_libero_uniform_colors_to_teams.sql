SET @schema_name = DATABASE();

SET @add_main_color = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE teams ADD COLUMN main_color VARCHAR(20) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'teams'
    AND column_name = 'main_color'
);
PREPARE stmt FROM @add_main_color;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_second_color = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE teams ADD COLUMN second_color VARCHAR(20) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'teams'
    AND column_name = 'second_color'
);
PREPARE stmt FROM @add_second_color;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_third_color = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE teams ADD COLUMN third_color VARCHAR(20) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'teams'
    AND column_name = 'third_color'
);
PREPARE stmt FROM @add_third_color;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_libero_main_color = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE teams ADD COLUMN libero_main_color VARCHAR(20) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'teams'
    AND column_name = 'libero_main_color'
);
PREPARE stmt FROM @add_libero_main_color;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_libero_second_color = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE teams ADD COLUMN libero_second_color VARCHAR(20) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'teams'
    AND column_name = 'libero_second_color'
);
PREPARE stmt FROM @add_libero_second_color;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_libero_third_color = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE teams ADD COLUMN libero_third_color VARCHAR(20) NULL',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = @schema_name
    AND table_name = 'teams'
    AND column_name = 'libero_third_color'
);
PREPARE stmt FROM @add_libero_third_color;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
