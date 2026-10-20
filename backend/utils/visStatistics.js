// VIS statistics are recorded in match_actions. Retain legacy records from
// match_events only when that match has no canonical VIS action, avoiding double counts.
// Existing deployments mix utf8mb4_0900_ai_ci and utf8mb4_unicode_ci (and may
// include older character sets). Normalize both text columns before UNION;
// changing the connection collation alone does not override column collations.
const visStatisticsSource = `
    SELECT a.id, a.match_id, a.team_id, a.player_id,
        CONVERT(a.skill USING utf8mb4) COLLATE utf8mb4_unicode_ci AS skill,
        CONVERT(a.grade USING utf8mb4) COLLATE utf8mb4_unicode_ci AS grade
    FROM match_actions a
    WHERE UPPER(a.skill) IN ('A', 'S', 'B', 'R', 'D', 'E') AND a.grade IS NOT NULL
    UNION ALL
    SELECT e.id, e.match_id, e.team_id, e.player_id,
        CONVERT(e.skill USING utf8mb4) COLLATE utf8mb4_unicode_ci AS skill,
        CONVERT(e.grade USING utf8mb4) COLLATE utf8mb4_unicode_ci AS grade
    FROM match_events e
    WHERE UPPER(e.skill) IN ('A', 'S', 'B', 'R', 'D', 'E') AND e.grade IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM match_actions a WHERE a.match_id = e.match_id
          AND UPPER(a.skill) IN ('A', 'S', 'B', 'R', 'D', 'E') AND a.grade IS NOT NULL
      )
`;
module.exports = { visStatisticsSource };
