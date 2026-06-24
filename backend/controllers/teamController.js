const db = require('../config/db');

const parseNullableInt = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return parseInt(val, 10);
};

const parseNullableString = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return val;
};

// ดึงข้อมูลทีมทั้งหมด พร้อมรายชื่อนักกีฬาและสตาฟ
exports.getTeamDetails = async (req, res) => {
  try {
    const teamId = req.params.teamId || req.params.id;
    console.log("Team ID requested:", teamId);
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }


    // 1. ดึงข้อมูลทีม
    const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamRes.rows.length === 0) {
        // เพิ่ม log เพื่อดูว่าหา ID อะไรไม่เจอ
        console.log(`Searching for team ${teamId} but not found.`);
        return res.status(404).json({ error: 'Team not found' });
    }

    // 2. ดึงนักกีฬา
    const playersRes = await db.query(
      'SELECT * FROM players WHERE team_id = $1 ORDER BY number ASC', 
      [teamId]
    );

    // 3. ดึงสตาฟ
    const staffRes = await db.query(
      'SELECT * FROM team_staff WHERE team_id = $1 ORDER BY role ASC', 
      [teamId]
    );

    res.json({
      info: teamRes.rows[0],
      staff: staffRes.rows,
      players: playersRes.rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createMyTeam = async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { name, code, logo_url, coach } = req.body;
    const userId = req.user.id; // ✅ ได้จาก authMiddleware

    if (!name || !code) {
      return res.status(400).json({ error: "Team name and code are required." });
    }

    await client.query('BEGIN');

    // 1. ตรวจสอบว่า User นี้มีทีมอยู่แล้วหรือยัง (เช็คจากตาราง teams โดยตรง)
    const checkTeam = await client.query('SELECT * FROM teams WHERE user_id = $1', [userId]);
    if (checkTeam.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "You already own a team." });
    }

    // 2. สร้างทีมใหม่ พร้อมใส่ user_id และ code
    const newTeamRes = await client.query(
      'INSERT INTO teams (name, code, logo_url, user_id, coach) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, code, logo_url, userId, coach]
    );
    const newTeam = newTeamRes.rows[0];

    // 3. อัปเดต user ให้มี team_id ด้วย (เพื่อให้ง่ายต่อการเช็คฝั่ง User)
    await client.query('UPDATE users SET team_id = $1 WHERE id = $2', [newTeam.id, userId]);

    // 4. เพิ่ม User คนนี้เป็น "Head Coach" หรือ "Manager" ในตาราง Staff ด้วย (Optional)
    // เพื่อให้เขามีชื่ออยู่ในระบบจัดการทีม
    let coachFirstName = '';
    let coachLastName = '';

    if (coach) {
      const nameParts = coach.trim().split(' ');
      coachFirstName = nameParts[0];
      coachLastName = nameParts.slice(1).join(' ') || '-';
    } else {
      const userDetails = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
      coachFirstName = userDetails.rows[0].username;
      coachLastName = '(Manager)';
    }

    await client.query(
      'INSERT INTO team_staff (team_id, first_name, last_name, role) VALUES ($1, $2, $3, $4)',
      [newTeam.id, coachFirstName, coachLastName, 'Head Coach']
    );

    await client.query('COMMIT');
    res.status(201).json(newTeam);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating team:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ✅ [เพิ่ม] ดึงข้อมูลทีมของตัวเอง (ที่ User Login อยู่)
exports.getMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 1. ดึง team_id ล่าสุดจาก DB (เผื่อกรณี Token เก่า)
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) {
      // ใช้ status 400 เพื่อให้ frontend รู้ว่า "ยังไม่มีทีม" ไม่ใช่ server error
      return res.status(400).json({ error: 'User has no team.' });
    }

    // 2. ดึงข้อมูลทีมจาก team_id
    const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);

    if (teamRes.rows.length === 0) {
      // Data inconsistency: user has a team_id that doesn't exist.
      // Self-heal: update user's team_id to NULL.
      console.warn(`Data inconsistency found: User ${userId} has non-existent team_id ${teamId}. Resetting to NULL.`);
      await db.query('UPDATE users SET team_id = NULL WHERE id = $1', [userId]);
      
      // Return 400 so frontend redirects to create-team page.
      return res.status(400).json({ error: 'Team data inconsistent. Please create a new team.' });
    }

    res.json(teamRes.rows[0]);

  } catch (err) {
    console.error("Error in getMyTeam:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] อัปเดตข้อมูลทีมของตัวเอง
exports.updateMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, code, logo_url } = req.body;

    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }

    const result = await db.query(
      'UPDATE teams SET name = COALESCE($1, name), code = COALESCE($2, code), logo_url = COALESCE($3, logo_url) WHERE id = $4 RETURNING *',
      [name, code, logo_url, teamId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating team:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] Admin: สร้างทีมใหม่
exports.createTeam = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, code, logo_url } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: "Team name and code are required." });
    }

    await client.query('BEGIN');
    const newTeamRes = await client.query(
      'INSERT INTO teams (name, code, logo_url) VALUES ($1, $2, $3) RETURNING *',
      [name, code, logo_url]
    );
    await client.query('COMMIT');
    res.status(201).json(newTeamRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating team (admin):", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ✅ [เพิ่ม] Admin: อัปเดตข้อมูลทีม
exports.updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, logo_url } = req.body;
    const result = await db.query(
      'UPDATE teams SET name = COALESCE($1, name), code = COALESCE($2, code), logo_url = COALESCE($3, logo_url) WHERE id = $4 RETURNING *',
      [name, code, logo_url, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Team not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating team (admin):", err);
    res.status(500).json({ error: err.message });
  }
};

// ฟังก์ชันสำหรับดึงข้อมูล Staff ของทีมตัวเอง (โดยเช็คจาก User ที่ Login)
exports.getMyTeamStaff = async (req, res) => {
  try {
    const userId = req.user.id; // ได้จาก Token

    // 1. หา team_id ของ User คนนี้ก่อน
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }

    const teamId = userRes.rows[0].team_id;

    // 2. ดึงข้อมูล Staff ของทีมนั้น
    const staffRes = await db.query(
      'SELECT * FROM team_staff WHERE team_id = $1 ORDER BY role ASC', 
      [teamId]
    );

    res.json(staffRes.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ฟังก์ชันสำหรับเพิ่ม Staff เข้าทีมตัวเอง
exports.addStaffToMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 1. รับค่าจากหน้าบ้าน (รับมารอไว้ทุกตัวเผื่อหน้าบ้านส่งมาแบบไหน)
    const { name, first_name, last_name, role, gender } = req.body; 

    // ตัวแปรสำหรับเก็บค่าที่จะบันทึกลง DB
    let dbFirstName = '';
    let dbLastName = '';

    // 2. ตรวจสอบและแปลงข้อมูล
    if (first_name && last_name) {
      // กรณีหน้าบ้านส่งแยกมา (ดีที่สุด ตรงกับ DB)
      dbFirstName = first_name;
      dbLastName = last_name;
    } else if (name) {
      // กรณีหน้าบ้านส่ง 'name' รวมมา (ต้องมาตัดคำเอง)
      const nameParts = name.trim().split(' ');
      dbFirstName = nameParts[0];
      dbLastName = nameParts.slice(1).join(' ') || '-';
    } else {
      // กรณีไม่ส่งอะไรมาเลย หรือส่งผิดชื่อ
      return res.status(400).json({ 
        error: "ข้อมูลไม่ครบ! กรุณาส่ง 'first_name' และ 'last_name' หรือ 'name'" 
      });
    }

    // 3. หา team_id ของ User
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;

    // 4. บันทึกลงฐานข้อมูล (ใช้คอลัมน์ first_name, last_name ตาม DB จริง)
    const newStaff = await db.query(
      'INSERT INTO team_staff (team_id, first_name, last_name, role, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [teamId, dbFirstName, dbLastName, role, gender]
    );

    res.status(201).json(newStaff.rows[0]);

  } catch (err) {
    console.error("Error adding staff:", err); // Log Error ให้เห็นใน Terminal
    res.status(500).json({ error: err.message });
  }
};

// ฟังก์ชันสำหรับอัปเดตข้อมูล Staff ในทีมตัวเอง
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, first_name, last_name, role, gender } = req.body;

    // 1. หา team_id ของ User
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;

    // 2. ตรวจสอบว่า Staff คนนี้อยู่ในทีมของ User หรือไม่
    const staffCheck = await db.query('SELECT * FROM team_staff WHERE id = $1 AND team_id = $2', [id, teamId]);
    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found in your team.' });
    }

    // 3. ตรวจสอบและแปลงข้อมูลชื่อ
    let dbFirstName = '';
    let dbLastName = '';
    if (first_name && last_name) {
      dbFirstName = first_name;
      dbLastName = last_name;
    } else if (name) {
      const nameParts = name.trim().split(' ');
      dbFirstName = nameParts[0];
      dbLastName = nameParts.slice(1).join(' ') || '-';
    } else {
      dbFirstName = staffCheck.rows[0].first_name;
      dbLastName = staffCheck.rows[0].last_name;
    }

    // 4. อัปเดตข้อมูลใน DB
    const result = await db.query(
      `UPDATE team_staff 
       SET first_name = $1, last_name = $2, role = $3, gender = $4
       WHERE id = $5 AND team_id = $6 RETURNING *`,
      [dbFirstName, dbLastName, role, gender, id, teamId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating staff:", err);
    res.status(500).json({ error: err.message });
  }
};

// ฟังก์ชันสำหรับลบ Staff ในทีมตัวเอง
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. หา team_id ของ User
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;

    // 2. ลบ Staff
    const result = await db.query(
      'DELETE FROM team_staff WHERE id = $1 AND team_id = $2 RETURNING id',
      [id, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found in your team.' });
    }

    res.json({ message: 'Staff member deleted successfully' });
  } catch (err) {
    console.error("Error deleting staff:", err);
    res.status(500).json({ error: err.message });
  }
};


// ฟังก์ชันสำหรับดึงข้อมูล Players ของทีมตัวเอง
exports.getMyPlayers = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    if (!userRes.rows[0]?.team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;
    const playersRes = await db.query('SELECT * FROM players WHERE team_id = $1 ORDER BY number ASC', [teamId]);
    res.json(playersRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ฟังก์ชันสำหรับเพิ่ม Player เข้าทีมตัวเอง
exports.addPlayerToMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    // หา team_id ของ user คนนี้
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.status(400).json({ error: "User has no team." });

    const { first_name, last_name, number, position, height_cm, weight, birth_date, is_captain, gender, nickname, nationality, photo } = req.body;

    // --- [เพิ่มส่วนนี้] Logic: ถ้าตั้งคนนี้เป็นกัปตัน ให้ปลดกัปตันคนเก่าออก ---
    if (is_captain === true || is_captain === 'true') {
        await db.query('UPDATE players SET is_captain = false WHERE team_id = $1', [teamId]);
    }
    // ----------------------------------------------------------------

    const cleanNumber = parseNullableInt(number);
    const cleanHeight = parseNullableInt(height_cm);
    const cleanWeight = parseNullableInt(weight);
    const cleanBirthDate = parseNullableString(birth_date);
    const cleanIsCaptain = is_captain === true || is_captain === 'true';

    const result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, number, position, height_cm, weight, birth_date, is_captain, gender, nickname, nationality, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [teamId, first_name, last_name, cleanNumber, position, cleanHeight, cleanWeight, cleanBirthDate, cleanIsCaptain, gender, nickname, nationality, photo]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};

// ฟังก์ชันสำหรับอัปเดตข้อมูล Player (รวมถึง Roles)
exports.updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, number, position, height_cm, weight, birth_date, is_captain, gender, nickname, nationality, photo } = req.body;

    // --- [LOGIC กัปตัน] ---
    if (is_captain === true || is_captain === 'true') {
        // 1. หา team_id ของนักกีฬาคนนี้ก่อน เพื่อจะได้รีเซ็ตถูกทีม
        const playerCheck = await db.query('SELECT team_id FROM players WHERE id = $1', [id]);
        
        if (playerCheck.rows.length > 0) {
            const teamId = playerCheck.rows[0].team_id;
            // 2. ปลดกัปตันทุกคนในทีมนี้ออก
            await db.query('UPDATE players SET is_captain = false WHERE team_id = $1', [teamId]);
        }
    }
    // ---------------------

    const cleanNumber = parseNullableInt(number);
    const cleanHeight = parseNullableInt(height_cm);
    const cleanWeight = parseNullableInt(weight);
    const cleanBirthDate = parseNullableString(birth_date);
    const cleanIsCaptain = is_captain === true || is_captain === 'true';

    const result = await db.query(
      `UPDATE players 
       SET first_name=$1, last_name=$2, number=$3, position=$4, height_cm=$5, weight=$6, birth_date=$7, is_captain=$8, gender=$9, nickname=$10, nationality=$11, photo=$12
       WHERE id=$13 RETURNING *`,
      [first_name, last_name, cleanNumber, position, cleanHeight, cleanWeight, cleanBirthDate, cleanIsCaptain, gender, nickname, nationality, photo, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Player not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};

// ฟังก์ชันสำหรับลบ Player ออกจากทีม
exports.deletePlayer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: playerId } = req.params;

    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;
    if (!teamId) {
      return res.status(403).json({ error: "User does not belong to a team." });
    }

    const { rowCount } = await db.query('DELETE FROM players WHERE id = $1 AND team_id = $2', [playerId, teamId]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Player not found in your team." });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting player:", err);
    res.status(500).json({ error: "Failed to delete player." });
  }
};

exports.getAllTeams = async (req, res) => {
  try {
    // ดึงจำนวนสมาชิกในทีมมาโชว์ด้วยก็ได้
    const result = await db.query(`
      SELECT t.*, 
      (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) as player_count 
      FROM teams t ORDER BY t.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] ลบทีม (ระวัง! การลบทีมควรลบ Players ที่สังกัดทีมนั้นด้วย -> ตั้งค่า CASCADE ใน DB หรือยัง?)
exports.deleteTeam = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');

    // 1. ปลด User ออกจากทีมก่อน (สำคัญมาก เพราะติด FK users.team_id -> teams.id)
    await client.query('UPDATE users SET team_id = NULL WHERE team_id = $1', [id]);

    // 2. ลบข้อมูลสมาชิกในทีม (Players, Staff)
    await client.query('DELETE FROM players WHERE team_id = $1', [id]);
    await client.query('DELETE FROM team_staff WHERE team_id = $1', [id]);

    // 3. ลบข้อมูลการสมัครแข่งขัน
    await client.query('DELETE FROM team_competitions WHERE team_id = $1', [id]);

    // 4. ค้นหาแมตช์ทั้งหมดที่ทีมนี้เกี่ยวข้อง เพื่อลบข้อมูลที่เชื่อมโยง (Sets, Actions, Events, Lineups)
    const matchesRes = await client.query(
      'SELECT id FROM matches WHERE home_team_id = $1 OR away_team_id = $1',
      [id]
    );
    const matchIds = matchesRes.rows.map(m => m.id);

    if (matchIds.length > 0) {
      // ลบข้อมูลรายเซต, สถิติ, และรายชื่อผู้เล่นในแต่ละแมตช์
      await client.query('DELETE FROM match_sets WHERE match_id = ANY($1)', [matchIds]);
      await client.query('DELETE FROM match_actions WHERE match_id = ANY($1)', [matchIds]);
      await client.query('DELETE FROM match_events WHERE match_id = ANY($1)', [matchIds]);
      await client.query('DELETE FROM match_lineups WHERE match_id = ANY($1)', [matchIds]);
      
      // ลบแมตช์จริง
      await client.query('DELETE FROM matches WHERE id = ANY($1)', [matchIds]);
    }

    // 5. ลบทีม
    const result = await client.query('DELETE FROM teams WHERE id = $1', [id]);

    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Team not found" });
    }

    res.json({ message: "Team deleted successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error deleting team:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getAllPlayers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, t.name as team_name 
      FROM players p 
      LEFT JOIN teams t ON p.team_id = t.id 
      ORDER BY p.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
};

exports.getPlayersByTeam = async (req, res) => {
  try {
    const { id } = req.params; // รับ id จาก url: /admin/teams/:id/players
    
    const result = await db.query(
      'SELECT * FROM players WHERE team_id = $1 ORDER BY number ASC', 
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching players by team:", err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
};

// ✅ [เพิ่ม] Admin: ดึงรายชื่อสตาฟตาม Team ID
exports.getStaffByTeam = async (req, res) => {
  try {
    const { id } = req.params; // รับ id จาก url: /admin/teams/:id/staff
    
    const result = await db.query(
      'SELECT * FROM team_staff WHERE team_id = $1 ORDER BY role ASC', 
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching staff by team:", err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
};

// ✅ [เพิ่ม] ดึงรายการแข่งขันที่เปิดรับสมัคร (Open)
exports.getOpenCompetitions = async (req, res) => {
  try {
    // สมมติว่าตารางชื่อ competitions และมี column status
    const result = await db.query("SELECT * FROM competitions WHERE status = 'open' ORDER BY start_date ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] ดึงรายการแข่งขันที่ทีมตัวเองเข้าร่วม
exports.getMyCompetitions = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.json([]); // ยังไม่มีทีม ก็ยังไม่มีรายการแข่ง

    const result = await db.query(`
        SELECT c.*, tc.created_at as joined_at
        FROM competitions c
        JOIN team_competitions tc ON c.id = tc.competition_id
        WHERE tc.team_id = $1
        ORDER BY c.start_date DESC
    `, [teamId]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] ดึงสถิติผู้เล่นทั้งหมดในทีม
exports.getMyPlayersStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.status(400).json({ error: "No team found for this user" });

    const statsQuery = `
        SELECT
            p.id, p.first_name, p.last_name, p.number, p.position, p.gender, p.photo,
            COALESCE(s.attack_kills, 0) as attack_kills,
            COALESCE(s.attack_errors, 0) as attack_errors,
            COALESCE(s.attack_attempts, 0) as attack_attempts,
            COALESCE(s.block_points, 0) as block_points,
            COALESCE(s.serve_aces, 0) as serve_aces,
            COALESCE(s.serve_errors, 0) as serve_errors,
            COALESCE(s.digs, 0) as digs,
            COALESCE(s.receptions, 0) as receptions
        FROM players p
        LEFT JOIN (
            SELECT
                player_id,
                COUNT(*) FILTER (WHERE skill = 'A' AND grade = '#') as attack_kills,
                COUNT(*) FILTER (WHERE skill = 'A' AND grade = '=') as attack_errors,
                COUNT(*) FILTER (WHERE skill = 'A') as attack_attempts,
                COUNT(*) FILTER (WHERE skill = 'B' AND grade = '#') as block_points,
                COUNT(*) FILTER (WHERE skill = 'S' AND grade = '#') as serve_aces,
                COUNT(*) FILTER (WHERE skill = 'S' AND grade = '=') as serve_errors,
                COUNT(*) FILTER (WHERE skill = 'D') as digs,
                COUNT(*) FILTER (WHERE skill = 'R') as receptions
            FROM match_actions
            GROUP BY player_id
        ) s ON p.id = s.player_id
        WHERE p.team_id = $1
        ORDER BY p.number ASC;
    `;

    const result = await db.query(statsQuery, [teamId]);

    const playersWithStats = result.rows.map(player => {
        const attAtt = parseInt(player.attack_attempts) || 0, attKill = parseInt(player.attack_kills) || 0, attErr = parseInt(player.attack_errors) || 0;
        const attack_efficiency = attAtt > 0 ? (((attKill - attErr) / attAtt) * 100).toFixed(1) : 0;
        return { ...player, attack_efficiency };
    });

    res.json(playersWithStats);
  } catch (err) {
    console.error("Get My Players Stats Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] สมัครเข้าร่วมการแข่งขัน
exports.joinCompetition = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    const { competition_id } = req.body;

    const userRes = await client.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.status(400).json({ error: "You must create a team first." });

    await client.query('BEGIN');
    // ตรวจสอบว่าสมัครไปหรือยัง
    const check = await client.query('SELECT * FROM team_competitions WHERE team_id = $1 AND competition_id = $2', [teamId, competition_id]);
    if (check.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Already joined this competition." });
    }

    await client.query('INSERT INTO team_competitions (team_id, competition_id) VALUES ($1, $2)', [teamId, competition_id]);
    await client.query('COMMIT');

    res.json({ message: "Joined successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ✅ [เพิ่ม] ถอนตัวจากการแข่งขัน
exports.leaveCompetition = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    const { competition_id } = req.body;

    const userRes = await client.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.status(400).json({ error: "You must create a team first." });

    await client.query('BEGIN');
    
    const check = await client.query('SELECT * FROM team_competitions WHERE team_id = $1 AND competition_id = $2', [teamId, competition_id]);
    if (check.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "You have not joined this competition." });
    }

    await client.query('DELETE FROM team_competitions WHERE team_id = $1 AND competition_id = $2', [teamId, competition_id]);
    await client.query('COMMIT');

    res.json({ message: "Left competition successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ✅ [เพิ่ม] Public: ดึงข้อมูลทีมทั้งหมดพร้อมนักกีฬา (สำหรับหน้า PublicTeams)
exports.getPublicTeamsList = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, 
             COALESCE(json_agg(p ORDER BY p.number ASC) FILTER (WHERE p.id IS NOT NULL), '[]') as players
      FROM teams t
      LEFT JOIN players p ON t.id = p.team_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Get Public Teams List Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] ลบทีมของตัวเอง (เจ้าหน้าที่ทีมลบเอง)
exports.deleteMyTeam = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    
    // 1. หา team_id ของ User
    const userRes = await client.query('SELECT team_id FROM users WHERE id = $1', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) {
      return res.status(400).json({ error: "You do not belong to any team." });
    }

    await client.query('BEGIN');

    // 2. ปลดทุกคนที่สังกัดทีมนี้ออก (รวมถึงตัวเอง)
    await client.query('UPDATE users SET team_id = NULL WHERE team_id = $1', [teamId]);

    // 3. ลบข้อมูลสมาชิกในทีม (Players, Staff)
    await client.query('DELETE FROM players WHERE team_id = $1', [teamId]);
    await client.query('DELETE FROM team_staff WHERE team_id = $1', [teamId]);

    // 4. ลบข้อมูลการสมัครแข่งขัน
    await client.query('DELETE FROM team_competitions WHERE team_id = $1', [teamId]);

    // 5. ค้นหาแมตช์ทั้งหมดที่ทีมนี้เกี่ยวข้อง เพื่อลบข้อมูลที่เชื่อมโยง
    const matchesRes = await client.query(
      'SELECT id FROM matches WHERE home_team_id = $1 OR away_team_id = $1',
      [teamId]
    );
    const matchIds = matchesRes.rows.map(m => m.id);

    if (matchIds.length > 0) {
      await client.query('DELETE FROM match_sets WHERE match_id = ANY($1)', [matchIds]);
      await client.query('DELETE FROM match_actions WHERE match_id = ANY($1)', [matchIds]);
      await client.query('DELETE FROM match_events WHERE match_id = ANY($1)', [matchIds]);
      await client.query('DELETE FROM match_lineups WHERE match_id = ANY($1)', [matchIds]);
      await client.query('DELETE FROM matches WHERE id = ANY($1)', [matchIds]);
    }

    // 6. ลบทีม
    await client.query('DELETE FROM teams WHERE id = $1', [teamId]);

    await client.query('COMMIT');
    res.json({ message: "Team and all associated data deleted successfully" });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error in deleteMyTeam:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};