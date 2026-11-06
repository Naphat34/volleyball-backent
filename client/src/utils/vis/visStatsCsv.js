import { visSkillNames } from './visPresentation.js';

export const statGrades = ['#', '+', '!', '-', '=', '/'];
export function detailedStats(plays) {
    const count = (skill, grade) => plays.filter(event => event.skill === skill && (grade === undefined || event.grade === grade)).length;
    const attack = [count('A'), count('A', '#'), count('A', '='), count('A', '/')];
    const reception = [count('R'), count('R', '#'), count('R', '=')];
    return { attack, reception, points: count('A', '#') + count('B', '#') + count('S', '#'),
        efficiency: attack[0] ? (attack[1] - attack[2] - attack[3]) / attack[0] : null,
        block: [count('B', '#'), count('B', '=')], serve: [count('S'), count('S', '#'), count('S', '=')],
        positive: reception[0] ? (reception[1] + count('R', '+')) / reception[0] : null,
        dig: [count('D'), count('D', '=')], set: [count('E'), count('E', '=')] };
}
export const statPercent = value => value === null ? '–' : `${Math.round(value * 100)}%`;
export const detailCells = detail => [detail.points, detail.attack.join('/'), statPercent(detail.efficiency), detail.block.join('/'), detail.serve.join('/'), detail.reception.join('/'), statPercent(detail.positive), detail.dig.join('/'), detail.set.join('/')];
export function buildMatchStats(match, teams, events = []) {
    return teams.map(team => {
        const own = events.filter(event => String(event.team_id) === String(match[`${team.key}_team_id`]));
        const players = team.players.map(player => {
            const plays = own.filter(event => event.player_id != null && Number(event.player_id) === Number(player.id));
            return { player, detail: detailedStats(plays), counts: Object.keys(visSkillNames).map(skill => plays.filter(event => event.skill === skill).length),
                points: plays.filter(event => ['S', 'A', 'B'].includes(event.skill) && event.grade === '#').length,
                errors: plays.filter(event => ['=', '/'].includes(event.grade)).length };
        });
        const skills = Object.entries(visSkillNames).map(([skill, name]) => {
            const plays = own.filter(event => event.skill === skill);
            return { skill, name, grades: statGrades.map(grade => plays.filter(event => event.grade === grade).length), total: plays.length };
        });
        const opponent = events.filter(event => String(event.team_id) === String(match[`${team.key === 'home' ? 'away' : 'home'}_team_id`]));
        const opponentErrors = opponent.filter(event => event.grade === '=').length + own.filter(event => event.skill === 'OP' && event.grade === '#').length;
        return { ...team, players, skills, total: detailedStats(own), opponentErrors };
    });
}

export function buildSetStats(match, teams, events, setNumber) {
    const setEvents = events.filter(event => Number(event.set_number ?? event.set_id) === Number(setNumber));
    const rallies = new Map();
    setEvents.forEach((event, index) => {
        let details = event.details;
        if (typeof details === 'string') {
            try { details = JSON.parse(details); } catch { details = {}; }
        }
        const key = details?.rallyId ?? `event-${index}`;
        if (!rallies.has(key)) rallies.set(key, []);
        rallies.get(key).push(event);
    });
    return buildMatchStats(match, teams, setEvents).map(team => {
        const ownId = String(match[`${team.key}_team_id`]);
        const opponentId = String(match[`${team.key === 'home' ? 'away' : 'home'}_team_id`]);
        const opponentErrors = [...rallies.values()].filter(plays => {
            const own = plays.filter(event => String(event.team_id) === ownId);
            if (own.some(event => ['A', 'B', 'S'].includes(event.skill) && event.grade === '#')) return false;
            return own.some(event => event.skill === 'OP' && event.grade === '#')
                || plays.some(event => String(event.team_id) === opponentId && event.grade === '=');
        }).length;
        return { ...team, opponentErrors };
    });
}

const cell = value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+@\-\t\r]/.test(value)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
};

export function matchStatsCsv(match, stats) {
    const rows = [['Type', 'Match', 'Team', 'No', 'Name', 'Pts', 'Attack T', 'Attack K', 'Attack E', 'Attack B', 'Eff%', 'Block P', 'Block E', 'Serve T', 'Serve A', 'Serve E', 'Reception T', 'Reception #', 'Reception E', 'Pos%', 'Dig T', 'Dig E', 'Set T', 'Set E']];
    const values = d => [d.points, ...d.attack, d.efficiency === null ? '' : Math.round(d.efficiency * 100), ...d.block, ...d.serve, ...d.reception, d.positive === null ? '' : Math.round(d.positive * 100), ...d.dig, ...d.set];
    for (const team of stats) {
        for (const { player, detail } of team.players) rows.push(['Player', match.match_number || match.id, team.name, player.number, player.name || [player.first_name, player.last_name].filter(Boolean).join(' '), ...values(detail)]);
        rows.push(['Total', match.match_number || match.id, team.name, '', '', ...values(team.total)]);
    }
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function downloadMatchStatsCsv(match, stats) {
    const url = URL.createObjectURL(new Blob([matchStatsCsv(match, stats)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `vis-stats-${String(match.match_number || match.id).replace(/[^\w-]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
