-- Remove duplicate competition category rows that have no registrations or matches.
-- A valid category is the unique combination of title, gender, and age_group_id.

DELETE c
FROM competitions c
JOIN competitions keeper
  ON keeper.title = c.title
 AND keeper.gender = c.gender
 AND keeper.age_group_id = c.age_group_id
 AND keeper.id <> c.id
LEFT JOIN team_entries te ON te.competition_id = c.id
LEFT JOIN team_competitions tc ON tc.competition_id = c.id
LEFT JOIN matches m ON m.competition_id = c.id
WHERE te.id IS NULL
  AND tc.competition_id IS NULL
  AND m.id IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM team_entries keeper_te
      WHERE keeper_te.competition_id = keeper.id
    )
    OR EXISTS (
      SELECT 1
      FROM team_competitions keeper_tc
      WHERE keeper_tc.competition_id = keeper.id
    )
    OR EXISTS (
      SELECT 1
      FROM matches keeper_m
      WHERE keeper_m.competition_id = keeper.id
    )
    OR keeper.id < c.id
  );
