const db = require('../config/db');

const hasTableColumn = async (tableName, columnName) => {
    const result = await db.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Number(result.rows?.[0]?.count || 0) > 0;
};

const parseNullableInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
};

const isTruthyFlag = (value) => (
    value === true
    || value === 1
    || value === '1'
    || String(value).toLowerCase() === 'true'
);

const getRosterRole = (player = {}) => {
    const rawRole = String(player.entry_role || player.role || player.position || '').trim().toUpperCase();
    const isCaptain = isTruthyFlag(player.entry_is_captain ?? player.is_captain ?? player.isCaptain)
        || rawRole === 'C'
        || rawRole === 'L1+C'
        || rawRole === 'L2+C';
    const isLibero1 = isTruthyFlag(player.entry_is_libero1 ?? player.is_libero1 ?? player.isLibero1)
        || rawRole === 'L'
        || rawRole === 'LIBERO'
        || rawRole === 'L1'
        || rawRole === 'L1+C';
    const isLibero2 = isTruthyFlag(player.entry_is_libero2 ?? player.is_libero2 ?? player.isLibero2)
        || rawRole === 'L2'
        || rawRole === 'L2+C';

    if (isLibero2 && isCaptain) return 'L2+C';
    if (isLibero1 && isCaptain) return 'L1+C';
    if (isLibero2) return 'L2';
    if (isLibero1) return 'L1';
    if (isCaptain) return 'C';
    return ['C', 'L1', 'L2', 'L1+C', 'L2+C'].includes(rawRole) ? rawRole : parseNullableString(player.role || player.entry_role || player.position);
};

const getRoleFlags = (role) => {
    const normalizedRole = String(role || '').trim().toUpperCase();
    return {
        isCaptain: normalizedRole === 'C' || normalizedRole === 'L1+C' || normalizedRole === 'L2+C',
        isLibero1: normalizedRole === 'L1' || normalizedRole === 'L1+C',
        isLibero2: normalizedRole === 'L2' || normalizedRole === 'L2+C',
    };
};

const normalizeRosterPlayer = (player = {}) => {
    const role = getRosterRole(player);
    const roleFlags = getRoleFlags(role);
    const selected = player.selected === true
        || player.selected === 1
        || player.selected === '1'
        || player.selected === 'true';

    return {
        id: parseNullableInt(player.id || player.player_id),
        number: parseNullableInt(player.number || player.entry_number),
        role,
        selected,
        isCaptain: roleFlags.isCaptain,
        isLibero1: roleFlags.isLibero1,
        isLibero2: roleFlags.isLibero2,
    };
};

const getRosterPlayersForMatchTeam = async (competitionId, teamId, entrySelectFields = 'p.*', fallbackSelectFields = 'p.*', options = {}) => {
    const entryPlayingWhere = options.entryHasIsPlaying
        ? 'AND (tep.is_playing = 1 OR tep.is_playing = true OR tep.is_playing IS NULL)'
        : '';
    const playerPlayingWhere = options.playerHasIsPlaying
        ? 'AND (p.is_playing = 1 OR p.is_playing = true OR p.is_playing IS NULL)'
        : '';

    const entryRoster = await db.query(`
        SELECT ${entrySelectFields}
        FROM team_entry_players tep
        JOIN team_entries te ON te.id = tep.team_entry_id
        JOIN players p ON p.id = tep.player_id
        WHERE te.competition_id = ?
          AND te.team_id = ?
          ${entryPlayingWhere}
        ORDER BY COALESCE(tep.number, p.number) ASC, p.id ASC
    `, [competitionId, teamId]);

    if (entryRoster.rows.length > 0) {
        return entryRoster;
    }

    return db.query(`
        SELECT ${fallbackSelectFields}
        FROM players p
        WHERE p.team_id = ?
          ${playerPlayingWhere}
        ORDER BY p.number ASC, p.id ASC
    `, [teamId]);
};

module.exports = { 

    // 1. ดึงเหตุการณ์ทั้งหมด (ปรับให้ตรงกับ match_events)
    async getMatchEvents(req, res) {
        try {
            const { matchId } = req.params;
            // ใช้ชื่อคอลัมน์ตามที่คุณแจ้งมา: match_id, set_id, player_id, skill, grade, ...
            const result = await db.query(`
                SELECT id, match_id, set_id, set_id AS set_number, player_id, skill, skill AS event_type, grade, 
                       score_home, score_away, server_player_id, start_zone, end_zone,
                       created_at
                FROM match_events 
                WHERE match_id = ? 
                ORDER BY id DESC
            `, [matchId]);
            res.json(result.rows);
        } catch (err) {
            console.error("Get Match Events Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // 1.5 ดึงรายละเอียดแมตช์ (สำหรับ Scorer Console)
    async getMatchDetails(req, res) {
        try {
            const { matchId } = req.params;
            const result = await db.query(`
                SELECT 
                    m.*, 
                    t1.name as home_team_name, 
                    t2.name as away_team_name,
                    t1.main_color as home_main_color,
                    t1.second_color as home_second_color,
                    t1.third_color as home_third_color,
                    t1.libero_main_color as home_libero_main_color,
                    t1.libero_second_color as home_libero_second_color,
                    t1.libero_third_color as home_libero_third_color,
                    t1.home_color as home_legacy_home_color,
                    t1.away_color as home_legacy_away_color,
                    t2.main_color as away_main_color,
                    t2.second_color as away_second_color,
                    t2.third_color as away_third_color,
                    t2.libero_main_color as away_libero_main_color,
                    t2.libero_second_color as away_libero_second_color,
                    t2.libero_third_color as away_libero_third_color,
                    t2.home_color as away_legacy_home_color,
                    t2.away_color as away_legacy_away_color,
                    COALESCE(c.max_sets, 5) as max_sets,
                    -- ข้อมูล Referee 1
                    r1.firstname as r1_firstname, r1.lastname as r1_lastname, r1.country as r1_country,
                    -- ข้อมูล Referee 2
                    r2.firstname as r2_firstname, r2.lastname as r2_lastname, r2.country as r2_country,
                    -- ข้อมูล Scorer
                    s1.firstname as scorer_firstname, s1.lastname as scorer_lastname, COALESCE(s1.country, m.scorer_country) as scorer_country,
                    -- ข้อมูล Line Judges (ตัวอย่างดึงแค่ 2 คน)
                    l1.firstname as lj1_firstname, l1.lastname as lj1_lastname,
                    l2.firstname as lj2_firstname, l2.lastname as lj2_lastname,

                    -- New Columns
                    m.rr_name, m.rr_country, m.rr_code,
                    m.rc_name, m.rc_country, m.rc_code,
                    m.assistant_scorer_name, m.assistant_scorer_country, m.assistant_scorer_code,
                    m.td_name, m.td_country, m.td_code,
                    m.rd_name, m.rd_country, m.rd_code

                FROM matches m
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
                LEFT JOIN competitions c ON m.competition_id = c.id -- Join Competitions
                -- Join ตารางกรรมการ
                LEFT JOIN referees r1 ON m.referee_1_id = r1.id
                LEFT JOIN referees r2 ON m.referee_2_id = r2.id
                LEFT JOIN scorers s1 ON m.scorer_id = s1.id
                LEFT JOIN line_judges l1 ON m.line_judge_1_id = l1.id
                LEFT JOIN line_judges l2 ON m.line_judge_2_id = l2.id
                
                WHERE m.id = ?
            `, [matchId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Match not found" });
            }

            res.json(result.rows[0]);
        } catch (err) {
            console.error("Get Match Details Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // --- [เพิ่มใหม่] ฟังก์ชันสำหรับอัปเดตและดึง Live State ---
    async updateLiveState(req, res) {
        try {
            const { matchId } = req.params;
            const { state } = req.body; // รับ state ทั้งก้อนจาก frontend

            // ตรวจสอบว่า state เป็น object ที่ถูกต้อง
            if (typeof state !== 'object' || state === null) {
                return res.status(400).json({ error: 'Invalid state data provided.' });
            }

            const statePayload = typeof state === 'string' ? state : JSON.stringify(state);
            await db.query(
                'UPDATE matches SET live_state = ? WHERE id = ?',
                [statePayload, matchId]
            );

            if (state.workflowStep === 'MATCH_FINISHED') {
                const setsWonHome = Number(state.setsWon?.home) || 0;
                const setsWonAway = Number(state.setsWon?.away) || 0;
                let winnerTeamId = null;

                if (setsWonHome !== setsWonAway) {
                    const matchResult = await db.query(
                        'SELECT home_team_id, away_team_id FROM matches WHERE id = ? LIMIT 1',
                        [matchId]
                    );
                    const matchRow = matchResult.rows?.[0];
                    winnerTeamId = setsWonHome > setsWonAway
                        ? matchRow?.home_team_id
                        : matchRow?.away_team_id;
                }

                await db.query(
                    `UPDATE matches
                     SET status = 'completed',
                         winner_team_id = COALESCE(?, winner_team_id)
                     WHERE id = ?`,
                    [winnerTeamId || null, matchId]
                );
            }

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('live_state_updated', state);
            }

            res.json({ success: true, message: 'State updated.' });
        } catch (err) {
            console.error("Update Live State Error:", err);
            res.status(500).json({ error: "Database error while updating live state." });
        }
    },

    // Save coin toss result: first server and left side team
    async saveCoinToss(req, res) {
        try {
            const { matchId } = req.params;
            const { first_serve_team_id, left_side_team_id } = req.body;

            await db.query(
                `UPDATE matches SET first_serve_team_id = ?, left_side_team_id = ? WHERE id = ?`,
                [first_serve_team_id || null, left_side_team_id || null, matchId]
            );

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('match_updated', { id: matchId });
            }

            res.json({ success: true });
        } catch (err) {
            console.error('Save Coin Toss Error:', err);
            res.status(500).json({ error: 'Database error while saving coin toss' });
        }
    },

    async getLiveState(req, res) {
        try {
            const { matchId } = req.params;
            const result = await db.query('SELECT live_state FROM matches WHERE id = ?', [matchId]);
            if (!result.rows || result.rows.length === 0) {
                return res.status(404).json({ error: "Match not found." });
            }

            let state = result.rows[0].live_state;
            if (typeof state === 'string') {
                try {
                    state = JSON.parse(state);
                } catch (parseErr) {
                    console.warn('Unable to parse live_state JSON:', parseErr);
                }
            }

            res.json(state ?? {});
        } catch (err) {
            console.error("Get Live State Error:", err);
            res.status(500).json({ error: "Database error while fetching live state." });
        }
    },

    // 2. ดึง Lineup ล่าสุด (ปรับให้ตรงกับ match_lineups: p1-p6)
    async getMatchLineup(req, res) {
        try {
            const { matchId } = req.params;

            // ดึง Lineup ล่าสุดของแต่ละทีม
            const lineupResult = await db.query(`
                SELECT match_id, team_id, set_number, 
                    player_id_p1, player_id_p2, player_id_p3, 
                    player_id_p4, player_id_p5, player_id_p6, 
                    libero_id
                FROM match_lineups 
                WHERE match_id = ?
                ORDER BY team_id, set_number DESC
            `, [matchId]);

            // ถ้าไม่มีข้อมูลเลย ให้ส่ง Array ว่างกลับไป
            if (lineupResult.rows.length === 0) {
                return res.json([]);
            }

            // รวบรวม Player IDs ทั้งหมดเพื่อไปดึงชื่อและเบอร์มาแสดง
            let allPlayerIds = [];
            lineupResult.rows.forEach(row => {
                allPlayerIds.push(
                    row.player_id_p1, row.player_id_p2, row.player_id_p3,
                    row.player_id_p4, row.player_id_p5, row.player_id_p6,
                    row.libero_id
                );
            });

            // กรอง ID ที่ซ้ำและไม่เป็น null
            allPlayerIds = [...new Set(allPlayerIds.filter(id => id))];

            // ดึงข้อมูลนักกีฬา (ชื่อ, เบอร์) จากตาราง players
            let playersMap = {};
            if (allPlayerIds.length > 0) {
                const playersRes = await db.query(`
                    SELECT id, first_name, last_name, number, position 
                    FROM players 
                    WHERE id IN (${allPlayerIds.map(() => '?').join(',')})
                `, allPlayerIds);

                playersRes.rows.forEach(p => {
                    playersMap[p.id] = {
                        id: p.id,
                        number: p.number,
                        name: `${p.first_name.charAt(0)}.${p.last_name}`,
                        firstname: p.first_name,
                        lastname: p.last_name,
                        position: p.position
                    };
                });
            }

            // จัด Format ส่งกลับ Frontend ให้เป็น Array [p1, p2, ..., p6]
            const formattedLineups = lineupResult.rows.map(row => {
                const getP = (id) => playersMap[id] || { id: id, number: '?', name: 'Unknown' };
                return {
                    team_id: row.team_id,
                    lineup: [
                        getP(row.player_id_p1),
                        getP(row.player_id_p2),
                        getP(row.player_id_p3),
                        getP(row.player_id_p4),
                        getP(row.player_id_p5),
                        getP(row.player_id_p6)
                    ],
                    libero: playersMap[row.libero_id] || null
                };
            });

            res.json(formattedLineups);

        } catch (err) {
            console.error("Get Match Lineup Error", err);
            res.status(500).json({ error: "Database error: " + err.message });
        }
    },

    // 3. บันทึกเหตุการณ์ (Mapping ค่าให้ตรงกับ skill, grade, start_zone, end_zone)
    async saveMatchEvent(req, res) {
        try {
            const { matchId } = req.params;
            const {
                set_number, // Map ไป set_id
                event_type, // 'POINT', 'SUBSTITUTION', etc.
                team_id,
                player_id,  // Player involved (e.g. Scorer, Sub In, Sanctioned)
                score_home,
                score_away,
                server_player_id,
                start_zone,
                end_zone,
                details, // JSON or extra info
                skill: explicitSkill, // รับค่า skill โดยตรง
                grade: explicitGrade,  // รับค่า grade โดยตรง
                local_event_id
            } = req.body;

            // อัปเดตคะแนนสดเข้าระบบ Public แทนการบันทึกประวัติ VIS
            await db.query(`
                UPDATE matches
                SET team_a_score = ?, team_b_score = ?
                WHERE id = ?
            `, [score_home, score_away, matchId]);

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('match_updated', { id: matchId });
            }

            // อัปเดตตาราง matches หลัก (ถ้าจำเป็น เพื่อให้หน้า Public เห็นคะแนนรวม)
            // *หมายเหตุ: ถ้าคุณไม่มีตาราง match_sets อาจจะต้องข้ามส่วนนี้ หรือแก้ query ให้ตรงกับระบบคุณ
            /*
            await db.query(`
                UPDATE matches 
                SET home_set_score = (SELECT SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) FROM match_sets WHERE match_id = ?),
                    away_set_score = (SELECT SUM(CASE WHEN away_score > home_score THEN 1 ELSE 0 END) FROM match_sets WHERE match_id = ?)
                WHERE id = ?
            `, [matchId, matchId, matchId]);
            */

            // บันทึกเหตุการณ์ลงตาราง `match_events` เพื่อเก็บประวัติแบบ point-by-point
            let eventDetails = details || null;
            if (typeof eventDetails === 'string') {
                try {
                    eventDetails = JSON.parse(eventDetails);
                } catch {
                    eventDetails = { note: eventDetails };
                }
            }
            if (eventDetails && typeof eventDetails === 'object') {
                eventDetails = {
                    ...eventDetails,
                    event_type: event_type || explicitSkill || eventDetails.event_type || null,
                    local_event_id: local_event_id || eventDetails.local_event_id || eventDetails.localEventId || null
                };
            }

            const insertParams = [
                matchId,
                set_number || null,
                team_id || null,
                player_id || null,
                explicitSkill || event_type || null,
                explicitGrade || null,
                score_home ?? null,
                score_away ?? null,
                server_player_id || null,
                start_zone || null,
                end_zone || null,
                eventDetails ? JSON.stringify(eventDetails) : null
            ];

            const insertSql = `
                INSERT INTO match_events
                (match_id, set_id, team_id, player_id, skill, grade, score_home, score_away, server_player_id, start_zone, end_zone, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            const insertResult = await db.query(insertSql, insertParams);
            const insertedId = insertResult.insertId || insertResult.rows?.[0]?.id;

            if (!insertedId) {
                console.error('Insert did not return insertId or row');
                return res.status(500).json({ error: 'Failed to persist match event' });
            }

            // Fetch the inserted row to ensure we emit the exact DB representation
            const fetched = await db.query('SELECT * FROM match_events WHERE id = ?', [insertedId]);
            const insertedRow = fetched.rows && fetched.rows.length > 0 ? fetched.rows[0] : null;

            if (!insertedRow) {
                console.error('Inserted match_event not found after insert, id=', insertedId);
                return res.status(500).json({ error: 'Failed to read back inserted match event' });
            }

            insertedRow.local_event_id = local_event_id || null;

            if (io) {
                io.to(`match_${matchId}`).emit('match_event', insertedRow);
            }

            res.json({ success: true, event: insertedRow });
        } catch (err) {
            console.error("Save Event Error", err);
            let validEnums = "";
            try {
                const enumRes = await db.query("SELECT 'A', 'B', 'S', 'D', 'R' AS enumlabel");
                validEnums = enumRes.rows.map(r => r.enumlabel).join(', ');
            } catch(e) {}
            const msg = err.message;
            res.status(500).json({ error: "Database error: " + msg });
        }
    },

    // 4. บันทึก Lineup (แตก Array ลง p1-p6)
    async saveLineup(req, res) {
        const client = await db.pool.connect();
        let matchId = null;
        let team_id = null;
        let set_number = null;
        let pIds = [];
        let libero_id = null;
        const maxRetries = 3;
        let attempt = 0;

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            matchId = req.params.matchId;
            const { team_id: bodyTeamId, set_number: bodySetNumber, player_positions, libero_id: bodyLiberoId } = req.body;
            team_id = bodyTeamId;
            set_number = bodySetNumber;
            libero_id = bodyLiberoId;

            if (!team_id || !set_number) {
                return res.status(400).json({ error: "Missing required fields: team_id or set_number" });
            }

            if (!Array.isArray(player_positions)) {
                return res.status(400).json({ error: "Missing required field: player_positions" });
            }

            pIds = player_positions.map(p => (p && typeof p === 'object' && p.id) ? p.id : p);

            while (true) {
                try {
                    await client.query('BEGIN');

                    await client.query(`
                        DELETE FROM match_lineups
                        WHERE match_id = ? AND team_id = ? AND set_number = ?
                    `, [matchId, team_id, set_number]);

                    await client.query(`
                        INSERT INTO match_lineups
                        (match_id, team_id, set_number, player_id_p1, player_id_p2, player_id_p3, player_id_p4, player_id_p5, player_id_p6, libero_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        matchId,
                        team_id,
                        set_number,
                        pIds[0] || null,
                        pIds[1] || null,
                        pIds[2] || null,
                        pIds[3] || null,
                        pIds[4] || null,
                        pIds[5] || null,
                        libero_id
                    ]);

                    await client.query('COMMIT');
                    break;
                } catch (innerErr) {
                    await client.query('ROLLBACK');
                    if (innerErr && innerErr.code === 'ER_LOCK_DEADLOCK' && attempt < maxRetries) {
                        attempt += 1;
                        console.warn(`Deadlock detected in saveLineup, retrying attempt ${attempt}/${maxRetries}`);
                        await sleep(100 * attempt);
                        continue;
                    }
                    throw innerErr;
                }
            }

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('match_updated', { id: matchId });
            }

            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Save Lineup Error", err);
            console.error("Payload:", { matchId, team_id, set_number, pIds, libero_id });
            res.status(500).json({ error: "Database error", details: err.message });
        } finally {
            client.release();
        }
    },

    // --- [เพิ่มใหม่] Master Data สำหรับเจ้าหน้าที่ ---
    async getAllReferees(req, res) {
        try {
            const result = await db.query('SELECT * FROM referees ORDER BY firstname ASC');
            res.json(result.rows);
        } catch (err) {
            console.error("Get Referees Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    async getAllScorers(req, res) {
        try {
            const result = await db.query('SELECT * FROM scorers ORDER BY firstname ASC');
            res.json(result.rows);
        } catch (err) {
            console.error("Get Scorers Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    async getAllLineJudges(req, res) {
        try {
            const result = await db.query('SELECT * FROM line_judges ORDER BY firstname ASC');
            res.json(result.rows);
        } catch (err) {
            console.error("Get Line Judges Error", err);
            res.status(500).json({ error: "Database error" });
        }
    },

    // --- [เพิ่มใหม่] อัปเดตรายชื่อเจ้าหน้าที่ในแมตช์ ---
    async updateMatchOfficials(req, res) {
        try {
            const { matchId } = req.params;
            const {
                referee_1_id, referee_2_id, scorer_id,
                line_judge_1_id, line_judge_2_id, line_judge_3_id, line_judge_4_id,

                // New Fields
                rr_name, rr_country, rr_code,
                rc_name, rc_country, rc_code,
                assistant_scorer_name, assistant_scorer_country, assistant_scorer_code,
                td_name, td_country, td_code,
                rd_name, rd_country, rd_code,
                scorer_name, scorer_country, scorer_code,

                // Match settings from Confirm Setup
                has_challenge, match_number, pool_name, round_name, city, location, country
            } = req.body;

            await db.query(`
                UPDATE matches 
                SET referee_1_id = ?,
                    referee_2_id = ?,
                    scorer_id = ?,
                    line_judge_1_id = ?,
                    line_judge_2_id = ?,
                    line_judge_3_id = ?,
                    line_judge_4_id = ?,

                    rr_name = ?, rr_country = ?, rr_code = ?,
                    rc_name = ?, rc_country = ?, rc_code = ?,
                    assistant_scorer_name = ?, assistant_scorer_country = ?, assistant_scorer_code = ?,
                    td_name = ?, td_country = ?, td_code = ?,
                    rd_name = ?, rd_country = ?, rd_code = ?,
                    scorer_name = ?, scorer_country = ?, scorer_code = ?,

                    has_challenge = ?,
                    match_number = ?,
                    pool_name = ?,
                    round_name = ?,
                    city = ?,
                    location = ?,
                    country = ?
                WHERE id = ?
            `, [
                referee_1_id || null,
                referee_2_id || null,
                scorer_id || null,
                line_judge_1_id || null,
                line_judge_2_id || null,
                line_judge_3_id || null,
                line_judge_4_id || null,

                rr_name || null, rr_country || null, rr_code || null,
                rc_name || null, rc_country || null, rc_code || null,
                assistant_scorer_name || null, assistant_scorer_country || null, assistant_scorer_code || null,
                td_name || null, td_country || null, td_code || null,
                rd_name || null, rd_country || null, rd_code || null,
                scorer_name || null, scorer_country || null, scorer_code || null,

                has_challenge !== undefined ? has_challenge : null,
                match_number !== undefined ? match_number : null,
                pool_name || null,
                round_name || null,
                city || null,
                location || null,
                country || null,
                matchId
            ]);

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('match_updated', { id: matchId });
            }

            res.json({ success: true, message: "Match officials and setup updated" });
        } catch (err) {
            console.error("Update Officials Error", err);
            res.status(500).json({ error: "Database error: " + err.message });
        }
    },

    // ✅ ฟังก์ชันจบเซต
    async updateMatchRoster(req, res) {
        const client = await db.pool.connect();
        try {
            const { matchId } = req.params;
            const { homePlayers = [], awayPlayers = [] } = req.body;

            const matchRes = await client.query(`
                SELECT id, competition_id, home_team_id, away_team_id
                FROM matches
                WHERE id = ?
            `, [matchId]);

            if (matchRes.rows.length === 0) {
                return res.status(404).json({ error: 'Match not found' });
            }

            const match = matchRes.rows[0];
            const rosterByTeam = [
                { teamId: match.home_team_id, players: Array.isArray(homePlayers) ? homePlayers : [] },
                { teamId: match.away_team_id, players: Array.isArray(awayPlayers) ? awayPlayers : [] },
            ];

            await client.query('BEGIN');

            for (const teamRoster of rosterByTeam) {
                if (!teamRoster.teamId || teamRoster.players.length === 0) continue;

                const normalizedPlayersById = new Map();
                teamRoster.players
                    .map(normalizeRosterPlayer)
                    .filter((player) => player.id)
                    .forEach((player) => normalizedPlayersById.set(player.id, player));
                const normalizedPlayers = [...normalizedPlayersById.values()];

                if (normalizedPlayers.length === 0) continue;

                const selectedNumberCounts = new Map();
                normalizedPlayers
                    .filter((player) => player.selected && player.number)
                    .forEach((player) => selectedNumberCounts.set(
                        player.number,
                        (selectedNumberCounts.get(player.number) || 0) + 1
                    ));
                const duplicateSelectedNumbers = [...selectedNumberCounts.entries()]
                    .filter(([, count]) => count > 1)
                    .map(([number]) => number);
                if (duplicateSelectedNumbers.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: `Duplicate selected player number: ${duplicateSelectedNumbers.join(', ')}`
                    });
                }

                const playerIds = normalizedPlayers.map((player) => player.id);
                const placeholders = playerIds.map(() => '?').join(',');
                const existingPlayers = await client.query(
                    `SELECT id FROM players WHERE team_id = ? AND id IN (${placeholders})`,
                    [teamRoster.teamId, ...playerIds]
                );
                const validPlayerIds = new Set(existingPlayers.rows.map((player) => Number(player.id)));

                if (validPlayerIds.size !== playerIds.length) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'One or more players do not belong to this match team' });
                }

                const entryRes = match.competition_id
                    ? await client.query(
                        'SELECT id FROM team_entries WHERE competition_id = ? AND team_id = ? LIMIT 1',
                        [match.competition_id, teamRoster.teamId]
                    )
                    : { rows: [] };
                const entryId = entryRes.rows[0]?.id || null;

                if (entryId) {
                    await client.query('DELETE FROM team_entry_players WHERE team_entry_id = ?', [entryId]);
                }

                for (const player of normalizedPlayers) {
                    if (entryId) {
                        await client.query(`
                            INSERT INTO team_entry_players
                                (team_entry_id, player_id, number, role, is_captain, is_libero1, is_libero2, is_playing)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            entryId,
                            player.id,
                            player.selected ? player.number : null,
                            player.role,
                            player.isCaptain ? 1 : 0,
                            player.isLibero1 ? 1 : 0,
                            player.isLibero2 ? 1 : 0,
                            player.selected ? 1 : 0,
                        ]);
                    } else {
                        await client.query(
                            `UPDATE players
                             SET is_captain = ?,
                                 is_libero1 = ?,
                                 is_libero2 = ?,
                                 is_playing = ?
                             WHERE id = ? AND team_id = ?`,
                            [
                                player.isCaptain ? 1 : 0,
                                player.isLibero1 ? 1 : 0,
                                player.isLibero2 ? 1 : 0,
                                player.selected ? 1 : 0,
                                player.id,
                                teamRoster.teamId,
                            ]
                        );
                    }
                }
            }

            await client.query('COMMIT');

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('roster_updated', { id: matchId });
            }

            res.json({ success: true, message: 'Roster updated' });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Update Match Roster Error", err);
            res.status(500).json({ error: "Database error: " + err.message });
        } finally {
            client.release();
        }
    },

    async startSet(req, res) {
        try {
            const { matchId } = req.params;
            const { setNumber } = req.body;

            if (!setNumber) {
                return res.status(400).json({ error: "Missing set number" });
            }

            const hasStartTime = await hasTableColumn('match_sets', 'start_time');
            if (hasStartTime) {
                const existingSet = await db.query(
                    'SELECT id, start_time FROM match_sets WHERE match_id = ? AND set_number = ? LIMIT 1',
                    [matchId, setNumber]
                );

                if (existingSet.rows.length > 0) {
                    await db.query(
                        'UPDATE match_sets SET start_time = COALESCE(start_time, NOW()) WHERE id = ?',
                        [existingSet.rows[0].id]
                    );
                } else {
                    try {
                        await db.query(
                            'INSERT INTO match_sets (match_id, set_number, start_time) VALUES (?, ?, NOW())',
                            [matchId, setNumber]
                        );
                    } catch (insertErr) {
                        console.warn('Unable to persist set start row; continuing without start_time:', insertErr.message);
                    }
                }
            }

            await db.query(
                `UPDATE matches
                 SET status = 'live'
                 WHERE id = ? AND (status IS NULL OR status IN ('scheduled', 'live'))`,
                [matchId]
            );

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('match_updated', { id: matchId });
            }

            res.json({ success: true });
        } catch (err) {
            console.error("StartSet Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    async endSet(req, res) {
        const client = await db.pool.connect();

        try {
            await client.query("BEGIN");

            const { matchId } = req.params;
            const { setNumber, homeScore, awayScore, duration } = req.body;

            if (!setNumber || homeScore == null || awayScore == null) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Missing set data" });
            }
            
            // 1️ ตรวจสอบว่ามีเซตนี้แล้วหรือยัง (กันกดซ้ำ)
            const existingSet = await client.query(
                `SELECT id, home_score, away_score FROM match_sets WHERE match_id=? AND set_number=?`,
                [matchId, setNumber]
            );

            if (existingSet.rows.length > 0) {
                const existing = existingSet.rows[0];
                const hasStartTime = await hasTableColumn('match_sets', 'start_time');
                await client.query(
                    `UPDATE match_sets
                     SET home_score = ?, away_score = ?, duration_minutes = ?, end_time = NOW()
                     ${hasStartTime ? ', start_time = COALESCE(start_time, NOW())' : ''}
                     WHERE id = ?`,
                    [homeScore, awayScore, duration || 0, existing.id]
                );
            } else {
                await client.query(
                    `INSERT INTO match_sets
        (match_id, set_number, home_score, away_score, duration_minutes, end_time)
        VALUES (?, ?, ?, ?, ?, NOW())`,
                    [matchId, setNumber, homeScore, awayScore, duration || 0]
                );
            }

            // 3️ คำนวณจำนวนเซตที่ชนะจาก match_sets จริง
            const setsResult = await client.query(
                `
        SELECT
        SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) AS home_sets,
        SUM(CASE WHEN away_score > home_score THEN 1 ELSE 0 END) AS away_sets
        FROM match_sets
        WHERE match_id = ?
        `,
                [matchId]
            );

            const homeSets = parseInt(setsResult.rows[0].home_sets);
            const awaySets = parseInt(setsResult.rows[0].away_sets);

            // 4️ ดึง score รายเซต
            const allSets = await client.query(
                `
        SELECT home_score, away_score
        FROM match_sets
        WHERE match_id = ?
        ORDER BY set_number
        `,
                [matchId]
            );

            const setScores = JSON.stringify(
                allSets.rows.map((s) => `${s.home_score}-${s.away_score}`)
            );

            // 5️ อัปเดต matches
            await client.query(
                `
        UPDATE matches
        SET
            home_set_score = ?,
            away_set_score = ?,
            set_scores = ?,
            team_a_score = 0,
            team_b_score = 0
        WHERE id = ?
        `,
                [homeSets, awaySets, setScores, matchId]
            );

            // 6️⃣ ตรวจสอบว่าจบแมตช์หรือยัง
            const matchInfo = await client.query(
                `
        SELECT m.home_team_id, m.away_team_id, COALESCE(c.max_sets, 5) as max_sets
        FROM matches m
        LEFT JOIN competitions c ON m.competition_id = c.id
        WHERE m.id = ?
        `,
                [matchId]
            );


            const info = matchInfo.rows[0];

            const maxSets = info.max_sets || 5;
            const setsToWin = Math.ceil(maxSets / 2);

            let isMatchFinished = false;
            let winnerId = null;

            if (homeSets >= setsToWin) {
                isMatchFinished = true;
                winnerId = info.home_team_id;
            }

            if (awaySets >= setsToWin) {
                isMatchFinished = true;
                winnerId = info.away_team_id;
            }

            // 7️ ถ้าแมตช์จบ
            if (isMatchFinished) {
                await client.query(
                    `
            UPDATE matches
            SET
            status = 'completed',
            winner_team_id = ?
            WHERE id = ?
        `,
                    [winnerId, matchId]
                );
            }

            await client.query("COMMIT");

            const io = req.app.get('io');
            if (io) {
                io.to(`match_${matchId}`).emit('match_updated', { id: matchId });
            }

            res.json({
                success: true,
                message: isMatchFinished ? "Match Finished" : "Set Finished",
                currentSets: {
                    home: homeSets,
                    away: awaySets,
                },
                nextSet: setNumber + 1,
                matchFinished: isMatchFinished,
                winner: winnerId,
            });
        } catch (err) {
            await client.query("ROLLBACK");
            console.error("EndSet Error:", err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    },

    // เพิ่มฟังก์ชันดึงข้อมูลสำหรับ Match Roster PDF
    async getMatchRosterData(req, res) {
        try {
            const { matchId } = req.params;

            // 1. ดึงรายละเอียดแมตช์ และ Competition (Category, Age Group)
            const matchResult = await db.query(`
                SELECT 
                    m.*, 
                    t1.name as home_team_name, t1.code as home_team_code, t1.logo_url as home_logo_url,
                    t2.name as away_team_name, t2.code as away_team_code, t2.logo_url as away_logo_url,
                    c.title as competition_name, c.title as competition_title, 
                    c.gender as competition_gender, c.sport as competition_sport,
                    c.start_date as start_date, c.end_date as end_date,
                    COALESCE(c.max_sets, 5) as max_sets,
                    ag.name as age_group_name
                FROM matches m
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
                LEFT JOIN competitions c ON m.competition_id = c.id
                LEFT JOIN age_groups ag ON c.age_group_id = ag.id
                WHERE m.id = ?
            `, [matchId]);

            if (matchResult.rows.length === 0) {
                return res.status(404).json({ error: "Match not found" });
            }

            const match = matchResult.rows[0];

            let stadiumName = null;
            let stadiumCity = null;
            if (match.location !== null && match.location !== undefined && match.location !== '') {
                const stadiumResult = await db.query(`
                    SELECT name, address
                    FROM stadiums
                    WHERE CAST(id AS CHAR) = ? OR name = ?
                    ORDER BY CASE WHEN CAST(id AS CHAR) = ? THEN 0 ELSE 1 END
                    LIMIT 1
                `, [String(match.location), String(match.location), String(match.location)]);

                if (stadiumResult.rows[0]) {
                    stadiumName = stadiumResult.rows[0].name;
                    stadiumCity = stadiumResult.rows[0].address;
                }
            }

            match.stadium_name = stadiumName;
            match.stadium_city = stadiumCity;

            // 2. ดึงนักกีฬา และระบุ Captain/Libero
            const playerColumnsResult = await db.query('SHOW COLUMNS FROM players');
            const playerColumnNames = new Set((playerColumnsResult.rows || []).map((col) => col.Field));
            const entryColumnsResult = await db.query('SHOW COLUMNS FROM team_entry_players');
            const entryColumnNames = new Set((entryColumnsResult.rows || []).map((col) => col.Field));
            const entryRoleExpr = entryColumnNames.has('role') ? 'tep.role' : 'NULL';
            const entryNumberExpr = entryColumnNames.has('number') ? 'tep.number' : 'NULL';
            const entryCaptainExpr = entryColumnNames.has('is_captain') ? 'tep.is_captain' : 'NULL';
            const entryLibero1Expr = entryColumnNames.has('is_libero1') ? 'tep.is_libero1' : 'NULL';
            const entryLibero2Expr = entryColumnNames.has('is_libero2') ? 'tep.is_libero2' : 'NULL';
            const playerCaptainExpr = playerColumnNames.has('is_captain') ? 'p.is_captain' : '0';
            const playerLibero1Expr = playerColumnNames.has('is_libero1') ? 'p.is_libero1' : '0';
            const playerLibero2Expr = playerColumnNames.has('is_libero2') ? 'p.is_libero2' : '0';
            const playerSelectFields = [
                'p.id',
                'p.first_name',
                'p.last_name',
                `COALESCE(${entryNumberExpr}, p.number) as number`,
                `COALESCE(${entryRoleExpr}, p.position) as position`,
                `COALESCE(${entryRoleExpr}, p.position) as role`,
                `COALESCE(${entryCaptainExpr}, ${playerCaptainExpr}, 0) as is_captain`,
                `COALESCE(${entryLibero1Expr}, ${playerLibero1Expr}, 0) as is_libero1`,
                `COALESCE(${entryLibero2Expr}, ${playerLibero2Expr}, 0) as is_libero2`
            ];
            const fallbackSelectFields = [
                'p.id',
                'p.first_name',
                'p.last_name',
                'p.number',
                'p.position',
                'p.position as role',
                `${playerCaptainExpr} as is_captain`,
                `${playerLibero1Expr} as is_libero1`,
                `${playerLibero2Expr} as is_libero2`
            ];
            if (playerColumnNames.has('photo')) {
                playerSelectFields.push('p.photo');
                fallbackSelectFields.push('p.photo');
            }
            if (playerColumnNames.has('is_playing')) {
                const entryPlayingExpr = entryColumnNames.has('is_playing') ? 'tep.is_playing' : 'NULL';
                playerSelectFields.push(`COALESCE(${entryPlayingExpr}, p.is_playing) as is_playing`);
                fallbackSelectFields.push('p.is_playing');
            }

            const rosterQueryOptions = {
                entryHasIsPlaying: entryColumnNames.has('is_playing'),
                playerHasIsPlaying: playerColumnNames.has('is_playing')
            };

            const buildPlayersPayload = (rows = []) =>
                rows.map((player) => {
                    const derivedRole = getRosterRole(player);
                    const role = String(derivedRole || '').trim().toUpperCase();
                    const isLibero = Number(player.is_libero1 || 0) === 1
                        || Number(player.is_libero2 || 0) === 1
                        || ['L', 'LIBERO', 'L1', 'L2'].includes(role);
                    return {
                        ...player,
                        role: ['C', 'L1', 'L2', 'L1+C', 'L2+C'].includes(role) ? role : player.role,
                        is_libero: isLibero ? 1 : 0,
                        is_playing: player.is_playing !== undefined && player.is_playing !== null ? player.is_playing : true,
                    };
                });

            const homePlayersQuery = await getRosterPlayersForMatchTeam(
                match.competition_id,
                match.home_team_id,
                playerSelectFields.join(', '),
                fallbackSelectFields.join(', '),
                rosterQueryOptions
            );

            const awayPlayersQuery = await getRosterPlayersForMatchTeam(
                match.competition_id,
                match.away_team_id,
                playerSelectFields.join(', '),
                fallbackSelectFields.join(', '),
                rosterQueryOptions
            );

            const homePlayers = {
                rows: buildPlayersPayload(homePlayersQuery.rows || [])
            };

            const awayPlayers = {
                rows: buildPlayersPayload(awayPlayersQuery.rows || [])
            };

            // 3. ดึงสตาฟทีม
            const homeStaff = await db.query(`
                SELECT first_name, last_name, role 
                FROM team_staff 
                WHERE team_id = ? 
                ORDER BY role ASC
            `, [match.home_team_id]);

            const awayStaff = await db.query(`
                SELECT first_name, last_name, role 
                FROM team_staff 
                WHERE team_id = ? 
                ORDER BY role ASC
            `, [match.away_team_id]);

            res.json({
                match,
                home: {
                    players: homePlayers.rows,
                    staff: homeStaff.rows
                },
                away: {
                    players: awayPlayers.rows,
                    staff: awayStaff.rows
                }
            });

        } catch (err) {
            console.error("Get Match Roster Data Error:", err);
            res.status(500).json({ error: "Database error: " + err.message });
        }
    },

    // เพิ่มฟังก์ชันดึงข้อมูลจัดทำ Scoresheet PDF
    async getMatchScoresheetData(req, res) {
        try {
            const { matchId } = req.params;

            // 1. ดึงรายละเอียดแมตช์ (Official, Teams, Competition)
            const matchResult = await db.query(`
                SELECT 
                    m.*, 
                    t1.name as home_team_name, t1.code as home_team_code,
                    t2.name as away_team_name, t2.code as away_team_code,
                    c.title as competition_name, c.title as competition_title, c.gender as competition_gender, c.gender as competition_category,
                    COALESCE(c.max_sets, 5) as max_sets,
                    
                    -- Officials
                    r1.firstname as r1_firstname, r1.lastname as r1_lastname, r1.country as r1_country,
                    r2.firstname as r2_firstname, r2.lastname as r2_lastname, r2.country as r2_country,
                    s1.firstname as scorer_firstname, s1.lastname as scorer_lastname, COALESCE(s1.country, m.scorer_country) as scorer_country,
                    l1.firstname as lj1_firstname, l1.lastname as lj1_lastname, NULL as lj1_country,
                    l2.firstname as lj2_firstname, l2.lastname as lj2_lastname, NULL as lj2_country,
                    l3.firstname as lj3_firstname, l3.lastname as lj3_lastname, NULL as lj3_country,
                    l4.firstname as lj4_firstname, l4.lastname as lj4_lastname, NULL as lj4_country
                FROM matches m
                LEFT JOIN teams t1 ON m.home_team_id = t1.id
                LEFT JOIN teams t2 ON m.away_team_id = t2.id
                LEFT JOIN competitions c ON m.competition_id = c.id
                LEFT JOIN referees r1 ON m.referee_1_id = r1.id
                LEFT JOIN referees r2 ON m.referee_2_id = r2.id
                LEFT JOIN scorers s1 ON m.scorer_id = s1.id
                LEFT JOIN line_judges l1 ON m.line_judge_1_id = l1.id
                LEFT JOIN line_judges l2 ON m.line_judge_2_id = l2.id
                LEFT JOIN line_judges l3 ON m.line_judge_3_id = l3.id
                LEFT JOIN line_judges l4 ON m.line_judge_4_id = l4.id
                WHERE m.id = ?
            `, [matchId]);

            if (matchResult.rows.length === 0) {
                return res.status(404).json({ error: "Match not found" });
            }

            const match = matchResult.rows[0];

            // 2. ดึงข้อมูลเซต (Score & Duration)
            const setsResult = await db.query(`
                SELECT * FROM match_sets WHERE match_id = ? ORDER BY set_number ASC
            `, [matchId]);

            // 3. ดึง Lineup (Starting positions)
            const lineupsResult = await db.query(`
                SELECT * FROM match_lineups WHERE match_id = ? ORDER BY set_number ASC, team_id ASC
            `, [matchId]);

            // 4. ดึงรายชื่อนักกีฬาทั้งสองทีม (เฉพาะผู้เล่นที่ลงสนาม)
            const homePlayers = await getRosterPlayersForMatchTeam(
                match.competition_id,
                match.home_team_id,
                'p.id, p.first_name, p.last_name, COALESCE(tep.number, p.number) as number, COALESCE(tep.role, p.position) as position',
                'p.id, p.first_name, p.last_name, p.number, p.position'
            );
            const awayPlayers = await getRosterPlayersForMatchTeam(
                match.competition_id,
                match.away_team_id,
                'p.id, p.first_name, p.last_name, COALESCE(tep.number, p.number) as number, COALESCE(tep.role, p.position) as position',
                'p.id, p.first_name, p.last_name, p.number, p.position'
            );

            // 5. ดึงเหตุการณ์ (Point by Point)
            const eventsResult = await db.query(`
                SELECT me.*, me.skill AS event_type, me.set_id AS set_number
                FROM match_events me
                WHERE me.match_id = ?
                ORDER BY me.id ASC
            `, [matchId]);

            res.json({
                match,
                sets: setsResult.rows,
                lineups: lineupsResult.rows,
                homePlayers: homePlayers.rows,
                awayPlayers: awayPlayers.rows,
                events: eventsResult.rows
            });

        } catch (err) {
            console.error("Get Scoresheet Data Error:", err);
            res.status(500).json({ error: "Database error: " + err.message });
        }
    }

}; 

