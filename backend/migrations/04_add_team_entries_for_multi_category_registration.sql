CREATE TABLE IF NOT EXISTS team_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  competition_id INT NOT NULL,
  display_name VARCHAR(150) NULL,
  gender VARCHAR(30) NULL,
  age_group_id INT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL,
  UNIQUE KEY uq_team_entries_team_competition (team_id, competition_id),
  KEY idx_team_entries_competition (competition_id),
  KEY idx_team_entries_team (team_id),
  CONSTRAINT fk_team_entries_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_team_entries_competition
    FOREIGN KEY (competition_id) REFERENCES competitions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_team_entries_age_group
    FOREIGN KEY (age_group_id) REFERENCES age_groups(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_entry_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_entry_id INT NOT NULL,
  player_id INT NOT NULL,
  number INT NULL,
  role VARCHAR(30) NULL,
  is_captain TINYINT(1) NOT NULL DEFAULT 0,
  is_libero1 TINYINT(1) NOT NULL DEFAULT 0,
  is_libero2 TINYINT(1) NOT NULL DEFAULT 0,
  is_playing TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_entry_players_entry_player (team_entry_id, player_id),
  KEY idx_team_entry_players_player (player_id),
  CONSTRAINT fk_team_entry_players_entry
    FOREIGN KEY (team_entry_id) REFERENCES team_entries(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_team_entry_players_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE CASCADE
);

INSERT IGNORE INTO team_entries
  (team_id, competition_id, display_name, gender, age_group_id, status, registered_at)
SELECT
  tc.team_id,
  tc.competition_id,
  CONCAT(t.name, ' - ', c.title),
  c.gender,
  c.age_group_id,
  COALESCE(tc.status, 'pending'),
  COALESCE(tc.registered_at, CURRENT_TIMESTAMP)
FROM team_competitions tc
JOIN teams t ON t.id = tc.team_id
JOIN competitions c ON c.id = tc.competition_id;

INSERT IGNORE INTO team_entry_players
  (team_entry_id, player_id, number, role, is_captain, is_libero1, is_libero2, is_playing)
SELECT
  te.id,
  p.id,
  p.number,
  p.position,
  COALESCE(p.is_captain, 0),
  COALESCE(p.is_libero1, 0),
  COALESCE(p.is_libero2, 0),
  COALESCE(p.is_playing, 1)
FROM team_entries te
JOIN players p ON p.team_id = te.team_id;
