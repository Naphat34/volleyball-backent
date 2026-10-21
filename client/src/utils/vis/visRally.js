const other = team => team === 'home' ? 'away' : 'home';
const winnerOf = event => event.skill === 'OP' || (event.grade === '#' && ['S', 'A', 'B'].includes(event.skill))
    ? event.team : ['=', '/'].includes(event.grade) ? other(event.team) : null;
export function rallyCode(event) {
    return `${event.team === 'home' ? '*' : 'a'}${event.number == null ? '' : String(event.number).padStart(2, '0')}${event.skill}${event.grade || ''}`;
}

export function parseVisRally(text, teams, servingTeam) {
    const roster = Object.fromEntries(Object.values(teams).map(team => [team.key, team]));
    const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
    const events = [], errors = [];
    let forced = null;
    for (const token of tokens) {
        if (/^(\*|a)$/i.test(token)) { forced = token === '*' ? 'home' : 'away'; continue; }
        let raw = token.toUpperCase(), explicit = forced;
        forced = null;
        if (raw.startsWith('*')) { explicit = 'home'; raw = raw.slice(1); }
        else if (/^A(?=\d|OP|T)/.test(raw)) { explicit = 'away'; raw = raw.slice(1); }
        else if (/^[AB]:/.test(raw)) { explicit = teams[raw[0]]?.key; raw = raw.slice(2); }
        const teamEvent = /^(OP#|T=)$/.exec(raw);
        if (teamEvent) {
            const team = explicit || (events.length ? other(events.at(-1).team) : servingTeam);
            if (!roster[team]) { errors.push(`${token}: กรุณาระบุทีม`); continue; }
            events.push({ team, player: null, number: null, skill: raw === 'OP#' ? 'OP' : 'T', grade: raw.at(-1) });
            continue;
        }
        // Accept both combined codes (*03S) and existing VIS codes (A:S3#).
        const match = /^(?:(\d{1,3})([SRABDE])?|([SRABDE])(\d{1,3}))([#+!\-=/])?$/.exec(raw);
        if (!match) { errors.push(`${token}: รหัสไม่ถูกต้อง`); continue; }
        const number = Number(match[1] || match[4]);
        const grade = match[5] || '';
        const skill = match[2] || match[3] || (!events.length && grade !== '/' && (!explicit || explicit === servingTeam) ? 'S' : 'A');
        if (grade === '/' && skill !== 'A') { errors.push(`${token}: / ใช้กับการตบเท่านั้น`); continue; }
        let team = explicit;
        if (!team) {
            if (!events.length && skill === 'S') team = servingTeam;
            else {
                const onCourt = Object.values(roster).filter(item => item.lineup.some(p => Number(p.number) === number));
                const candidates = onCourt.length ? onCourt : Object.values(roster).filter(item => item.players.some(p => Number(p.number) === number));
                team = candidates.length === 1 ? candidates[0].key : other(events.at(-1)?.team || servingTeam);
            }
        }
        const candidates = roster[team]?.players.filter(p => Number(p.number) === number) || [];
        const player = candidates[0];
        if (candidates.length !== 1 || !roster[team]?.lineup.some(p => Number(p.id) === Number(player?.id))) {
            errors.push(`${token}: ไม่พบผู้เล่นเบอร์ ${number} ในสนาม หรือเบอร์ซ้ำ`); continue;
        }
        events.push({ team, player: Number(player.id), number, skill, grade });
    }
    if (forced) errors.push('ระบุทีมแล้ว กรุณาใส่รหัสผู้เล่น');
    // Complete the attacker outcome when a recorded block closes the rally.
    const last = events.at(-1);
    if (last?.skill === 'B' && ['#', '='].includes(last.grade)) {
        const attack = events.findLast(event => event.team !== last.team && event.skill === 'A' && !event.grade);
        if (attack) attack.grade = last.grade === '#' ? '/' : '#';
    }
    const winners = new Set(events.map(winnerOf).filter(Boolean));
    if (winners.size > 1) errors.push('ผลในบรรทัดขัดแย้งกัน: ต้องมีทีมได้แต้มเพียงทีมเดียว');
    const winner = winners.size === 1 ? [...winners][0] : null;
    const suggestions = [];
    if (winner && last && !['OP', 'T'].includes(last.skill)) {
        const opposite = other(last.team);
        const alreadyPaired = events.some(event => event !== last && event.team === opposite && winnerOf(event));
        if (!alreadyPaired) {
            const generic = { team: opposite, player: null, number: null,
                skill: winner === opposite ? 'OP' : 'T', grade: winner === opposite ? '#' : '=', generated: true };
            suggestions.push(generic);
            const skill = last.skill === 'A' ? 'B' : last.skill === 'B' ? 'A' : null;
            const grade = last.skill === 'A' ? last.grade === '/' ? '#' : '=' : last.grade === '#' ? '/' : '#';
            if (skill && (last.skill === 'B' || ['#', '/'].includes(last.grade))) {
                const players = skill === 'B' ? roster[opposite].lineup.slice(1, 4) : roster[opposite].lineup;
                for (const p of players) suggestions.push({ team: opposite, player: Number(p.id), number: p.number, skill, grade, generated: true });
            }
        }
    }
    return { events, errors, winner, suggestions, automatic: last && ((last.skill === 'S' && ['#', '='].includes(last.grade)) || (last.skill === 'A' && last.grade === '=')) };
}
