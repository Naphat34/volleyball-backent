const { sqlDialect } = require('../utils/sqlDialect');
const { applyMatchSetup, setupPlayers } = require('../utils/matchSetup');
const crypto = require('crypto');
const db = require('../config/db');
const { normalizeManualMatch, assertReady, parseConfig, canManage } = require('../utils/manualScorer');
const { attachDashboardSummaries } = require('../utils/matchDashboard');
const { writeAuditLog } = require('../utils/auditLogger');
const { playerNameFields, teamNameFields } = require('../utils/bilingualNames');
const { canReadStatistics } = require('../utils/manualVisAccess');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const sendError = (res, error) => {
    if (!error.status) console.error('Manual scorer:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'ไม่สามารถบันทึกแมตช์ได้ กรุณาลองใหม่' });
};
async function owned(connection, req, lock = false) {
    const result = await connection.query(`SELECT * FROM matches WHERE id = ? AND manual_owner_id IS NOT NULL${lock ? ' FOR UPDATE' : ''}`, [req.params.id]);
    const match = result.rows[0];
    if (!match || !canManage(req.user, match)) throw httpError(404, 'ไม่พบแมตช์ของบัญชีนี้');
    return match;
}
async function actualConfig(connection, match) {
    const config = { ...parseConfig(match.manual_config) };
    for (const side of ['home', 'away']) {
        const team = (await connection.query('SELECT name, name_th, name_en, main_color FROM teams WHERE id = ?', [match[`${side}_team_id`]])).rows[0];
        const players = (await connection.query('SELECT id, number, first_name, last_name, first_name_th, last_name_th, first_name_en, last_name_en, position, is_captain FROM players WHERE team_id = ? AND is_playing = 1 ORDER BY number', [match[`${side}_team_id`]])).rows;
        const configured = applyMatchSetup({ ...match });
        config[side] = { ...team, ...config[side], name: configured[`${side}_team_name`] || team.name,
            name_th: configured[`${side}_team_name_th`] ?? team.name_th, name_en: configured[`${side}_team_name_en`] ?? team.name_en,
            color: team.main_color || config[side].color, players: setupPlayers(match, side, players).map(p => ({ ...p, position: p.position || '', is_captain: Boolean(p.is_captain) })) };
    }
    return config;
}
async function saveTeam(connection, config, ownerId, id) {
    const translatedTeamFields = teamNameFields.filter(field => config[field] !== undefined);
    if (!id) {
        const result = await connection.query(sqlDialect(`INSERT INTO teams (name, code, status, main_color, manual_owner_id${translatedTeamFields.map(field => `, ${field}`).join('')}) VALUES (?, ?, 'active', ?, ?${translatedTeamFields.map(() => ', ?').join('')})`, `INSERT INTO teams (name, code, status, main_color, manual_owner_id${translatedTeamFields.map(field => `, ${field}`).join('')}) VALUES (?, ?, 'active', ?, ?${translatedTeamFields.map(() => ', ?').join('')}) RETURNING id`),
            [config.name, `M${crypto.randomBytes(4).toString('hex')}`, config.color, ownerId, ...translatedTeamFields.map(field => config[field])]);
        id = result.insertId;
    } else await connection.query(`UPDATE teams SET name = ?, main_color = ?${translatedTeamFields.map(field => `, ${field}=?`).join('')} WHERE id = ?`, [config.name, config.color, ...translatedTeamFields.map(field => config[field]), id]);
    const existing = (await connection.query('SELECT id, number FROM players WHERE team_id = ?', [id])).rows;
    const keep = [];
    let libero = 0;
    for (const p of config.players) {
        const previous = existing.find(row => Number(row.number) === p.number);
        const isLibero = p.position === 'L';
        if (isLibero) libero += 1;
        const values = [p.number, p.first_name, p.last_name, p.position || null, p.is_captain ? 1 : 0, isLibero && libero === 1 ? 1 : 0, isLibero && libero === 2 ? 1 : 0];
        const translatedFields = playerNameFields.filter(field => p[field] !== undefined);
        const translatedValues = translatedFields.map(field => p[field]);
        if (previous) {
            await connection.query(`UPDATE players SET number=?, first_name=?, last_name=?, position=?, is_captain=?, is_libero1=?, is_libero2=?, is_playing=1${translatedFields.map(field => `, ${field}=?`).join('')} WHERE id=? AND team_id=?`, [...values, ...translatedValues, previous.id, id]);
            keep.push(previous.id);
        } else {
            const inserted = await connection.query(sqlDialect(`INSERT INTO players (number, first_name, last_name, position, is_captain, is_libero1, is_libero2, team_id, is_active, is_playing${translatedFields.map(field => `, ${field}`).join('')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1${translatedFields.map(() => ', ?').join('')})`, `INSERT INTO players (number, first_name, last_name, position, is_captain, is_libero1, is_libero2, team_id, is_active, is_playing${translatedFields.map(field => `, ${field}`).join('')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1${translatedFields.map(() => ', ?').join('')}) RETURNING id`), [...values, id, ...translatedValues]);
            keep.push(inserted.insertId);
        }
    }
    const removed = existing.filter(row => !keep.includes(row.id)).map(row => row.id);
    if (removed.length) await connection.query(`DELETE FROM players WHERE team_id=? AND id IN (${removed.map(() => '?').join(',')})`, [id, ...removed]);
    return id;
}
exports.list = async (req, res) => {
    try {
        const rows = (await db.query(`SELECT m.*, m.manual_title AS competition_name, t1.name AS home_team, t1.name_th AS home_team_name_th, t1.name_en AS home_team_name_en, t2.name AS away_team, t2.name_th AS away_team_name_th, t2.name_en AS away_team_name_en
            FROM matches m JOIN teams t1 ON t1.id=m.home_team_id JOIN teams t2 ON t2.id=m.away_team_id
            WHERE m.manual_owner_id IS NOT NULL AND (? = 'admin' OR m.manual_owner_id=?) ORDER BY m.id DESC`, [req.user.role, req.user.id])).rows;
        const matches = rows.map(m => ({ ...m, is_manual_scorer: true, manual_lifecycle: m.manual_lifecycle === 'confirmed' ? 'confirmed' : m.status === 'completed' ? 'review' : m.status === 'live' ? 'live' : m.manual_lifecycle }));
        res.json(await attachDashboardSummaries(db, matches));
    } catch (error) { sendError(res, error); }
};
exports.read = async (req, res) => {
    try { const match = await owned(db, req); res.json({ match: applyMatchSetup(match), config: await actualConfig(db, match) }); }
    catch (error) { sendError(res, error); }
};
exports.save = async (req, res) => {
    let connection;
    try {
        const config = normalizeManualMatch(req.body);
        const start = req.body.ready === true;
        if (start) assertReady(config);
        if (!req.params.id && !/^[a-f0-9-]{36}$/i.test(req.body.creationId || '')) throw httpError(400, 'รหัสการสร้างแมตช์ไม่ถูกต้อง');
        connection = await db.connect();
        await connection.beginTransaction();
        let match = req.params.id ? await owned(connection, req, true) : null;
        if (!match) {
            const duplicate = (await connection.query('SELECT * FROM matches WHERE manual_owner_id=? AND manual_creation_id=? FOR UPDATE', [req.user.id, req.body.creationId])).rows[0];
            if (duplicate) { await connection.commit(); return res.status(200).json({ match: duplicate }); }
        }
        if (match && (match.status !== 'scheduled' || match.first_serve_team_id || !['draft', 'ready'].includes(match.manual_lifecycle))) throw httpError(409, 'แมตช์เริ่มเตรียมการแข่งขันแล้ว ไม่สามารถแก้กติกาหรือรายชื่อจากหน้านี้ได้');
        if (match) {
            if (match.manual_vis_assignee_id) throw httpError(409, 'กรุณาคืนงานสถิติก่อนแก้ไขกติกาหรือรายชื่อ');
            const statistics = (await connection.query("SELECT COUNT(*) AS count FROM match_actions WHERE match_id=? AND action_type='VIS_STAT'", [match.id])).rows[0];
            if (Number(statistics.count)) throw httpError(409, 'เริ่มบันทึกสถิติแล้ว ไม่สามารถเปลี่ยนกติกาหรือรายชื่อได้');
        }
        if (match?.manual_published && !start) throw httpError(409, 'กรุณาหยุดเผยแพร่ก่อนเปลี่ยนแมตช์กลับเป็นฉบับร่าง');
        const homeId = await saveTeam(connection, config.home, req.user.id, match?.home_team_id);
        const awayId = await saveTeam(connection, config.away, req.user.id, match?.away_team_id);
        const values = [config.title || 'แมตช์สร้างเอง', start ? 'ready' : 'draft', JSON.stringify(config), config.date || null, config.time || null, config.location || null, config.matchNumber, config.maxSets, config.hasChallenge ? 1 : 0, config.gender || null];
        if (match) {
            await connection.query('UPDATE matches SET match_setup=NULL, match_setup_revision=match_setup_revision+1, manual_title=?, manual_lifecycle=?, manual_config=?, match_date=?, start_time=?, location=?, match_number=?, max_sets=?, has_challenge=?, gender=?, live_state=NULL WHERE id=?', [...values, match.id]);
        } else {
            const inserted = await connection.query(sqlDialect(`INSERT INTO matches
                (manual_title, manual_lifecycle, manual_config, match_date, start_time, location, match_number, max_sets, has_challenge, gender, home_team_id, away_team_id, manual_owner_id, manual_creation_id, status, set_scores)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', '[]')`, `INSERT INTO matches
                (manual_title, manual_lifecycle, manual_config, match_date, start_time, location, match_number, max_sets, has_challenge, gender, home_team_id, away_team_id, manual_owner_id, manual_creation_id, status, set_scores)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', '[]') RETURNING id`), [...values, homeId, awayId, req.user.id, req.body.creationId]);
            match = { id: inserted.insertId };
        }
        await writeAuditLog(req, req.params.id ? 'manual_match.update' : 'manual_match.create', 'match', match.id, { lifecycle: start ? 'ready' : 'draft', config }, connection);
        const saved = (await connection.query('SELECT * FROM matches WHERE id=?', [match.id])).rows[0];
        await connection.commit();
        res.status(req.params.id ? 200 : 201).json({ match: saved });
    } catch (error) {
        if (connection) await connection.rollback();
        // Retrying after a lost response or simultaneous double-click returns the same match.
        if (error.code === 'ER_DUP_ENTRY' && !req.params.id) {
            const existing = (await db.query('SELECT * FROM matches WHERE manual_owner_id=? AND manual_creation_id=?', [req.user.id, req.body.creationId])).rows[0];
            if (existing) return res.json({ match: existing });
        }
        sendError(res, error);
    } finally { connection?.release(); }
};
exports.action = async (req, res) => {
    let connection;
    try {
        connection = await db.connect(); await connection.beginTransaction();
        const match = await owned(connection, req, true);
        const action = req.params.action;
        if (action === 'publish') {
            if (typeof req.body.published !== 'boolean') throw httpError(400, 'กรุณาระบุสถานะเผยแพร่');
            if (req.body.published && match.manual_lifecycle === 'draft') throw httpError(409, 'เตรียมแมตช์ให้พร้อมก่อนเผยแพร่');
            await connection.query('UPDATE matches SET manual_published=? WHERE id=?', [req.body.published ? 1 : 0, match.id]);
        } else if (action === 'statistics-access') {
            if (typeof req.body.shared !== 'boolean') throw httpError(400, 'กรุณาระบุสิทธิ์เข้าถึงสถิติ');
            if (req.body.shared && (match.manual_lifecycle === 'draft' || ['cancelled', 'canceled'].includes(match.status))) throw httpError(409, 'กรุณาเตรียมแมตช์ให้พร้อมก่อนเปิดให้บันทึกสถิติ');
            if (req.body.shared) {
                const config = await actualConfig(connection, match);
                for (const side of ['home', 'away']) config[side].players = config[side].players.map(player => ({ ...player,
                    is_captain: Boolean(player.is_captain || player.role === 'C' || String(player.role || '').endsWith('+C')),
                    position: String(player.role || '').startsWith('L') ? 'L' : player.position }));
                assertReady(config);
            }
            if (Number(match.manual_vis_shared) !== Number(req.body.shared)) {
                await connection.query('UPDATE matches SET manual_vis_shared=?, manual_vis_assignee_id=NULL, manual_vis_claimed_at=NULL WHERE id=?', [req.body.shared ? 1 : 0, match.id]);
            }
        } else if (action === 'confirm') {
            if (match.status !== 'completed') throw httpError(409, 'ยืนยันผลได้หลังจบการแข่งขันเท่านั้น');
            const config = parseConfig(match.manual_config);
            const sets = (await connection.query('SELECT home_score, away_score, set_number FROM match_sets WHERE match_id=? AND end_time IS NOT NULL ORDER BY set_number', [match.id])).rows;
            const needed = Math.ceil(config.maxSets / 2);
            let home = 0, away = 0;
            for (const [index, set] of sets.entries()) {
                const target = Number(set.set_number) === config.maxSets ? config.decidingSetPoints : config.pointsPerSet;
                if (Number(set.set_number) !== index + 1 || index >= config.maxSets || Math.min(set.home_score, set.away_score) < 0
                    || home >= needed || away >= needed || Math.max(set.home_score, set.away_score) < target || Math.abs(set.home_score - set.away_score) < 2) throw httpError(409, 'คะแนนรายเซตไม่ตรงกติกา กรุณาตรวจสอบก่อนยืนยัน');
                if (set.home_score > set.away_score) home++; else away++;
            }
            if (Math.max(home, away) !== needed) throw httpError(409, 'ผลเซตยังไม่ครบ กรุณาตรวจสอบก่อนยืนยัน');
            await connection.query("UPDATE matches SET manual_lifecycle='confirmed' WHERE id=?", [match.id]);
        } else throw httpError(400, 'คำสั่งไม่ถูกต้อง');
        await writeAuditLog(req, `manual_match.${action}`, 'match', match.id, req.body, connection);
        await connection.commit();
        if ((action === 'publish' && !req.body.published) || (action === 'statistics-access' && !req.body.shared)) {
            const current = { ...match,
                manual_published: action === 'publish' ? Number(req.body.published) : match.manual_published,
                manual_vis_shared: action === 'statistics-access' ? Number(req.body.shared) : match.manual_vis_shared };
            const io = req.app.get('io');
            const room = `match_${match.id}`;
            for (const id of io?.sockets.adapter.rooms.get(room) || []) {
                const socket = io.sockets.sockets.get(id);
                if (socket && !canManage(socket.user, current) && !canReadStatistics(socket.user, current) && !Number(current.manual_published)) {
                    socket.leave(room);
                    socket.emit('join_error', { error: 'Match is private' });
                }
            }
        }
        res.json({ success: true });
    } catch (error) { if (connection) await connection.rollback(); sendError(res, error); }
    finally { connection?.release(); }
};
exports.backup = async (req, res) => {
    try {
        const match = await owned(db, req);
        const sets = (await db.query('SELECT * FROM match_sets WHERE match_id=? ORDER BY set_number', [match.id])).rows;
        const events = (await db.query('SELECT * FROM match_events WHERE match_id=? ORDER BY id', [match.id])).rows;
        res.json({ format: 'volley-manual-scorer', version: 1, exportedAt: new Date().toISOString(), match, config: await actualConfig(db, match), sets, events });
    } catch (error) { sendError(res, error); }
};
