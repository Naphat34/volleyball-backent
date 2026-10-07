SET @has_competition_sport_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competitions'
    AND COLUMN_NAME = 'sport_type'
);

SET @add_competition_sport_type_sql := IF(
  @has_competition_sport_type = 0,
  'ALTER TABLE competitions ADD COLUMN sport_type VARCHAR(20) NOT NULL DEFAULT ''indoor'' AFTER sport',
  'SELECT 1'
);
PREPARE add_competition_sport_type_stmt FROM @add_competition_sport_type_sql;
EXECUTE add_competition_sport_type_stmt;
DEALLOCATE PREPARE add_competition_sport_type_stmt;

SET @has_competition_scoring_config := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competitions'
    AND COLUMN_NAME = 'scoring_config'
);

SET @add_competition_scoring_config_sql := IF(
  @has_competition_scoring_config = 0,
  'ALTER TABLE competitions ADD COLUMN scoring_config JSON NULL AFTER max_players',
  'SELECT 1'
);
PREPARE add_competition_scoring_config_stmt FROM @add_competition_scoring_config_sql;
EXECUTE add_competition_scoring_config_stmt;
DEALLOCATE PREPARE add_competition_scoring_config_stmt;

UPDATE competitions
SET sport_type = 'indoor'
WHERE sport_type IS NULL OR sport_type <> 'indoor';

UPDATE competitions
SET sport_type = 'indoor'
WHERE sport_type IS NULL OR sport_type <> 'indoor';




UPDATE competitions
SET scoring_config = JSON_OBJECT(
  'regular_set_points', 25,
  'deciding_set_points', 15,
  'win_by', 2,
  'side_switch_points', null,
  'deciding_side_switch_points', null,
  'libero_enabled', true,
  'substitutions_enabled', true
)
WHERE sport_type = 'indoor'
  AND scoring_config IS NULL;

