const db = require('../config/db');

const hasTableColumn = async (tableName, columnName) => {
    const result = await db.query(`
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    `, [tableName, columnName]);
    return Number(result.rows?.[0]?.count || 0) > 0;
};

const hasTable = async (tableName) => {
    const result = await db.query(`
        SELECT COUNT(*) AS count
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
    `, [tableName]);
    return Number(result.rows?.[0]?.count || 0) > 0;
};

module.exports = {

    // 1. ดึงรายการแข่งขันทั้งหมด (สำหรับ Dropdown)
    async getCompetitions(req, res) {
        try {
            const hasMatchDate = await hasTableColumn('competitions', 'match_date');
            const hasEndDate = await hasTableColumn('competitions', 'end_date');
            const hasMaxSets = await hasTableColumn('competitions', 'max_sets');
            const hasAgeGroupId = await hasTableColumn('competitions', 'age_group_id');
            const canJoinAgeGroups = hasAgeGroupId && await hasTable('age_groups');
            const dateSelect = hasMatchDate ? 'c.match_date' : 'NULL as match_date';
            const endDateSelect = hasEndDate ? 'c.end_date' : 'NULL as end_date';
            const maxSetsSelect = hasMaxSets ? 'c.max_sets' : '3 as max_sets';
            const ageGroupSelect = canJoinAgeGroups ? 'ag.name as age_group_name' : 'NULL as age_group_name';
            const ageGroupJoin = canJoinAgeGroups ? 'LEFT JOIN age_groups ag ON c.age_group_id = ag.id' : '';
            const orderDate = hasMatchDate ? 'COALESCE(c.match_date, c.start_date)' : 'c.start_date';

            const [rows] = await db.query(`
                SELECT c.id, c.title, c.gender, c.start_date, ${endDateSelect}, c.status, ${dateSelect},
                       ${maxSetsSelect}, ${ageGroupSelect}
                FROM competitions c
                ${ageGroupJoin}
                ORDER BY ${orderDate} DESC, c.id DESC
            `);
            res.json(rows);
        } catch (err) {
            console.error("Public: Get Competitions Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 2. ดึงทีมในรายการแข่งขัน (แสดงใน Grid)
    async getCompetitionTeams(req, res) {
        try {
            const { competitionId } = req.params;
            const [rows] = await db.query(`
                SELECT
                       te.id as team_entry_id,
                       te.display_name as entry_display_name,
                       te.competition_id,
                       t.id, t.name, t.code, t.logo_url, t.coach, te.status,
                       (SELECT COUNT(*)
                        FROM team_entry_players tep
                        WHERE tep.team_entry_id = te.id
                          AND (tep.is_playing = 1 OR tep.is_playing = true OR tep.is_playing IS NULL)) as player_count
                FROM teams t
                JOIN team_entries te ON t.id = te.team_id
                WHERE te.competition_id = ?
                ORDER BY t.name ASC
            `, [competitionId]);
            res.json(rows);
        } catch (err) {
            console.error("Public: Get Comp Teams Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 3. ดึงรายชื่อนักกีฬาในทีม (แสดงใน Modal)
    async getTeamPlayers(req, res) {
        try {
            const { teamId } = req.params;
            const { competitionId } = req.query;
            let rows = [];

            if (competitionId) {
                const [entryRows] = await db.query(`
                    SELECT p.id,
                        p.first_name,
                        p.last_name,
                        COALESCE(tep.role, p.position) as position,
                        COALESCE(tep.role, p.position) as role,
                        COALESCE(tep.number, p.number) as number,
                        p.birth_date,
                        p.height_cm,
                        p.weight,
                        p.photo,
                        p.nationality,
                        COALESCE(tep.is_captain, p.is_captain, 0) as is_captain,
                        COALESCE(tep.is_libero1, p.is_libero1, 0) as is_libero1,
                        COALESCE(tep.is_libero2, p.is_libero2, 0) as is_libero2
                    FROM team_entry_players tep
                    JOIN team_entries te ON te.id = tep.team_entry_id
                    JOIN players p ON p.id = tep.player_id
                    WHERE te.team_id = ?
                      AND te.competition_id = ?
                      AND (tep.is_playing = 1 OR tep.is_playing = true OR tep.is_playing IS NULL)
                    ORDER BY COALESCE(tep.number, p.number) ASC, p.id ASC
                `, [teamId, competitionId]);
                rows = entryRows;
            }

            if (!rows.length) {
                const [fallbackRows] = await db.query(`
                    SELECT id,
                        first_name,
                        last_name,
                        position,
                        position as role,
                        number,
                        birth_date,
                        height_cm,
                        weight,
                        photo,
                        nationality,
                        is_captain,
                        is_libero1,
                        is_libero2
                    FROM players
                    WHERE team_id = ?
                      AND (is_playing = 1 OR is_playing = true OR is_playing IS NULL)
                    ORDER BY number ASC
                `, [teamId]);
                rows = fallbackRows;
            }
            res.json(rows);
        } catch (err) {
            console.error("Public: Get Team Players Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 4. ดึงทีมทั้งหมด (ถ้ามีหน้าแสดงทีมรวม)
    async getAllTeams(req, res) {
        try {
            const [rows] = await db.query(`
                SELECT id, name, logo_url, code FROM teams ORDER BY name ASC
            `);
            res.json(rows);
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
                    m.match_number,
                    m.round_name,
                    m.competition_id,
                    c.title AS competition_name,
                    c.max_sets,
                    m.start_time AS raw_start_time,
                    m.match_date,
                    m.status,
                    m.location AS stadium_name,

                    -- คะแนนรวมเซต
                    m.home_team_id,
                    m.away_team_id,
                    m.home_set_score,
                    m.away_set_score,
                    m.home_set_score AS team_a_score,
                    m.away_set_score AS team_b_score,

                    -- ทีมเจ้าบ้าน
                    t1.name AS team_a_name,
                    t1.logo_url AS team_a_logo,
                    t1.code AS team_a_code,

                    -- ทีมเยือน
                    t2.name AS team_b_name,
                    t2.logo_url AS team_b_logo,
                    t2.code AS team_b_code,

                    IFNULL(m.set_scores, '[]') AS set_scores
                    

                FROM matches m
                LEFT JOIN competitions c ON m.competition_id = c.id
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
            `;

            const params = [];
            
            // หมายเหตุ: ถ้าในตาราง matches ของคุณไม่มี competition_id ให้ลบส่วน WHERE นี้ออก
            // แต่ปกติควรมีเพื่อแยกรายการแข่งขัน
            if (competitionId) {
                query += ` WHERE m.competition_id = ?`;
                params.push(competitionId);
            }

            // เรียงตามเวลาแข่ง
            query += ` ORDER BY m.match_date ASC, m.start_time ASC, m.id ASC`;

            const [rows] = await db.query(query, params);
                rows.forEach(row => {
                    if (typeof row.set_scores === "string") {
                        try {
                            row.set_scores = JSON.parse(row.set_scores);
                        } catch (err) {
                            row.set_scores = [];
                        }
                    } else if (!row.set_scores) {
                        row.set_scores = [];
                    }
                });


            const matches = rows.map(row => {
                let match_date = row.match_date;
                if (match_date instanceof Date) {
                    const year = match_date.getFullYear();
                    const month = String(match_date.getMonth() + 1).padStart(2, '0');
                    const day = String(match_date.getDate()).padStart(2, '0');
                    match_date = `${year}-${month}-${day}`;
                }
                let start_time_str = null;
                const rawStart = row.raw_start_time;

                if (rawStart) {
                    const dateObj = new Date(rawStart);
                    if (!isNaN(dateObj.getTime())) {
                        try {
                            if (typeof rawStart === 'string' && rawStart.includes('T')) {
                                const parts = rawStart.split('T');
                                match_date = parts[0];
                                start_time_str = parts[1].substring(0, 5); // "HH:MM"
                            } else {
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                match_date = `${year}-${month}-${day}`;

                                const hours = String(dateObj.getHours()).padStart(2, '0');
                                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                                start_time_str = `${hours}:${minutes}`;
                            }
                        } catch (e) {
                            start_time_str = String(rawStart);
                        }
                    } else {
                        start_time_str = String(rawStart);
                    }
                }

                // Delete temporary raw field to keep payload clean
                delete row.raw_start_time;

                return {
                    ...row,
                    match_date,
                    start_time: start_time_str
                };
            });

            res.json(matches);

        } catch (err) {
            console.error("Public: Get Matches Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 6. ดึงทีมที่มี staff (Team Staff)
    async getTeamStaff(req, res) {
        try {
            const { teamId } = req.params;
            const [rows] = await db.query(`
                SELECT id, first_name, last_name, role
                FROM team_staff 
                WHERE team_id = ?
                ORDER BY role ASC
            `, [teamId]);
            res.json(rows);
        } catch (err) {
            console.error("Public: Get Team Staff Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    async getStatistics(req, res) {
        try {
            const { competitionId } = req.params;

            const getTopPlayers = async (extraWhere, valueExpression = 'COUNT(*)') => {
                const [rows] = await db.query(`
                    SELECT
                        p.id as player_id,
                        p.first_name,
                        p.last_name,
                        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) as name,
                        p.number,
                        p.photo as image_url,
                        t.name as team_name,
                        ${valueExpression} as value
                    FROM match_events me
                    JOIN matches m ON m.id = me.match_id
                    LEFT JOIN players p ON p.id = me.player_id
                    LEFT JOIN teams t ON t.id = p.team_id
                    WHERE m.competition_id = ?
                      AND me.player_id IS NOT NULL
                      ${extraWhere}
                    GROUP BY p.id, p.first_name, p.last_name, p.number, t.name
                    ORDER BY value DESC, p.number ASC
                    LIMIT 10
                `, [competitionId]);
                return rows;
            };

            const successGrade = "AND UPPER(COALESCE(me.grade, '')) IN ('#', 'ACE', 'KILL', 'POINT', 'SUCCESS')";

            res.json({
                best_scorers: await getTopPlayers(`
                    AND (
                        UPPER(COALESCE(me.grade, '')) IN ('#', 'ACE', 'KILL', 'POINT', 'SUCCESS')
                        OR UPPER(COALESCE(me.skill, '')) IN ('POINT', 'ATTACK_POINT', 'BLOCK_POINT', 'SERVE_ACE')
                    )
                `),
                best_spikers: await getTopPlayers(`AND UPPER(COALESCE(me.skill, '')) IN ('ATTACK', 'SPIKE') ${successGrade}`),
                best_blockers: await getTopPlayers(`AND UPPER(COALESCE(me.skill, '')) IN ('BLOCK') ${successGrade}`),
                best_servers: await getTopPlayers(`AND UPPER(COALESCE(me.skill, '')) IN ('SERVE', 'SERVICE') ${successGrade}`),
                best_setters: await getTopPlayers(`AND UPPER(COALESCE(me.skill, '')) IN ('SET', 'SETTING') ${successGrade}`),
                best_diggers: await getTopPlayers(`AND UPPER(COALESCE(me.skill, '')) IN ('DIG', 'DEFENSE', 'RECEPTION') ${successGrade}`)
            });
        } catch (err) {
            console.error("Public: Get Statistics Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },
};

