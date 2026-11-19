import { dashboardSetResult } from './dashboardResult.js';
import { dashboardMatchStatus } from './dashboardStatus.js';

export function visCompetitionName(name = '') {
    return String(name).replace(/\s*\((?:male|female|men|women|boys|girls|ชาย|หญิง)\)\s*$/i, '').trim();
}

export function visCompetitionKey(name) {
    return 'name:' + visCompetitionName(name).toLocaleLowerCase();
}

export function visMatchGender(match) {
    const value=String(match.gender || match.competition_gender || '').trim().toLowerCase();
    if(['male','men','boys','m','ชาย'].includes(value))return 'Male';
    if(['female','women','girls','f','หญิง'].includes(value))return 'Female';
    return value;
}
export function groupVisMatches(rows, allMatches = rows, {combineByName=false} = {}) {
    const keyOf = match => `${match.is_custom_vis ? 'custom' : 'official'}:${combineByName&&match.competition_name?visCompetitionKey(match.competition_name):match.competition_id || match.competition_name || 'vis'}`;
    const counts = new Map();
    for (const match of allMatches) counts.set(keyOf(match), (counts.get(keyOf(match)) || 0) + 1);
    const groups = new Map();
    for (const match of rows) {
        const key = keyOf(match);
        if (!groups.has(key)) groups.set(key, { key, title: (combineByName?visCompetitionName(match.competition_name):match.competition_name) || 'VIMS', total: counts.get(key), matches: [] });
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
