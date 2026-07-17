-- Align match_actions with application writes and add missing child-table
-- foreign keys for match logs, events, sets, and lineup player references.
--
-- Preflight before running:
-- SELECT COUNT(*) FROM match_actions a LEFT JOIN matches m ON m.id = a.match_id WHERE m.id IS NULL;
-- SELECT COUNT(*) FROM match_actions a LEFT JOIN teams t ON t.id = a.team_id WHERE a.team_id IS NOT NULL AND t.id IS NULL;
-- SELECT COUNT(*) FROM match_actions a LEFT JOIN players p ON p.id = a.player_id WHERE a.player_id IS NOT NULL AND p.id IS NULL;
-- SELECT COUNT(*) FROM match_events e LEFT JOIN matches m ON m.id = e.match_id WHERE e.match_id IS NOT NULL AND m.id IS NULL;
-- SELECT COUNT(*) FROM match_events e LEFT JOIN teams t ON t.id = e.team_id WHERE e.team_id IS NOT NULL AND t.id IS NULL;
-- SELECT COUNT(*) FROM match_events e LEFT JOIN players p ON p.id = e.player_id WHERE e.player_id IS NOT NULL AND p.id IS NULL;
-- SELECT COUNT(*) FROM match_events e LEFT JOIN players p ON p.id = e.server_player_id WHERE e.server_player_id IS NOT NULL AND p.id IS NULL;
-- SELECT COUNT(*) FROM match_sets s LEFT JOIN matches m ON m.id = s.match_id WHERE s.match_id IS NOT NULL AND m.id IS NULL;
--
-- Note: match_events.set_id is intentionally not constrained here. The
-- current application writes set_number into that column, not match_sets.id.

ALTER TABLE match_actions
  RENAME COLUMN `timestamp` TO created_at;

ALTER TABLE match_actions
  MODIFY COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE match_actions
  ADD INDEX idx_match_actions_match_id (match_id),
  ADD INDEX idx_match_actions_team_id (team_id),
  ADD INDEX idx_match_actions_player_id (player_id);

ALTER TABLE match_actions
  ADD CONSTRAINT fk_match_actions_match
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_match_actions_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_actions_player
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE match_events
  ADD INDEX idx_match_events_match_id (match_id),
  ADD INDEX idx_match_events_team_id (team_id),
  ADD INDEX idx_match_events_player_id (player_id),
  ADD INDEX idx_match_events_server_player_id (server_player_id);

ALTER TABLE match_events
  ADD CONSTRAINT fk_match_events_match
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_match_events_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_events_player
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_events_server_player
    FOREIGN KEY (server_player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE match_sets
  ADD INDEX idx_match_sets_match_id (match_id);

ALTER TABLE match_sets
  ADD CONSTRAINT fk_match_sets_match
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;

ALTER TABLE match_lineups
  ADD INDEX idx_match_lineups_player_p1 (player_id_p1),
  ADD INDEX idx_match_lineups_player_p2 (player_id_p2),
  ADD INDEX idx_match_lineups_player_p3 (player_id_p3),
  ADD INDEX idx_match_lineups_player_p4 (player_id_p4),
  ADD INDEX idx_match_lineups_player_p5 (player_id_p5),
  ADD INDEX idx_match_lineups_player_p6 (player_id_p6),
  ADD INDEX idx_match_lineups_libero_id (libero_id);

ALTER TABLE match_lineups
  ADD CONSTRAINT fk_match_lineups_player_p1
    FOREIGN KEY (player_id_p1) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_lineups_player_p2
    FOREIGN KEY (player_id_p2) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_lineups_player_p3
    FOREIGN KEY (player_id_p3) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_lineups_player_p4
    FOREIGN KEY (player_id_p4) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_lineups_player_p5
    FOREIGN KEY (player_id_p5) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_lineups_player_p6
    FOREIGN KEY (player_id_p6) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_match_lineups_libero
    FOREIGN KEY (libero_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE matches
  ADD INDEX idx_matches_first_serve_team_id (first_serve_team_id),
  ADD INDEX idx_matches_left_side_team_id (left_side_team_id);

ALTER TABLE matches
  ADD CONSTRAINT fk_matches_first_serve_team
    FOREIGN KEY (first_serve_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_matches_left_side_team
    FOREIGN KEY (left_side_team_id) REFERENCES teams(id) ON DELETE SET NULL;
