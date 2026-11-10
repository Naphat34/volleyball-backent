import { dashboardMatchStatus } from './dashboardStatus.js';
import { dashboardSetResult } from './dashboardResult.js';

export function filterAdminVis(matches, filters) {
    const query = (filters.search || '').trim().toLocaleLowerCase();
    return matches.filter(m => (!filters.from || (m.match_date && m.match_date >= filters.from))
        && (!filters.to || (m.match_date && m.match_date <= filters.to))
        && (!filters.competition || m.competition_name === filters.competition)
        && (!filters.age || (m.age_group_name || m.category || '') === filters.age)
        && (!filters.gender || m.gender === filters.gender)
        && (!filters.team || [m.home_team, m.away_team].includes(filters.team))
        && (!filters.owner || (m.owner || 'unknown') === filters.owner)
        && (!filters.status || dashboardMatchStatus(m) === filters.status)
        && (!filters.vis || m.vis_summary?.status === filters.vis)
        && (!filters.source || m.source === filters.source)
        && (!query || [m.id, m.match_number, m.home_team, m.away_team, m.competition_name, m.location, m.owner].some(value => String(value || '').toLocaleLowerCase().includes(query))));
}

export function adminVisIssues(match) {
    if (dashboardMatchStatus(match) === 'cancelled') return [];
    const issues = [];
    if (dashboardMatchStatus(match) === 'completed' && !['confirmed'].includes(match.vis_summary?.status)) issues.push('review');
    if (dashboardMatchStatus(match) === 'completed' && !match.action_count) issues.push('no_stats');
    if (match.action_count > 0 && ['home', 'away'].some(key => match.lineup_counts?.[key] !== 6)) issues.push('lineup');
    if (match.offline_checked_out) issues.push('offline');
    if (['review', 'confirmed'].includes(match.vis_summary?.status) && ['completed', 'finished'].includes(match.status)
        && !match.is_custom_vis && match.official_summary?.setsWon && match.vis_summary?.setsWon
        && ['home', 'away'].some(key => Number(match.official_summary.setsWon[key]) !== Number(match.vis_summary.setsWon[key]))) issues.push('result');
    return issues;
}

export function summarizeAdminVis(matches) {
    return { total: matches.length, scheduled: matches.filter(m => dashboardMatchStatus(m) === 'scheduled').length,
        recording: matches.filter(m => m.vis_summary?.status === 'recording').length,
        completed: matches.filter(m => dashboardMatchStatus(m) === 'completed').length,
        review: matches.filter(m => dashboardMatchStatus(m) === 'completed' && m.vis_summary?.status !== 'confirmed').length,
        confirmed: matches.filter(m => m.vis_summary?.status === 'confirmed').length,
        offline: matches.filter(m => m.offline_checked_out).length,
        issues: matches.filter(m => adminVisIssues(m).length).length };
}

export function rankAdminVis(matches, includeUnconfirmed = false) {
    const eligible = matches.filter(m => dashboardMatchStatus(m) !== 'cancelled' && (includeUnconfirmed || m.vis_summary?.status === 'confirmed'));
    const players = new Map(), teams = new Map();
    for (const match of eligible) for (const stat of match.statistics || []) {
        const prefix = match.is_custom_vis ? `custom:${match.id}` : 'official';
        const teamKey = `${prefix}:${stat.team_id}`, playerKey = stat.master_player_id != null ? `athlete:${stat.master_player_id}` : !match.is_custom_vis ? `athlete:${stat.id}` : `${teamKey}:${stat.id}`;
        const add = (map, key, name, extra = {}) => {
            if (!map.has(key)) map.set(key, { key, name, ...extra, attack: 0, block: 0, serve: 0, attackAttempts: 0, attackErrors: 0, attackBlocked: 0, matches: new Set() });
            const row = map.get(key);
            for (const field of ['attack', 'block', 'serve', 'attackAttempts', 'attackErrors', 'attackBlocked']) row[field] += Number(stat[field]) || 0;
            row.matches.add(String(match.id));
        };
        add(teams, teamKey, stat.team_name);
        if (stat.id != null) add(players, playerKey, stat.name || `#${stat.number || stat.id}`, { team: stat.team_name, number: stat.number });
    }
    const finish = map => [...map.values()].map(row => ({ ...row, matches: row.matches.size, points: row.attack + row.block + row.serve,
        efficiency: row.attackAttempts ? ((row.attack - row.attackErrors - row.attackBlocked) / row.attackAttempts * 100).toFixed(1) + '%' : '-' }))
        .sort((a, b) => b.points - a.points || b.attack - a.attack || String(a.name).localeCompare(String(b.name)));
    return { players: finish(players), teams: finish(teams), matchCount: eligible.filter(m => m.statistics?.length).length };
}

function csvTable(rows) {
    const cell = value => {
        let text = String(value ?? '');
        if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replaceAll('"', '""') + '"';
    };
    return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}

export function adminVisCsv(matches) {
    return csvTable([['Match', 'Competition', 'Date', 'Time', 'Home', 'Away', 'Sets', 'Match status', 'VIMS status', 'Owner', 'Source', 'Last sync', 'Issues'],
        ...matches.map(m => [m.match_number || m.id, m.competition_name, m.match_date, m.start_time, m.home_team, m.away_team, dashboardSetResult(m), dashboardMatchStatus(m), m.vis_summary?.status, m.owner, m.source, m.last_synced_at, adminVisIssues(m).join(' | ')])]);
}

export function adminVisRankingCsv(rows) {
    return csvTable([['Rank', 'Name', 'Team', 'Matches', 'Points', 'Attack', 'Block', 'Ace', 'Attack attempts', 'Attack efficiency'],
        ...rows.map((row, index) => [index + 1, row.name, row.team || row.name, row.matches, row.points, row.attack, row.block, row.serve, row.attackAttempts, row.efficiency])]);
}
