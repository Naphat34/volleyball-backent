-- The legacy numeric/word ENUM rejects canonical VIS grades (#, +, !, -, =).
-- Widen to text, retaining every existing grade value (including legacy words)
-- and NULLs. No match scores, events or player records are deleted or rewritten.
ALTER TABLE match_events
  MODIFY COLUMN grade VARCHAR(32) NULL DEFAULT NULL;
