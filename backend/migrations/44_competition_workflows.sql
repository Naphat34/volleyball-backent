CREATE TABLE competition_workflows (
    competition_id INT PRIMARY KEY,
    revision INT NOT NULL DEFAULT 1,
    state LONGTEXT NOT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE RESTRICT,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);
CREATE TABLE competition_workflow_matches (
    match_id INT PRIMARY KEY,
    competition_id INT NOT NULL,
    phase VARCHAR(20) NOT NULL,
    pool_name VARCHAR(50),
    slot_key VARCHAR(30),
    home_source TEXT,
    away_source TEXT,
    UNIQUE KEY workflow_slot (competition_id,slot_key),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE RESTRICT,
    FOREIGN KEY (competition_id) REFERENCES competition_workflows(competition_id) ON DELETE RESTRICT,
    KEY workflow_competition (competition_id)
);
ALTER TABLE matches ADD COLUMN result_type VARCHAR(20) NOT NULL DEFAULT 'normal', ADD COLUMN forfeit_reason TEXT NULL;
CREATE TABLE competition_workflow_rulings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL DEFAULT (UUID()) UNIQUE,
    competition_id INT NOT NULL,
    match_id INT NOT NULL,
    original_snapshot LONGTEXT NOT NULL,
    awarded_result TEXT NOT NULL,
    reason TEXT NOT NULL,
    decided_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reversed_at TIMESTAMP NULL,
    reversed_by INT NULL,
    reversal_reason TEXT,
    FOREIGN KEY (competition_id) REFERENCES competition_workflows(competition_id),
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (decided_by) REFERENCES users(id),
    FOREIGN KEY (reversed_by) REFERENCES users(id),
    KEY ruling_match (match_id)
);
