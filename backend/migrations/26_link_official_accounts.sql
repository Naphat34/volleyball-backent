-- Keep the role column capable of storing the additional admin-managed roles,
-- while preserving its current nullability and default if the base schema uses ENUM.
SET @user_role_data_type := (
  SELECT DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
  LIMIT 1
);
SET @user_role_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
  LIMIT 1
);
SET @user_role_default := (
  SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
  LIMIT 1
);
SET @widen_user_role_sql := IF(
  LOWER(COALESCE(@user_role_data_type, '')) = 'enum',
  CONCAT(
    'ALTER TABLE users MODIFY COLUMN role VARCHAR(40) ',
    IF(@user_role_nullable = 'YES', 'NULL', 'NOT NULL'),
    IF(@user_role_default IS NULL, '', CONCAT(' DEFAULT ', QUOTE(@user_role_default)))
  ),
  'SELECT 1'
);
PREPARE widen_user_role_stmt FROM @widen_user_role_sql;
EXECUTE widen_user_role_stmt;
DEALLOCATE PREPARE widen_user_role_stmt;

-- Match the users.id data type exactly so the foreign keys work for signed or
-- unsigned integer primary keys in existing installations.
SET @users_id_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
  LIMIT 1
);
SET @add_scorer_user_link_sql := CONCAT(
  'ALTER TABLE scorers ADD COLUMN user_id ', @users_id_type,
  ' NULL, ADD UNIQUE KEY uq_scorers_user_id (user_id),',
  ' ADD CONSTRAINT fk_scorers_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'
);
PREPARE add_scorer_user_link_stmt FROM @add_scorer_user_link_sql;
EXECUTE add_scorer_user_link_stmt;
DEALLOCATE PREPARE add_scorer_user_link_stmt;

SET @add_referee_user_link_sql := CONCAT(
  'ALTER TABLE referees ADD COLUMN user_id ', @users_id_type,
  ' NULL, ADD UNIQUE KEY uq_referees_user_id (user_id),',
  ' ADD CONSTRAINT fk_referees_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'
);
PREPARE add_referee_user_link_stmt FROM @add_referee_user_link_sql;
EXECUTE add_referee_user_link_stmt;
DEALLOCATE PREPARE add_referee_user_link_stmt;
