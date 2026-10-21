const { visDashboardSummary } = require('./visWorkflow');
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
function dashboardMatch(row, actions) {
    const { vis_state, live_state, ...match } = row;
    const setup = { ...parse(vis_state) }; delete setup.offlineVis;
    const live = parse(live_state), score = live.score;
    const valid = score && ['home','away'].every(key => score[key] != null && Number.isFinite(Number(score[key])) && Number(score[key]) >= 0);
    return { ...match, vis_summary: visDashboardSummary({ ...match, vis_state: setup }, actions),
        official_summary: { status: match.status, currentSet: Number(live.currentSet || live.matchData?.currentSet || 1),
            score: valid ? { home: Number(score.home), away: Number(score.away) } : null,
            setsWon: { home: Number(match.home_set_score || 0), away: Number(match.away_set_score || 0) } } };
}
async function attachDashboardSummaries(db, rows) {
    const grouped = new Map();
    for (let start = 0; start < rows.length; start += 500) {
        const ids = rows.slice(start, start + 500).map(row => row.id);
        const result = await db.query(`SELECT id, match_id, action_type, set_number, team_id, player_id, skill, grade, score_home, score_away, details, description
            FROM match_actions WHERE action_type='VIS_STAT' AND match_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids);
        for (const action of result.rows) {
            const key = String(action.match_id);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(action);
        }
    }
    return rows.map(row => dashboardMatch(row, grouped.get(String(row.id)) || []));
}
module.exports = { dashboardMatch, attachDashboardSummaries };
