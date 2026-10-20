-- Keep the complete VIS action context independently from eScoreControl.
-- description remains a short human-readable code (for example S21#), while
-- details stores score, lineup and operation metadata for recovery and audit.
ALTER TABLE match_actions
  ADD COLUMN details JSON NULL AFTER description,
  ADD COLUMN operation_id VARCHAR(80) NULL AFTER details,
  ADD INDEX idx_match_actions_vis_operation (match_id, action_type, operation_id);
