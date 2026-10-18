-- Store account contact details separately from the team's registration data.
ALTER TABLE users
  ADD COLUMN email VARCHAR(255) NULL,
  ADD COLUMN phone VARCHAR(50) NULL;

-- Preserve the contact details already provided during team registration.
-- Prefer the team's mobile number, then fall back to its general phone number.
UPDATE users u
JOIN teams t ON t.id = u.team_id
SET
  u.email = COALESCE(u.email, NULLIF(TRIM(t.email), '')),
  u.phone = COALESCE(u.phone, NULLIF(TRIM(t.mobile_phone), ''), NULLIF(TRIM(t.phone), ''))
WHERE u.email IS NULL OR u.phone IS NULL;
