import { dashboardMatchStatus } from '../vis/dashboardStatus.js';
import { adminVisIssues } from '../vis/adminVims.js';

export function bangkokDay(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

export function matchPreparationIssues(match) {
    if (match.is_custom_vis || ['completed', 'cancelled'].includes(dashboardMatchStatus(match))) return [];
    const issues = [];
    if (!match.home_team_id || !match.away_team_id || String(match.home_team_id) === String(match.away_team_id)) issues.push('teams');
    if (!match.match_date || !match.start_time) issues.push('schedule');
    if (!String(match.location || '').trim()) issues.push('venue');
    if (!match.referee_1_id || !match.referee_2_id) issues.push('officials');
    return issues;
}

export function buildControlCenter(matches, competitions, now = new Date()) {
    const today = bangkokDay(now);
    const official = matches.filter(m => !m.is_custom_vis);
    const todayMatches = official.filter(m => m.match_date === today).sort((a, b) => String(a.start_time || '99:99').localeCompare(String(b.start_time || '99:99')));
    const needsPreparation = official.filter(m => matchPreparationIssues(m).length);
    const needsStatistics = matches.filter(m => adminVisIssues(m).length);
    const collisions = [];
    const scheduled = official.filter(m => m.match_date && m.start_time && !['cancelled', 'completed'].includes(dashboardMatchStatus(m)));
    const slots = new Map();
    for (const match of scheduled) {
        const key = `${match.match_date} ${String(match.start_time).slice(0, 5)}`;
        if (!slots.has(key)) slots.set(key, []);
        for (const other of slots.get(key)) {
            const sameVenue = match.location && String(match.location).trim() === String(other.location || '').trim();
            const sameTeam = [match.home_team_id, match.away_team_id].filter(Boolean).some(id => [other.home_team_id, other.away_team_id].some(otherId => otherId != null && String(id) === String(otherId)));
            if (sameVenue || sameTeam) collisions.push({ id: `${other.id}:${match.id}`, first: other, second: match, venue: Boolean(sameVenue), team: sameTeam });
        }
        slots.get(key).push(match);
    }
    return { today, todayMatches, needsPreparation, needsStatistics, collisions,
        total: official.length, live: official.filter(m => m.status === 'live').length,
        completed: official.filter(m => ['completed', 'finished', 'match_finished'].includes(m.status)).length,
        competitions: competitions.length, openCompetitions: competitions.filter(c => String(c.status).toLowerCase() === 'open').length };
}
