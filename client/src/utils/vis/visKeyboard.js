export function resolveVisSpaceInput(text, currentTeam, count, teams) {
    if (count === 2) {
        const label = currentTeam === 'A' ? 'B' : 'A';
        const draft = String(text || '').replace(/^[AB]:/i, '');
        return { label, draft, entry: resolveVisInput(draft, label, teams) };
    }
    const entry = resolveVisInput(text, currentTeam, teams);
    return { label: entry.label || currentTeam, draft: text, entry };
}

export function resolveVisInput(text, defaultTeam, teams) {
    const input = String(text || '').trim().toUpperCase();
    if (!input) return { empty: true };
    const match = /^(?:([AB]):)?([SRABDE])(\d{1,3})([#+!=-])$/.exec(input);
    if (!match) return { error: 'รูปแบบไม่ถูกต้อง ใช้ S21# หรือ B:R7+' };
    const [, prefix, skill, shirt, grade] = match;
    const label = prefix || defaultTeam;
    const team = teams[label];
    if (!team) return { error: 'กรุณาเลือกทีม A หรือ B' };
    const number = Number(shirt);
    const candidates = team.players.filter(player => player.number != null && String(player.number).trim() !== '' && Number(player.number) === number);
    if (!candidates.length) return { error: `ไม่พบเบอร์ ${number} ในทีม ${label} · ${team.name}` };
    if (candidates.length !== 1) return { error: `เบอร์ ${number} ซ้ำในทีม ${label} กรุณาตรวจรายชื่อ` };
    const player = candidates[0];
    // Before eScoreControl publishes a lineup, VIS may record a registered
    // roster player. Once a lineup exists, keep the on-court restriction.
    if (team.lineup.length && !team.lineup.some(item => Number(item.id) === Number(player.id))) return { error: `เบอร์ ${number} ไม่ได้อยู่ในสนามของทีม ${label}` };
    return { label, team, player, skill, grade, code: `${skill}${number}${grade}`,
        command: { type: 'STAT', team: team.key, player: player.id, skill, grade } };
}

