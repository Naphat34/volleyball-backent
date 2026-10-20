const { projectOfficialState, applyRally, resolveContext, fail } = require('./visWorkflow');
const keys = ['home', 'away'];
const clone = value => JSON.parse(JSON.stringify(value));
function validateInput(input) {
    const text = (value, max = 160) => String(value || '').trim().slice(0, max);
    if (!text(input.title)) fail('กรุณาระบุชื่อแมตช์');
    if (![3, 5].includes(Number(input.maxSets))) fail('จำนวนเซตต้องเป็น 3 หรือ 5');
    if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fail('วันที่ไม่ถูกต้อง');
    if (input.date) {
        const date = new Date(`${input.date}T00:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) fail('วันที่ไม่ถูกต้อง');
    }
    const teams = {};
    for (const [index, key] of keys.entries()) {
        const source = input[key];
        if (!text(source?.name)) fail('กรุณาระบุชื่อทีมทั้งสองทีม');
        if (!Array.isArray(source.players) || source.players.length > 30) fail('รายชื่อได้สูงสุดทีมละ 30 คน');
        const numbers = new Set();
        const players = source.players.map((p, n) => {
            const number = Number(p.number);
            if (!Number.isSafeInteger(number) || number < 1 || number > 999 || numbers.has(number)) fail(`เบอร์ผู้เล่นซ้ำหรือไม่ถูกต้องในทีม ${source.name}`);
            if (!text(p.first_name) || !text(p.last_name)) fail('กรุณาระบุชื่อและนามสกุลผู้เล่น');
            const position = text(p.position, 10).toUpperCase();
            if (position && !['S', 'OH', 'MB', 'OPP', 'OP', 'L'].includes(position)) fail('ตำแหน่งผู้เล่นไม่ถูกต้อง');
            numbers.add(number);
            return { id: index * 1000 + n + 1, number, first_name: text(p.first_name), last_name: text(p.last_name),
                name: `${text(p.first_name)} ${text(p.last_name)}`, position, is_captain: Boolean(p.is_captain) };
        });
        if (players.filter(p => p.is_captain).length > 1) fail('กำหนดกัปตันได้ทีมละหนึ่งคน');
        teams[key] = { name: text(source.name), players };
    }
    return { title: text(input.title), maxSets: Number(input.maxSets), date: input.date || null,
        time: /^\d{2}:\d{2}$/.test(input.time || '') ? input.time : null, location: text(input.location), gender: text(input.gender, 20), ...teams };
}
function createPayload(input, id) {
    const config = validateInput(input);
    return { config, match: { id, match_number: `VIS-${id.slice(-6).toUpperCase()}`, is_custom_vis: true, home_team_id: 1, away_team_id: 2, max_sets: config.maxSets,
        vis_state: { controls: [] } }, actions: [], revision: 0, nextId: 1, operations: [], lifecycle: 'draft' };
}
function view(payload) {
    const { config } = payload;
    const match = { ...payload.match, home_team: config.home.name, away_team: config.away.name,
        home_team_name: config.home.name, away_team_name: config.away.name, competition_name: config.title,
        competition_title: config.title, match_date: config.date, start_time: config.time, location: config.location,
        gender: config.gender, vis_lifecycle: payload.lifecycle };
    const projected = projectOfficialState(match, payload.actions);
    const state = projected.state;
    state.liberos = payload.match.vis_state.setups?.[state.currentSet]?.liberos || { home: null, away: null };
    state.revision = payload.revision;
    state.isReadOnly = ['confirmed', 'cancelled'].includes(payload.lifecycle);
    match.status = payload.lifecycle === 'confirmed' ? 'completed' : payload.lifecycle === 'cancelled' ? 'cancelled' : payload.actions.length ? 'live' : 'scheduled';
    match.home_set_score = state.setsWon.home; match.away_set_score = state.setsWon.away;
    // A compatible, authoritative snapshot for existing VIS reports only.
    match.live_state = { scoringSource: 'custom-vis', workflowStep: state.phase, score: state.score,
        currentSet: state.currentSet, matchData: { currentSet: state.currentSet }, completedSets: state.completedSets,
        setsWon: state.setsWon, homeLineup: state.lineups.home, awayLineup: state.lineups.away };
    const controls = match.vis_state.controls || [];
    const all = [...payload.actions, ...controls];
    const events = [...state.history].reverse().map(item => all.find(event => String(event.id) === String(item.eventId))).filter(Boolean);
    return { match, state, events, rallies: [], operations: payload.operations,
        roster: { match, home: { players: config.home.players }, away: { players: config.away.players } } };
}
function commandPayload(previous, operation) {
    if (!/^[\w-]{16,80}$/.test(operation.operationId || '')) fail('Invalid operation ID');
    if (previous.operations.includes(operation.operationId)) return { payload: previous, response: { ...view(previous), duplicate: true } };
    if (operation.revision !== previous.revision) fail('ข้อมูลเปลี่ยนแปลงจากหน้าจออื่น กรุณาโหลดใหม่', 409);
    const payload = clone(previous), current = view(payload), state = current.state, command = operation.command;
    if (!command || ['confirmed', 'cancelled'].includes(payload.lifecycle)) fail('แมตช์ถูกล็อกแล้ว', 409);
    let response = {};
    const setup = payload.match.vis_state;
    if (command.type === 'SET_LINEUP') {
        if (state.phase === 'MATCH_FINISHED' || payload.actions.some(a => a.set_number === state.currentSet)) fail('ไม่สามารถแก้ไลน์อัปหลังเริ่มเซต', 409);
        for (const key of keys) {
            const ids = command.lineups?.[key];
            if (!Array.isArray(ids) || ids.length !== 6 || new Set(ids).size !== 6 || ids.some(id => !payload.config[key].players.some(p => p.id === id && p.position !== 'L'))) fail('เลือกผู้เล่นทั่วไปที่ไม่ใช่ลิเบอโร่ ไม่ซ้ำกันให้ครบทีมละ 6 คน');
        }
        const servingTeam = state.requiresToss ? command.servingTeam : state.servingTeam;
        const side = state.requiresToss ? command.firstSetHomeLeft : state.isHomeLeft;
        if (!keys.includes(servingTeam) || typeof side !== 'boolean') fail('เลือกทีมเสิร์ฟและแดนก่อน');
        const set = { lineups: command.lineups, servingTeam, firstSetHomeLeft: side,
            liberos: Object.fromEntries(keys.map(key => [key, payload.config[key].players.find(p => p.position === 'L')?.id || null])) };
        if (state.currentSet === 1) Object.assign(setup, set);
        setup.setups = { ...setup.setups, [state.currentSet]: set };
        payload.lifecycle = 'ready';
    } else if (command.type === 'RALLY') {
        if (!state.setupComplete || state.phase === 'MATCH_FINISHED') fail('กรุณาจัดไลน์อัปก่อน', 409);
        const context = resolveContext(state, [], command.context);
        const result = applyRally(state, command.events);
        const events = command.events.map((event, index) => {
            const player = payload.config[event.team].players.find(p => p.id === event.player);
            const code = `${event.team === 'home' ? '*' : 'a'}${player ? String(player.number).padStart(2, '0') : ''}${event.skill}${event.grade}`;
            return { id: payload.nextId++, action_type: 'VIS_STAT', set_number: state.currentSet, set_id: state.currentSet,
                team_id: event.team === 'home' ? 1 : 2, player_id: event.player, skill: event.skill, grade: event.grade || '!',
                score_home: result.state.score.home, score_away: result.state.score.away, event_code: code,
                details: { vis: true, rallyId: operation.operationId, rallyPoint: index === command.events.length - 1,
                    statisticalRallyWinner: result.winner, event_code: code, jersey_number: player?.number,
                    visContext: { ...context, scoreBefore: context.score, scoreAfter: result.state.score } } };
        });
        payload.actions.push(...events); response.events = [...events].reverse();
        payload.lifecycle = view(payload).state.phase === 'MATCH_FINISHED' ? 'review' : 'playing';
    } else if (command.type === 'UNDO') {
        const last = state.history.at(-1);
        if (!last) fail('ไม่มีรายการให้ย้อน');
        if (last.type === 'CONTROL') {
            setup.controls = setup.controls.filter(e => String(e.id) !== String(last.eventId)); response.deletedEventId = last.eventId;
        } else {
            const row = payload.actions.find(e => e.id === last.eventId), group = row.details.rallyId;
            response.deletedEventIds = payload.actions.filter(e => e.details.rallyId === group).map(e => e.id);
            payload.actions = payload.actions.filter(e => e.details.rallyId !== group);
        }
        payload.lifecycle = payload.actions.length ? 'playing' : 'ready';
    } else if (['TIMEOUT', 'SUBSTITUTION'].includes(command.type)) {
        const team = command.team;
        if (!keys.includes(team) || !state.setupComplete || state.phase === 'MATCH_FINISHED') fail('ไม่สามารถบันทึกรายการนี้');
        const details = {};
        if (command.type === 'TIMEOUT' && state.timeouts[team] >= 2) fail('ขอเวลานอกครบแล้ว');
        if (command.type === 'SUBSTITUTION') {
            if (state.substitutions[team] >= 6 || !state.lineups[team].includes(command.playerOut) || state.lineups[team].includes(command.playerIn)
                || !payload.config[team].players.some(p => p.id === command.playerIn)) fail('คู่เปลี่ยนตัวไม่ถูกต้องหรือครบโควตา');
            const starters = setup.setups[state.currentSet].lineups[team];
            const controls = setup.controls.filter(e => e.set_id === state.currentSet && e.team === team && e.skill === 'SUBSTITUTION');
            const earlier = controls.find(e => e.details.playerIn === command.playerOut);
            const slot = earlier ? earlier.details.slot : starters.indexOf(command.playerOut);
            const swaps = controls.filter(e => e.details.slot === slot);
            if (swaps.length >= 2 || (swaps.length === 1 && command.playerIn !== starters[slot]) || (!swaps.length && starters.includes(command.playerIn))) fail('คู่เปลี่ยนตัวไม่ตรงกับผู้เล่นเริ่มต้น');
            Object.assign(details, { playerOut: command.playerOut, playerIn: command.playerIn, slot });
        }
        const event = { id: `control-${operation.operationId}`, skill: command.type, team, team_id: team === 'home' ? 1 : 2,
            set_id: state.currentSet, set_number: state.currentSet, score_home: state.score.home, score_away: state.score.away, details,
            afterEventId: payload.actions.at(-1)?.id || 0 };
        setup.controls.push(event); response.event = event;
    } else if (command.type === 'CONFIRM') {
        if (state.phase !== 'MATCH_FINISHED') fail('การแข่งขันยังไม่จบ');
        payload.lifecycle = 'confirmed';
    } else if (command.type === 'REOPEN') fail('กรุณาใช้คำสั่งเปิดแก้ไขผลสำหรับเจ้าของแมตช์');
    else if (command.type === 'CANCEL') payload.lifecycle = 'cancelled';
    else fail('Unsupported custom VIS command');
    payload.operations.push(operation.operationId); payload.revision++;
    return { payload, response: { ...view(payload), ...response } };
}
module.exports = { validateInput, createPayload, view, commandPayload };
