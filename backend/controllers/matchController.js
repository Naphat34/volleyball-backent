const db = require('../config/db');

// Helper: สลับทีมสำหรับ Round Robin
const rotateTeams = (teams) => {
    if (teams.length <= 1) return teams;
    const newTeams = [...teams];
    const firstTeam = newTeams[0];
    const remainingTeams = newTeams.slice(1);
    const lastTeam = remainingTeams.pop();
    return [firstTeam, lastTeam, ...remainingTeams];
};

// Helper: แปลงค่าว่างให้เป็น NULL เพื่อไม่ให้ Database Error
const parseNullableInt = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    return parseInt(val, 10);
};

const parseNullableString = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    return val;
};

module.exports = {

    async getAllMatches(req, res) {
        try {
            const result = await db.query(`
                SELECT 
                    m.id, m.competition_id, c.name as competition_name, m.round_name, m.start_time, m.location, m.status,
                    m.match_number, m.pool_name, m.gender,
                    m.home_set_score, m.away_set_score, m.set_scores,
                    
                    m.home_team_id,
                    t1.name as home_team, t1.code as home_team_code,
                    t1.logo_url as home_team_logo_url,
                    
                    m.away_team_id,
                    t2.name as away_team, t2.code as away_team_code,
                    t2.logo_url as away_team_logo_url
                FROM matches m
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
                LEFT JOIN competitions c ON m.competition_id = c.id
                ORDER BY 
                    m.start_time DESC NULLS LAST,
                    m.id DESC
            `);

            const normalizedRows = result.rows.map(row => ({
                ...row,
                status: row.status ? row.status.toLowerCase() : row.status
            }));
            res.json(normalizedRows);
        } catch (err) {
            console.error("Get All Matches Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // ==========================================
    // 1. READ: ดึงข้อมูลแมตช์
    // ==========================================
    async getMatchesByCompetition(req, res) {
        const { competitionId } = req.params;
        try {
            const result = await db.query(`
                SELECT 
                    m.id, m.competition_id, m.round_name, m.start_time, m.location, m.status,
                    m.match_number, m.pool_name, m.gender,
                    m.home_set_score, m.away_set_score, m.set_scores,
                    
                    m.home_team_id,
                    t1.name as home_team, t1.code as home_team_code,
                    t1.name as team_a_name, t1.code as team_a_code,
                    NULL as home_team_logo, -- CHANGED: Return NULL because 'logo' column is missing
                    
                    m.away_team_id,
                    t2.name as away_team, t2.code as away_team_code,
                    t2.name as team_b_name, t2.code as team_b_code,
                    NULL as away_team_logo  -- CHANGED: Return NULL because 'logo' column is missing
                FROM matches m
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
                WHERE m.competition_id = $1
                ORDER BY 
                    CASE 
                        WHEN CAST(m.match_number AS TEXT) ~ '^[0-9]+$' 
                        THEN CAST(m.match_number AS INTEGER) 
                        ELSE 9999 
                    END ASC,
                    m.id ASC
            `, [competitionId]);

            const normalizedRows = result.rows.map(row => ({
                ...row,
                status: row.status ? row.status.toLowerCase() : row.status
            }));
            res.json(normalizedRows);
        } catch (err) {
            console.error("Get Matches Error:", err);
            res.status(500).json({ error: err.message });
        }
    },
    
    // ==========================================
    // 2. CREATE: สร้างแมตช์ใหม่ (Manual)
    // ==========================================
    async createMatch(req, res) {
        // รับค่าจาก Frontend
        const {
            competition_id,
            home_team_id, away_team_id,
            round_name, start_time, location,
            match_number, pool_name, gender,
            max_sets
        } = req.body;

        // Validation
        if (!competition_id) {
            return res.status(400).json({ error: "Competition ID is required" });
        }

        try {
            // Clean Data: แปลงค่าว่าง "" เป็น NULL ก่อนส่งเข้า DB
            const homeId = parseNullableInt(home_team_id);
            const awayId = parseNullableInt(away_team_id);
            const mNumber = parseNullableString(match_number); // match_number บางทีเป็น Text ได้
            const sTime = parseNullableString(start_time);
            const mSets = parseNullableInt(max_sets) || 5;
            
            const result = await db.query(
                `INSERT INTO matches (
                    competition_id, 
                    home_team_id, away_team_id, 
                    round_name, start_time, location, 
                    match_number, pool_name, gender,
                    status, home_set_score, away_set_score, set_scores,
                    max_sets
                )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', 0, 0, '[]', $10) 
                 RETURNING *`,
                [
                    competition_id,
                    homeId,
                    awayId,
                    round_name,
                    sTime,
                    location,
                    mNumber,
                    pool_name,
                    gender,
                    mSets
                ]
            );
            res.json(result.rows[0]);
        } catch (err) {
            console.error("Create Match Error:", err);
            res.status(500).json({ error: "Database Error: " + err.message });
        }
    },

    // ==========================================
    // 3. UPDATE: แก้ไขข้อมูลแมตช์
    // ==========================================
    async updateMatch(req, res) {
        const { id } = req.params;
        const {
            home_team_id, away_team_id,
            start_time, location, round_name, status,
            match_number, pool_name, gender,
            max_sets
        } = req.body;

        try {
            const homeId = parseNullableInt(home_team_id);
            const awayId = parseNullableInt(away_team_id);
            const sTime = parseNullableString(start_time);
            const mSets = parseNullableInt(max_sets) || 5;

            await db.query(
                `UPDATE matches 
                 SET start_time = $1,
                     location = $2,
                     round_name = $3,
                     status = COALESCE($4, status),
                     match_number = $5,
                     pool_name = $6,
                     gender = $7,
                     home_team_id = $8,
                     away_team_id = $9,
                     max_sets = $10
                 WHERE id = $11`,
                [
                    sTime, location, round_name,
                    status, match_number, pool_name,
                    gender, homeId, awayId,
                    mSets,
                    id
                ]
            );
            res.json({ message: "Match details updated" });
        } catch (err) {
            console.error("Update Match Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // ==========================================
    // 4. DELETE & GENERATE & RESULT
    // ==========================================
    async deleteMatch(req, res) {
        try {
            const { id } = req.params;
            await db.query('DELETE FROM matches WHERE id = $1', [id]);
            res.json({ message: "Match deleted" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateFixtures(req, res) {
        const { competitionId } = req.params;
        try {
            const check = await db.query("SELECT count(*) FROM matches WHERE competition_id = $1", [competitionId]);
            if (parseInt(check.rows[0].count) > 0) return res.status(400).json({ error: "Matches already generated" });

            const teamsRes = await db.query("SELECT team_id as id FROM team_competitions WHERE competition_id = $1", [competitionId]);
            let teams = teamsRes.rows;
            if (teams.length < 2) return res.status(400).json({ error: "Need at least 2 teams" });
            if (teams.length % 2 !== 0) teams.push({ id: null });

            const totalRounds = teams.length - 1;
            const matchesPerRound = teams.length / 2;
            let fixtures = [];
            let currentTeams = [...teams];

            for (let round = 0; round < totalRounds; round++) {
                for (let i = 0; i < matchesPerRound; i++) {
                    const home = currentTeams[i];
                    const away = currentTeams[teams.length - 1 - i];
                    if (home.id && away.id) {
                        fixtures.push({ round: `Round ${round + 1}`, home_team_id: home.id, away_team_id: away.id });
                    }
                }
                currentTeams = rotateTeams(currentTeams);
            }

            let matchNum = 1;
            for (const match of fixtures) {
                // แก้ไข: ใช้ set_scores (มี s) ให้ตรงกับฟังก์ชันอื่น
                await db.query(
                    `INSERT INTO matches (competition_id, home_team_id, away_team_id, round_name, match_number, status, home_set_score, away_set_score, set_scores) 
                     VALUES ($1, $2, $3, $4, $5, 'scheduled', 0, 0, '[]')`,
                    [competitionId, match.home_team_id, match.away_team_id, match.round, matchNum++]
                );
            }
            res.json({ message: `Generated ${fixtures.length} matches` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async updateMatchResult(req, res) {
        const client = await db.pool.connect(); // ใช้ Transaction เพื่อความปลอดภัย
        try {
            await client.query('BEGIN'); // เริ่ม Transaction

            const { id } = req.params; // matchId
            const { 
                home_set_score, 
                away_set_score, 
                status,       
                set_scores          // JSON string ของคะแนนเซต: '["25-20", "25-22"]'
            } = req.body;

            // 1. อัปเดตข้อมูลหลักในตาราง matches
            await client.query(`
                UPDATE matches 
                SET home_set_score = $1, away_set_score = $2, set_scores = $3, status = $4
                WHERE id = $5
            `, [home_set_score, away_set_score, set_scores, status, id]);

            // 2. จัดการคะแนนรายเซต (match_sets)
            if (set_scores && typeof set_scores === 'string') {
                const parsedSets = JSON.parse(set_scores);
                if (parsedSets.length > 0) {
                    // ลบข้อมูลเซตเก่าของแมตช์นี้ออกก่อน (กันซ้ำ)
                    await client.query('DELETE FROM match_sets WHERE match_id = $1', [id]);

                    // วนลูป Insert เซตใหม่
                    for (let i = 0; i < parsedSets.length; i++) {
                        const setScore = parsedSets[i];
                        const [homePoints, awayPoints] = setScore.split('-').map(Number);
                        
                        if (!isNaN(homePoints) && !isNaN(awayPoints)) {
                            await client.query(`
                                INSERT INTO match_sets (match_id, set_number, home_score, away_score)
                                VALUES ($1, $2, $3, $4)
                            `, [id, i + 1, homePoints, awayPoints]);
                        }
                    }
                }
            }

            await client.query('COMMIT'); // ยืนยันข้อมูล
            res.json({ message: "Match result and sets updated successfully" });

        } catch (err) {
            await client.query('ROLLBACK'); // ย้อนกลับถ้ามี Error
            console.error("Update Match Result Error:", err);
            res.status(500).json({ error: "Database error" });
        } finally {
            client.release();
        }
    },

    // ==========================================
    // 5. บันทึก Action (แต้ม/สถิติ) จาก Live Scorer
    // ==========================================
    async saveMatchAction(req, res) {
        try {
            const { match_id, set_number, team_id, player_id, skill, grade, score_home, score_away, description } = req.body;
            
            await db.query(
                `INSERT INTO match_actions (match_id, set_number, team_id, player_id, skill, grade, score_home, score_away, description, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                [match_id, set_number, team_id, player_id, skill, grade, score_home, score_away, description]
            );
            res.json({ message: "Action saved" });
        } catch (err) {
            console.error("Save Action Error:", err);
            // ไม่ return 500 เพื่อให้เกมดำเนินต่อได้แม้ log พลาด (แต่ควรแก้ DB ให้รองรับ)
            res.status(200).json({ error: "Log failed but ignored" }); 
        }
    },

    // ==========================================
    // บันทึก Lineup (ผู้เล่น 6 คนแรก + Libero)
    // ==========================================
    async saveLineup(req, res) {
        try {
            // 1. แก้ไขการรับค่าให้ตรงกับที่ Frontend ส่งมา (snake_case)
            // { match_id, team_id, starters, libero_id }
            const { match_id, team_id, starters, libero_id } = req.body;

            console.log("Saving lineup params:", { match_id, team_id });

            // 2. ใช้ match_id ในการค้นหา
            const matchRes = await db.query('SELECT home_team_id, away_team_id FROM matches WHERE id = $1', [match_id]);
            
            if (matchRes.rows.length === 0) {
                return res.status(404).json({ message: 'Match not found' });
            }

            const match = matchRes.rows[0];
            const lineupJson = JSON.stringify(starters); // ใช้ starters แทน lineup

            // 3. เปรียบเทียบ ID (แปลงเป็น String เพื่อความชัวร์)
            if (String(match.home_team_id) === String(team_id)) {
                await db.query(
                    'UPDATE matches SET home_lineup = $1, home_libero = $2 WHERE id = $3',
                    [lineupJson, libero_id, match_id]
                );
            } else if (String(match.away_team_id) === String(team_id)) {
                await db.query(
                    'UPDATE matches SET away_lineup = $1, away_libero = $2 WHERE id = $3',
                    [lineupJson, libero_id, match_id]
                );
            } else {
                return res.status(400).json({ message: 'Team ID does not match participants in this match' });
            }

            res.json({ message: 'Lineup saved successfully' });
        } catch (error) {
            console.error('Error saving lineup:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },

    // --- [เพิ่มใหม่] ดึงข้อมูลคำขอสตาฟฟ์ที่ค้างอยู่ (Pending Requests) ---
    async getPendingRequests(req, res) {
        try {
            const { matchId } = req.params;
            const result = await db.query(
                `SELECT mr.*, t.name AS team_name 
                 FROM match_requests mr
                 LEFT JOIN teams t ON mr.team_id = t.id
                 WHERE mr.match_id = $1 AND mr.status = 'PENDING' 
                 ORDER BY mr.id ASC`,
                [matchId]
            );
            res.json(result.rows);
        } catch (err) {
            console.error("Get Pending Requests Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // --- [เพิ่มใหม่] สร้างคำขอสตาฟฟ์ (Timeout, Substitution, Challenge, Lineup) ---
    async createRequest(req, res) {
        try {
            const { matchId } = req.params;
            const { team_id, request_type, details } = req.body;
            const result = await db.query(
                `INSERT INTO match_requests (match_id, team_id, request_type, status, details, created_at)
                 VALUES ($1, $2, $3, 'PENDING', $4, NOW())
                 RETURNING id`,
                [matchId, team_id, request_type, details ? JSON.stringify(details) : null]
            );
            const requestId = result.rows[0].id;

            // ดึงข้อมูลคำขอตัวเต็มที่รวมชื่อทีม (team_name) ด้วย
            const newRequestRes = await db.query(
                `SELECT mr.*, t.name AS team_name 
                 FROM match_requests mr
                 LEFT JOIN teams t ON mr.team_id = t.id
                 WHERE mr.id = $1`,
                [requestId]
            );
            const requestData = newRequestRes.rows[0];

            // ส่งเหตุการณ์ผ่าน Socket.io ไปยังโต๊ะบันทึกคะแนนในแบบเรียลไทม์
            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('new_staff_request', requestData);
            }

            res.json({ success: true, requestId });
        } catch (err) {
            console.error("Create Request Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // --- [เพิ่มใหม่] อัปเดตคำขอสตาฟฟ์ (Approve / Reject / Update Details) ---
    async updateRequest(req, res) {
        try {
            const { matchId, requestId } = req.params;
            const { status, details } = req.body;
            
            let query = 'UPDATE match_requests SET ';
            const updates = [];
            const params = [];
            
            if (status !== undefined) {
                params.push(status);
                updates.push(`status = $${params.length}`);
            }
            
            if (details !== undefined) {
                params.push(details ? JSON.stringify(details) : null);
                updates.push(`details = $${params.length}`);
            }
            
            if (updates.length === 0) {
                return res.json({ success: true, message: "No updates provided" });
            }
            
            params.push(requestId, matchId);
            query += updates.join(', ') + ` WHERE id = $${params.length - 1} AND match_id = $${params.length} RETURNING *`;
            
            const result = await db.query(query, params);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Request not found" });
            }

            // ดึงข้อมูลคำขอตัวเต็มพร้อมชื่อทีม
            const updatedRequestRes = await db.query(
                `SELECT mr.*, t.name AS team_name 
                 FROM match_requests mr
                 LEFT JOIN teams t ON mr.team_id = t.id
                 WHERE mr.id = $1`,
                [requestId]
            );
            const requestData = updatedRequestRes.rows[0];

            // ส่งข้อมูลอัปเดตผ่าน Socket.io
            const io = req.app.get('io');
            if (io) {
                if (status === 'APPROVED' || status === 'REJECTED') {
                    io.to(`match_${matchId}`).emit('request_processed', { id: Number(requestId), status });
                } else {
                    io.to(`match_${matchId}`).emit('request_updated', requestData);
                }
            }

            res.json(requestData);
        } catch (err) {
            console.error("Update Request Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // --- [เพิ่มใหม่] ดึงข้อมูล Lineup รายทีมและเซต ---
    async getTeamLineup(req, res) {
        try {
            const { matchId, teamId } = req.params;
            const setNum = req.query.set ? parseInt(req.query.set, 10) : 1;
            const result = await db.query(
                `SELECT player_id_p1, player_id_p2, player_id_p3, player_id_p4, player_id_p5, player_id_p6
                 FROM match_lineups 
                 WHERE match_id = $1 AND team_id = $2 AND set_number = $3`,
                [matchId, teamId, setNum]
            );
            if (result.rows.length === 0) {
                return res.json([]);
            }
            const row = result.rows[0];
            res.json([
                row.player_id_p1,
                row.player_id_p2,
                row.player_id_p3,
                row.player_id_p4,
                row.player_id_p5,
                row.player_id_p6
            ]);
        } catch (err) {
            console.error("Get Team Lineup Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // --- [เพิ่มใหม่] ลบ Lineup รายทีมและเซต ---
    async deleteTeamLineup(req, res) {
        try {
            const { matchId, teamId } = req.params;
            const setNum = req.query.set ? parseInt(req.query.set, 10) : 1;
            await db.query(
                `DELETE FROM match_lineups 
                 WHERE match_id = $1 AND team_id = $2 AND set_number = $3`,
                [matchId, teamId, setNum]
            );
            res.json({ success: true, message: "Lineup deleted successfully" });
        } catch (err) {
            console.error("Delete Team Lineup Error:", err);
            res.status(500).json({ error: err.message });
        }
    }
}; 