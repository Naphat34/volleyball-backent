-- Standalone VIS matches do not enter competition standings or master rosters.
CREATE TABLE IF NOT EXISTS custom_vis_matches (
  id VARCHAR(48) PRIMARY KEY,
  owner_id INT NOT NULL,
  public_token VARCHAR(64) NOT NULL UNIQUE,
  published TINYINT(1) NOT NULL DEFAULT 0,
  payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_custom_vis_owner (owner_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
