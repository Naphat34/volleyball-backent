const db = require('../config/db');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createHash, randomUUID } = require('node:crypto');
const { fail } = require('../utils/visWorkflow');
const { initialCheckpoint, checkOperation } = require('../utils/scorerOfflineRules');
const { scorerCheckoutStatus } = require('../utils/scorerCheckoutStatus');
const controllerFile = require.resolve('./scorerController');
const controllerSource = fs.readFileSync(controllerFile, 'utf8');
const handlers = { 'POST event': 'saveMatchEvent', 'POST toss': 'saveCoinToss', 'POST lineup': 'saveLineup',
    'POST start-set': 'startSet', 'POST end-set': 'endSet', 'PUT state': 'updateLiveState', 'PUT officials': 'updateMatchOfficials', 'PUT roster': 'updateMatchRoster' };
function scopedController(connection) {
    const query = (sql, args) => /^(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql.trim()) ? Promise.resolve({ rows: [] }) : connection.query(sql, args);
    const proxy = { query, release() {} };
    const database = { query, pool: { connect: async () => proxy }, connect: async () => proxy };
    const localRequire = createRequire(controllerFile);
    const scope = { module: { exports: {} }, exports: {}, console, require: name => name === '../config/db' ? database : localRequire(name) };
    vm.runInNewContext(controllerSource, scope, { filename: controllerFile });
    return scope.module.exports;
}
async function call(controller, method, req, body) {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.data = value; return this; } };
    await controller[method]({ ...req, body, app: { get: () => null } }, response);
    if (response.code >= 400) fail(response.data?.error || 'คำสั่งไม่ผ่านการตรวจสอบ', response.code);
    return response.data;
}
async function fingerprint(connection, req) {
    const match = (await connection.query('SELECT * FROM matches WHERE id = ?', [req.params.matchId])).rows[0];
    if (!match) fail('ไม่พบแมตช์', 404);
    const { vis_state: _vis, updated_at: _updated, ...official } = match;
    const values = [official];
    for (const table of ['match_events', 'match_sets', 'match_lineups']) values.push((await connection.query(`SELECT * FROM ${table} WHERE match_id = ? ORDER BY id`, [match.id])).rows);
    values.push(await call(scopedController(connection), 'getMatchRosterData', req, {}));
    return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const device = value => typeof value === 'string' && /^[\w-]{16,80}$/.test(value);
const operationHash = op => createHash('sha256').update(JSON.stringify({method:op.method,path:op.path,body:op.body,at:op.at})).digest('hex');
function endpoint(action) {
    return async (req, res) => {
        let connection;
        try {
            connection = await db.connect(); await connection.beginTransaction();
            await connection.query('SELECT id FROM matches WHERE id = ? FOR UPDATE', [req.params.matchId]);
            await require('./officialVisOfflineController').assertOnline(connection, req.params.matchId);
            let answer;
            await action(req, { json: data => { answer = data; } }, connection); await connection.commit();
            const io = req.app.get('io');
            if (io) {
                const saved = (await connection.query('SELECT live_state FROM matches WHERE id=?',[req.params.matchId])).rows[0];
                io.to(`match_${req.params.matchId}`).emit('live_state_updated', parse(saved?.live_state) || {});
                if (!req.skipMatchUpdated) io.to(`match_${req.params.matchId}`).emit('match_updated', {id:req.params.matchId});
                if (req.emitRoster) io.to(`match_${req.params.matchId}`).emit('roster_updated', {id:req.params.matchId});
                if (answer?.event) io.to(`match_${req.params.matchId}`).emit('match_event', answer.event);
            }
            res.json(answer);
        } catch (error) {
            if (connection) await connection.rollback();
            res.status(error.status || 500).json({ error: error.status ? error.message : error.code === 'ER_NO_SUCH_TABLE' ? 'กรุณาติดตั้ง migration 33' : 'ซิงค์ ScorerControl ไม่สำเร็จ ข้อมูลในเครื่องยังอยู่' });
        } finally { connection?.release(); }
    };
}
exports.permit = (req, res) => res.json({ user: { id: req.user.id, role: req.user.role, username: req.user.username || `Scorer ${req.user.id}` }, expiresAt: Date.now() + 7 * 86400000 });
exports.status = async (req, res) => {
    let connection;
    res.set('Cache-Control', 'no-store');
    try {
        if (!device(req.query.deviceId)) fail('Invalid device');
        connection = await db.connect(); await connection.beginTransaction();
        const match = (await connection.query('SELECT * FROM matches WHERE id=? FOR UPDATE', [req.params.matchId])).rows[0];
        const lease = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE', [req.params.matchId])).rows[0];
        const status = scorerCheckoutStatus(match, lease, req.user.id, req.query.deviceId);
        await connection.commit(); res.json(status);
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(error.status || 500).json({ error: error.status ? error.message : 'ตรวจสถานะการจองไม่สำเร็จ กรุณาลองใหม่' });
    } finally { connection?.release(); }
};
exports.checkout = endpoint(async (req, res, connection) => {
    if (!device(req.body.deviceId)) fail('Invalid device');
    const current = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id = ? FOR UPDATE', [req.params.matchId])).rows[0];
    const row = (await connection.query('SELECT * FROM matches WHERE id=? FOR UPDATE', [req.params.matchId])).rows[0];
    const status = scorerCheckoutStatus(row, current, req.user.id, req.body.deviceId);
    if (!status.canCheckout) fail(status.reason, 409);
    const hash = await fingerprint(connection, req);
    const controller = scopedController(connection);
    const match = await call(controller, 'getMatchDetails', req, {});
    if (['completed','cancelled'].includes(match.status)) fail('แมตช์จบหรือยกเลิกแล้ว',409);
    const leaseCreated = !current || Boolean(current.released) || Number(current.expires_at) <= Date.now();
    // Repeat checkout from the same device must preserve receipts from ambiguous sends.
    if (!leaseCreated && current.fingerprint !== hash) fail('ข้อมูลเปลี่ยนระหว่างจอง กรุณาสำรองและตรวจสอบ', 409);
    if (leaseCreated) {
        const sets = (await connection.query('SELECT * FROM match_sets WHERE match_id=?', [req.params.matchId])).rows;
        const checkpoint = { ...initialCheckpoint(match, sets), checkoutToken: randomUUID() };
        await connection.query(`INSERT INTO scorer_offline_sessions (match_id,owner_id,device_id,expires_at,fingerprint,receipts,checkpoint,released)
        VALUES (?,?,?,?,?,'[]',?,0) ON DUPLICATE KEY UPDATE owner_id=VALUES(owner_id), device_id=VALUES(device_id), expires_at=VALUES(expires_at), fingerprint=VALUES(fingerprint),checkpoint=VALUES(checkpoint),receipts=JSON_ARRAY(), released=0`,
    [req.params.matchId, req.user.id, req.body.deviceId, Date.now() + 7 * 86400000, hash, JSON.stringify(checkpoint)]);
    }
    const prefix = `/scorer/match/${req.params.matchId}`;
    const cache = { [prefix]: match };
    for (const [key, handler] of [['roster', 'getMatchRosterData'], ['state', 'getLiveState'], ['lineup', 'getMatchLineup'], ['events', 'getMatchEvents']]) {
        cache[`${prefix}/${key}`] = await call(controller, handler, req, {});
    }
    const savedSession = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=?', [req.params.matchId])).rows[0];
    res.json({ fingerprint: hash, cache, leaseCreated, checkoutToken: parse(savedSession.checkpoint).checkoutToken });
});
exports.cancelCheckout = endpoint(async (req, res, connection) => {
    const session = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE', [req.params.matchId])).rows[0];
    if (!session || String(session.owner_id) !== String(req.user.id) || session.device_id !== req.body.deviceId
        || !req.body.checkoutToken || parse(session.checkpoint).checkoutToken !== req.body.checkoutToken
        || session.fingerprint !== req.body.fingerprint || parse(session.receipts).length
        || await fingerprint(connection, req) !== session.fingerprint) fail('ไม่สามารถคืนสิทธิ์ดาวน์โหลดนี้ได้ กรุณาตรวจสอบแมตช์', 409);
    await connection.query('UPDATE scorer_offline_sessions SET released=1 WHERE match_id=?', [req.params.matchId]);
    res.json({ released: true });
});
exports.sync = endpoint(async (req, res, connection) => {
    const session = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id = ? FOR UPDATE', [req.params.matchId])).rows[0];
    if (!session || String(session.owner_id) !== String(req.user.id) || session.device_id !== req.body.deviceId) fail('ไม่มีสิทธิ์เครื่องหลักของแมตช์นี้', 409);
    const operations = req.body.operations;
    if (!Array.isArray(operations) || operations.length > 5000 || operations.some(op => !/^[\w-]{16,80}$/.test(op.id || ''))) fail('คิวคำสั่งไม่ถูกต้อง');
    if (new Set(operations.map(op => op.id)).size !== operations.length) fail('คำสั่งซ้ำในชุด');
    const receipts = parse(session.receipts), pending = operations.filter(op => !receipts.some(item => item.id === op.id));
    let prefix = 0, sawPending = false;
    for (const op of operations) {
        const saved = receipts.find(item=>item.id===op.id);
        if (!saved) sawPending = true;
        else {
            if (sawPending || (saved.hash && saved.hash!==operationHash(op))) fail('ข้อมูลคำสั่งที่เคยส่งไม่ตรงกับใบรับเดิม',409);
            prefix++;
        }
    }
    const currentHash = await fingerprint(connection, req);
    if (!operations.length && session.released && req.body.release && req.body.fingerprint === session.fingerprint && currentHash === session.fingerprint) {
        return res.json({ fingerprint: currentHash, acknowledged: [], released: true, syncedAt: new Date().toISOString() });
    }
    if (operations.length && !pending.length) {
        if (req.body.release && !session.released) {
            if (currentHash !== session.fingerprint) fail('ข้อมูลทางการเปลี่ยนก่อนคืนสิทธิ์ กรุณาตรวจสอบ',409);
            await connection.query('UPDATE scorer_offline_sessions SET released=1 WHERE match_id=?',[req.params.matchId]);
        }
        return res.json({fingerprint:currentHash,acknowledged:operations.map(op=>op.id),released:Boolean(session.released || req.body.release),syncedAt:new Date().toISOString()});
    }
    if ((pending.length || !operations.length) && (session.released || (req.body.fingerprint !== session.fingerprint && !prefix) || currentHash !== session.fingerprint)) fail('ข้อมูลทางการเปลี่ยน กรุณาสำรองและตรวจสอบ ห้ามเขียนทับอัตโนมัติ', 409);
    const controller = scopedController(connection);
    req.emitRoster = pending.some(op => op.path === 'roster');
    let checkpoint = parse(session.checkpoint);
    for (const op of pending) {
        const receiptHash = operationHash(op);
        checkpoint = checkOperation(checkpoint, op);
        if (op.path === 'undo') {
            const state = op.body?.state;
            if (!state?.score || !Array.isArray(op.body.keepLocalIds)) fail('ข้อมูลย้อนรายการไม่ครบ');
            const keep = new Set(op.body.keepLocalIds);
            for (const item of receipts.filter(item => item.localEventId && !keep.has(item.localEventId))) {
                await connection.query("DELETE FROM match_events WHERE match_id=? AND JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(details) THEN details ELSE '{}' END,'$.local_event_id'))=?", [req.params.matchId, item.localEventId]);
            }
            await connection.query('DELETE FROM match_sets WHERE match_id=? AND set_number>?', [req.params.matchId, state.completedSets?.length || 0]);
            await connection.query("UPDATE matches SET status='live',winner_team_id=NULL,team_a_score=?,team_b_score=?,home_set_score=?,away_set_score=? WHERE id=?", [state.score.home,state.score.away,state.setsWon?.home || 0,state.setsWon?.away || 0,req.params.matchId]);
            const setScores = Object.keys(checkpoint.completed).sort((a,b)=>Number(a)-Number(b)).map(key=>`${checkpoint.completed[key].home}-${checkpoint.completed[key].away}`);
            await connection.query('UPDATE matches SET set_scores=? WHERE id=?',[JSON.stringify(setScores),req.params.matchId]);
            await call(controller, 'updateLiveState', req, { state });
            receipts.push({ id: op.id,hash:receiptHash }); continue;
        }
        const method = handlers[`${op.method} ${op.path}`];
        if (!method) fail('ไม่รองรับคำสั่ง Offline นี้');
        // Official events are the only point source. Never replay VIS statistics.
        if (op.path === 'event' && (op.body.skill || op.body.grade)) fail('VIS ต้องบันทึกแยกจากคะแนนทางการ');
        if (op.path === 'event' && op.body.event_type !== 'POINT') {
            const score = checkpoint.scores[Number(op.body.set_number)] || checkpoint.scores[checkpoint.set];
            op.body.score_home = score.home; op.body.score_away = score.away;
        }
        const result = await call(controller, method, req, op.body);
        if (op.path === 'event' && result?.event?.id && Number.isSafeInteger(op.at)) {
            await connection.query('UPDATE match_events SET created_at=? WHERE id=?',[new Date(op.at),result.event.id]);
        }
        receipts.push({ id: op.id, hash:receiptHash, localEventId: op.path === 'event' ? op.body.local_event_id : null });
    }
    const wins = {home:0,away:0};
    Object.values(checkpoint.completed).forEach(score => wins[score.home > score.away ? 'home':'away']++);
    if (Math.max(wins.home,wins.away) >= Math.ceil(checkpoint.maxSets/2)) {
        const row = (await connection.query('SELECT live_state FROM matches WHERE id=?',[req.params.matchId])).rows[0];
        const state = parse(row.live_state) || {};
        state.offlineAwaitingConfirmation = true;
        await connection.query("UPDATE matches SET status='live',winner_team_id=NULL,live_state=? WHERE id=?",[JSON.stringify(state),req.params.matchId]);
    }
    const latest = (await connection.query('SELECT live_state FROM matches WHERE id=?',[req.params.matchId])).rows[0];
    const latestState = parse(latest.live_state) || {};
    latestState.offlineSyncedAt = new Date().toISOString();
    await connection.query('UPDATE matches SET live_state=? WHERE id=?',[JSON.stringify(latestState),req.params.matchId]);
    const hash = await fingerprint(connection, req);
    await connection.query('UPDATE scorer_offline_sessions SET fingerprint=?, receipts=?,checkpoint=?, released=?, expires_at=?, synced_at=NOW() WHERE match_id=?',
        [hash, JSON.stringify(receipts),JSON.stringify(checkpoint), req.body.release ? 1 : 0, Date.now() + 7 * 86400000, req.params.matchId]);
    res.json({ fingerprint: hash, acknowledged: operations.map(op => op.id), released: Boolean(req.body.release), syncedAt: new Date().toISOString() });
});
exports.confirm = endpoint(async (req,res,connection) => {
    const session = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE',[req.params.matchId])).rows[0];
    if (!session?.released || (String(session.owner_id) !== String(req.user.id) && req.user.role !== 'admin')) fail('ต้องซิงค์และคืนสิทธิ์ก่อนยืนยันผล',409);
    const checkpoint = parse(session.checkpoint), wins = {home:0,away:0};
    Object.values(checkpoint.completed).forEach(score=>wins[score.home>score.away?'home':'away']++);
    if (Math.max(wins.home,wins.away)<Math.ceil(checkpoint.maxSets/2)) fail('การแข่งขันยังไม่จบ');
    const match = (await connection.query('SELECT live_state FROM matches WHERE id=?',[req.params.matchId])).rows[0], state=parse(match.live_state);
    const score = checkpoint.scores[checkpoint.set];
    if (Number(state.score?.home)!==Number(score.home) || Number(state.score?.away)!==Number(score.away)) fail('คะแนนเปลี่ยนหลังซิงค์ กรุณาตรวจสอบก่อนยืนยัน',409);
    delete state.offlineAwaitingConfirmation;
    await connection.query("UPDATE matches SET status='completed',winner_team_id=?,live_state=? WHERE id=?",[wins.home>wins.away?checkpoint.homeId:checkpoint.awayId,JSON.stringify(state),req.params.matchId]);
    res.json({success:true});
});
exports.online = method => endpoint(async (req,res,connection) => {
    req.skipMatchUpdated = method === 'updateLiveState';
    req.emitRoster = ['updateMatchRoster','createMatchTeamPlayer','updateMatchTeamPlayer'].includes(method);
    const lease = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE',[req.params.matchId])).rows[0];
    if (lease && !lease.released && Number(lease.expires_at)>Date.now()) fail('แมตช์ถูกจอง Offline กรุณาซิงค์และคืนสิทธิ์ก่อน',409);
    res.json(await call(scopedController(connection),method,req,req.body));
});
exports.guard = async (req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method) || /\/offline(?:-|\/)/.test(req.path) || !req.params.matchId) return next();
    try {
        const row = (await db.query('SELECT released,expires_at FROM scorer_offline_sessions WHERE match_id=?', [req.params.matchId])).rows[0];
        if (row && !row.released && Number(row.expires_at) > Date.now()) return res.status(409).json({ error: 'แมตช์ถูกจอง Offline กรุณาซิงค์และคืนสิทธิ์ก่อนแก้คะแนนออนไลน์' });
        next();
    } catch (error) { res.status(503).json({ error: error.code === 'ER_NO_SUCH_TABLE' ? 'กรุณาติดตั้ง migration 33 ก่อนบันทึก' : 'ตรวจสิทธิ์เครื่องหลักไม่สำเร็จ' }); }
};

exports.scopedController = scopedController;
exports.call = call;
