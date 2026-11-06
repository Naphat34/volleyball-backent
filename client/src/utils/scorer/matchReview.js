export const flag = value => value === true || value === 'true' || value === 1 || value === '1';
export const playerNumber = player => player.number ?? player.jersey_number ?? player.shirt_number;
export const playerName = player => player.name || player.full_name || [player.first_name || player.firstname, player.last_name || player.lastname].filter(Boolean).join(' ');
export const isLibero = player => ['L', 'L1', 'L2', 'LIBERO'].includes(String(player.role || player.position || '').toUpperCase()) || flag(player.is_libero) || flag(player.is_libero1) || flag(player.is_libero2);
export const isCaptain = player => flag(player.is_captain) || flag(player.isCaptain) || String(player.role || '').toUpperCase() === 'C';

export function reviewMatch({ roster, sheet, manual, matchId }) {
    const checks = [], add = (code, status) => checks.push({ code, status });
    const match = { ...roster?.match, ...sheet?.match, ...manual?.match };
    const sameId = value => value?.match && String(value.match.id) === String(matchId);
    add('source', sameId(roster) && sameId(sheet) && (!manual || sameId(manual)) ? 'pass' : 'block');
    add('teams', match.home_team_id && match.away_team_id && String(match.home_team_id) !== String(match.away_team_id) ? 'pass' : 'block');
    add('schedule', (match.match_date || match.start_date || match.start_time) && match.location ? 'pass' : 'warning');
    for (const side of ['home', 'away']) {
        const players = roster?.[side]?.players;
        if (!Array.isArray(players)) { add(`${side}Roster`, 'unknown'); continue; }
        const numbers = players.map(playerNumber);
        const valid = players.length >= 6 && players.every(p => playerName(p) && Number.isInteger(Number(playerNumber(p))) && Number(playerNumber(p)) > 0)
            && new Set(numbers.map(Number)).size === players.length;
        add(`${side}Roster`, valid ? 'pass' : 'warning');
        add(`${side}Roles`, players.filter(isCaptain).length === 1 && players.filter(isLibero).length <= 2 ? 'pass' : 'warning');
    }
    const config = manual?.config;
    const maxSets = Number(config?.maxSets ?? match.max_sets);
    const points = Number(config?.pointsPerSet ?? match.points_per_set ?? 25);
    const deciding = Number(config?.decidingSetPoints ?? match.deciding_set_points ?? 15);
    const validRules = [3, 5].includes(maxSets) && Number.isInteger(points) && points > 1 && Number.isInteger(deciding) && deciding > 1;
    add('rules', validRules ? 'pass' : 'unknown');
    const sets = Array.isArray(sheet?.sets) ? [...sheet.sets].sort((a, b) => Number(a.set_number) - Number(b.set_number)) : null;
    let home = 0, away = 0, validScores = Boolean(sets?.length && validRules);
    const needed = Math.ceil(maxSets / 2);
    for (const [index, set] of (sets || []).entries()) {
        const a = Number(set.home_score), b = Number(set.away_score);
        const target = Number(set.set_number) === maxSets ? deciding : points;
        if (Number(set.set_number) !== index + 1 || index >= maxSets || home >= needed || away >= needed
            || set.home_score == null || set.away_score == null || set.home_score === '' || set.away_score === ''
            || !Number.isInteger(a) || !Number.isInteger(b) || Math.min(a, b) < 0
            || !set.end_time || Math.max(a, b) < target || Math.abs(a - b) < 2) validScores = false;
        if (set.end_time && set.home_score != null && set.away_score != null) {
            if (a > b) home++; else if (b > a) away++;
        }
    }
    add('sets', !sets ? 'unknown' : validScores ? 'pass' : 'block');
    add('winner', validScores && Math.max(home, away) === needed ? 'pass' : 'block');
    const completed = ['completed', 'finished', 'match_finished'].includes(String(match.status).toLowerCase());
    add('completed', completed ? 'pass' : 'block');
    const confirmed = match.manual_lifecycle === 'confirmed';
    add('sync', 'unknown');
    return { match, checks, sets, home, away, confirmed,
        canConfirm: Boolean(manual && !confirmed && completed && validRules && !checks.some(check => check.status === 'block' || check.code === 'source' && check.status !== 'pass')) };
}
