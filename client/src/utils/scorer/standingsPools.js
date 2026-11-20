import { calculateStandings } from './standings.js';

const poolName = value => String(value ?? '').trim();
const teamIds = match => [match.home_team_id, match.away_team_id]
    .filter(id => id != null && id !== '').map(String);
const belongsToPoolRounds = match => {
    if (match.workflow_phase) return match.workflow_phase !== 'knockout';
    const round = String(match.round_name || '').trim();
    return !/^(?:knockout|(?:quarter|semi)[ -]?finals?|finals?|bronze|third[ -]place|r(?:4|8|16|32))\b/i.test(round)
        && !/^(?:รอบ(?:รองชนะเลิศ|ชิง|แพ้คัดออก|ก่อนรองชนะเลิศ)|ชิง(?:ชนะเลิศ|อันดับ))/u.test(round);
};

export function buildPoolStandings(competition, teams, matches) {
    const poolMatches = matches.filter(belongsToPoolRounds);
    const memberships = new Map(teams.map(team => [String(team.id), new Set()]));
    const assignedPools = new Map(teams.filter(team => poolName(team.workflow_pool))
        .map(team => [String(team.id), poolName(team.workflow_pool)]));

    for (const [id, pool] of assignedPools) memberships.get(id).add(pool);
    for (const match of poolMatches) {
        const pool = poolName(match.pool_name);
        if (!pool) continue;
        for (const id of teamIds(match)) {
            if (!assignedPools.has(id)) memberships.get(id)?.add(pool);
        }
    }

    const groups = new Map();
    const groupFor = pool => {
        if (!groups.has(pool)) groups.set(pool, { pool, teams: [], matches: [] });
        return groups.get(pool);
    };
    for (const team of teams) {
        const pools = memberships.get(String(team.id));
        for (const pool of pools.size ? pools : ['']) groupFor(pool).teams.push(team);
    }
    for (const match of poolMatches) {
        const pool = poolName(match.pool_name);
        const [home, away] = teamIds(match).map(id => memberships.get(id));
        const homePool = home?.size === 1 ? home.values().next().value : null;
        if (pool) {
            if (home?.has(pool) && away?.has(pool)) groups.get(pool).matches.push(match);
        } else if (homePool && away?.size === 1 && away.has(homePool)) {
            groups.get(homePool)?.matches.push(match);
        } else if (home && away && !home.size && !away.size) {
            groups.get('')?.matches.push(match);
        }
    }

    return [...groups.values()]
        .sort((a, b) => Number(!a.pool) - Number(!b.pool) || a.pool.localeCompare(b.pool, undefined, { numeric: true }))
        .map(group => ({
            ...group,
            competition,
            standings: calculateStandings(group.teams, group.matches, [competition]),
        }));
}
