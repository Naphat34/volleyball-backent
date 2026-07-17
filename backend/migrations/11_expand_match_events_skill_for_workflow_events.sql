-- Allow match_events.skill to store workflow/action event names such as
-- COIN_TOSS_WINNER, FIRST_SERVE, SUBSTITUTION, SANCTION, and SET_START.
-- Older schemas used short VIS/stat codes here, which truncates long names
-- and causes event sync to fail with WARN_DATA_TRUNCATED.

ALTER TABLE match_events
  MODIFY COLUMN skill VARCHAR(64) NULL;
