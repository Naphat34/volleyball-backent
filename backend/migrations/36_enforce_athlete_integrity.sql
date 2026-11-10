-- Athlete master defaults and entry snapshots remain independent.
-- This migration never deletes or rewrites athlete data. Preflight existing conflicts first.
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND INDEX_NAME='uq_team_entry_players_entry_number'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD UNIQUE KEY uq_team_entry_players_entry_number (team_entry_id, number)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND CONSTRAINT_NAME='chk_players_libero'), 'SELECT 1', 'ALTER TABLE players ADD CONSTRAINT chk_players_libero CHECK (COALESCE(is_libero1,0) IN (0,1) AND COALESCE(is_libero2,0) IN (0,1) AND NOT(COALESCE(is_libero1,0)=1 AND COALESCE(is_libero2,0)=1) AND ((COALESCE(is_libero1,0)=0 AND COALESCE(is_libero2,0)=0) OR COALESCE(position,'''')=''L''))');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND CONSTRAINT_NAME='chk_entry_libero'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD CONSTRAINT chk_entry_libero CHECK (is_libero1 IN (0,1) AND is_libero2 IN (0,1) AND NOT(is_libero1=1 AND is_libero2=1) AND (is_libero1=0 OR COALESCE(role,'''') IN (''L'',''L1'',''L1+C'')) AND (is_libero2=0 OR COALESCE(role,'''') IN (''L'',''L2'',''L2+C'')) AND (COALESCE(role,'''') NOT IN (''L1'',''L1+C'') OR is_libero1=1) AND (COALESCE(role,'''') NOT IN (''L2'',''L2+C'') OR is_libero2=1))');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='integrity_captain_scope'), 'SELECT 1', 'ALTER TABLE players ADD COLUMN integrity_captain_scope INT GENERATED ALWAYS AS (CASE WHEN COALESCE(is_active,1)=1 AND is_captain=1 THEN team_id ELSE NULL END) VIRTUAL');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND INDEX_NAME='uq_players_captain'), 'SELECT 1', 'ALTER TABLE players ADD UNIQUE KEY uq_players_captain (integrity_captain_scope)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='integrity_libero1_scope'), 'SELECT 1', 'ALTER TABLE players ADD COLUMN integrity_libero1_scope INT GENERATED ALWAYS AS (CASE WHEN COALESCE(is_active,1)=1 AND is_libero1=1 THEN team_id ELSE NULL END) VIRTUAL');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND INDEX_NAME='uq_players_libero1'), 'SELECT 1', 'ALTER TABLE players ADD UNIQUE KEY uq_players_libero1 (integrity_libero1_scope)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='integrity_libero2_scope'), 'SELECT 1', 'ALTER TABLE players ADD COLUMN integrity_libero2_scope INT GENERATED ALWAYS AS (CASE WHEN COALESCE(is_active,1)=1 AND is_libero2=1 THEN team_id ELSE NULL END) VIRTUAL');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND INDEX_NAME='uq_players_libero2'), 'SELECT 1', 'ALTER TABLE players ADD UNIQUE KEY uq_players_libero2 (integrity_libero2_scope)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND COLUMN_NAME='integrity_captain_scope'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD COLUMN integrity_captain_scope INT GENERATED ALWAYS AS (CASE WHEN is_captain=1 THEN team_entry_id ELSE NULL END) VIRTUAL');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND INDEX_NAME='uq_team_entry_players_captain'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD UNIQUE KEY uq_team_entry_players_captain (integrity_captain_scope)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND COLUMN_NAME='integrity_libero1_scope'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD COLUMN integrity_libero1_scope INT GENERATED ALWAYS AS (CASE WHEN is_libero1=1 THEN team_entry_id ELSE NULL END) VIRTUAL');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND INDEX_NAME='uq_team_entry_players_libero1'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD UNIQUE KEY uq_team_entry_players_libero1 (integrity_libero1_scope)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND COLUMN_NAME='integrity_libero2_scope'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD COLUMN integrity_libero2_scope INT GENERATED ALWAYS AS (CASE WHEN is_libero2=1 THEN team_entry_id ELSE NULL END) VIRTUAL');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND INDEX_NAME='uq_team_entry_players_libero2'), 'SELECT 1', 'ALTER TABLE team_entry_players ADD UNIQUE KEY uq_team_entry_players_libero2 (integrity_libero2_scope)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND INDEX_NAME='uq_players_national_id'), 'SELECT 1', 'ALTER TABLE players ADD UNIQUE KEY uq_players_national_id (national_id)');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_actions' AND CONSTRAINT_NAME='fk_match_actions_player_history'),'SELECT 1','ALTER TABLE match_actions ADD CONSTRAINT fk_match_actions_player_history FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_actions' AND CONSTRAINT_NAME='fk_match_actions_player'),'ALTER TABLE match_actions DROP FOREIGN KEY fk_match_actions_player','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_events' AND CONSTRAINT_NAME='fk_match_events_player_history'),'SELECT 1','ALTER TABLE match_events ADD CONSTRAINT fk_match_events_player_history FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_events' AND CONSTRAINT_NAME='fk_match_events_player'),'ALTER TABLE match_events DROP FOREIGN KEY fk_match_events_player','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_events' AND CONSTRAINT_NAME='fk_match_events_server_history'),'SELECT 1','ALTER TABLE match_events ADD CONSTRAINT fk_match_events_server_history FOREIGN KEY (server_player_id) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_events' AND CONSTRAINT_NAME='fk_match_events_server'),'ALTER TABLE match_events DROP FOREIGN KEY fk_match_events_server','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p1_history'),'SELECT 1','ALTER TABLE match_lineups ADD CONSTRAINT fk_match_lineups_player_p1_history FOREIGN KEY (player_id_p1) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p1'),'ALTER TABLE match_lineups DROP FOREIGN KEY fk_match_lineups_player_p1','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p2_history'),'SELECT 1','ALTER TABLE match_lineups ADD CONSTRAINT fk_match_lineups_player_p2_history FOREIGN KEY (player_id_p2) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p2'),'ALTER TABLE match_lineups DROP FOREIGN KEY fk_match_lineups_player_p2','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p3_history'),'SELECT 1','ALTER TABLE match_lineups ADD CONSTRAINT fk_match_lineups_player_p3_history FOREIGN KEY (player_id_p3) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p3'),'ALTER TABLE match_lineups DROP FOREIGN KEY fk_match_lineups_player_p3','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p4_history'),'SELECT 1','ALTER TABLE match_lineups ADD CONSTRAINT fk_match_lineups_player_p4_history FOREIGN KEY (player_id_p4) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p4'),'ALTER TABLE match_lineups DROP FOREIGN KEY fk_match_lineups_player_p4','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p5_history'),'SELECT 1','ALTER TABLE match_lineups ADD CONSTRAINT fk_match_lineups_player_p5_history FOREIGN KEY (player_id_p5) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p5'),'ALTER TABLE match_lineups DROP FOREIGN KEY fk_match_lineups_player_p5','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p6_history'),'SELECT 1','ALTER TABLE match_lineups ADD CONSTRAINT fk_match_lineups_player_p6_history FOREIGN KEY (player_id_p6) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_player_p6'),'ALTER TABLE match_lineups DROP FOREIGN KEY fk_match_lineups_player_p6','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_libero_history'),'SELECT 1','ALTER TABLE match_lineups ADD CONSTRAINT fk_match_lineups_libero_history FOREIGN KEY (libero_id) REFERENCES players(id) ON DELETE RESTRICT');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_lineups' AND CONSTRAINT_NAME='fk_match_lineups_libero'),'ALTER TABLE match_lineups DROP FOREIGN KEY fk_match_lineups_libero','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
CREATE TABLE IF NOT EXISTS custom_vis_player_links (
  match_id VARCHAR(48) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  side ENUM('home','away') NOT NULL,
  local_player_id INT NOT NULL,
  player_id INT NOT NULL,
  linked_by INT NOT NULL,
  linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(match_id, side, local_player_id),
  UNIQUE KEY uq_custom_match_athlete(match_id, player_id),
  CONSTRAINT fk_custom_link_match FOREIGN KEY(match_id) REFERENCES custom_vis_matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_custom_link_player FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Older installations used a longer name for the server-player FK.
SET @athlete_ddl=IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='match_events' AND CONSTRAINT_NAME='fk_match_events_server_player'),'ALTER TABLE match_events DROP FOREIGN KEY fk_match_events_server_player','SELECT 1');
PREPARE athlete_stmt FROM @athlete_ddl; EXECUTE athlete_stmt; DEALLOCATE PREPARE athlete_stmt;
