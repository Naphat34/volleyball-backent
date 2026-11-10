const db = require('../config/db');
const { attachDashboardSummaries } = require('../utils/matchDashboard');
const { writeAuditLog } = require('../utils/auditLogger');
const { isStatisticsUser, canReadStatistics } = require('../utils/manualVisAccess');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
exports.access = (req, res, next) => isStatisticsUser(req.user) ? next() : res.status(403).json({ error: 'เฉพาะผู้ดูแลและเจ้าหน้าที่สถิติ' });
exports.list = async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT m.*, m.manual_title AS competition_name, 1 AS is_manual_scorer,
            h.name AS home_team, h.name_th AS home_team_name_th, h.name_en AS home_team_name_en,
            a.name AS away_team, a.name_th AS away_team_name_th, a.name_en AS away_team_name_en,
            owner.username AS manual_creator, recorder.username AS manual_vis_assignee
            FROM matches m JOIN teams h ON h.id=m.home_team_id JOIN teams a ON a.id=m.away_team_id
            LEFT JOIN users owner ON owner.id=m.manual_owner_id
            LEFT JOIN users recorder ON recorder.id=m.manual_vis_assignee_id
            WHERE m.manual_owner_id IS NOT NULL AND m.manual_vis_shared=1
            AND m.manual_lifecycle <> 'draft' AND m.status NOT IN ('cancelled', 'canceled') ORDER BY m.id DESC`);
        res.json(await attachDashboardSummaries(db, rows));
    } catch (error) {
        console.error('Manual statistics list:', error);
        res.status(500).json({ error: 'ไม่สามารถโหลดแมตช์ที่สกอร์เปิดให้บันทึกสถิติ' });
    }
};
exports.assignment = async (req, res) => {
    let connection;
    try {
        connection = await db.connect(); await connection.beginTransaction();
        const match = (await connection.query('SELECT * FROM matches WHERE id=? AND manual_owner_id IS NOT NULL FOR UPDATE', [req.params.id])).rows[0];
        if (!match || !canReadStatistics(req.user, match)) fail(404, 'ไม่พบแมตช์ที่เปิดให้บันทึกสถิติ');
        const mine = String(match.manual_vis_assignee_id) === String(req.user.id);
        if (req.params.assignment === 'claim') {
            if (match.manual_vis_assignee_id && !mine) fail(409, 'มีเจ้าหน้าที่รับงานนี้แล้ว กรุณาโหลดข้อมูลใหม่');
            await connection.query('UPDATE matches SET manual_vis_assignee_id=?, manual_vis_claimed_at=COALESCE(manual_vis_claimed_at, NOW()) WHERE id=?', [req.user.id, match.id]);
        } else if (req.params.assignment === 'release') {
            if (!mine && req.user.role !== 'admin') fail(403, 'เฉพาะผู้รับงานหรือผู้ดูแลเท่านั้นที่คืนงานได้');
            await connection.query('UPDATE matches SET manual_vis_assignee_id=NULL, manual_vis_claimed_at=NULL WHERE id=?', [match.id]);
        } else fail(400, 'คำสั่งไม่ถูกต้อง');
        await writeAuditLog(req, `manual_statistics.${req.params.assignment}`, 'match', match.id, {}, connection);
        await connection.commit(); res.json({ success: true });
    } catch (error) {
        if (connection) await connection.rollback();
        if (!error.status) console.error('Manual statistics assignment:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'ไม่สามารถรับหรือคืนงานสถิติ' });
    } finally { connection?.release(); }
};
