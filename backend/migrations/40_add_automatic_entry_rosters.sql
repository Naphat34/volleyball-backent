-- Existing assignments are retained. The first sync freezes closed/started entries.
SET @roster_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entries' AND COLUMN_NAME='roster_locked_at'),'SELECT 1','ALTER TABLE team_entries ADD COLUMN roster_locked_at DATETIME NULL');
PREPARE roster_stmt FROM @roster_ddl; EXECUTE roster_stmt; DEALLOCATE PREPARE roster_stmt;
SET @roster_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entries' AND COLUMN_NAME='roster_source_hash'),'SELECT 1','ALTER TABLE team_entries ADD COLUMN roster_source_hash VARCHAR(64) NULL');
PREPARE roster_stmt FROM @roster_ddl; EXECUTE roster_stmt; DEALLOCATE PREPARE roster_stmt;
SET @roster_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entries' AND COLUMN_NAME='roster_sync_error'),'SELECT 1','ALTER TABLE team_entries ADD COLUMN roster_sync_error TEXT NULL');
PREPARE roster_stmt FROM @roster_ddl; EXECUTE roster_stmt; DEALLOCATE PREPARE roster_stmt;
SET @roster_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_entry_players' AND COLUMN_NAME='athlete_snapshot'),'SELECT 1','ALTER TABLE team_entry_players ADD COLUMN athlete_snapshot JSON NULL');
PREPARE roster_stmt FROM @roster_ddl; EXECUTE roster_stmt; DEALLOCATE PREPARE roster_stmt;

UPDATE team_entry_players ep JOIN players p ON p.id=ep.player_id
SET ep.athlete_snapshot=JSON_OBJECT(
  'first_name',p.first_name,'last_name',p.last_name,
  'first_name_th',p.first_name_th,'last_name_th',p.last_name_th,
  'first_name_en',p.first_name_en,'last_name_en',p.last_name_en,
  'birth_date',p.birth_date,'gender',p.gender,'height_cm',p.height_cm,
  'weight',p.weight,'nationality',p.nationality,'photo',p.photo,'nickname',p.nickname)
WHERE ep.athlete_snapshot IS NULL;

UPDATE team_entries te JOIN competitions c ON c.id=te.competition_id
SET te.roster_locked_at=CURRENT_TIMESTAMP
WHERE te.roster_locked_at IS NULL AND (c.status <> 'open' OR c.start_date <= CURRENT_DATE
   OR EXISTS (SELECT 1 FROM matches m WHERE m.competition_id=te.competition_id
      AND (m.home_team_id=te.team_id OR m.away_team_id=te.team_id)
      AND (m.status <> 'scheduled' OR m.match_setup IS NOT NULL
        OR EXISTS (SELECT 1 FROM match_actions a WHERE a.match_id=m.id)
        OR EXISTS (SELECT 1 FROM match_events e WHERE e.match_id=m.id)
        OR EXISTS (SELECT 1 FROM match_lineups l WHERE l.match_id=m.id))));
