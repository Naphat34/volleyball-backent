CREATE TABLE IF NOT EXISTS team_entry_staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_entry_id INT NOT NULL,
  staff_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_team_entry_staff (team_entry_id, staff_id),
  KEY idx_team_entry_staff_entry (team_entry_id),
  KEY idx_team_entry_staff_staff (staff_id),
  CONSTRAINT fk_team_entry_staff_entry
    FOREIGN KEY (team_entry_id) REFERENCES team_entries(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_team_entry_staff_staff
    FOREIGN KEY (staff_id) REFERENCES team_staff(id)
    ON DELETE CASCADE
);
