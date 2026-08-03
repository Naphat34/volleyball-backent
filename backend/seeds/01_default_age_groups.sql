CREATE TABLE IF NOT EXISTS age_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

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
