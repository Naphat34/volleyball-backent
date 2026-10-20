CREATE TABLE IF NOT EXISTS scorer_offline_sessions (
 match_id INT NOT NULL PRIMARY KEY,
 owner_id INT NOT NULL,
 device_id VARCHAR(80) NOT NULL,
 expires_at BIGINT NOT NULL,
 fingerprint CHAR(64) NOT NULL,
 receipts JSON NOT NULL,
 checkpoint JSON NULL,
 released TINYINT NOT NULL DEFAULT 0,
 synced_at DATETIME NULL
);
