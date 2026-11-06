-- Per-match overrides; team and competition registrations remain unchanged.
-- Check columns independently to support reruns and partially applied schemas.
SET @match_setup_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE matches ADD COLUMN match_setup JSON NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'match_setup'
);
PREPARE match_setup_stmt FROM @match_setup_ddl;
EXECUTE match_setup_stmt;
DEALLOCATE PREPARE match_setup_stmt;

SET @match_setup_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE matches ADD COLUMN match_setup_revision INT NOT NULL DEFAULT 0',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'match_setup_revision'
);
PREPARE match_setup_stmt FROM @match_setup_ddl;
EXECUTE match_setup_stmt;
DEALLOCATE PREPARE match_setup_stmt;
