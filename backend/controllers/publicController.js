const db = require('../config/db');

module.exports = {

    // 1. ดึงรายการแข่งขันทั้งหมด (สำหรับ Dropdown)
    async getCompetitions(req, res) {
        try {
            const result = await db.query(`
                SELECT id, title, gender, start_date, status 
                FROM competitions 
                ORDER BY start_date DESC
            `);
            res.json(result.rows);
        } catch (err) {
            console.error("Public: Get Competitions Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 2. ดึงทีมในรายการแข่งขัน (แสดงใน Grid)
    async getCompetitionTeams(req, res) {
        try {
            const { competitionId } = req.params;
            const result = await db.query(`
                SELECT t.id, t.name, t.code, t.logo_url, t.coach, tc.status,
                       (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) as player_count
                FROM teams t
                JOIN team_competitions tc ON t.id = tc.team_id
                WHERE tc.competition_id = $1
                ORDER BY t.name ASC
            `, [competitionId]);
            res.json(result.rows);
        } catch (err) {
            console.error("Public: Get Comp Teams Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 3. ดึงรายชื่อนักกีฬาในทีม (แสดงใน Modal)
    async getTeamPlayers(req, res) {
        try {
            const { teamId } = req.params;
            const result = await db.query(`
                SELECT id, 
                    first_name, 
                    last_name, 
                    position, 
                    number, 
                    birth_date, 
                    height_cm, 
                    weight, 
                    photo, 
                    nationality
                FROM players 
                WHERE team_id = $1
                ORDER BY number ASC
            `, [teamId]);
            res.json(result.rows);
        } catch (err) {
            console.error("Public: Get Team Players Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 4. ดึงทีมทั้งหมด (ถ้ามีหน้าแสดงทีมรวม)
    async getAllTeams(req, res) {
        try {
            const result = await db.query(`
                SELECT id, name, logo_url, code FROM teams ORDER BY name ASC
            `);
            res.json(result.rows);
        } catch (err) {
            console.error("Public: Get All Teams Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 5. ดึงตารางแข่ง/ผลการแข่ง (Matches)
    async getMatches(req, res) {
        try {
            const { competitionId } = req.query;

            let query = `
                SELECT 
                    m.id, 
                    -- แยกวันที่และเวลาจาก start_time (ที่เป็น Timestamp หรือ Text ก็ตาม)
                    TO_CHAR(NULLIF(m.start_time::text, '')::timestamp, 'YYYY-MM-DD') as match_date,
                    TO_CHAR(NULLIF(m.start_time::text, '')::timestamp, 'HH24:MI') as start_time,
                    
                    m.status, 
                    m.location as stadium_name, -- ใช้ location เป็นชื่อสนาม
                    
                    -- คะแนนรวมเซต (3-0, 3-2)
                    m.home_set_score as team_a_score, 
                    m.away_set_score as team_b_score,
                    
                    -- ข้อมูลทีม Home (Team A)
                    t1.name as team_a_name, t1.logo_url as team_a_logo, t1.code as team_a_code,
                    
                    -- ข้อมูลทีม Away (Team B)
                    t2.name as team_b_name, t2.logo_url as team_b_logo, t2.code as team_b_code,
                    
                    -- ✅ ดึงคะแนนรายเซต (จากตาราง match_sets)
                    COALESCE(
                        (
                            SELECT json_agg(json_build_object(
                                'set_number', ms.set_number,
                                'team_a', ms.home_score,  
                                'team_b', ms.away_score   
                            ) ORDER BY ms.set_number ASC)
                            FROM match_sets ms
                            WHERE ms.match_id = m.id
                        ), 
                        '[]'::json
                    ) as set_scores

                FROM matches m
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
            `;

            const params = [];
            
            // หมายเหตุ: ถ้าในตาราง matches ของคุณไม่มี competition_id ให้ลบส่วน WHERE นี้ออก
            // แต่ปกติควรมีเพื่อแยกรายการแข่งขัน
            if (competitionId) {
                query += ` WHERE m.competition_id = $1`;
                params.push(competitionId);
            }

            // เรียงตามเวลาแข่ง
            query += ` ORDER BY m.start_time ASC`;

            const result = await db.query(query, params);
            res.json(result.rows);

        } catch (err) {
            console.error("Public: Get Matches Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 6. ดึงทีมที่มี staff (Team Staff)
    async getTeamStaff(req, res) {
        try {
            const { teamId } = req.params;
            const result = await db.query(`
                SELECT id, first_name, last_name, role
                FROM team_staff 
                WHERE team_id = $1
                ORDER BY role ASC
            `, [teamId]);
            res.json(result.rows);
        } catch (err) {
            console.error("Public: Get Team Staff Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },
};