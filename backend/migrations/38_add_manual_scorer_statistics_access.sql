-- Opt-in statistics access is independent of public Livescore publishing.

SET @manual_vis_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE matches ADD COLUMN manual_vis_shared TINYINT NOT NULL DEFAULT 0', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='manual_vis_shared');
PREPARE manual_vis_stmt FROM @manual_vis_ddl;
EXECUTE manual_vis_stmt;
DEALLOCATE PREPARE manual_vis_stmt;

SET @manual_vis_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE matches ADD COLUMN manual_vis_assignee_id INT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='manual_vis_assignee_id');
PREPARE manual_vis_stmt FROM @manual_vis_ddl;
EXECUTE manual_vis_stmt;
DEALLOCATE PREPARE manual_vis_stmt;

SET @manual_vis_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE matches ADD COLUMN manual_vis_claimed_at DATETIME NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='manual_vis_claimed_at');
PREPARE manual_vis_stmt FROM @manual_vis_ddl;
EXECUTE manual_vis_stmt;
DEALLOCATE PREPARE manual_vis_stmt;
