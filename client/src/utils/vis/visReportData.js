import { eventDetails } from './visPresentation.js';

const skills = ['S', 'R', 'A', 'B', 'D', 'E'];
const grades = ['#', '+', '!', '-', '=', '/'];
const parse = value => {
    try { return typeof value === 'string' ? JSON.parse(value) : value || {}; }
    catch { return {}; }
};
const blank = () => Object.fromEntries(skills.map(skill => [skill, Object.fromEntries(grades.map(grade => [grade, 0]))]));
export const attempts = (stats, skill) => grades.reduce((sum, grade) => sum + stats[skill][grade], 0);
export const playerPoints = stats => stats.A['#'] + stats.S['#'] + stats.B['#'];
export const percentage = (numerator, denominator) => denominator ? `${(numerator / denominator * 100).toFixed(1)}%` : '-';

export function buildVisReport(data) {
    const { match, events = [], visActions = [], sets = [], homePlayers = [], awayPlayers = [] } = data;
    // Official timeline stays in match_events; VIS actions are supplied separately.
    const reportEvents = [...events, ...visActions.map(action => ({ ...action,
        set_id: action.set_number, details: action.details ?? action.description }))];
    const live = parse(match.live_state);
    // Never promote old VIS-generated score snapshots into official results.
    const state = live.vis && live.scoringSource !== 'escore' ? null : live;
    const firstStart = events.find(event => event.skill === 'MATCH_START' && !eventDetails(event).vis);
    const firstHomeLeft = match.left_side_team_id ? String(match.left_side_team_id) === String(match.home_team_id) : eventDetails(firstStart).isHomeLeft;
    const homeIsA = typeof firstHomeLeft === 'boolean' ? firstHomeLeft
        : match.left_side_team_id ? String(match.left_side_team_id) === String(match.home_team_id) : true;
    const teams = [
        { key: 'home', id: match.home_team_id, name: match.home_team_name || match.home_team || 'ทีมเหย้า', roster: homePlayers },
        { key: 'away', id: match.away_team_id, name: match.away_team_name || match.away_team || 'ทีมเยือน', roster: awayPlayers },
    ].map(team => ({ ...team, label: (team.key === 'home') === homeIsA ? 'A' : 'B', stats: blank(), count: 0,
        players: team.roster.map(player => ({ ...player, stats: blank(), count: 0 })), opponentErrors: 0 }));
    let excluded = 0;
    const statEvents = [];
    for (const event of reportEvents) {
        if (!skills.includes(event.skill)) continue;
        const team = teams.find(item => String(item.id) === String(event.team_id));
        if (!team || !grades.includes(event.grade)) { excluded++; continue; }
        let player = team.players.find(item => String(item.id) === String(event.player_id));
        const details = eventDetails(event);
        if (!player && event.player_id != null) {
            player = { id: event.player_id, number: details.jersey_number ?? '?', first_name: 'ไม่พบชื่อในรายชื่อปัจจุบัน', stats: blank(), count: 0 };
            team.players.push(player);
        }
        team.stats[event.skill][event.grade]++;
        team.count++;
        if (player) {
            player.number = details.jersey_number ?? player.number;
            player.stats[event.skill][event.grade]++;
            player.count++;
        }
        if (event.grade === '=') teams.find(item => item !== team).opponentErrors++;
        statEvents.push(event);
    }
    const setMap = new Map(sets.map(set => [Number(set.set_number), {
        number: Number(set.set_number), home: Number(set.home_score), away: Number(set.away_score), finished: Boolean(set.end_time),
    }]));
    for (const set of state?.completedSets || []) setMap.set(Number(set.set ?? set.set_number), { number: Number(set.set ?? set.set_number), home: set.home, away: set.away, finished: true });
    if (['SERVING', 'RALLY', 'PLAYING'].includes(state?.workflowStep) && state.score) setMap.set(Number(state.matchData?.currentSet || match.current_set || 1), {
        number: Number(state.matchData?.currentSet || match.current_set || 1), ...state.score, finished: false,
    });
    const orderedEvents = [...reportEvents].sort((a, b) => Number(a.id) - Number(b.id));
    // Include a live set even if an older endpoint has not updated match_sets yet.
    if (!state?.score && orderedEvents.some(event => event.skill === 'POINT' && !eventDetails(event).vis)) {
        const last = orderedEvents.filter(event => event.skill === 'POINT' && !eventDetails(event).vis).at(-1);
        const number = Number(last.set_number ?? last.set_id);
        if (number && !setMap.get(number)?.finished && last.score_home != null && last.score_away != null) {
            setMap.set(number, { number, home: Number(last.score_home), away: Number(last.score_away), finished: false });
        }
    }
    teams.sort((a, b) => a.label.localeCompare(b.label));
    const completed = state?.workflowStep === 'MATCH_FINISHED' || ['completed', 'finished'].includes(match.status);
    return { match, teams, events: orderedEvents, statEvents, sets: [...setMap.values()].sort((a, b) => a.number - b.number), excluded,
        completed, hasStats: statEvents.length > 0, state,
        wins: state?.setsWon || { home: Number(match.home_set_score || 0), away: Number(match.away_set_score || 0) } };
}
