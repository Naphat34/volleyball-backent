const { isVisSkill, isVisGrade, normalizeVisSkill, normalizeVisGrade } = require('../config/visCodes');

function formatVisEventCode(skill, jerseyNumber, grade) {
    const number = jerseyNumber == null || String(jerseyNumber).trim() === '' ? NaN : Number(jerseyNumber);
    if (!isVisSkill(skill) || !isVisGrade(grade) || !Number.isSafeInteger(number) || number < 0) return null;
    return `${normalizeVisSkill(skill)}${number}${normalizeVisGrade(grade)}`;
}

async function getVisJerseyNumber(connection, match, teamId, playerId) {
    // Match registration numbers take precedence over the player's default number.
    const ageGroup = match.effective_age_group_id ?? match.age_group_id ?? null;
    const gender = match.effective_gender ?? match.gender ?? null;
    const result = await connection.query(`SELECT COALESCE((
        SELECT tep.number FROM team_entry_players tep
        JOIN team_entries te ON te.id = tep.team_entry_id
        JOIN competitions c ON c.id = te.competition_id
        WHERE tep.player_id = p.id AND te.team_id = p.team_id AND te.competition_id = ?
          AND (? IS NULL OR COALESCE(te.age_group_id, c.age_group_id) = ?)
          AND (? IS NULL OR LOWER(CONVERT(COALESCE(te.gender, c.gender, '') USING utf8mb4) COLLATE utf8mb4_general_ci)
              = LOWER(CONVERT(? USING utf8mb4) COLLATE utf8mb4_general_ci))
        ORDER BY te.id LIMIT 1
    ), p.number) AS jersey_number FROM players p WHERE p.id = ? AND p.team_id = ?`,
    [match.competition_id, ageGroup, ageGroup, gender, gender, playerId, teamId]);
    return result.rows[0]?.jersey_number;
}

module.exports = { formatVisEventCode, getVisJerseyNumber };
