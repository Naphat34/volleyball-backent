const db = require('../config/db');

const parseNullableInt = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return parseInt(val, 10);
};

const parseNullableString = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return val;
};

const truncate = (value, maxLength) => String(value || '').slice(0, maxLength);

const normalizeGender = (value) => String(value || '').trim().toLowerCase();

const normalizeCompetitionTitle = (value) => String(value || '')
  .replace(/\s*\((Male|Female|Mixed|Mix|Men|Women)\)\s*$/i, '')
  .trim()
  .toLowerCase();

const genderMatches = (playerGender, competitionGender) => {
  const comp = normalizeGender(competitionGender);
  if (!comp || comp === 'mixed' || comp === 'mix' || comp === 'all') return true;

  const player = normalizeGender(playerGender);
  if (!player) return false;

  const maleValues = new Set(['male', 'men', 'm', 'ชาย']);
  const femaleValues = new Set(['female', 'women', 'f', 'หญิง']);

  if (maleValues.has(comp)) return maleValues.has(player);
  if (femaleValues.has(comp)) return femaleValues.has(player);
  return player === comp;
};

const getUserActiveTeamId = async (client, userId) => {
  const userRes = await client.query('SELECT team_id FROM users WHERE id = ?', [userId]);
  return userRes.rows[0]?.team_id || null;
};

const buildTeamCode = async (client, baseCode, compId) => {
  const cleanBase = String(baseCode || 'TEAM').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TEAM';
  const compPart = String(compId).replace(/\D/g, '').slice(-4) || '0';

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? compPart : `${compPart}${attempt}`;
    const code = `${cleanBase.slice(0, Math.max(1, 10 - suffix.length))}${suffix}`.slice(0, 10);
    const existing = await client.query('SELECT id FROM teams WHERE code = ?', [code]);
    if (existing.rows.length === 0) return code;
  }

  throw new Error('Unable to generate a unique team code.');
};

const getUserTeams = async (client, userId) => {
  const result = await client.query('SELECT * FROM teams WHERE user_id = ? ORDER BY id ASC', [userId]);
  return result.rows;
};

const getActiveOrFirstTeam = async (client, userId) => {
  const result = await client.query(`
    SELECT t.*
    FROM teams t
    LEFT JOIN users u ON u.id = ? AND u.team_id = t.id
    WHERE t.user_id = ?
    ORDER BY CASE WHEN u.team_id = t.id THEN 0 ELSE 1 END, t.id ASC
    LIMIT 1
  `, [userId, userId]);
  return result.rows[0] || null;
};

const cloneTeamForCompetition = async (client, baseTeam, competition, userId) => {
  const code = await buildTeamCode(client, baseTeam.code, competition.id);
  const teamName = truncate(`${baseTeam.name} - ${competition.title || competition.id}`, 100);

  const inserted = await client.query(`
    INSERT INTO teams
      (name, code, coach, logo_url, user_id, home_color, away_color, manager_name, phone, email,
       province, address, verification_doc_url, category, status, main_color, second_color, third_color,
       libero_main_color, libero_second_color, libero_third_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    teamName,
    code,
    baseTeam.coach,
    baseTeam.logo_url,
    userId,
    baseTeam.home_color,
    baseTeam.away_color,
    baseTeam.manager_name,
    baseTeam.phone,
    baseTeam.email,
    baseTeam.province,
    baseTeam.address,
    baseTeam.verification_doc_url,
    competition.age_group_id || baseTeam.category,
    baseTeam.status || 'pending',
    baseTeam.main_color,
    baseTeam.second_color,
    baseTeam.third_color,
    baseTeam.libero_main_color,
    baseTeam.libero_second_color,
    baseTeam.libero_third_color,
  ]);

  const newTeamId = inserted.insertId;

  await client.query(`
    INSERT INTO players
      (team_id, number, first_name, last_name, nickname, position, height_cm, is_active, is_captain,
       is_libero1, is_libero2, weight, birth_date, nationality, photo, gender, is_playing)
    SELECT ?, number, first_name, last_name, nickname, position, height_cm, is_active, is_captain,
       is_libero1, is_libero2, weight, birth_date, nationality, photo, gender, is_playing
    FROM players
    WHERE team_id = ?
  `, [newTeamId, baseTeam.id]);

  await client.query(`
    INSERT INTO team_staff (team_id, first_name, last_name, role, gender)
    SELECT ?, first_name, last_name, role, gender
    FROM team_staff
    WHERE team_id = ?
  `, [newTeamId, baseTeam.id]);

  const newTeam = await client.query('SELECT * FROM teams WHERE id = ?', [newTeamId]);
  return newTeam.rows[0];
};

const resolveRegistrationTeam = async (client, userId, compId) => {
  const existing = await client.query(`
    SELECT tc.team_id
    FROM team_competitions tc
    JOIN teams t ON t.id = tc.team_id
    WHERE t.user_id = ? AND tc.competition_id = ?
    LIMIT 1
  `, [userId, compId]);

  if (existing.rows.length > 0) {
    return { alreadyRegistered: true, teamId: existing.rows[0].team_id };
  }

  const competitionRes = await client.query('SELECT * FROM competitions WHERE id = ?', [compId]);
  const competition = competitionRes.rows[0];
  if (!competition) {
    return { missingCompetition: true };
  }

  const baseTeam = await getActiveOrFirstTeam(client, userId);
  if (!baseTeam) {
    return { missingTeam: true };
  }

  const baseRegistration = await client.query(
    'SELECT competition_id FROM team_competitions WHERE team_id = ? LIMIT 1',
    [baseTeam.id]
  );

  if (baseRegistration.rows.length === 0) {
    return { team: baseTeam, cloned: false };
  }

  const team = await cloneTeamForCompetition(client, baseTeam, competition, userId);
  return { team, cloned: true };
};

module.exports = {

  // ==========================================
  // 1. สำหรับ Admin (จัดการรายการแข่งขัน)
  // ==========================================

  // ดึงรายการแข่งขันทั้งหมด
  async getAllCompetitions(req, res) {
    try {
      const result = await db.query(`
        SELECT c.*, ag.name as age_group_name, s.name as stadium_name,
        (SELECT COUNT(*) FROM team_entries te WHERE te.competition_id = c.id) as team_count
        FROM competitions c
        LEFT JOIN age_groups ag ON c.age_group_id = ag.id
        LEFT JOIN stadiums s ON c.stadium_id = s.id
        ORDER BY c.start_date DESC, c.id DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Get All Competitions Error:", err);
      res.status(500).json({ error: 'Database error' });
    }
  },

 // ==========================================
  // 2. สร้างรายการแข่งขัน (สำคัญ: รองรับการเลือกหลายเพศ)
  // ==========================================
  async createCompetition(req, res) {
    const client = await db.pool.connect();

    try {
        const { title, details, sport, gender, age_group_id, age_group_ids, start_date, end_date, location, status, max_sets, max_players, stadium_id } = req.body;
        const baseTitle = String(title || '').trim();
        const rawAgeGroups = Array.isArray(age_group_ids)
          ? age_group_ids
          : String(age_group_ids || age_group_id || '').split(',');
        const selectedAgeGroupIds = [...new Set(rawAgeGroups.map(parseNullableInt).filter(Boolean))];
        const selectedGenders = gender ? gender.split(',').map(g => g.trim()).filter(Boolean) : [];
        const cleanMaxPlayers = parseNullableInt(max_players);
        const requestedMaxSets = parseNullableInt(max_sets);
        const cleanMaxSets = [3, 5].includes(requestedMaxSets) ? requestedMaxSets : 3;
        const cleanStadium = parseNullableInt(stadium_id);
        const cleanStartDate = parseNullableString(start_date);
        const cleanEndDate = parseNullableString(end_date);

        if (!baseTitle) {
            return res.status(400).json({ error: 'Please enter a competition name' });
        }
        if (selectedGenders.length === 0) {
            return res.status(400).json({ error: 'Please select at least one gender category' });
        }
        if (selectedAgeGroupIds.length === 0) {
            return res.status(400).json({ error: 'Please select at least one age group' });
        }

        await client.query('BEGIN');

        const existingRes = await client.query('SELECT id, title, gender, age_group_id FROM competitions');
        const existingKeys = new Set((existingRes.rows || []).map((row) => (
          `${normalizeCompetitionTitle(row.title)}|${String(row.gender).trim().toLowerCase()}|${row.age_group_id}`
        )));

        let createdCount = 0;
        let skippedCount = 0;
        for (const ageGroupId of selectedAgeGroupIds) {
            for (const selectedGender of selectedGenders) {
                const cleanGender = String(selectedGender).trim();
                const key = `${normalizeCompetitionTitle(baseTitle)}|${cleanGender.toLowerCase()}|${ageGroupId}`;
                if (existingKeys.has(key)) {
                    skippedCount++;
                    continue;
                }

                const suffix = selectedGenders.length > 1 ? ` (${cleanGender})` : '';
                const finalTitle = `${baseTitle}${suffix}`;

                await client.query(
                    `INSERT INTO competitions
                    (title, details, sport, gender, age_group_id, start_date, end_date, location, status, max_sets, max_players, stadium_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        finalTitle,
                        details,
                        sport,
                        cleanGender,
                        ageGroupId,
                        cleanStartDate,
                        cleanEndDate,
                        location,
                        status,
                        cleanMaxSets,
                        cleanMaxPlayers,
                        cleanStadium
                    ]
                );
                existingKeys.add(key);
                createdCount++;
            }
        }

        if (createdCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'All selected competition categories already exist' });
        }

        await client.query('COMMIT');
        res.json({
            message: `Successfully created ${createdCount} competition category/categories${skippedCount ? `, skipped ${skippedCount} duplicate(s)` : ''}`,
            created_count: createdCount,
            skipped_count: skippedCount
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create Competition Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
  },

  // ==========================================
  // 3. แก้ไขรายการแข่งขัน
  // ==========================================
  async updateCompetition(req, res) {
    try {
      const { id } = req.params;
      const { title, details, sport, gender, age_group_id, start_date, end_date, location, status, max_sets, max_players, stadium_id } = req.body;

      // Handle Gender: ถ้าแก้ไขรายการเดิม จะรับค่าได้แค่เพศเดียว
      // ถ้าส่งมาเป็น "Male,Female" ให้เอาแค่ตัวแรก (หรือ Frontend ควรส่งมาแค่ตัวเดียว)
      const singleGender = gender && gender.includes(',') ? gender.split(',')[0] : gender;

      const cleanAgeGroup = parseNullableInt(age_group_id);
      const requestedMaxSets = parseNullableInt(max_sets);
      const cleanMaxSets = [3, 5].includes(requestedMaxSets) ? requestedMaxSets : 3;
      const cleanMaxPlayers = parseNullableInt(max_players);
      const cleanStadium = parseNullableInt(stadium_id);
      const cleanStartDate = parseNullableString(start_date);
      const cleanEndDate = parseNullableString(end_date);

      if (!cleanAgeGroup) {
        return res.status(400).json({ error: 'Please select an age group' });
      }

      await db.query(
        `UPDATE competitions 
         SET title=?, details=?, sport=?, gender=?, age_group_id=?, start_date=?, end_date=?, location=?, status=?, max_sets=?, max_players=?, stadium_id=?
         WHERE id=?`,
        [
          title, details, sport, 
          singleGender, // ใช้ค่าเดียว
          cleanAgeGroup, cleanStartDate, cleanEndDate, location, status, cleanMaxSets, cleanMaxPlayers, cleanStadium,
          id
        ]
      );

      const updatedCompetition = await db.query('SELECT * FROM competitions WHERE id = ?', [id]);
      if (updatedCompetition.rows.length === 0) {
        return res.status(404).json({ error: "Competition not found" });
      }

      res.json(updatedCompetition.rows[0]);
    } catch (err) {
      console.error("Update Competition Error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  async deleteCompetition(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      await client.query('BEGIN');

      // ลบข้อมูลที่เกี่ยวข้องก่อน
      await client.query('DELETE FROM matches WHERE competition_id = ?', [id]);
      await client.query('DELETE FROM team_competitions WHERE competition_id = ?', [id]);
      
      const result = await client.query('DELETE FROM competitions WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Competition not found' });
      }

      await client.query('COMMIT');
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    } finally {
      client.release();
    }
  },

  // เปลี่ยนสถานะ (Open/Closed/Ended)
  async toggleCompetitionStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await db.query(
        'UPDATE competitions SET status = ? WHERE id = ?',
        [status, id]
      );
      const updatedCompetition = await db.query('SELECT * FROM competitions WHERE id = ?', [id]);
      res.json(updatedCompetition.rows[0]);
    } catch (err) {
      console.error("Toggle Status Error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 2. สำหรับ User ทั่วไป / ทีม
  // ==========================================

  // ดึงรายการที่เปิดรับสมัคร (Open)
  async getOpenCompetitions(req, res) {
    try {
      const result = await db.query(`
        SELECT c.*, ag.name as age_group_name 
        FROM competitions c
        LEFT JOIN age_groups ag ON c.age_group_id = ag.id
        WHERE c.status = 'open'
        ORDER BY c.start_date ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Get Open Comp Error:", err);
      res.status(500).json({ error: 'Database error' });
    }
  },

  // ดึงรายการที่ทีมตัวเองลงสมัครไว้
  async getMyCompetitions(req, res) {
    try {
      const userId = req.user.id;
      // หา team_id ของ user ก่อน
      const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
      const teamId = userRes.rows[0]?.team_id;

      if (!teamId) return res.json([]);

      const result = await db.query(`
        SELECT
          c.*,
          te.id as team_entry_id,
          te.display_name as entry_display_name,
          te.status as registration_status,
          te.registered_at,
          te.age_group_id as entry_age_group_id,
          ag.name as age_group_name
        FROM competitions c
        JOIN team_entries te ON c.id = te.competition_id
        LEFT JOIN age_groups ag ON ag.id = te.age_group_id
        WHERE te.team_id = ?
        ORDER BY c.start_date DESC
      `, [teamId]);

      res.json(result.rows);
    } catch (err) {
      console.error("Get My Comp Error:", err);
      res.status(500).json({ error: 'Database error' });
    }
  },

  async getMyTeamEntries(req, res) {
    try {
      const userId = req.user.id;
      const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
      const teamId = userRes.rows[0]?.team_id;

      if (!teamId) return res.json([]);

      const result = await db.query(`
        SELECT
          te.*,
          t.name as organization_name,
          t.code as organization_code,
          c.title as competition_title,
          c.sport,
          c.gender as competition_gender,
          c.start_date,
          c.end_date,
          te.age_group_id as entry_age_group_id,
          ag.name as age_group_name
        FROM team_entries te
        JOIN teams t ON t.id = te.team_id
        JOIN competitions c ON c.id = te.competition_id
        LEFT JOIN age_groups ag ON ag.id = te.age_group_id
        WHERE te.team_id = ?
        ORDER BY c.start_date DESC, te.registered_at DESC, te.id DESC
      `, [teamId]);

      res.json(result.rows);
    } catch (err) {
      console.error("Get My Team Entries Error:", err);
      res.status(500).json({ error: 'Database error' });
    }
  },

  async getMyTeamEntryPlayers(req, res) {
    try {
      const userId = req.user.id;
      const { entryId } = req.params;
      const teamId = await getUserActiveTeamId(db, userId);

      if (!teamId) return res.status(400).json({ error: 'Team not found' });

      const entryRes = await db.query(`
        SELECT
          te.*,
          c.title as competition_title,
          c.gender as competition_gender,
          c.max_players,
          ag.name as age_group_name
        FROM team_entries te
        JOIN competitions c ON c.id = te.competition_id
        LEFT JOIN age_groups ag ON ag.id = te.age_group_id
        WHERE te.id = ? AND te.team_id = ?
      `, [entryId, teamId]);

      if (entryRes.rows.length === 0) {
        return res.status(404).json({ error: 'Team entry not found' });
      }

      const entry = entryRes.rows[0];

      const playersRes = await db.query(`
        SELECT
          p.*,
          CASE WHEN tep.id IS NULL THEN 0 ELSE 1 END as selected,
          tep.number as entry_number,
          tep.role as entry_role,
          tep.is_captain as entry_is_captain,
          tep.is_libero1 as entry_is_libero1,
          tep.is_libero2 as entry_is_libero2,
          tep.is_playing as entry_is_playing
        FROM players p
        LEFT JOIN team_entry_players tep
          ON tep.player_id = p.id AND tep.team_entry_id = ?
        WHERE p.team_id = ?
        ORDER BY p.number ASC, p.id ASC
      `, [entry.id, teamId]);

      const eligiblePlayers = playersRes.rows.map((player) => ({
        ...player,
        gender_eligible: genderMatches(player.gender, entry.competition_gender),
      }));

      const selectedPlayerIds = eligiblePlayers
        .filter((player) => Number(player.selected) === 1)
        .map((player) => player.id);

      res.json({
        entry,
        players: eligiblePlayers,
        selectedPlayerIds,
      });
    } catch (err) {
      console.error("Get Team Entry Players Error:", err);
      res.status(500).json({ error: 'Database error' });
    }
  },

  async updateMyTeamEntryPlayers(req, res) {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;
      const { entryId } = req.params;
      const playerIds = Array.isArray(req.body.player_ids) ? req.body.player_ids : [];

      const uniquePlayerIds = [...new Set(playerIds.map((id) => parseNullableInt(id)).filter(Boolean))];

      await client.query('BEGIN');

      const teamId = await getUserActiveTeamId(client, userId);
      if (!teamId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Team not found' });
      }

      const entryRes = await client.query(`
        SELECT te.*, c.gender as competition_gender, c.max_players
        FROM team_entries te
        JOIN competitions c ON c.id = te.competition_id
        WHERE te.id = ? AND te.team_id = ?
      `, [entryId, teamId]);

      if (entryRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Team entry not found' });
      }

      const entry = entryRes.rows[0];
      const maxPlayers = parseNullableInt(entry.max_players);

      if (maxPlayers && uniquePlayerIds.length > maxPlayers) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Roster exceeds maximum players (${maxPlayers})` });
      }

      let selectedPlayers = [];
      if (uniquePlayerIds.length > 0) {
        const placeholders = uniquePlayerIds.map(() => '?').join(',');
        const playersRes = await client.query(`
          SELECT id, team_id, number, position, gender, is_captain, is_libero1, is_libero2, is_playing
          FROM players
          WHERE id IN (${placeholders})
        `, uniquePlayerIds);
        selectedPlayers = playersRes.rows;
      }

      if (selectedPlayers.length !== uniquePlayerIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more players were not found' });
      }

      const invalidTeamPlayer = selectedPlayers.find((player) => String(player.team_id) !== String(teamId));
      if (invalidTeamPlayer) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more players do not belong to this team' });
      }

      const invalidGenderPlayer = selectedPlayers.find((player) => !genderMatches(player.gender, entry.competition_gender));
      if (invalidGenderPlayer) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more players do not match this competition gender' });
      }

      const numberCounts = new Map();
      for (const player of selectedPlayers) {
        const playerNumber = parseNullableInt(player.number);
        if (!playerNumber) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Every selected player must have a valid number' });
        }

        numberCounts.set(playerNumber, (numberCounts.get(playerNumber) || 0) + 1);
      }

      const duplicateNumbers = [...numberCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([number]) => number);
      if (duplicateNumbers.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Duplicate player number in this category/age group: ${duplicateNumbers.join(', ')}`
        });
      }

      await client.query('DELETE FROM team_entry_players WHERE team_entry_id = ?', [entry.id]);

      for (const player of selectedPlayers) {
        await client.query(`
          INSERT INTO team_entry_players
            (team_entry_id, player_id, number, role, is_captain, is_libero1, is_libero2, is_playing)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          entry.id,
          player.id,
          player.number,
          player.position,
          player.is_captain || 0,
          player.is_libero1 || 0,
          player.is_libero2 || 0,
          player.is_playing !== undefined && player.is_playing !== null ? player.is_playing : 1,
        ]);
      }

      await client.query('COMMIT');
      res.json({ message: 'Roster updated', player_count: selectedPlayers.length });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Update Team Entry Players Error:", err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },

  // สมัครเข้าร่วมแข่งขัน
  async joinCompetition(req, res) {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;
      const { competition_id } = req.body;
      const compId = competition_id || req.body.id;

      if (!compId) {
        return res.status(400).json({ error: "Missing competition ID" });
      }

      await client.query('BEGIN');

      // 1. ตรวจสอบว่า User มีทีมหรือไม่
      const userRes = await client.query('SELECT team_id FROM users WHERE id = ?', [userId]);
      const teamId = userRes.rows[0]?.team_id;

      if (!teamId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "คุณต้องสร้างทีมก่อนสมัครแข่งขัน (You must create a team first)" });
      }

      const competitionRes = await client.query('SELECT * FROM competitions WHERE id = ?', [compId]);
      const competition = competitionRes.rows[0];
      if (!competition) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Competition not found" });
      }

      const teamRes = await client.query('SELECT * FROM teams WHERE id = ?', [teamId]);
      const team = teamRes.rows[0];

      // 2. ตรวจสอบว่าเคยสมัครไปแล้วหรือยัง
      const check = await client.query(
        "SELECT * FROM team_entries WHERE team_id = ? AND competition_id = ?",
        [teamId, compId]
      );

      if (check.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "ทีมของคุณสมัครรายการนี้ไปแล้ว (Already registered)" });
      }

      // 3. บันทึกการสมัครแบบ team entry โดยไม่ clone โรงเรียน/สโมสร
      const displayName = truncate(`${team.name} - ${competition.title}`, 150);
      await client.query(
        `INSERT INTO team_entries
          (team_id, competition_id, display_name, gender, age_group_id, status, registered_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
        [teamId, compId, displayName, competition.gender, competition.age_group_id]
      );

      // Mirror ไว้ให้ fixture/match และหน้าจอเดิมที่ยังอ่าน team_competitions ทำงานต่อ
      await client.query(
        `INSERT INTO team_competitions
          (team_id, competition_id, gender, age_group_id, registered_at, status)
         VALUES (?, ?, ?, ?, NOW(), 'pending')
         ON DUPLICATE KEY UPDATE
          gender = VALUES(gender),
          age_group_id = VALUES(age_group_id),
          status = VALUES(status)`,
        [teamId, compId, competition.gender, competition.age_group_id]
      );

      await client.query('COMMIT');
      res.json({ message: "Register Success (Wait for approval)" });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Join Competition Error:", err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },

  // ยกเลิกการสมัครแข่งขัน
  async leaveCompetition(req, res) {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;
      const { competition_id } = req.body;
      const compId = parseNullableInt(competition_id);

      if (!compId) {
        return res.status(400).json({ error: "Missing competition ID" });
      }

      await client.query('BEGIN');

      // 1. หา team_id ของ user
      const userRes = await client.query('SELECT team_id FROM users WHERE id = ?', [userId]);
      const teamId = userRes.rows[0]?.team_id;

      if (!teamId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Team not found" });
      }

      const entryCheck = await client.query(
        "SELECT id FROM team_entries WHERE team_id = ? AND competition_id = ? LIMIT 1",
        [teamId, compId]
      );
      const matchCheck = await client.query(
        "SELECT id FROM matches WHERE competition_id = ? AND (home_team_id = ? OR away_team_id = ?) LIMIT 1",
        [compId, teamId, teamId]
      );
      if (matchCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Cannot leave after matches have been generated for this registration" });
      }

      const registrationCheck = await client.query(
        "SELECT competition_id FROM team_competitions WHERE team_id = ? AND competition_id = ? LIMIT 1",
        [teamId, compId]
      );

      if (entryCheck.rows.length === 0 && registrationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Registration not found or already removed" });
      }

      // 2. ลบการสมัครทั้งตารางใหม่และตาราง legacy ให้ตรงกัน
      const result = await client.query(
        "DELETE FROM team_entries WHERE team_id = ? AND competition_id = ?",
        [teamId, compId]
      );

      await client.query(
        "DELETE FROM team_competitions WHERE team_id = ? AND competition_id = ?",
        [teamId, compId]
      );

      await client.query('COMMIT');
      res.json({ message: "Successfully left the competition" });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Leave Competition Error:", err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },

  // ==========================================
  // 3. สำหรับจัดการแมตช์ (Match Management)
  // ==========================================

  // ดึงรายชื่อทีมที่สมัครในรายการแข่งขันนั้นๆ
  async getCompetitionTeams(req, res) {
    const { competitionId } = req.params;
    const { status } = req.query;

    try {
      let query = `
        SELECT
          te.id as team_entry_id,
          te.display_name as entry_display_name,
          te.gender as entry_gender,
          te.age_group_id as entry_age_group_id,
          ag.name as age_group_name,
          t.id, t.name, t.code, t.logo_url, t.coach, te.status, te.registered_at
        FROM teams t
        JOIN team_entries te ON t.id = te.team_id
        LEFT JOIN age_groups ag ON ag.id = te.age_group_id
        WHERE te.competition_id = ?
      `;
      const params = [competitionId];

      if (status) {
        query += ` AND te.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY t.name ASC`;

      const result = await db.query(query, params);
      if (result.rows.length > 0) {
        return res.json(result.rows);
      }

      const matchTeams = await db.query(`
        SELECT DISTINCT
          t.id,
          t.name,
          t.code,
          t.logo_url,
          t.coach,
          'match' AS status,
          NULL AS team_entry_id,
          NULL AS entry_display_name,
          NULL AS entry_gender,
          NULL AS entry_age_group_id,
          NULL AS age_group_name,
          NULL AS registered_at
        FROM teams t
        JOIN (
          SELECT home_team_id AS team_id FROM matches WHERE competition_id = ?
          UNION
          SELECT away_team_id AS team_id FROM matches WHERE competition_id = ?
        ) mt ON mt.team_id = t.id
        ORDER BY t.name ASC
      `, [competitionId, competitionId]);

      res.json(matchTeams.rows);
    } catch (err) {
      console.error("Get Competition Teams Error:", err);
      res.status(500).json({ error: "Database error" });
    }
  },

  async getAllStadiums(req, res) {
    try {
      // ดึงเฉพาะสนามที่สถานะเป็น active
      const result = await db.query("SELECT * FROM stadiums WHERE status = 'active' ORDER BY name ASC");
      res.json(result.rows);
    } catch (err) {
      console.error("Get Stadiums Error:", err);
      res.status(500).json({ error: 'Database error' });
    }
  },
}; 
