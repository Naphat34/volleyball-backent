SET @has_competition_athlete_sport_policy := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competitions'
    AND COLUMN_NAME = 'athlete_sport_policy'
);

SET @drop_competition_athlete_sport_policy_sql := IF(
  @has_competition_athlete_sport_policy > 0,
  'ALTER TABLE competitions DROP COLUMN athlete_sport_policy',
  'SELECT 1'
);
PREPARE drop_competition_athlete_sport_policy_stmt FROM @drop_competition_athlete_sport_policy_sql;
EXECUTE drop_competition_athlete_sport_policy_stmt;
DEALLOCATE PREPARE drop_competition_athlete_sport_policy_stmt;

DROP TABLE IF EXISTS player_sport_eligibilities;
