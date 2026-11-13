const fields = ['home_set_score', 'away_set_score', 'winner_team_id', 'set_scores', 'home_lineup', 'away_lineup', 'home_libero', 'away_libero', 'team_a_score', 'team_b_score', 'live_state', 'match_state', 'first_serve_team_id', 'left_side_team_id'];
const normalize = value => {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { /* Plain scalar. */ } }
    if (value == null || value === '' || value === 0 || (Array.isArray(value) && !value.length)) return '';
    return JSON.stringify(value);
};
function assertAdminRecordingPolicy(user, body, previous = {}) {
    if (user?.role !== 'admin') return;
    if (fields.some(field => body[field] !== undefined && normalize(body[field]) !== normalize(previous[field]))) {
        throw Object.assign(new Error('Administrators cannot record scores, lineups or statistics'), { statusCode: 403 });
    }
}
module.exports = { assertAdminRecordingPolicy };
