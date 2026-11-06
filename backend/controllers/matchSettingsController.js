const db = require('../config/db');
const { createHash } = require('node:crypto');
const { normalizeTeam, parseSetup } = require('../utils/matchSetup');
const { roleHasPermission } = require('../config/permissions');
const { canManage, assertReady } = require('../utils/manualScorer');
const { writeAuditLog } = require('../utils/auditLogger');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const officialFields = { referee_1_id: 'referees', referee_2_id: 'referees', scorer_id: 'scorers', line_judge_1_id: 'line_judges', line_judge_2_id: 'line_judges', line_judge_3_id: 'line_judges', line_judge_4_id: 'line_judges' };
const detailFields = ['match_number', 'match_date', 'start_time', 'round_name', 'pool_name', 'location', 'city', 'country', 'category', 'age_group_id', 'has_challenge'];
const started = match => match.status !== 'scheduled' || Boolean(match.first_serve_team_id);
async function roster(connection, req) {
    const scorer = require('./scorerOfflineController');
    return scorer.call(scorer.scopedController(connection), 'getMatchRosterData', req, {});
}
function teamDraft(data, side) {
    const match = data.match;
    const flag = value => value === true || value === 1 || value === '1';
    return { name: match[`${side}_team_name`] || '', code: match[`${side}_team_code`] || '',
        color: parseSetup(match.match_setup)?.[side]?.color || (side === 'home' ? '#6366f1' : '#f43f5e'),
        liberoColor: parseSetup(match.match_setup)?.[side]?.liberoColor || (side === 'home' ? '#facc15' : '#3b82f6'),
        players: data[side].players.map(p => ({ id: p.id, number: p.number, first_name: p.first_name || '', last_name: p.last_name || '', position: p.position || '',
            role: flag(p.is_libero2) || String(p.role).startsWith('L2') ? (flag(p.is_captain) ? 'L2+C' : 'L2') : flag(p.is_libero1) || flag(p.is_libero) || ['L', 'L1', 'L1+C'].includes(p.role) ? (flag(p.is_captain) ? 'L1+C' : 'L1') : flag(p.is_captain) || p.role === 'C' ? 'C' : '' })),
        staff: data[side].staff.map(p => ({ first_name: p.first_name || '', last_name: p.last_name || '', role: p.role || '' })) };
}
async function snapshot(connection, req) {
    const data = await roster(connection, req), match = data.match;
    const draft = Object.fromEntries([...detailFields, ...Object.keys(officialFields)].map(key => [key, match[key] ?? '']));
    // DATE values returned by mysql2 are local Dates, not UTC calendar dates.
    if (Object.prototype.toString.call(draft.match_date) === '[object Date]') draft.match_date = `${draft.match_date.getFullYear()}-${String(draft.match_date.getMonth()+1).padStart(2,'0')}-${String(draft.match_date.getDate()).padStart(2,'0')}`;
    else draft.match_date = String(draft.match_date).slice(0,10);
    draft.start_time = String(draft.start_time).slice(0,5);
    draft.age_group_id = match.age_group_id || match.match_age_group_id || '';
    draft.has_challenge = Boolean(Number(match.has_challenge));
    for (const side of ['home', 'away']) draft[side] = teamDraft(data, side);
    const config = parseSetup(match.manual_config) || {};
    Object.assign(draft, { title: match.competition_title || '', gender: match.competition_gender || match.gender || '', maxSets: Number(match.max_sets || 5), pointsPerSet: Number(match.points_per_set || config.pointsPerSet || 25), decidingSetPoints: Number(match.deciding_set_points || config.decidingSetPoints || 15) });
    const owns = !match.manual_owner_id || canManage(req.user, match);
    return { draft, fingerprint: createHash('sha256').update(JSON.stringify(draft)).digest('hex'), revision: match.match_setup_revision || 0, editableTeams: !started(match),
        canEdit: owns && roleHasPermission(req.user?.role, 'match.score') && match.manual_lifecycle !== 'confirmed' && !['completed', 'cancelled'].includes(match.status),
        available: { home: data.home.availablePlayers, away: data.away.availablePlayers } };
}
exports.read = async (req, res) => {
    try {
        if (!roleHasPermission(req.user?.role, 'match.score') && req.user?.role !== 'referee') fail('ไม่มีสิทธิ์ดูการตั้งค่าแมตซ์', 403);
        const match = (await db.query('SELECT manual_owner_id FROM matches WHERE id=?', [req.params.matchId])).rows[0];
        if (!match || match.manual_owner_id && !canManage(req.user, match)) fail('ไม่พบแมตซ์', 404);
        const data = await snapshot(db, req);
        const [referees, scorers, lineJudges] = await Promise.all(['referees', 'scorers', 'line_judges'].map(table => db.query(`SELECT id, firstname, lastname FROM ${table} ORDER BY firstname, lastname`)));
        const ageGroups = (await db.query('SELECT id, name FROM age_groups ORDER BY name')).rows;
        res.set('Cache-Control', 'no-store'); res.json({ ...data, ageGroups, officials: { referees: referees.rows, scorers: scorers.rows, lineJudges: lineJudges.rows } });
    }
    catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'อ่านการตั้งค่าแมตซ์ไม่สำเร็จ' }); }
};
exports.save = async (req, res) => {
    let connection;
    try {
        connection = await db.connect(); await connection.beginTransaction();
        const match = (await connection.query('SELECT * FROM matches WHERE id=? FOR UPDATE', [req.params.matchId])).rows[0];
        if (!match) fail('ไม่พบแมตซ์', 404);
        if (match.manual_owner_id && !canManage(req.user, match)) fail('ไม่มีสิทธิ์แก้ไขแมตซ์นี้', 403);
        if (match.manual_lifecycle === 'confirmed' || ['completed', 'cancelled'].includes(match.status)) fail('แมตซ์นี้ถูกล็อกการแก้ไขแล้ว', 409);
        await require('./officialVisOfflineController').assertOnline(connection, match.id);
        const lease = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE', [match.id])).rows[0];
        if (lease && !lease.released && Number(lease.expires_at) > Date.now()) fail('กรุณาซิงค์และคืนสิทธิ์ Offline ก่อนแก้ไข', 409);
        if (req.body.revision !== (match.match_setup_revision || 0)) fail('มีการเปลี่ยนข้อมูล กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก', 409);
        const current = await snapshot(connection, req), input = req.body.draft;
        if (req.body.fingerprint !== current.fingerprint) fail('ข้อมูลเปลี่ยนระหว่างแก้ไข กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก', 409);
        if (!input || typeof input !== 'object') fail('ข้อมูลไม่ครบถ้วน');
        const setup = {};
        for (const key of ['title', 'gender']) {
            if (typeof input[key] !== 'string' || input[key].length > 160) fail('ข้อมูลรายการไม่ถูกต้อง');
            setup[key] = input[key].trim();
        }
        if (!setup.title) fail('กรุณาระบุชื่อรายการ');
        if (!['', 'Male', 'Female', 'Mixed'].includes(setup.gender)) fail('ประเภทการแข่งขันไม่ถูกต้อง');
        for (const key of ['maxSets', 'pointsPerSet', 'decidingSetPoints']) {
            setup[key] = Number(input[key]);
            if (!Number.isInteger(setup[key]) || (key === 'maxSets' ? ![3,5].includes(setup[key]) : setup[key] < 5 || setup[key] > 99)) fail('กติกาคะแนนไม่ถูกต้อง');
            if (started(match) && setup[key] !== current.draft[key]) fail('เริ่มแข่งขันแล้ว ไม่สามารถเปลี่ยนกติกาได้', 409);
        }
        if (!match.manual_owner_id && (setup.pointsPerSet !== 25 || setup.decidingSetPoints !== 15)) fail('แมตซ์จากรายการใช้คะแนน 25 และเซตตัดสิน 15');
        for (const side of ['home', 'away']) {
            const ids = new Set([...current.available[side], ...current.draft[side].players].map(p => Number(p.id)));
            setup[side] = normalizeTeam(input[side], ids);
            if (started(match) && JSON.stringify(setup[side]) !== JSON.stringify(normalizeTeam(current.draft[side], ids))) fail('เริ่มแข่งขันแล้ว ไม่สามารถเปลี่ยนข้อมูลทีมและรายชื่อได้', 409);
        }
        if (setup.home.name === setup.away.name) fail('ชื่อทีมทั้งสองต้องต่างกัน');
        if (match.manual_owner_id && match.manual_lifecycle === 'ready') assertReady(setup);
        if (typeof input.has_challenge !== 'boolean') fail('ข้อมูล Challenge ไม่ถูกต้อง');
        if (started(match) && input.has_challenge !== current.draft.has_challenge) fail('เริ่มแข่งขันแล้ว ไม่สามารถเปลี่ยน Challenge ได้', 409);
        if (input.age_group_id !== '' && (!Number.isSafeInteger(Number(input.age_group_id)) || !(await connection.query('SELECT id FROM age_groups WHERE id=?', [input.age_group_id])).rows.length)) fail('รุ่นอายุไม่ถูกต้อง');
        const values = detailFields.map(key => {
            if (key === 'has_challenge') return input[key] ? 1 : 0;
            const value = input[key];
            if (typeof value !== 'string' && typeof value !== 'number') fail('ข้อมูลการแข่งขันไม่ถูกต้อง');
            if (String(value).length > (key === 'location' ? 100 : 50)) fail('ข้อความยาวเกินกำหนด');
            return String(value).trim() || null;
        });
        if (input.match_number !== '' && (!Number.isInteger(Number(input.match_number)) || Number(input.match_number) < 1)) fail('หมายเลขแมตซ์ไม่ถูกต้อง');
        if (input.match_date && (!/^\d{4}-\d{2}-\d{2}$/.test(input.match_date) || Number.isNaN(Date.parse(input.match_date)) || new Date(input.match_date).toISOString().slice(0,10) !== input.match_date)) fail('วันที่ไม่ถูกต้อง');
        if (input.start_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start_time)) fail('เวลาไม่ถูกต้อง');
        const used = new Set();
        for (const [key, table] of Object.entries(officialFields)) {
            const id = input[key] === '' || input[key] == null ? null : Number(input[key]);
            if (id !== null) {
                if (!Number.isSafeInteger(id) || id < 1 || !(await connection.query(`SELECT id FROM ${table} WHERE id=?`, [id])).rows.length) fail('ไม่พบข้อมูลผู้ตัดสินที่เลือก');
                const identity = `${table}:${id}`;
                if (used.has(identity)) fail('เลือกผู้ตัดสินซ้ำตำแหน่ง');
                used.add(identity);
            }
            values.push(id);
        }
        // The JSON contains only this match's roster and display names.
        await connection.query(`UPDATE matches SET ${[...detailFields, ...Object.keys(officialFields)].map(key => `${key}=?`).join(',')}, match_setup=?, match_setup_revision=match_setup_revision+1 WHERE id=?`, [...values, JSON.stringify(setup), match.id]);
        if (match.manual_owner_id) {
            const config = { ...parseSetup(match.manual_config), title: setup.title, gender: setup.gender, hasChallenge: input.has_challenge, maxSets: setup.maxSets, pointsPerSet: setup.pointsPerSet, decidingSetPoints: setup.decidingSetPoints, date: input.match_date, time: input.start_time, location: input.location, matchNumber: input.match_number === '' ? null : Number(input.match_number) };
            await connection.query('UPDATE matches SET manual_config=? WHERE id=?', [JSON.stringify(config), match.id]);
        }
        await writeAuditLog(req, 'match.settings.update', 'match', match.id, { revision: current.revision + 1 }, connection);
        await connection.commit();
        const io = req.app.get('io');
        io?.to(`match_${match.id}`).emit('match_updated', { id: match.id });
        io?.to(`match_${match.id}`).emit('roster_updated', { id: match.id });
        res.json({ success: true });
    } catch (error) {
        if (connection) await connection.rollback();
        if (!error.status) console.error('Match settings:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : error.code === 'ER_BAD_FIELD_ERROR' ? 'กรุณาติดตั้ง migration 35 ก่อนใช้งานตั้งค่าแมตซ์' : 'บันทึกตั้งค่าแมตซ์ไม่สำเร็จ' });
    } finally { connection?.release(); }
};
