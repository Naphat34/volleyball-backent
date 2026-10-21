const finishedStatuses = new Set(['completed', 'finished', 'match_finished']);
export const isMatchFinished = (status) => finishedStatuses.has(String(status || '').toLowerCase());
export const isMatchLive = (status) => ['live', 'set_playing', 'in_progress'].includes(String(status || '').toLowerCase());

// Shared by the public overview and full table, including best-of-three matches.
export function calculateStandings(teams, matches, competitions = []) {
    const stats = new Map(teams.map(team => [String(team.id), {
        id: team.id, name: team.name, logo_url: team.logo_url,
        played: 0, won: 0, lost: 0, points: 0, sets_won: 0, sets_lost: 0, points_won: 0, points_lost: 0
    }]));
    for (const match of matches) {
        if (!isMatchFinished(match.status)) continue;
        const home = stats.get(String(match.home_team_id));
        const away = stats.get(String(match.away_team_id));
        const h = Number(match.home_set_score ?? match.team_a_score) || 0;
        const a = Number(match.away_set_score ?? match.team_b_score) || 0;
        if (!home || !away || h === a) continue;
        const competition = competitions.find(item => String(item.id) === String(match.competition_id));
        const maxSets = Number(competition?.max_sets || match.max_sets) || 5;
        const winSets = Math.floor(maxSets / 2) + 1;
        home.played++; away.played++;
        home.sets_won += h; home.sets_lost += a;
        away.sets_won += a; away.sets_lost += h;
        const winner = h > a ? home : away;
        const loser = h > a ? away : home;
        winner.won++; loser.lost++;
        const closeMatch = Math.min(h, a) === winSets - 1;
        winner.points += closeMatch ? 2 : 3;
        loser.points += closeMatch ? 1 : 0;
        let sets = match.set_scores || [];
        if (typeof sets === 'string') { try { sets = JSON.parse(sets); } catch { sets = []; } }
        if (Array.isArray(sets)) for (const set of sets) {
            if (!set) continue;
            const parts = typeof set === 'string' ? set.split('-') : [];
            const sh = Number(set.home ?? set.team_a ?? set.home_score ?? parts[0]);
            const sa = Number(set.away ?? set.team_b ?? set.away_score ?? parts[1]);
            if (!Number.isFinite(sh) || !Number.isFinite(sa)) continue;
            home.points_won += sh; home.points_lost += sa;
            away.points_won += sa; away.points_lost += sh;
        }
    }
    const ratio = (won, lost) => lost ? won / lost : won ? 999 : 0;
    return [...stats.values()].map(team => {
        const setRatioVal = ratio(team.sets_won, team.sets_lost);
        const pointRatioVal = ratio(team.points_won, team.points_lost);
        return { ...team, setRatioVal, pointRatioVal,
            setRatioStr: !team.sets_lost && team.sets_won ? 'MAX' : setRatioVal.toFixed(3),
            pointRatioStr: !team.points_lost && team.points_won ? 'MAX' : pointRatioVal.toFixed(3) };
    }).sort((a, b) => b.points - a.points || b.won - a.won || b.setRatioVal - a.setRatioVal || b.pointRatioVal - a.pointRatioVal || String(a.name).localeCompare(String(b.name), 'th'));
}
