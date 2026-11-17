const rules = require('./competitionWorkflow');

function sourceLabel(source, numbers = new Map(), english = false) {
    if (!source) return '';
    if (typeof source === 'string') source = JSON.parse(source);
    if (source.type === 'draw') return english ? `Awaiting draw ${source.position} (${source.side === 'home' ? 'home' : 'away'})` : `รอผลจับสลากคู่ ${source.position} (${source.side === 'home' ? 'ทีมแรก' : 'ทีมสอง'})`;
    if (source.type === 'pool') return english ? `Rank ${source.rank} Pool ${source.pool}` : `อันดับ ${source.rank} สาย ${source.pool}`;
    if (['winner', 'loser'].includes(source.type)) {
        const number = numbers.get(source.slot) || source.slot;
        return english ? `${source.type === 'winner' ? 'Winner' : 'Loser'} of match ${number}` : `${source.type === 'winner' ? 'ผู้ชนะ' : 'ผู้แพ้'}คู่ที่ ${number}`;
    }
    return '';
}

async function attachScheduleSources(db, rows) {
    if (!rows.length) return rows;
    const ids = [...new Set(rows.map(row => row.competition_id).filter(Boolean))];
    if (!ids.length) return rows;
    const links = (await db.query(`SELECT w.match_id,w.competition_id,w.slot_key,w.home_source,w.away_source,m.match_number,f.state FROM competition_workflow_matches w JOIN matches m ON m.id=w.match_id JOIN competition_workflows f ON f.competition_id=w.competition_id WHERE w.competition_id IN (${ids.map(() => '?').join(',')}) AND w.phase='knockout'`, ids)).rows;
    const byId = new Map(links.map(link => [String(link.match_id), link]));
    return rows.map(row => {
        const link = byId.get(String(row.id));
        if (!link) return row;
        const numbers = new Map(links.filter(item => String(item.competition_id) === String(row.competition_id)).map(item => [item.slot_key, item.match_number]));
        const state = typeof link.state === 'string' ? JSON.parse(link.state) : link.state;
        const result = {...row, workflow_phase: 'knockout', home_source: link.home_source, away_source: link.away_source, workflow_invalidated: !!state?.invalidated, awaiting_teams: !row.home_team_id || !row.away_team_id};
        for (const side of ['home', 'away']) {
            const th = sourceLabel(link[`${side}_source`], numbers);
            const en = sourceLabel(link[`${side}_source`], numbers, true);
            result[`${side}_source_label_th`] = th;
            result[`${side}_source_label_en`] = en;
            if (!row[`${side}_team_id`]) {
                result[`${side}_team`] = th;
                result[`${side}_team_name_th`] = th;
                result[`${side}_team_name_en`] = en;
                result[side === 'home' ? 'team_a_name' : 'team_b_name'] = th;
            }
        }
        return result;
    });
}

function poolBracket(groups, pairs, thirdPlace=true) {
    const qualifiers = groups.flatMap((group, index) => [1, 2].map(rank => ({teamId: index * 2 + rank, pool: group.name, rank})));
    let selected = pairs;
    if (groups.length === 2) selected = [{home: 1, away: 4}, {home: 3, away: 2}];
    const confirmed = rules.validateDraw(qualifiers, selected);
    const byId = new Map(qualifiers.map(team => [team.teamId, team]));
    const plan = rules.bracketPlan(confirmed,thirdPlace).map(slot => ({...slot, ...Object.fromEntries(['home', 'away'].map(side => {
        const source = slot[side];
        if (source.type !== 'team') return [side, source];
        const team = byId.get(source.teamId);
        return [side, {type: 'pool', pool: team.pool, rank: team.rank}];
    }))}));
    return [...plan.filter(slot => slot.key !== 'R2-1'), plan.find(slot => slot.key === 'R2-1')];
}

module.exports = {sourceLabel, attachScheduleSources, poolBracket};
