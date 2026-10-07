SET @has_competition_athlete_sport_policy := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competitions'
    AND COLUMN_NAME = 'athlete_sport_policy'
);

SET @add_competition_athlete_sport_policy_sql := IF(
  @has_competition_athlete_sport_policy = 0,
  'ALTER TABLE competitions ADD COLUMN athlete_sport_policy VARCHAR(40) NOT NULL DEFAULT ''single_sport'' AFTER sport_type',
  'SELECT 1'
);
PREPARE add_competition_athlete_sport_policy_stmt FROM @add_competition_athlete_sport_policy_sql;
EXECUTE add_competition_athlete_sport_policy_stmt;
DEALLOCATE PREPARE add_competition_athlete_sport_policy_stmt;

CREATE TABLE IF NOT EXISTS player_sport_eligibilities (
  player_id INT NOT NULL,
  sport_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, sport_type),
  KEY idx_player_sport_eligibilities_sport_type (sport_type),
  CONSTRAINT fk_player_sport_eligibilities_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE CASCADE
);

INSERT IGNORE INTO player_sport_eligibilities (player_id, sport_type)
SELECT id, 'indoor'
FROM players;

UPDATE competitions
SET athlete_sport_policy = 'single_sport'
WHERE athlete_sport_policy IS NULL
   OR athlete_sport_policy <> 'single_sport';

