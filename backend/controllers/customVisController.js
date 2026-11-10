const { randomUUID, randomBytes } = require('node:crypto');
const db = require('../config/db');
const { linkAthlete, retainUnchangedLinks } = require('../utils/customAthleteLinks');
const { athleteError } = require('../utils/athleteIntegrity');
const { createPayload, view, commandPayload } = require('../utils/customVis');
const { fail } = require('../utils/visWorkflow');
const { importCustomVis } = require('../utils/importCustomVis');
const { assertAvailable, checkout, syncPayload } = require('../utils/visOffline');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const audit = (payload, req, action) => {
    payload.audit = [...(payload.audit || []), { action, actor_id: req.user.id, at: new Date().toISOString(), revision: payload.revision }];
};
const admin = req => req.user.role === 'admin';
const allowed = (row, req) => { if (!row || (!admin(req) && String(row.owner_id) !== String(req.user.id))) fail('ไม่พบแมตช์หรือไม่มีสิทธิ์เข้าถึง', 404); };
const decorate = row => ({ ...view(parse(row.payload)).match, updated_at: row.updated_at, last_synced_at: parse(row.payload).lastSyncedAt || row.updated_at, published: Boolean(row.published), public_token: row.public_token });
function endpoint(handler) {
    return async (req, res) => {
        let connection;
        try { connection = await db.connect(); await handler(req, res, connection); }
        catch (error) { if (connection) await connection.rollback(); console.error('Custom VIMS:', error.message); res.status(error.code === 'ER_DUP_ENTRY' ? 409 : error.status || 500).json({ error: error.code === 'ER_DUP_ENTRY' ? athleteError(error).message : error.status ? error.message : error.code === 'ER_NO_SUCH_TABLE' ? 'กรุณาติดตั้ง migration 32 ก่อนใช้งานแมตช์สร้างเอง' : 'ไม่สามารถบันทึกข้อมูลแมตช์ VIMS ได้' }); }
        finally { if (connection) connection.release(); }
    };
}
async function locked(req, connection) {
    await connection.beginTransaction();
    const result = await connection.query('SELECT * FROM custom_vis_matches WHERE id = ? FOR UPDATE', [req.params.id]);
    const row = result.rows[0]; allowed(row, req); return row;
}
exports.list = endpoint(async (req, res, connection) => {
    const result = await connection.query(`SELECT * FROM custom_vis_matches${admin(req) ? '' : ' WHERE owner_id = ?'} ORDER BY created_at DESC`, admin(req) ? [] : [req.user.id]);
    res.json(result.rows.map(decorate));
});
exports.create = endpoint(async (req, res, connection) => {
    if (req.body.creationId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.body.creationId)) fail('Invalid creation ID');
    const id = `custom-${req.body.creationId || randomUUID()}`, token = randomBytes(24).toString('hex');
    const payload = req.body.importBackup ? importCustomVis(req.body.importBackup, id) : createPayload(req.body, id);
    audit(payload, req, 'CREATE');
    await connection.query('INSERT IGNORE INTO custom_vis_matches (id, owner_id, public_token, payload) VALUES (?, ?, ?, ?)', [id, req.user.id, token, JSON.stringify(payload)]);
    const saved = await connection.query('SELECT * FROM custom_vis_matches WHERE id = ?', [id]);
    allowed(saved.rows[0], req);
    res.status(201).json({ match: decorate(saved.rows[0]), config: parse(saved.rows[0].payload).config });
});
exports.read = endpoint(async (req, res, connection) => {
    const result = await connection.query('SELECT * FROM custom_vis_matches WHERE id = ?', [req.params.id]);
    const row = result.rows[0]; allowed(row, req);
    const payload = parse(row.payload);
    const athleteLinks = await connection.query('SELECT side,local_player_id,player_id FROM custom_vis_player_links WHERE match_id=?', [row.id]);
    res.json({ ...view(payload), athleteLinks: athleteLinks.rows, match: decorate(row), config: payload.config,
        offlinePayload: payload,
        backup: { config: payload.config, match: payload.match, actions: payload.actions } });
});
exports.update = endpoint(async (req, res, connection) => {
    const row = await locked(req, connection), previous = parse(row.payload);
    assertAvailable(previous);
    if (view(previous).state.history.length || previous.lifecycle === 'cancelled' || previous.lifecycle === 'confirmed') fail('แก้ข้อมูลพื้นฐานได้ก่อนเริ่มบันทึกเท่านั้น', 409);
    const payload = createPayload(req.body, req.params.id);
    payload.revision = previous.revision + 1; payload.operations = previous.operations;
    payload.audit = previous.audit || []; audit(payload, req, 'UPDATE_CONFIG');
    await retainUnchangedLinks(connection, req.params.id, previous, payload);
    await connection.query('UPDATE custom_vis_matches SET payload = ? WHERE id = ?', [JSON.stringify(payload), req.params.id]);
    await connection.commit(); res.json({ match: decorate({ ...row, payload }) });
});
exports.command = endpoint(async (req, res, connection) => {
    const row = await locked(req, connection);
    assertAvailable(parse(row.payload));
    const result = commandPayload(parse(row.payload), req.body);
    if (!result.response.duplicate) {
        audit(result.payload, req, req.body.command.type);
        if (req.body.command.type === 'CONFIRM') result.payload.confirmed_at = new Date().toISOString();
        await connection.query('UPDATE custom_vis_matches SET payload = ? WHERE id = ?', [JSON.stringify(result.payload), req.params.id]);
        if (result.payload.lifecycle === 'cancelled') await connection.query('UPDATE custom_vis_matches SET published = 0 WHERE id = ?', [req.params.id]);
    }
    await connection.commit();
    const io = req.app.get('io');
    if (io) io.to(`match_${req.params.id}`).emit('vis_statistics_updated', { matchId: req.params.id });
    res.json(result.response);
});
exports.publish = endpoint(async (req, res, connection) => {
    if (typeof req.body.published !== 'boolean') fail('กรุณาระบุสถานะเผยแพร่');
    const row = await locked(req, connection);
    if (req.body.published) assertAvailable(parse(row.payload));
    if (parse(row.payload).lifecycle === 'cancelled' && req.body.published) fail('ไม่สามารถเผยแพร่แมตช์ที่ยกเลิก');
    const payload = parse(row.payload); audit(payload, req, req.body.published ? 'PUBLISH' : 'UNPUBLISH');
    await connection.query('UPDATE custom_vis_matches SET published = ?, payload = ? WHERE id = ?', [req.body.published ? 1 : 0, JSON.stringify(payload), req.params.id]);
    await connection.commit(); res.json({ published: req.body.published, public_token: row.public_token });
});
exports.reopen = endpoint(async (req, res, connection) => {
    const row = await locked(req, connection), payload = parse(row.payload);
    assertAvailable(payload);
    if (payload.lifecycle !== 'confirmed') fail('แมตช์นี้ยังไม่ได้ยืนยันผล', 409);
    payload.lifecycle = 'review'; payload.revision++;
    audit(payload, req, 'REOPEN');
    await connection.query('UPDATE custom_vis_matches SET payload = ? WHERE id = ?', [JSON.stringify(payload), req.params.id]);
    await connection.commit(); res.json({ match: decorate({ ...row, payload }) });
});
exports.publicView = endpoint(async (req, res, connection) => {
    if (!/^[a-f0-9]{48}$/.test(req.params.token)) fail('ไม่พบการเผยแพร่แมตช์', 404);
    const result = await connection.query('SELECT payload, updated_at FROM custom_vis_matches WHERE public_token = ? AND published = 1', [req.params.token]);
    if (!result.rows[0]) fail('แมตช์นี้ไม่ได้เปิดเผยแพร่', 404);
    const payload = parse(result.rows[0].payload), resultView = view(payload);
    if (payload.lifecycle === 'cancelled') fail('แมตช์นี้ยกเลิกแล้ว', 404);
    res.set('Cache-Control', 'no-store');
    res.json({ lastSyncedAt: result.rows[0].updated_at || payload.lastSyncedAt, title: payload.config.title, date: payload.config.date, location: payload.config.location, lifecycle: payload.lifecycle,
        home: payload.config.home.name, away: payload.config.away.name, score: resultView.state.score,
        setsWon: resultView.state.setsWon, currentSet: resultView.state.currentSet, completedSets: resultView.state.completedSets,
        phase: resultView.state.phase, servingTeam: resultView.state.servingTeam,
        players: ['home', 'away'].flatMap(key => payload.config[key].players.map(p => {
            const events = payload.actions.filter(e => e.player_id === p.id);
            const points = skill => events.filter(e => e.skill === skill && e.grade === '#').length;
            return { team: key, number: p.number, name: p.name, attack: points('A'), block: points('B'), serve: points('S') };
        })) });
});

exports.offlinePermit = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ user: { id: req.user.id, role: req.user.role, username: req.user.username || `VIMS ${req.user.id}` },
        issuedAt: Date.now(), expiresAt: Date.now() + 7 * 86400000 });
};
exports.offlineCheckout = endpoint(async (req, res, connection) => {
    const row = await locked(req, connection), previous = parse(row.payload);
    const previousToken = previous.offlineLease?.checkoutToken;
    const leaseCreated = !previous.offlineLease || previous.offlineLease.expiresAt <= Date.now();
    const payload = checkout(previous, req.body.deviceId);
    payload.offlineLease.checkoutToken = leaseCreated ? randomUUID() : previousToken;
    await connection.query('UPDATE custom_vis_matches SET payload = ? WHERE id = ?', [JSON.stringify(payload), req.params.id]);
    await connection.commit(); res.json({ payload, match: decorate({ ...row, payload }), leaseCreated });
});
exports.offlineCancelCheckout = endpoint(async (req, res, connection) => {
    const row = await locked(req, connection), payload = parse(row.payload);
    if (!req.body.checkoutToken || payload.offlineLease?.checkoutToken !== req.body.checkoutToken || payload.offlineLease?.deviceId !== req.body.deviceId || payload.revision !== req.body.revision) fail('ข้อมูลเปลี่ยน จึงไม่คืนสิทธิ์อัตโนมัติ กรุณาตรวจสอบแมตช์', 409);
    payload.offlineLease = null;
    await connection.query('UPDATE custom_vis_matches SET payload = ? WHERE id = ?', [JSON.stringify(payload), req.params.id]);
    await connection.commit(); res.json({ released: true });
});
exports.offlineSync = endpoint(async (req, res, connection) => {
    if (!/^custom-[a-f0-9-]{36}$/i.test(req.params.id)) fail('Invalid offline match ID');
    await connection.beginTransaction();
    // INSERT IGNORE + row lock serialize first syncs as well as existing matches.
    if (req.body.config) {
        const initial = req.body.importBackup ? importCustomVis(req.body.importBackup, req.params.id) : createPayload(req.body.config, req.params.id);
        await connection.query('INSERT IGNORE INTO custom_vis_matches (id, owner_id, public_token, payload) VALUES (?, ?, ?, ?)',
            [req.params.id, req.user.id, randomBytes(24).toString('hex'), JSON.stringify(initial)]);
    }
    const result = await connection.query('SELECT * FROM custom_vis_matches WHERE id = ? FOR UPDATE', [req.params.id]);
    const row = result.rows[0]; allowed(row, req);
    const synced = syncPayload(parse(row.payload), req.body);
    audit(synced.payload, req, 'OFFLINE_SYNC');
    await connection.query('UPDATE custom_vis_matches SET payload = ? WHERE id = ?', [JSON.stringify(synced.payload), row.id]);
    if (synced.payload.lifecycle === 'cancelled') await connection.query('UPDATE custom_vis_matches SET published = 0 WHERE id = ?', [row.id]);
    await connection.commit();
    const io = req.app.get('io');
    if (io) io.to(`match_${row.id}`).emit('vis_statistics_updated', { matchId: row.id });
    res.json({ payload: synced.payload, acknowledged: synced.acknowledged, match: decorate({ ...row, payload: synced.payload }) });
});

exports.athleteOptions = endpoint(async (req,res,connection) => {
    if (!admin(req)) fail('เฉพาะผู้ดูแลระบบ',403);
    const q = '%' + String(req.query.q || '').trim().slice(0,100) + '%';
    const players = await connection.query(`SELECT p.id,p.number,p.first_name,p.last_name,t.name AS team_name, t.name_th AS team_name_th, t.name_en AS team_name_en
        FROM players p LEFT JOIN teams t ON t.id=p.team_id WHERE COALESCE(p.is_active,1)=1
        AND (CONCAT_WS(' ',p.first_name,p.last_name) LIKE ? OR t.name LIKE ?) ORDER BY p.id LIMIT 200`,[q,q]);
    res.json(players.rows);
});
exports.linkAthlete = endpoint(async (req,res,connection) => {
    if (!admin(req)) fail('เฉพาะผู้ดูแลระบบ',403);
    const row = await locked(req,connection), payload = parse(row.payload);
    assertAvailable(payload);
    await linkAthlete(connection,payload,row.id,req.user,req.body);
    audit(payload,req,'LINK_ATHLETE');
    await connection.query('UPDATE custom_vis_matches SET payload=? WHERE id=?',[JSON.stringify(payload),row.id]);
    await connection.commit(); res.json({message:'บันทึกการเชื่อมตัวตนนักกีฬาแล้ว'});
});
