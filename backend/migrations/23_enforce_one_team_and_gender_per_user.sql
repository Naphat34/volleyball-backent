ALTER TABLE teams
  ADD COLUMN gender VARCHAR(10) NULL,
  ADD UNIQUE KEY uq_teams_user_id (user_id);

UPDATE teams t
JOIN (
  SELECT team_id,
         MIN(CASE
           WHEN LOWER(gender) IN ('male', 'men', 'm') THEN 'Male'
           WHEN LOWER(gender) IN ('female', 'women', 'f') THEN 'Female'
         END) AS gender
  FROM (
    SELECT te.team_id, c.gender
    FROM team_entries te
    JOIN competitions c ON c.id = te.competition_id
    WHERE c.gender IS NOT NULL
    UNION ALL
    SELECT tc.team_id, c.gender
    FROM team_competitions tc
    JOIN competitions c ON c.id = tc.competition_id
    WHERE c.gender IS NOT NULL
    UNION ALL
    SELECT p.team_id, p.gender
    FROM players p
    WHERE p.gender IS NOT NULL
  ) registrations
  GROUP BY team_id
  HAVING COUNT(DISTINCT CASE
    WHEN LOWER(gender) IN ('male', 'men', 'm') THEN 'Male'
    WHEN LOWER(gender) IN ('female', 'women', 'f') THEN 'Female'
  END) = 1
) registered_gender ON registered_gender.team_id = t.id
SET t.gender = registered_gender.gender
WHERE t.gender IS NULL;
