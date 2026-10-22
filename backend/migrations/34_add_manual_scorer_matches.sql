-- Manual matches use private team copies, separate from official competitions.
-- Check each object independently so this migration can resume after a partial run
-- and can safely be executed again on an already migrated database.

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD COLUMN manual_owner_id INT NULL', 'SELECT 1')
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'manual_owner_id'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD COLUMN manual_title VARCHAR(160) NULL', 'SELECT 1')
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'manual_title'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD COLUMN manual_lifecycle ENUM(''draft'',''ready'',''review'',''confirmed'') NULL', 'SELECT 1')
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'manual_lifecycle'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD COLUMN manual_published TINYINT NOT NULL DEFAULT 0', 'SELECT 1')
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'manual_published'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD COLUMN manual_creation_id CHAR(36) NULL', 'SELECT 1')
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'manual_creation_id'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD COLUMN manual_config JSON NULL', 'SELECT 1')
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'manual_config'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE teams ADD COLUMN manual_owner_id INT NULL', 'SELECT 1')
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'manual_owner_id'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD UNIQUE KEY uq_manual_creation (manual_owner_id, manual_creation_id)', 'SELECT 1')
 FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND INDEX_NAME = 'uq_manual_creation'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;

SET @manual_scorer_ddl = (
 SELECT IF(COUNT(*) = 0, 'ALTER TABLE matches ADD INDEX idx_manual_owner (manual_owner_id)', 'SELECT 1')
 FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND INDEX_NAME = 'idx_manual_owner'
);
PREPARE manual_scorer_stmt FROM @manual_scorer_ddl;
EXECUTE manual_scorer_stmt;
DEALLOCATE PREPARE manual_scorer_stmt;
