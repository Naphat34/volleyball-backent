-- User access requires status = 'active'. Keep team registration status separate.
UPDATE users
SET status = 'active'
WHERE LOWER(TRIM(status)) = 'approved';
