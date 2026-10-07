UPDATE team_entries te
JOIN competitions c ON c.id = te.competition_id
SET te.age_group_id = c.age_group_id
WHERE te.age_group_id IS NULL
  AND c.age_group_id IS NOT NULL;

UPDATE team_competitions tc
JOIN competitions c ON c.id = tc.competition_id
SET tc.age_group_id = c.age_group_id
WHERE tc.age_group_id IS NULL
  AND c.age_group_id IS NOT NULL;
