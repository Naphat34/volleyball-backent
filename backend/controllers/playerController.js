const db = require('../config/db');

// 5. ดึงสถิติรายบุคคล (Player Stats)
exports.getPlayerStats = async (req, res) => {
    try {
        const { id } = req.params;
        
        // ดึงข้อมูลรายละเอียดนักกีฬา
        const playerRes = await db.query('SELECT first_name, last_name, number, position FROM players WHERE id = ?', [id]);

        const stats = await db.query(`
            SELECT 
                SUM(CASE WHEN skill = 'A' THEN 1 ELSE 0 END) as attack_attempts,
                SUM(CASE WHEN skill = 'A' AND grade = '#' THEN 1 ELSE 0 END) as attack_kills,
                SUM(CASE WHEN skill = 'A' AND grade = '=' THEN 1 ELSE 0 END) as attack_errors,
                SUM(CASE WHEN skill = 'B' AND grade = '#' THEN 1 ELSE 0 END) as block_points,
                SUM(CASE WHEN skill = 'S' THEN 1 ELSE 0 END) as serve_attempts,
                SUM(CASE WHEN skill = 'S' AND grade = '#' THEN 1 ELSE 0 END) as serve_aces,
                SUM(CASE WHEN skill = 'S' AND grade = '=' THEN 1 ELSE 0 END) as serve_errors,
                SUM(CASE WHEN skill = 'D' THEN 1 ELSE 0 END) as digs,
                SUM(CASE WHEN skill = 'R' THEN 1 ELSE 0 END) as receptions,
                SUM(CASE WHEN skill = 'R' AND grade = '=' THEN 1 ELSE 0 END) as reception_errors,
                COUNT(*) as total_actions
            FROM match_actions
            WHERE player_id = ?
        `, [id]);

        const data = stats.rows[0] || {};
        
        // คำนวณ Efficiency %
        const attAtt = parseInt(data.attack_attempts) || 0;
        const attKill = parseInt(data.attack_kills) || 0;
        const attErr = parseInt(data.attack_errors) || 0;
        data.attack_efficiency = attAtt > 0 ? ((attKill - attErr) / attAtt * 100).toFixed(1) : 0;

        res.json(data);
        res.json({
            ...playerRes.rows[0], // เพิ่มข้อมูลนักกีฬา (ชื่อ, เบอร์, ตำแหน่ง) เข้าไปใน Response
            ...data
        });

    } catch (err) {
        console.error("Get Player Stats Error:", err);
        // ส่งค่า 0 กลับไปหากเกิดข้อผิดพลาด (เช่น ยังไม่มีตาราง match_actions)
        res.json({
            attack_attempts: 0, attack_kills: 0, attack_errors: 0,
            block_points: 0, serve_attempts: 0, serve_aces: 0, serve_errors: 0,
            digs: 0, receptions: 0, reception_errors: 0, attack_efficiency: 0
        });
    }
};