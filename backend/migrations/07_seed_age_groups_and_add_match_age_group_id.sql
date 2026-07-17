-- Make age_groups the master data for competition age divisions.
-- Keep matches.category for backward compatibility, but use matches.age_group_id as the explicit FK.

CREATE TABLE IF NOT EXISTS age_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

SET @add_age_group_name_unique = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE age_groups ADD UNIQUE KEY uq_age_groups_name (name)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'age_groups'
    AND INDEX_NAME = 'uq_age_groups_name'
);
PREPARE stmt FROM @add_age_group_name_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO age_groups (name)
SELECT 'U12' WHERE NOT EXISTS (SELECT 1 FROM age_groups WHERE name = 'U12');
INSERT INTO age_groups (name)
SELECT 'U14' WHERE NOT EXISTS (SELECT 1 FROM age_groups WHERE name = 'U14');
INSERT INTO age_groups (name)
SELECT 'U16' WHERE NOT EXISTS (SELECT 1 FROM age_groups WHERE name = 'U16');
INSERT INTO age_groups (name)
SELECT 'U18' WHERE NOT EXISTS (SELECT 1 FROM age_groups WHERE name = 'U18');
INSERT INTO age_groups (name)
SELECT 'Open' WHERE NOT EXISTS (SELECT 1 FROM age_groups WHERE name = 'Open');

SET @open_age_group_id = (SELECT id FROM age_groups WHERE name = 'Open' LIMIT 1);

SET @add_matches_age_group_col = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE matches ADD COLUMN age_group_id INT NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'matches'
    AND COLUMN_NAME = 'age_group_id'
);
PREPARE stmt FROM @add_matches_age_group_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_matches_age_group_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE matches ADD INDEX idx_matches_age_group_id (age_group_id)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'matches'
    AND INDEX_NAME = 'idx_matches_age_group_id'
);
PREPARE stmt FROM @add_matches_age_group_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE competitions
SET age_group_id = @open_age_group_id
WHERE age_group_id IS NULL;

UPDATE team_entries te
JOIN competitions c ON c.id = te.competition_id
SET te.age_group_id = c.age_group_id
WHERE te.age_group_id IS NULL;

UPDATE team_competitions tc
JOIN competitions c ON c.id = tc.competition_id
SET tc.age_group_id = c.age_group_id
WHERE tc.age_group_id IS NULL;

UPDATE matches m
JOIN competitions c ON c.id = m.competition_id
SET
  m.age_group_id = COALESCE(m.age_group_id, c.age_group_id),
  m.category = COALESCE(m.category, c.age_group_id)
WHERE m.age_group_id IS NULL OR m.category IS NULL;

UPDATE competitions
SET age_group_id = @open_age_group_id
WHERE age_group_id IN (SELECT id FROM age_groups WHERE name IN ('Senior', 'Junior', 'Youth'));

UPDATE team_entries
SET age_group_id = @open_age_group_id
WHERE age_group_id IN (SELECT id FROM age_groups WHERE name IN ('Senior', 'Junior', 'Youth'));

UPDATE team_competitions
SET age_group_id = @open_age_group_id
WHERE age_group_id IN (SELECT id FROM age_groups WHERE name IN ('Senior', 'Junior', 'Youth'));

UPDATE matches
SET
  age_group_id = @open_age_group_id,
  category = @open_age_group_id
WHERE age_group_id IN (SELECT id FROM age_groups WHERE name IN ('Senior', 'Junior', 'Youth'))
   OR category IN (SELECT id FROM age_groups WHERE name IN ('Senior', 'Junior', 'Youth'));

DELETE FROM age_groups
WHERE name IN ('Senior', 'Junior', 'Youth');

SET @add_team_competitions_age_group_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE team_competitions ADD CONSTRAINT fk_team_competitions_age_group FOREIGN KEY (age_group_id) REFERENCES age_groups(id)',
    'SELECT 1'
  )
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_competitions'
    AND COLUMN_NAME = 'age_group_id'
    AND REFERENCED_TABLE_NAME = 'age_groups'
);
PREPARE stmt FROM @add_team_competitions_age_group_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_matches_age_group_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE matches ADD CONSTRAINT fk_matches_age_group_id FOREIGN KEY (age_group_id) REFERENCES age_groups(id)',
    'SELECT 1'
  )
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'matches'
    AND COLUMN_NAME = 'age_group_id'
    AND REFERENCED_TABLE_NAME = 'age_groups'
);
PREPARE stmt FROM @add_matches_age_group_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
