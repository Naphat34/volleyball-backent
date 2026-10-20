const { createPayload, commandPayload, view } = require('./customVis');
const { fail } = require('./visWorkflow');
function importCustomVis(backup, id) {
    if (!backup || typeof backup !== 'object' || !Array.isArray(backup.actions) || backup.actions.length > 10000) fail('ไฟล์สำรอง VIS ไม่ถูกต้อง');
    if (!backup.config || !Array.isArray(backup.config.home?.players) || !Array.isArray(backup.config.away?.players)
        || !backup.match?.vis_state || backup.match.home_team_id == null || backup.match.away_team_id == null
        || String(backup.match.home_team_id) === String(backup.match.away_team_id)) fail('ข้อมูลทีมในไฟล์สำรองไม่ครบถ้วน');
    const eventIds = new Set();
    for (const event of backup.actions) {
        if (!event || !Number.isSafeInteger(event.id) || event.id < 1 || eventIds.has(event.id) || !event.details || typeof event.details !== 'object') fail('เหตุการณ์ในไฟล์สำรองไม่ถูกต้อง');
        eventIds.add(event.id);
    }
    let payload = createPayload(backup.config, id);
    const mapping = { home: new Map(), away: new Map() };
    for (const team of ['home', 'away']) {
        for (const p of backup.config[team].players) {
            const target = payload.config[team].players.find(item => item.number === Number(p.number));
            if (!Number.isSafeInteger(p.id) || mapping[team].has(p.id)) fail('รหัสผู้เล่นในไฟล์สำรองไม่ถูกต้อง');
            mapping[team].set(p.id, target.id);
        }
    }
    const playerId = (team, id) => {
        const result = mapping[team]?.get(Number(id));
        if (!result) fail('ไฟล์อ้างอิงผู้เล่นที่ไม่อยู่ในรายชื่อ');
        return result;
    };
    let n = 0;
    const send = command => {
        const state = view(payload).state;
        payload = commandPayload(payload, { revision: payload.revision, operationId: `import-operation-${String(++n).padStart(10, '0')}`,
            command: { ...command, context: { key: state.context.key } } }).payload;
    };
    const setup = backup.match?.vis_state || {};
    const controls = setup.controls || [];
    if (!Array.isArray(controls) || controls.length > 1000) fail('รายการควบคุมในไฟล์สำรองไม่ถูกต้อง');
    const setLineup = setNumber => {
        const saved = setup.setups?.[setNumber] || (setNumber === 1 ? setup : {});
        if (!saved.lineups) fail('ไฟล์ไม่มีไลน์อัปเริ่มเซต');
        send({ type: 'SET_LINEUP', lineups: Object.fromEntries(['home', 'away'].map(team => [team, (saved.lineups[team] || []).map(id => playerId(team, id))])),
            servingTeam: saved.servingTeam, firstSetHomeLeft: saved.firstSetHomeLeft });
    };
    if (backup.actions.length || controls.length || setup.setups?.[1] || setup.lineups) setLineup(1);
    const timeline = [...backup.actions.map(e => ({ ...e, order: e.id, tie: 0 })),
        ...controls.map((e, i) => ({ ...e, order: e.afterEventId || 0, tie: i + 1 }))].sort((a, b) => a.order - b.order || a.tie - b.tie);
    const handled = new Set();
    for (const event of timeline) {
        if (event.action_type === 'VIS_STAT' && handled.has(event.details?.rallyId)) continue;
        const setNumber = Number(event.set_number ?? event.set_id);
        const state = view(payload).state;
        if (state.currentSet !== setNumber) fail('ลำดับเซตในไฟล์ไม่ถูกต้อง');
        if (!state.setupComplete) setLineup(setNumber);
        if (event.action_type === 'VIS_STAT') {
            const rallyId = event.details?.rallyId;
            if (!rallyId) fail('ไฟล์ต้องมีรหัสแรลลี่ครบถ้วน');
            if (handled.has(rallyId)) continue;
            handled.add(rallyId);
            const group = backup.actions.filter(e => e.details?.rallyId === rallyId);
            if (group.some(e => Number(e.set_number) !== setNumber)) fail('แรลลี่อ้างอิงข้ามเซต');
            send({ type: 'RALLY', events: group.map(e => {
                const team = Number(e.team_id) === Number(backup.match.home_team_id) ? 'home' : Number(e.team_id) === Number(backup.match.away_team_id) ? 'away' : null;
                if (!team) fail('ทีมในไฟล์ไม่ถูกต้อง');
                return { team, player: e.player_id == null ? null : playerId(team, e.player_id), skill: e.skill, grade: e.grade || '' };
            }) });
        } else if (event.skill === 'TIMEOUT') send({ type: 'TIMEOUT', team: event.team });
        else if (event.skill === 'SUBSTITUTION') send({ type: 'SUBSTITUTION', team: event.team,
            playerOut: playerId(event.team, event.details?.playerOut), playerIn: playerId(event.team, event.details?.playerIn) });
        else fail('ไฟล์มีเหตุการณ์ที่ไม่รองรับ');
    }
    const last = view(payload).state;
    if (last.phase !== 'MATCH_FINISHED' && !last.setupComplete && setup.setups?.[last.currentSet]) setLineup(last.currentSet);
    return payload;
}
module.exports = { importCustomVis };
