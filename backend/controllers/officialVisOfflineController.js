const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createHash, randomUUID } = require('node:crypto');
const db = require('../config/db');
const { fail } = require('../utils/visWorkflow');
const { syncPayload, checkout } = require('../utils/visOffline');
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const scorer = () => require('./scorerOfflineController');
const file = require.resolve('./visController');
const source = fs.readFileSync(file, 'utf8');
const flag = value => value === true || value === 1 || value === '1';
const dateOnly = value => Object.prototype.toString.call(value) === '[object Date]'
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value || '').slice(0, 10);

// Run existing VIS commands on the enclosing transaction. A failed batch rolls
// back every command, including its operation receipts and lineup changes.
function controller(connection) {
    const proxy = { query: connection.query.bind(connection), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} };
    const localRequire = createRequire(file);
    const scope = { exports: {}, console, require: name => name === '../config/db' ? { connect: async () => proxy } : localRequire(name) };
    vm.runInNewContext(source, scope, { filename: file });
    return scope.exports;
}
async function matchRow(connection, id) {
    const row = (await connection.query('SELECT * FROM matches WHERE id=? FOR UPDATE', [id])).rows[0];
    if (!row) fail('ไม่พบแมตช์', 404);
    return row;
}
exports.assertOnline = async (connection, id) => {
    const row = await matchRow(connection, id);
    const lease = parse(row.vis_state).offlineVis?.payload?.offlineLease;
    if (lease && lease.expiresAt > Date.now()) fail('แมตช์ถูกจองสำหรับ VIS Offline กรุณาซิงค์และคืนสิทธิ์ก่อนแก้ไขออนไลน์', 409);
};
async function snapshot(connection, req) {
    const roster = await scorer().call(scorer().scopedController(connection), 'getMatchRosterData', req, {});
    const detail = { ...roster.match, ...await scorer().call(scorer().scopedController(connection), 'getMatchDetails', req, {}) };
    const row = await matchRow(connection, req.params.matchId);
    const setup = { ...parse(row.vis_state) }; delete setup.offlineVis;
    setup.controls ||= [];
    setup.setups ||= {};
    if (setup.lineups && !setup.setups[1]) setup.setups[1] = { lineups: setup.lineups, servingTeam: setup.servingTeam, firstSetHomeLeft: setup.firstSetHomeLeft };
    const actions = (await connection.query("SELECT * FROM match_actions WHERE match_id=? AND action_type='VIS_STAT' ORDER BY id", [row.id])).rows.map(action => ({ ...action, details: parse(action.details || action.description), set_id: action.set_number }));
    const match = { ...detail, ...row, max_sets: Number(detail.max_sets || 5), vis_state: setup, is_custom_vis: false };
    const config = { title: detail.competition_name || detail.competition_title || `Match ${row.id}`, maxSets: match.max_sets,
        date: dateOnly(detail.match_date), time: detail.start_time, location: detail.location, gender: detail.gender };
    for (const team of ['home', 'away']) config[team] = { name: detail[`${team}_team`] || detail[`${team}_team_name`] || team,
        players: roster[team].players.map(player => ({ ...player, id: Number(player.id), number: player.number == null || String(player.number).trim() === '' ? NaN : Number(player.number),
            position: ['L', 'L1', 'L2', 'L1+C', 'L2+C', 'LIBERO'].includes(String(player.role || player.position).toUpperCase()) || flag(player.is_libero1) || flag(player.is_libero2) ? 'L' : player.position,
            name: player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() })) };
    const clean = { ...row, vis_state: setup }; delete clean.updated_at;
    const fingerprint = createHash('sha256').update(JSON.stringify({ match: clean, config, actions, home: roster.home, away: roster.away })).digest('hex');
    const state = await scorer().call(controller(connection), 'getState', req, {});
    return { fingerprint, payload: { config, match, actions, revision: state.state.revision, nextId: Math.max(0, ...actions.map(a => Number(a.id))) + 1,
        operations: [], lifecycle: actions.length ? 'playing' : setup.lineups ? 'ready' : 'draft' } };
}
async function save(connection, req, value) {
    const row = await matchRow(connection, req.params.matchId);
    await connection.query('UPDATE matches SET vis_state=? WHERE id=?', [JSON.stringify({ ...parse(row.vis_state), offlineVis: value }), row.id]);
}
function endpoint(action) {
    return async (req, res) => {
        let connection;
        try {
            if (!/^[\w-]{16,80}$/.test(req.body?.deviceId || '')) fail('Invalid device ID');
            connection = await db.connect(); await connection.beginTransaction();
            const row = await matchRow(connection, req.params.matchId);
            const value = await action(connection, req, row);
            await connection.commit();
            req.app.get('io')?.to(`match_${row.id}`).emit('vis_statistics_updated', { matchId: row.id });
            res.json(value);
        } catch (error) {
            if (connection) await connection.rollback();
            if (!error.status) console.error('Admin VIS Offline:', error.message);
            res.status(error.status || 500).json({ error: error.status ? error.message : 'ดำเนินการ VIS Offline ไม่สำเร็จ ข้อมูลในเครื่องยังอยู่' });
        } finally { connection?.release(); }
    };
}
function owned(value, req) {
    if (!value || String(value.owner) !== String(req.user.id) || value.payload.offlineDevice !== req.body.deviceId) fail('ไม่พบสิทธิ์ VIS Offline ของบัญชีและอุปกรณ์นี้', 409);
}
exports.checkout = endpoint(async (connection, req, row) => {
    if (['completed', 'finished', 'match_finished', 'cancelled', 'canceled'].includes(row.status)) fail('แมตช์จบหรือยกเลิกแล้ว', 409);
    const scoreLease = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE', [row.id])).rows[0];
    if (scoreLease && !scoreLease.released && Number(scoreLease.expires_at) > Date.now()) fail('แมตช์ถูกจองสำหรับ Scorer Offline กรุณาคืนสิทธิ์ก่อน', 409);
    const current = parse(row.vis_state).offlineVis;
    const fresh = await snapshot(connection, req);
    for (const team of ['home', 'away']) {
        const players = fresh.payload.config[team].players;
        if (players.filter(p => p.position !== 'L').length < 6) fail('กรุณาจัดรายชื่อผู้เล่นทั่วไปให้ครบทีมละ 6 คนในแมตช์ก่อนดาวน์โหลด', 409);
        if (players.some(p => !Number.isSafeInteger(p.id) || p.id <= 0 || !Number.isSafeInteger(p.number) || p.number < 0)) fail('รหัสหรือเบอร์ผู้เล่นไม่ถูกต้อง กรุณาตรวจรายชื่อก่อนดาวน์โหลด', 409);
    }
    // Keep expired leases recoverable by their owner; never discard receipts on retry.
    if (current?.payload.offlineLease) {
        owned(current, req);
        if (current.fingerprint !== fresh.fingerprint) fail('ข้อมูลเซิร์ฟเวอร์เปลี่ยน กรุณาสำรองข้อมูลและตรวจสอบก่อน', 409);
        const token = current.payload.offlineLease.checkoutToken;
        checkout(current.payload, req.body.deviceId);
        current.payload.offlineLease.checkoutToken = token;
        await save(connection, req, current);
        return { payload: current.payload, match: current.payload.match, leaseCreated: false };
    }
    const payload = checkout(fresh.payload, req.body.deviceId);
    payload.offlineLease.checkoutToken = randomUUID();
    payload.offlineSession = randomUUID();
    await save(connection, req, { owner: req.user.id, fingerprint: fresh.fingerprint, payload });
    return { payload, match: payload.match, leaseCreated: true };
});
exports.cancel = endpoint(async (connection, req, row) => {
    const value = parse(row.vis_state).offlineVis; owned(value, req);
    if (!req.body.checkoutToken || value.payload.offlineLease?.checkoutToken !== req.body.checkoutToken || value.payload.revision !== req.body.revision) fail('ข้อมูลเปลี่ยน จึงไม่คืนสิทธิ์อัตโนมัติ', 409);
    value.payload.offlineLease = null; await save(connection, req, value); return { released: true };
});
// Explicitly abandon a conflicting journal after the UI offers a JSON backup.
// Never replay or overwrite server data on this path.
exports.release = endpoint(async (connection, req, row) => {
    const value = parse(row.vis_state).offlineVis; owned(value, req);
    if (!req.body.offlineSession || req.body.offlineSession !== value.payload.offlineSession) fail('รอบการจองเปลี่ยนแล้ว ไม่สามารถคืนสิทธิ์รอบอื่นได้', 409);
    value.payload.offlineLease = null; await save(connection, req, value); return { released: true };
});
exports.sync = endpoint(async (connection, req, row) => {
    const value = parse(row.vis_state).offlineVis; owned(value, req);
    if (!req.body.offlineSession || req.body.offlineSession !== value.payload.offlineSession) fail('รอบการจอง Offline เปลี่ยนแล้ว กรุณาสำรองข้อมูลก่อนตรวจสอบ', 409);
    if (!Array.isArray(req.body.operations)) fail('ข้อมูลซิงค์ไม่ถูกต้อง');
    if (!value.payload.offlineLease && (!req.body.release || req.body.operations.some(op => !value.payload.operations.includes(op?.operationId)))) fail('คืนสิทธิ์รอบนี้แล้ว กรุณาสำรองงานก่อนดาวน์โหลดใหม่', 409);
    const scoreLease = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE', [row.id])).rows[0];
    if (scoreLease && !scoreLease.released && Number(scoreLease.expires_at) > Date.now()) fail('แมตช์ถูกจองสำหรับ Scorer Offline กรุณาคืนสิทธิ์ก่อนซิงค์ VIS', 409);
    const fresh = await snapshot(connection, req);
    if (fresh.fingerprint !== value.fingerprint) fail('ข้อมูลแมตช์หรือรายชื่อบนเซิร์ฟเวอร์เปลี่ยน กรุณาสำรองก่อนตรวจสอบ ห้ามเขียนทับ', 409);
    if (req.body.operations.some(op => !['SET_LINEUP', 'RALLY', 'UNDO', 'TIMEOUT', 'SUBSTITUTION'].includes(op?.command?.type))) fail('คำสั่งนี้ต้องทำออนไลน์หลังซิงค์และคืนสิทธิ์', 409);
    const result = syncPayload(value.payload, req.body);
    const official = controller(connection);
    for (const operation of req.body.operations) {
        if (value.payload.operations.includes(operation.operationId)) continue;
        const state = await scorer().call(official, 'getState', req, {});
        const command = { ...operation.command };
        if (command.type === 'RALLY') command.context = { key: state.state.context.key };
        await scorer().call(official, 'command', { ...req, offlineReplay: true }, { ...operation, revision: state.state.revision, command });
    }
    const saved = await snapshot(connection, req);
    result.payload = { ...saved.payload, revision: result.payload.revision, operations: result.payload.operations,
        offlineDevice: result.payload.offlineDevice, offlineSession: value.payload.offlineSession, offlineLease: result.payload.offlineLease, lastSyncedAt: result.payload.lastSyncedAt };
    await save(connection, req, { owner: value.owner, fingerprint: saved.fingerprint, payload: result.payload });
    return result;
});
