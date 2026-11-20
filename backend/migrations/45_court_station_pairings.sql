CREATE TABLE IF NOT EXISTS court_station_pairings (
    match_id INT NOT NULL,
    side CHAR(1) NOT NULL CHECK (side IN ('A', 'B')),
    pairing_id VARCHAR(36) NOT NULL,
    paired_user_id INT NULL,
    PRIMARY KEY (match_id, side),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (paired_user_id) REFERENCES users(id) ON DELETE CASCADE
);
