const db = require('../config/db');
const { buildAdminVisMatch } = require('../utils/adminVisSnapshot');

exports.overview = async (req, res) => {
    let connection;
    try {
        connection = await db.connect();
        await connection.beginTransaction();
        const regular = await connection.query(`SELECT m.*, c.title AS competition_name, c.title_th AS competition_name_th, c.title_en AS competition_name_en, COALESCE(c.max_sets, m.max_sets, 5) AS max_sets,
            COALESCE(ms.home_sets,m.home_set_score) AS home_set_score, COALESCE(ms.away_sets,m.away_set_score) AS away_set_score,
            ag.name AS age_group_name, ht.name AS home_team, at.name AS away_team, ht.code AS home_team_code, at.code AS away_team_code
            FROM matches m LEFT JOIN competitions c ON c.id=m.competition_id
            LEFT JOIN age_groups ag ON ag.id=COALESCE(m.age_group_id,c.age_group_id)
            LEFT JOIN teams ht ON ht.id=m.home_team_id LEFT JOIN teams at ON at.id=m.away_team_id
            LEFT JOIN (SELECT match_id, SUM(CASE WHEN home_score>away_score THEN 1 ELSE 0 END) AS home_sets, SUM(CASE WHEN away_score>home_score THEN 1 ELSE 0 END) AS away_sets
                FROM match_sets WHERE end_time IS NOT NULL GROUP BY match_id) ms ON ms.match_id=m.id
            WHERE m.manual_owner_id IS NULL ORDER BY m.id DESC`);
        const actions = await connection.query(`SELECT a.*, CONCAT_WS(' ',p.first_name,p.last_name) AS player_name, p.number AS player_number
            FROM match_actions a JOIN matches m ON m.id=a.match_id LEFT JOIN players p ON p.id=a.player_id
            WHERE a.action_type='VIS_STAT' AND m.manual_owner_id IS NULL ORDER BY a.id`);
        const custom = await connection.query(`SELECT v.*, u.username AS owner_username FROM custom_vis_matches v
            LEFT JOIN users u ON u.id=v.owner_id ORDER BY v.created_at DESC`);
        const byMatch = new Map();
        for (const action of actions.rows) {
            const key = String(action.match_id);
            if (!byMatch.has(key)) byMatch.set(key, []);
            byMatch.get(key).push(action);
        }
        const athleteLinks = await connection.query('SELECT match_id,side,local_player_id,player_id FROM custom_vis_player_links');
        const matches = [...regular.rows.map(row => buildAdminVisMatch(row, byMatch.get(String(row.id)) || [])),
            ...custom.rows.map(row => buildAdminVisMatch(row, [], true))];
        for (const match of matches) if (match.is_custom_vis) for (const stat of match.statistics || []) {
            const link = athleteLinks.rows.find(link => link.match_id === match.id && link.side === stat.team && Number(link.local_player_id) === Number(stat.id));
            if (link) stat.master_player_id = Number(link.player_id);
        }
        await connection.commit();
        res.json({ matches, fetched_at: new Date().toISOString(), scope: 'server', offline_queue_visible: false });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Admin VIMS overview:', error.message);
        res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูล VIMS ได้ กรุณาตรวจสอบการเชื่อมต่อและ migrations ของระบบ' });
    } finally { connection?.release(); }
};
