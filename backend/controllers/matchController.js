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

const parseNullableJson = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
};

const parseRequestDetails = (details) => {
    if (!details) return null;
    if (typeof details === 'object') return details;
    try {
        return JSON.parse(details);
    } catch {
        return null;
    }
};

const parseNullableBool = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    return val === true || val === 'true';
};

const normalizeTimeValue = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const text = String(val).trim();
    const timeMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!timeMatch) return val;

    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = timeMatch[3] === undefined ? 0 : Number(timeMatch[3]);
    if (hours > 23 || minutes > 59 || seconds > 59) return val;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const normalizeMatchDateAndTime = (body) => {
    const normalized = { ...body };
    const rawStartTime = normalized.start_time;

    if (rawStartTime !== '' && rawStartTime !== null && rawStartTime !== undefined) {
        const text = String(rawStartTime).trim();
        const dateTimeMatch = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}:\d{2}(?::\d{2})?)/);

        if (dateTimeMatch) {
            if (!normalized.match_date) {
                normalized.match_date = dateTimeMatch[1];
            }
            normalized.start_time = normalizeTimeValue(dateTimeMatch[2]);
        } else {
            normalized.start_time = normalizeTimeValue(rawStartTime);
        }
    }

    return normalized;
};

const parseFieldValue = (field, val) => {
    if (val === '' || val === null || val === undefined) return null;

    if (field === 'start_time') {
        return normalizeTimeValue(val);
    }
    
    // Integer fields
    if ([
        'home_team_id', 'away_team_id', 'competition_id', 'match_number', 
        'winner_team_id', 'stadium_id', 'team_a_score', 'team_b_score', 
        'referee_1_id', 'referee_2_id', 'scorer_id', 'assistant_scorer_id', 
        'line_judge_1_id', 'line_judge_2_id', 'line_judge_3_id', 'line_judge_4_id', 
        'category', 'age_group_id', 'first_serve_team_id', 'left_side_team_id'
    ].includes(field)) {
        return parseInt(val, 10);
    }
    
    // JSON / JSONB fields
    if (['set_scores', 'home_lineup', 'away_lineup', 'live_state', 'match_state'].includes(field)) {
        return parseNullableJson(val);
    }
    
    // Boolean fields
    if (field === 'has_challenge') {
        return parseNullableBool(val);
    }
    
    // Text / Character fields
    return val;
};

const ensureTeamsRegisteredForCompetition = async (competitionId, homeTeamId, awayTeamId) => {
    const compId = parseNullableInt(competitionId);
    const teamIds = [parseNullableInt(homeTeamId), parseNullableInt(awayTeamId)].filter(Boolean);

    if (!compId || teamIds.length < 2) return;
    if (teamIds[0] === teamIds[1]) {
        const error = new Error('Home team and away team must be different');
        error.statusCode = 400;
        throw error;
    }

    const uniqueTeamIds = [...new Set(teamIds)];
    const placeholders = uniqueTeamIds.map(() => '?').join(', ');
    const result = await db.query(
        `SELECT team_id FROM team_entries
         WHERE competition_id = ?
           AND team_id IN (${placeholders})
           AND status = 'approved'`,
        [compId, ...uniqueTeamIds]
    );

    const registeredIds = new Set((result.rows || []).map(row => Number(row.team_id)));
    const missingTeamIds = uniqueTeamIds.filter(id => !registeredIds.has(Number(id)));
    if (missingTeamIds.length > 0) {
        const error = new Error('Selected teams are not registered for this competition category');
        error.statusCode = 400;
        throw error;
    }
};

const ensureMatchCategoryMatchesCompetition = async (competitionId, gender, ageGroupId) => {
    const compId = parseNullableInt(competitionId);
    if (!compId) return;

    const result = await db.query(
        'SELECT gender, age_group_id FROM competitions WHERE id = ?',
        [compId]
    );
    const competition = result.rows[0];
    if (!competition) {
        const error = new Error('Competition not found');
        error.statusCode = 404;
        throw error;
    }

    if (gender && competition.gender && String(gender) !== String(competition.gender)) {
        const error = new Error('Match gender does not match the selected competition');
        error.statusCode = 400;
        throw error;
    }

    const matchAgeGroupId = parseNullableInt(ageGroupId);
    const competitionAgeGroupId = parseNullableInt(competition.age_group_id);
    if (matchAgeGroupId && competitionAgeGroupId && matchAgeGroupId !== competitionAgeGroupId) {
        const error = new Error('Match age group does not match the selected competition');
        error.statusCode = 400;
        throw error;
    }
};

module.exports = {

    async getAllMatches(req, res) {
        try {
            const result = await db.query(`
                SELECT 
                    m.id, m.competition_id, c.title as competition_name, m.round_name, 
                    m.start_time as raw_start_time, m.location, m.status,
                    m.match_number, m.pool_name, m.gender,
                    COALESCE(ms.home_set_score, m.home_set_score) AS home_set_score,
                    COALESCE(ms.away_set_score, m.away_set_score) AS away_set_score,
                    COALESCE(ms.set_scores, m.set_scores) AS set_scores,
                    m.city, m.category, m.age_group_id, ag.name as age_group_name, m.match_date, COALESCE(c.max_sets, 5) as max_sets,
                    
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
                LEFT JOIN age_groups ag ON ag.id = COALESCE(m.age_group_id, c.age_group_id)
                ORDER BY 
                    m.start_time DESC,
                    m.id DESC
            `);

            const normalizedRows = result.rows.map(row => {
                let match_date = row.match_date;
                let start_time_str = null;
                const rawStart = row.raw_start_time;

                if (rawStart) {
                    const dateObj = new Date(rawStart);
                    if (!isNaN(dateObj.getTime())) {
                        try {
                            if (typeof rawStart === 'string' && rawStart.includes('T')) {
                                const parts = rawStart.split('T');
                                match_date = parts[0];
                                start_time_str = parts[1].substring(0, 5);
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
                    start_time: start_time_str,
                    status: row.status ? row.status.toLowerCase() : row.status
                };
            });
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
                    m.id, m.competition_id, m.round_name, 
                    m.start_time as raw_start_time, m.location, m.status,
                    m.match_number, m.pool_name, m.gender,
                    m.home_set_score, m.away_set_score, m.set_scores,
                    m.city, m.category, m.age_group_id, ag.name as age_group_name, m.match_date, COALESCE(c.max_sets, 5) as max_sets,
                    
                    m.home_team_id,
                    t1.name as home_team, t1.code as home_team_code,
                    t1.name as team_a_name, t1.code as team_a_code,
                    t1.logo_url as home_team_logo_url,
                    
                    m.away_team_id,
                    t2.name as away_team, t2.code as away_team_code,
                    t2.name as team_b_name, t2.code as team_b_code,
                    t2.logo_url as away_team_logo_url
                FROM matches m
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
                LEFT JOIN competitions c ON m.competition_id = c.id
                LEFT JOIN age_groups ag ON ag.id = COALESCE(m.age_group_id, c.age_group_id)
                LEFT JOIN (
                    SELECT
                        match_id,
                        SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) AS home_set_score,
                        SUM(CASE WHEN away_score > home_score THEN 1 ELSE 0 END) AS away_set_score,
                        CONCAT(
                            '[',
                            GROUP_CONCAT(CONCAT('"', home_score, '-', away_score, '"') ORDER BY set_number ASC SEPARATOR ','),
                            ']'
                        ) AS set_scores
                    FROM match_sets
                    GROUP BY match_id
                ) ms ON ms.match_id = m.id
                WHERE m.competition_id = ?
                ORDER BY 
                    CASE 
                        WHEN m.match_number REGEXP '^[0-9]+$' THEN CAST(m.match_number AS SIGNED)
                        ELSE 9999
                    END ASC,
                    m.id ASC
            `, [competitionId]);

            const normalizedRows = result.rows.map(row => {
                let match_date = row.match_date;
                let start_time_str = null;
                const rawStart = row.raw_start_time;

                if (rawStart) {
                    const dateObj = new Date(rawStart);
                    if (!isNaN(dateObj.getTime())) {
                        try {
                            if (typeof rawStart === 'string' && rawStart.includes('T')) {
                                const parts = rawStart.split('T');
                                match_date = parts[0];
                                start_time_str = parts[1].substring(0, 5);
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
                    start_time: start_time_str,
                    status: row.status ? row.status.toLowerCase() : row.status
                };
            });
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
        // Validation
        if (!req.body.competition_id) {
            return res.status(400).json({ error: "Competition ID is required" });
        }

        try {
            const fields = [
                'home_team_id', 'away_team_id', 'start_time', 'location', 'status',
                'home_set_score', 'away_set_score', 'competition_id', 'match_number',
                'pool_name', 'round_name', 'winner_team_id', 'gender', 'set_scores',
                'home_lineup', 'away_lineup', 'home_libero', 'away_libero', 'stadium_id',
                'court_number', 'team_a_score', 'team_b_score', 'referee_1_id', 'referee_2_id',
                'scorer_id', 'assistant_scorer_id', 'line_judge_1_id', 'line_judge_2_id',
                'line_judge_3_id', 'line_judge_4_id', 'rr_name', 'rr_country', 'rr_code',
                'rc_name', 'rc_country', 'rc_code', 'assistant_scorer_name',
                'assistant_scorer_country', 'assistant_scorer_code', 'td_name',
                'td_country', 'td_code', 'rd_name', 'rd_country', 'rd_code',
                'live_state', 'city', 'match_date', 'category', 'age_group_id', 'match_state',
                'first_serve_team_id', 'left_side_team_id', 'country',
                'scorer_name', 'scorer_country', 'scorer_code', 'has_challenge'
            ];

            const columns = [];
            const placeholders = [];
            const params = [];
            let index = 1;

            const bodyWithDefaults = normalizeMatchDateAndTime(req.body);
            if (bodyWithDefaults.status === undefined || bodyWithDefaults.status === '') bodyWithDefaults.status = 'scheduled';
            if (bodyWithDefaults.home_set_score === undefined || bodyWithDefaults.home_set_score === '') bodyWithDefaults.home_set_score = 0;
            if (bodyWithDefaults.away_set_score === undefined || bodyWithDefaults.away_set_score === '') bodyWithDefaults.away_set_score = 0;
            if (bodyWithDefaults.set_scores === undefined || bodyWithDefaults.set_scores === '') bodyWithDefaults.set_scores = [];
            if (bodyWithDefaults.round_name === undefined || bodyWithDefaults.round_name === '') {
                return res.status(400).json({ error: "Round name is required" });
            }
            bodyWithDefaults.age_group_id = bodyWithDefaults.age_group_id || bodyWithDefaults.category;
            bodyWithDefaults.category = bodyWithDefaults.category || bodyWithDefaults.age_group_id;

            await ensureTeamsRegisteredForCompetition(
                bodyWithDefaults.competition_id,
                bodyWithDefaults.home_team_id,
                bodyWithDefaults.away_team_id
            );
            await ensureMatchCategoryMatchesCompetition(
                bodyWithDefaults.competition_id,
                bodyWithDefaults.gender,
                bodyWithDefaults.age_group_id
            );

            for (const field of fields) {
                if (bodyWithDefaults[field] !== undefined) {
                    params.push(parseFieldValue(field, bodyWithDefaults[field]));
                    columns.push(field);
                    placeholders.push(`$${index}`);
                    index++;
                }
            }

            const query = `INSERT INTO matches (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            const result = await db.query(query, params);
            const insertedId = result.insertId || result.rows?.[0]?.id;
            if (insertedId) {
                const insertedMatch = await db.query('SELECT * FROM matches WHERE id = ?', [insertedId]);
                return res.json(insertedMatch.rows[0]);
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error("Create Match Error:", err);
            res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Database Error: " + err.message });
        }
    },

    // ==========================================
    // 3. UPDATE: แก้ไขข้อมูลแมตช์
    // ==========================================
    async updateMatch(req, res) {
        const { id } = req.params;

        try {
            const fields = [
                'home_team_id', 'away_team_id', 'start_time', 'location', 'status',
                'home_set_score', 'away_set_score', 'competition_id', 'match_number',
                'pool_name', 'round_name', 'winner_team_id', 'gender', 'set_scores',
                'home_lineup', 'away_lineup', 'home_libero', 'away_libero', 'stadium_id',
                'court_number', 'team_a_score', 'team_b_score', 'referee_1_id', 'referee_2_id',
                'scorer_id', 'assistant_scorer_id', 'line_judge_1_id', 'line_judge_2_id',
                'line_judge_3_id', 'line_judge_4_id', 'rr_name', 'rr_country', 'rr_code',
                'rc_name', 'rc_country', 'rc_code', 'assistant_scorer_name',
                'assistant_scorer_country', 'assistant_scorer_code', 'td_name',
                'td_country', 'td_code', 'rd_name', 'rd_country', 'rd_code',
                'live_state', 'city', 'match_date', 'category', 'age_group_id', 'match_state',
                'first_serve_team_id', 'left_side_team_id', 'country',
                'scorer_name', 'scorer_country', 'scorer_code', 'has_challenge'
            ];

            const updates = [];
            const params = [];
            let index = 1;

            if (req.body.round_name !== undefined && req.body.round_name === '') {
                return res.status(400).json({ error: "Round name cannot be empty" });
            }

            const bodyWithAgeGroup = {
                ...normalizeMatchDateAndTime(req.body),
                age_group_id: req.body.age_group_id || req.body.category,
                category: req.body.category || req.body.age_group_id
            };

            await ensureTeamsRegisteredForCompetition(
                bodyWithAgeGroup.competition_id,
                bodyWithAgeGroup.home_team_id,
                bodyWithAgeGroup.away_team_id
            );
            await ensureMatchCategoryMatchesCompetition(
                bodyWithAgeGroup.competition_id,
                bodyWithAgeGroup.gender,
                bodyWithAgeGroup.age_group_id
            );

            for (const field of fields) {
                if (bodyWithAgeGroup[field] !== undefined) {
                    params.push(parseFieldValue(field, bodyWithAgeGroup[field]));
                    updates.push(`${field} = $${index}`);
                    index++;
                }
            }

            if (updates.length > 0) {
                params.push(id);
                const query = `UPDATE matches SET ${updates.join(', ')} WHERE id = $${index}`;
                await db.query(query, params);

                // ส่งเหตุการณ์ผ่าน Socket.io
                const io = req.app.get('io');
                if (io) {
                    io.to(`match_${id}`).emit('match_updated', { id });
                }
            }

            res.json({ message: "Match details updated" });
        } catch (err) {
            console.error("Update Match Error:", err);
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    },

    // ==========================================
    // 4. DELETE & GENERATE & RESULT
    // ==========================================
    async deleteMatch(req, res) {
        try {
            const { id } = req.params;
            await db.query('DELETE FROM matches WHERE id = ?', [id]);
            res.json({ message: "Match deleted" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateFixtures(req, res) {
        const { competitionId } = req.params;
        try {
            const check = await db.query("SELECT COUNT(*) as count FROM matches WHERE competition_id = ?", [competitionId]);
            if (parseInt(check.rows[0].count) > 0) return res.status(400).json({ error: "Matches already generated" });

            const competitionRes = await db.query('SELECT age_group_id, gender FROM competitions WHERE id = ?', [competitionId]);
            const competition = competitionRes.rows[0];
            if (!competition) return res.status(404).json({ error: "Competition not found" });

            const teamsRes = await db.query(
                "SELECT team_id as id FROM team_entries WHERE competition_id = ? AND status = 'approved' ORDER BY registered_at ASC, id ASC",
                [competitionId]
            );
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
                    `INSERT INTO matches (competition_id, home_team_id, away_team_id, round_name, match_number, status, home_set_score, away_set_score, set_scores, age_group_id, category, gender) 
                     VALUES (?, ?, ?, ?, ?, 'scheduled', 0, 0, '[]', ?, ?, ?)`,
                    [
                        competitionId,
                        match.home_team_id,
                        match.away_team_id,
                        match.round,
                        matchNum++,
                        competition.age_group_id,
                        competition.age_group_id,
                        competition.gender
                    ]
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
                SET home_set_score = ?, away_set_score = ?, set_scores = ?, status = ?
                WHERE id = ?
            `, [home_set_score, away_set_score, set_scores, status, id]);

            // 2. จัดการคะแนนรายเซต (match_sets)
            if (set_scores && typeof set_scores === 'string') {
                const parsedSets = JSON.parse(set_scores);
                if (parsedSets.length > 0) {
                    // ลบข้อมูลเซตเก่าของแมตช์นี้ออกก่อน (กันซ้ำ)
                    await client.query('DELETE FROM match_sets WHERE match_id = ?', [id]);

                    // วนลูป Insert เซตใหม่
                    for (let i = 0; i < parsedSets.length; i++) {
                        const setScore = parsedSets[i];
                        const [homePoints, awayPoints] = setScore.split('-').map(Number);
                        
                        if (!isNaN(homePoints) && !isNaN(awayPoints)) {
                            await client.query(`
                                INSERT INTO match_sets (match_id, set_number, home_score, away_score)
                                VALUES (?, ?, ?, ?)
                            `, [id, i + 1, homePoints, awayPoints]);
                        }
                    }
                }
            }

            await client.query('COMMIT'); // ยืนยันข้อมูล

            // ส่งเหตุการณ์ผ่าน Socket.io
            const io = req.app.get('io');
            if (io) {
                io.to(`match_${id}`).emit('match_updated', { id });
            }

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
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
            const matchRes = await db.query('SELECT home_team_id, away_team_id FROM matches WHERE id = ?', [match_id]);
            
            if (matchRes.rows.length === 0) {
                return res.status(404).json({ message: 'Match not found' });
            }

            const match = matchRes.rows[0];
            const lineupJson = JSON.stringify(starters); // ใช้ starters แทน lineup

            // 3. เปรียบเทียบ ID (แปลงเป็น String เพื่อความชัวร์)
            if (String(match.home_team_id) === String(team_id)) {
                await db.query(
                    'UPDATE matches SET home_lineup = ?, home_libero = ? WHERE id = ?',
                    [lineupJson, libero_id, match_id]
                );
            } else if (String(match.away_team_id) === String(team_id)) {
                await db.query(
                    'UPDATE matches SET away_lineup = ?, away_libero = ? WHERE id = ?',
                    [lineupJson, libero_id, match_id]
                );
            } else {
                return res.status(400).json({ message: 'Team ID does not match participants in this match' });
            }

            // ส่งเหตุการณ์ผ่าน Socket.io
            const io = req.app.get('io');
            if (io) {
                io.to(`match_${match_id}`).emit('match_updated', { id: match_id });
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
                 WHERE mr.match_id = ? AND mr.status = 'PENDING' 
                 ORDER BY mr.id ASC`,
                [matchId]
            );
            res.json(result.rows.map(row => ({
                ...row,
                details: parseRequestDetails(row.details)
            })));
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

            if (!team_id || !request_type) {
                return res.status(400).json({ error: 'team_id and request_type are required' });
            }

            const matchRes = await db.query(
                'SELECT home_team_id, away_team_id FROM matches WHERE id = ?',
                [matchId]
            );
            const match = matchRes.rows[0];
            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }
            if (String(match.home_team_id) !== String(team_id) && String(match.away_team_id) !== String(team_id)) {
                return res.status(403).json({ error: 'Team is not part of this match' });
            }

            const result = await db.query(
                `INSERT INTO match_requests (match_id, team_id, request_type, status, details, created_at)
                 VALUES (?, ?, ?, 'PENDING', ?, NOW())`,
                [matchId, team_id, request_type, details ? JSON.stringify(details) : null]
            );
            const requestId = result.insertId || result.rows?.[0]?.id;

            if (!requestId) {
                throw new Error('Failed to create staff request: missing inserted request id');
            }

            // ดึงข้อมูลคำขอตัวเต็มที่รวมชื่อทีม (team_name) ด้วย
            const newRequestRes = await db.query(
                `SELECT mr.*, t.name AS team_name 
                 FROM match_requests mr
                 LEFT JOIN teams t ON mr.team_id = t.id
                 WHERE mr.id = ?`,
                [requestId]
            );
            const requestData = newRequestRes.rows[0]
                ? { ...newRequestRes.rows[0], details: parseRequestDetails(newRequestRes.rows[0].details) }
                : null;

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
                updates.push('status = ?');
            }
            
            if (details !== undefined) {
                params.push(details ? JSON.stringify(details) : null);
                updates.push('details = ?');
            }
            
            if (updates.length === 0) {
                return res.json({ success: true, message: "No updates provided" });
            }
            
            params.push(requestId, matchId);
            query += updates.join(', ') + ` WHERE id = ? AND match_id = ?`;
            
            const result = await db.query(query, params);
            const affectedRows = result.affectedRows ?? result.rowCount ?? 0;
            if (affectedRows === 0) {
                return res.status(404).json({ error: "Request not found" });
            }

            // ดึงข้อมูลคำขอตัวเต็มพร้อมชื่อทีม
            const updatedRequestRes = await db.query(
                `SELECT mr.*, t.name AS team_name 
                 FROM match_requests mr
                 LEFT JOIN teams t ON mr.team_id = t.id
                 WHERE mr.id = ?`,
                [requestId]
            );
            const requestData = updatedRequestRes.rows[0]
                ? { ...updatedRequestRes.rows[0], details: parseRequestDetails(updatedRequestRes.rows[0].details) }
                : null;

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
                 WHERE match_id = ? AND team_id = ? AND set_number = ?`,
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
                 WHERE match_id = ? AND team_id = ? AND set_number = ?`,
                [matchId, teamId, setNum]
            );
            res.json({ success: true, message: "Lineup deleted successfully" });
        } catch (err) {
            console.error("Delete Team Lineup Error:", err);
            res.status(500).json({ error: err.message });
        }
    }
}; 
