import { dashboardSetResult } from './dashboardResult.js';
import { dashboardMatchStatus } from './dashboardStatus.js';

export function groupVisMatches(rows, allMatches = rows) {
    const keyOf = match => `${match.is_custom_vis ? 'custom' : 'official'}:${match.competition_id || match.competition_name || 'vis'}`;
    const counts = new Map();
    for (const match of allMatches) counts.set(keyOf(match), (counts.get(keyOf(match)) || 0) + 1);
    const groups = new Map();
    for (const match of rows) {
        const key = keyOf(match);
        if (!groups.has(key)) groups.set(key, { key, title: match.competition_name || 'VIS', total: counts.get(key), matches: [] });
        groups.get(key).matches.push(match);
    }
    return [...groups.values()];
}

export function visMatchSortValue(match, field, competitionLabel) {
    switch (field) {
        case 'number': return match.match_number ?? '';
        case 'date': return `${match.match_date || ''} ${match.start_time || ''}`;
        case 'time': return match.start_time || '';
        case 'match': return `${match.home_team || ''} ${match.away_team || ''}`;
        case 'competition': return competitionLabel(match);
        case 'score': return dashboardSetResult(match);
        case 'status': return dashboardMatchStatus(match);
        default: return match.updated_at || match.created_at || match.match_date || '';
    }
}
