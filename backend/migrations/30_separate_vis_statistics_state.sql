-- Isolate statistics retries/history from eScoreControl's live_state.
-- No scores, results or historical events are changed.
ALTER TABLE matches ADD COLUMN vis_state JSON NULL;
