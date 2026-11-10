const { dashboardMatch } = require('./matchDashboard');
const { view } = require('./customVis');
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const safeDate = value => value instanceof Date ? value.toISOString() : value || null;
const dateOnly = value => value instanceof Date ? value.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : String(value || '').slice(0, 10);
const fields = ['id', 'match_number', 'competition_id', 'competition_name', 'competition_name_th', 'competition_name_en', 'age_group_name', 'category', 'gender', 'round_name', 'pool_name', 'location', 'home_team_id', 'away_team_id', 'home_team', 'away_team', 'home_team_code', 'away_team_code', 'max_sets', 'status', 'home_set_score', 'away_set_score', 'vis_summary', 'official_summary', 'is_custom_vis', 'vis_lifecycle'];

function summarizePlayers(actions, match, roster = []) {
    const players = new Map();
    for (const action of actions) {
        if (!['A', 'B', 'S', 'R', 'D', 'E'].includes(action.skill) || !['#', '+', '!', '-', '=', '/'].includes(action.grade)) continue;
        const team = String(action.team_id) === String(match.home_team_id) ? 'home' : String(action.team_id) === String(match.away_team_id) ? 'away' : null;
        if (!team) continue;
        const key = `${team}:${action.player_id ?? 'team'}`;
        if (!players.has(key)) {
            const player = roster.find(p => String(p.id) === String(action.player_id));
            players.set(key, { id: action.player_id, team, team_id: match[`${team}_team_id`], team_name: match[`${team}_team`],
                name: action.player_name || player?.name || [player?.first_name, player?.last_name].filter(Boolean).join(' ') || '',
                number: parse(action.details ?? action.description).jersey_number ?? action.player_number ?? player?.number ?? '',
                attack: 0, block: 0, serve: 0, attackAttempts: 0, attackErrors: 0, attackBlocked: 0, attempts: 0 });
        }
        const stat = players.get(key);
        stat.attempts++;
        if (action.skill === 'A') { stat.attackAttempts++; if (action.grade === '=') stat.attackErrors++; if (action.grade === '/') stat.attackBlocked++; }
        if (action.grade === '#') {
            if (action.skill === 'A') stat.attack++;
            if (action.skill === 'B') stat.block++;
            if (action.skill === 'S') stat.serve++;
        }
    }
    return [...players.values()];
}

function buildAdminVisMatch(row, actions = [], custom = false, now = Date.now()) {
    const payload = custom ? parse(row.payload) : null;
    const setup = custom ? payload.match?.vis_state || {} : parse(row.vis_state);
    const offline = custom ? payload : setup.offlineVis?.payload;
    const current = custom ? view(payload) : null;
    const input = custom ? current.match : row;
    const match = custom ? input : dashboardMatch(row, actions);
    const result = Object.fromEntries(fields.filter(key => match[key] !== undefined).map(key => [key, match[key]]));
    result.is_custom_vis = custom;
    result.referee_1_id = custom ? null : row.referee_1_id || null;
    result.referee_2_id = custom ? null : row.referee_2_id || null;
    result.match_date = dateOnly(match.match_date);
    const rawTime = match.start_time;
    result.start_time = rawTime instanceof Date ? rawTime.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
        : /^\d{2}:\d{2}/.test(String(rawTime || '')) ? String(rawTime).slice(0, 5)
            : rawTime && !Number.isNaN(new Date(rawTime).getTime()) ? new Date(rawTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) : '';
    const timeline = custom ? payload.actions || [] : actions;
    result.updated_at = safeDate(row.updated_at || timeline.at(-1)?.created_at || row.created_at);
    result.owner = custom ? row.owner_username || null : null;
    result.source = custom ? 'custom' : 'official';
    result.published = custom && Boolean(row.published);
    result.last_synced_at = safeDate(offline?.lastSyncedAt);
    result.offline_checked_out = Boolean(offline?.offlineLease && offline.offlineLease.expiresAt > now);
    result.lineup_counts = Object.fromEntries(['home', 'away'].map(key => [key, (setup.setups?.[match.vis_summary?.currentSet || 1]?.lineups?.[key] || setup.lineups?.[key] || []).filter(Boolean).length]));
    result.action_count = timeline.length;
    result.audit = (payload?.audit || []).map(item => ({ action: item.action, actor_id: item.actor_id, at: item.at, revision: item.revision }));
    result.statistics = summarizePlayers(timeline, result, custom ? [...(payload.config?.home?.players || []), ...(payload.config?.away?.players || [])] : []);
    return result;
}
module.exports = { buildAdminVisMatch, summarizePlayers };
