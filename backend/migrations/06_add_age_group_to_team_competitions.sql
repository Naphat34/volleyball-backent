-- Keep the legacy registration mirror aligned with category-based registrations.
-- team_entries is the source of truth; team_competitions is still read by older screens.

SET @add_gender_col = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE team_competitions ADD COLUMN gender VARCHAR(30) NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_competitions'
    AND COLUMN_NAME = 'gender'
);
PREPARE stmt FROM @add_gender_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_age_group_col = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE team_competitions ADD COLUMN age_group_id INT NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_competitions'
    AND COLUMN_NAME = 'age_group_id'
);
PREPARE stmt FROM @add_age_group_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_age_group_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE team_competitions ADD INDEX idx_team_competitions_age_group (age_group_id)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_competitions'
    AND INDEX_NAME = 'idx_team_competitions_age_group'
);
PREPARE stmt FROM @add_age_group_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE team_competitions tc
JOIN competitions c ON c.id = tc.competition_id
SET
  tc.gender = COALESCE(tc.gender, c.gender),
  tc.age_group_id = COALESCE(tc.age_group_id, c.age_group_id);

UPDATE team_entries te
JOIN competitions c ON c.id = te.competition_id
SET
  te.gender = COALESCE(te.gender, c.gender),
  te.age_group_id = COALESCE(te.age_group_id, c.age_group_id);
