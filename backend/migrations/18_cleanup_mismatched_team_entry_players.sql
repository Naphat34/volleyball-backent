DELETE tep
FROM team_entry_players tep
JOIN team_entries te ON te.id = tep.team_entry_id
JOIN competitions c ON c.id = te.competition_id
JOIN players p ON p.id = tep.player_id
WHERE LOWER(CONVERT(COALESCE(te.gender, c.gender, '') USING utf8mb4) COLLATE utf8mb4_general_ci)
      IN ('male', 'men', 'm', 'female', 'women', 'f')
  AND NOT (
    (
      LOWER(CONVERT(COALESCE(te.gender, c.gender, '') USING utf8mb4) COLLATE utf8mb4_general_ci)
        IN ('male', 'men', 'm')
      AND LOWER(CONVERT(COALESCE(p.gender, '') USING utf8mb4) COLLATE utf8mb4_general_ci)
        IN ('male', 'men', 'm')
    )
    OR
    (
      LOWER(CONVERT(COALESCE(te.gender, c.gender, '') USING utf8mb4) COLLATE utf8mb4_general_ci)
        IN ('female', 'women', 'f')
      AND LOWER(CONVERT(COALESCE(p.gender, '') USING utf8mb4) COLLATE utf8mb4_general_ci)
        IN ('female', 'women', 'f')
    )
  );
