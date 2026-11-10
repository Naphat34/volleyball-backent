const { normalizeNames, playerNameFields } = require('./bilingualNames');
const parseSetup = value => typeof value === 'string' ? JSON.parse(value) : value;
function applyMatchSetup(match) {
    const setup = parseSetup(match.match_setup);
    if (!setup) return match;
    match.competition_name = setup.title;
    match.competition_title = setup.title;
    match.competition_gender = setup.gender;
    match.gender = setup.gender;
    match.max_sets = setup.maxSets;
    match.points_per_set = setup.pointsPerSet;
    match.deciding_set_points = setup.decidingSetPoints;
    for (const side of ['home', 'away']) {
        match[`${side}_team_name`] = setup[side].name;
        // Older match snapshots contain no translated names; retain the teams JOIN values.
        for (const language of ['th','en']) {
            const value = setup[side]['name_' + language]?.trim();
            if (value) match[`${side}_team_name_${language}`] = value;
        }
        match[`${side}_team`] = setup[side].name;
        match[`${side}_team_code`] = setup[side].code;
        if (setup[side].color) match[`${side}_team_color`] = setup[side].color;
        if (setup[side].liberoColor) match[`${side}_libero_color`] = setup[side].liberoColor;
    }
    return match;
}
function setupPlayers(match, side, fallback) {
    return parseSetup(match.match_setup)?.[side]?.players ?? fallback;
}
function setupStaff(match, side, fallback) {
    return parseSetup(match.match_setup)?.[side]?.staff ?? fallback;
}
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
function normalizeTeam(team, allowedIds) {
    const text = (value, max) => {
        if (typeof value !== 'string' || value.length > max) fail('ข้อมูลข้อความไม่ถูกต้อง');
        return value.trim();
    };
    const name = text(team?.name, 100), code = text(team?.code ?? '', 20);
    if (!name) fail('กรุณาระบุชื่อทีม');
    if (!Array.isArray(team.players) || team.players.length > 30 || !Array.isArray(team.staff) || team.staff.length > 20) fail('รายชื่อทีมไม่ถูกต้อง');
    const players = team.players.map(p => {
        const id = Number(p.id), number = Number(p.number);
        if (!allowedIds.has(id)) fail('นักกีฬาไม่ได้อยู่ในทีมของแมตซ์นี้');
        if (!Number.isInteger(number) || number < 1 || number > 999) fail('หมายเลขเสื้อต้องเป็นจำนวนเต็ม 1–999');
        const first_name = text(p.first_name, 50), last_name = text(p.last_name ?? '', 50);
        if (!first_name) fail('กรุณาระบุชื่อนักกีฬา');
        const role = text(p.role ?? '', 10);
        if (!['', 'C', 'L1', 'L2', 'L1+C', 'L2+C'].includes(role)) fail('ตำแหน่งนักกีฬาไม่ถูกต้อง');
        const position = ['S', 'OH', 'MB', 'OPP'].includes(p.position) ? p.position : '';
        const names = normalizeNames(p);
        return { ...Object.fromEntries(playerNameFields.map(field => [field,names[field] || null])), id, number, first_name, last_name, role, position: role.startsWith('L') ? 'L' : position, is_captain: role.includes('C') ? 1 : 0, is_libero1: role.startsWith('L1') ? 1 : 0, is_libero2: role.startsWith('L2') ? 1 : 0, is_libero: role.startsWith('L') ? 1 : 0, is_playing: 1 };
    });
    if (new Set(players.map(p => p.id)).size !== players.length || new Set(players.map(p => p.number)).size !== players.length) fail('นักกีฬาหรือหมายเลขเสื้อซ้ำ');
    if (players.filter(p => p.is_captain).length > 1 || players.filter(p => p.is_libero).length > 2
        || players.filter(p => p.is_libero1).length > 1 || players.filter(p => p.is_libero2).length > 1) fail('กำหนดกัปตันได้หนึ่งคน และ Libero แต่ละตำแหน่งได้หนึ่งคน');
    const staff = team.staff.map(p => {
        const first_name = text(p.first_name, 50), last_name = text(p.last_name ?? '', 50), role = text(p.role, 50);
        if (!first_name || !role) fail('กรุณาระบุชื่อและตำแหน่งเจ้าหน้าที่ทีม');
        return { first_name, last_name, role };
    });
    const names = normalizeNames(team, {}, true);
    const result = { name, name_th:names.name_th || null, name_en:names.name_en || null, code, players, staff };
    for (const key of ['color', 'liberoColor']) {
        if (team[key] === undefined) continue;
        if (typeof team[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(team[key])) fail('สีเสื้อไม่ถูกต้อง');
        result[key] = team[key].toLowerCase();
    }
    return result;
}
module.exports = { parseSetup, applyMatchSetup, setupPlayers, setupStaff, normalizeTeam };
