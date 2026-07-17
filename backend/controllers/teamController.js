const db = require('../config/db');
const bcrypt = require('bcryptjs');

const getColumnName = (row) => row.column_name ?? row.COLUMN_NAME;

const normalizeDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).split('T')[0];
};

const normalizeTimeOnly = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : String(value);
};

const parseNullableInt = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return parseInt(val, 10);
};

const parseNullableString = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return val;
};

const parseNullablePersonName = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  const text = String(val).trim();
  if (!text || text === '0' || text === '-0' || /^\d+$/.test(text)) return null;
  return text;
};

const parsePositiveNullableInt = (val) => {
  const parsed = parseNullableInt(val);
  if (parsed === null || Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

const getOwnedTeamIds = async (userId) => {
  const result = await db.query(
    `SELECT id FROM teams WHERE user_id = ?
     UNION
     SELECT team_id AS id FROM users WHERE id = ? AND team_id IS NOT NULL`,
    [userId, userId]
  );
  return result.rows.map((team) => team.id).filter(Boolean);
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
    const teamRes = await db.query('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (teamRes.rows.length === 0) {
        // เพิ่ม log เพื่อดูว่าหา ID อะไรไม่เจอ
        console.log(`Searching for team ${teamId} but not found.`);
        return res.status(404).json({ error: 'Team not found' });
    }

    // 2. ดึงนักกีฬา
    const playersRes = await db.query(
      'SELECT * FROM players WHERE team_id = ? ORDER BY number ASC', 
      [teamId]
    );

    // 3. ดึงสตาฟ
    const staffRes = await db.query(
      'SELECT * FROM team_staff WHERE team_id = ? ORDER BY role ASC', 
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
    const {
      name,
      code,
      logo_url,
      coach,
      manager_name,
      phone,
      email,
      province,
      main_color,
      second_color,
      third_color,
      libero_main_color,
      libero_second_color,
      libero_third_color
    } = req.body;
    const userId = req.user.id; // ได้จาก authMiddleware

    if (!name || !code) {
      return res.status(400).json({ error: "Team name and code are required." });
    }

    await client.query('BEGIN');

    // 1. ตรวจสอบว่า User นี้มีทีมอยู่แล้วหรือยัง (เช็คจากตาราง teams โดยตรง)
    // 2. สร้างทีมใหม่ พร้อมใส่ user_id และ code
    const columnsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' AND table_schema = DATABASE()"
    );
    const columns = columnsRes.rows.map(getColumnName).filter(Boolean);
    const teamFields = [];
    const teamParams = [];

    const addTeamField = (field, value) => {
      if (columns.includes(field) && value !== undefined) {
        teamFields.push(field);
        teamParams.push(value || null);
      }
    };

    addTeamField('name', name);
    addTeamField('code', code);
    addTeamField('logo_url', logo_url);
    addTeamField('user_id', userId);
    addTeamField('coach', coach);
    addTeamField('manager_name', manager_name);
    addTeamField('phone', phone);
    addTeamField('email', email);
    addTeamField('province', province);
    addTeamField('main_color', main_color);
    addTeamField('second_color', second_color);
    addTeamField('third_color', third_color);
    addTeamField('libero_main_color', libero_main_color);
    addTeamField('libero_second_color', libero_second_color);
    addTeamField('libero_third_color', libero_third_color);

    const placeholders = teamParams.map(() => '?').join(', ');
    const newTeamRes = await client.query(
      `INSERT INTO teams (${teamFields.join(', ')}) VALUES (${placeholders})`,
      teamParams
    );
    const newTeamRow = await client.query('SELECT * FROM teams WHERE id = ?', [newTeamRes.insertId]);
    const newTeam = newTeamRow.rows[0];

    // 3. อัปเดต user ให้มี team_id ด้วย (เพื่อให้ง่ายต่อการเช็คฝั่ง User)
    await client.query('UPDATE users SET team_id = ? WHERE id = ?', [newTeam.id, userId]);

    // 4. เพิ่ม User คนนี้เป็น "Head Coach" หรือ "Manager" ในตาราง Staff ด้วย (Optional)
    // เพื่อให้เขามีชื่ออยู่ในระบบจัดการทีม
    let coachFirstName = '';
    let coachLastName = '';

    if (coach) {
      const nameParts = coach.trim().split(' ');
      coachFirstName = nameParts[0];
      coachLastName = nameParts.slice(1).join(' ') || '-';
    } else {
      const userDetails = await client.query('SELECT username FROM users WHERE id = ?', [userId]);
      coachFirstName = userDetails.rows[0].username;
      coachLastName = '(Manager)';
    }

    await client.query(
      'INSERT INTO team_staff (team_id, first_name, last_name, role) VALUES (?, ?, ?, ?)',
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

// [เพิ่ม] ดึงข้อมูลทีมของตัวเอง (ที่ User Login อยู่)
exports.getMyTeams = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(`
      SELECT
        t.*,
        CASE WHEN u.team_id = t.id THEN 1 ELSE 0 END AS is_active,
        COUNT(te.competition_id) AS competition_count,
        GROUP_CONCAT(c.title ORDER BY c.start_date DESC SEPARATOR ', ') AS competition_titles
      FROM teams t
      LEFT JOIN users u ON u.id = ?
      LEFT JOIN team_entries te ON te.team_id = t.id
      LEFT JOIN competitions c ON c.id = te.competition_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY is_active DESC, t.created_at ASC, t.id ASC
    `, [userId, userId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error in getMyTeams:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.switchMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const teamId = parseNullableInt(req.params.id || req.body.team_id);
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required.' });
    }

    const teamRes = await db.query('SELECT * FROM teams WHERE id = ? AND user_id = ?', [teamId, userId]);
    if (teamRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found for this user.' });
    }

    await db.query('UPDATE users SET team_id = ? WHERE id = ?', [teamId, userId]);
    res.json(teamRes.rows[0]);
  } catch (err) {
    console.error("Error switching team:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) {
      const ownedTeams = await db.query('SELECT * FROM teams WHERE user_id = ? ORDER BY id ASC LIMIT 1', [userId]);
      if (ownedTeams.rows.length > 0) {
        const fallbackTeam = ownedTeams.rows[0];
        await db.query('UPDATE users SET team_id = ? WHERE id = ?', [fallbackTeam.id, userId]);
        return res.json(fallbackTeam);
      }

      return res.status(400).json({ error: 'User has no team.' });
    }

    const teamRes = await db.query('SELECT * FROM teams WHERE id = ?', [teamId]);

    if (teamRes.rows.length === 0) {
      console.warn(`Data inconsistency found: User ${userId} has non-existent team_id ${teamId}. Resetting to NULL.`);
      await db.query('UPDATE users SET team_id = NULL WHERE id = ?', [userId]);
      return res.status(400).json({ error: 'Team data inconsistent. Please create a new team.' });
    }

    res.json(teamRes.rows[0]);

  } catch (err) {
    console.error("Error in getMyTeam:", err);
    res.status(500).json({ error: err.message });
  }
};

// [เพิ่ม] อัปเดตข้อมูลทีมของตัวเอง
exports.updateMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      code,
      logo_url,
      coach,
      manager_name,
      phone,
      email,
      province,
      main_color,
      second_color,
      third_color,
      libero_main_color,
      libero_second_color,
      libero_third_color
    } = req.body;

    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }

    const columnsRes = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' AND table_schema = DATABASE()"
    );
    const columns = columnsRes.rows.map(getColumnName).filter(Boolean);
    const updateFields = [];
    const updateValues = [];

    const addUpdateField = (field, value) => {
      if (columns.includes(field) && value !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(value || null);
      }
    };

    addUpdateField('name', name);
    addUpdateField('code', code);
    addUpdateField('logo_url', logo_url);
    addUpdateField('coach', coach);
    addUpdateField('manager_name', manager_name);
    addUpdateField('phone', phone);
    addUpdateField('email', email);
    addUpdateField('province', province);
    addUpdateField('main_color', main_color);
    addUpdateField('second_color', second_color);
    addUpdateField('third_color', third_color);
    addUpdateField('libero_main_color', libero_main_color);
    addUpdateField('libero_second_color', libero_second_color);
    addUpdateField('libero_third_color', libero_third_color);

    if (updateFields.length === 0) {
      const currentTeamRes = await db.query('SELECT * FROM teams WHERE id = ?', [teamId]);
      return res.json(currentTeamRes.rows[0]);
    }

    updateValues.push(teamId);
    await db.query(
      `UPDATE teams SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedTeamRes = await db.query('SELECT * FROM teams WHERE id = ?', [teamId]);
    res.json(updatedTeamRes.rows[0]);
  } catch (err) {
    console.error("Error updating team:", err);
    res.status(500).json({ error: err.message });
  }
};

// [เพิ่ม] Admin: สร้างทีมใหม่
exports.createTeam = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      name,
      code,
      logo_url,
      coach,
      manager_name,
      phone,
      email,
      province,
      username,
      password,
      create_account,
      status,
      main_color,
      second_color,
      third_color,
      libero_main_color,
      libero_second_color,
      libero_third_color
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: "Team name and code are required." });
    }
    if ((create_account || username || password) && (!username || !password)) {
      return res.status(400).json({ error: "Username and password are required when creating a team account." });
    }

    await client.query('BEGIN');

    let userId = null;
    if (username && password) {
      const userCheck = await client.query('SELECT id FROM users WHERE username = ?', [username]);
      if (userCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 8);
      const userResult = await client.query(
        'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, 'team_staff', status || 'approved']
      );
      userId = userResult.insertId;
    }

    const teamsColsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' AND table_schema = DATABASE()"
    );
    const teamsCols = teamsColsRes.rows.map(getColumnName).filter(Boolean);

    const teamFields = ['name', 'code'];
    const teamParams = [name, code];

    const addTeamField = (field, value) => {
      if (teamsCols.includes(field) && value !== undefined) {
        teamFields.push(field);
        teamParams.push(value || null);
      }
    };

    addTeamField('logo_url', logo_url);
    addTeamField('coach', coach);
    addTeamField('manager_name', manager_name);
    addTeamField('phone', phone);
    addTeamField('email', email);
    addTeamField('province', province);
    addTeamField('user_id', userId);
    addTeamField('main_color', main_color);
    addTeamField('second_color', second_color);
    addTeamField('third_color', third_color);
    addTeamField('libero_main_color', libero_main_color);
    addTeamField('libero_second_color', libero_second_color);
    addTeamField('libero_third_color', libero_third_color);

    const placeholders = teamParams.map(() => '?').join(', ');
    const newTeamRes = await client.query(
      `INSERT INTO teams (${teamFields.join(', ')}) VALUES (${placeholders})`,
      teamParams
    );

    if (userId) {
      await client.query('UPDATE users SET team_id = ? WHERE id = ?', [newTeamRes.insertId, userId]);
    }

    const newTeamRow = await client.query('SELECT * FROM teams WHERE id = ?', [newTeamRes.insertId]);
    const newUserRow = userId
      ? await client.query('SELECT id, username, role, status, team_id FROM users WHERE id = ?', [userId])
      : null;

    await client.query('COMMIT');
    res.status(201).json({
      team: newTeamRow.rows[0],
      user: newUserRow?.rows?.[0] || null
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating team (admin):", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// [เพิ่ม] Admin: อัปเดตข้อมูลทีม
exports.updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, logo_url } = req.body;
    await db.query(
      'UPDATE teams SET name = COALESCE(?, name), code = COALESCE(?, code), logo_url = COALESCE(?, logo_url) WHERE id = ?',
      [name, code, logo_url, id]
    );
    const updatedTeamRes = await db.query('SELECT * FROM teams WHERE id = ?', [id]);
    if (updatedTeamRes.rows.length === 0) return res.status(404).json({ error: "Team not found" });
    res.json(updatedTeamRes.rows[0]);
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
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }

    const teamId = userRes.rows[0].team_id;

    // 2. ดึงข้อมูล Staff ของทีมนั้น
    const staffRes = await db.query(
      'SELECT * FROM team_staff WHERE team_id = ? ORDER BY role ASC', 
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
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;

    // 4. บันทึกลงฐานข้อมูล (ใช้คอลัมน์ first_name, last_name ตาม DB จริง)
    const newStaff = await db.query(
      'INSERT INTO team_staff (team_id, first_name, last_name, role, gender) VALUES (?, ?, ?, ?, ?)',
      [teamId, dbFirstName, dbLastName, role, gender]
    );
    const insertedStaff = await db.query('SELECT * FROM team_staff WHERE id = ?', [newStaff.insertId]);

    res.status(201).json(insertedStaff.rows[0]);

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
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;

    // 2. ตรวจสอบว่า Staff คนนี้อยู่ในทีมของ User หรือไม่
    const staffCheck = await db.query('SELECT * FROM team_staff WHERE id = ? AND team_id = ?', [id, teamId]);
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
    await db.query(
      `UPDATE team_staff 
       SET first_name = ?, last_name = ?, role = ?, gender = ?
       WHERE id = ? AND team_id = ?`,
      [dbFirstName, dbLastName, role, gender, id, teamId]
    );
    const updatedStaff = await db.query('SELECT * FROM team_staff WHERE id = ? AND team_id = ?', [id, teamId]);

    res.json(updatedStaff.rows[0]);
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
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;

    // 2. ลบ Staff
    const result = await db.query(
      'DELETE FROM team_staff WHERE id = ? AND team_id = ?',
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
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    if (!userRes.rows[0]?.team_id) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }
    const teamId = userRes.rows[0].team_id;
    const playersRes = await db.query('SELECT * FROM players WHERE team_id = ? ORDER BY number ASC', [teamId]);
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
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.status(400).json({ error: "User has no team." });

    const { first_name, last_name, number, position, height_cm, weight, birth_date, is_captain, gender, nickname, nationality, photo, is_libero1, is_libero2 } = req.body;

    // Validation: number is required
    if (!number || number === '' || number === null || number === undefined) {
      return res.status(400).json({ error: 'Player number is required' });
    }

    // --- [เพิ่มส่วนนี้] Logic: ถ้าตั้งคนนี้เป็นกัปตัน ให้ปลดกัปตันคนเก่าออก ---
    if (is_captain === true || is_captain === 'true') {
        await db.query('UPDATE players SET is_captain = false WHERE team_id = ?', [teamId]);
    }
    // ----------------------------------------------------------------

    const cleanNumber = parseNullableInt(number);
    if (!cleanNumber || Number.isNaN(cleanNumber)) {
      return res.status(400).json({ error: 'Player number must be a valid number' });
    }

    const cleanHeight = parsePositiveNullableInt(height_cm);
    const cleanWeight = parsePositiveNullableInt(weight);
    const cleanBirthDate = parseNullableString(birth_date);
    const cleanIsCaptain = is_captain === true || is_captain === 'true';
    const cleanIsLibero1 = position === 'L' && (is_libero1 === true || is_libero1 === 'true');
    const cleanIsLibero2 = position === 'L' && (is_libero2 === true || is_libero2 === 'true');

    // --- [LOGIC ลิเบอโร่] ---
    if (cleanIsLibero1) {
        await db.query('UPDATE players SET is_libero1 = false WHERE team_id = ?', [teamId]);
    }
    if (cleanIsLibero2) {
        await db.query('UPDATE players SET is_libero2 = false WHERE team_id = ?', [teamId]);
    }
    // ---------------------

    const result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, number, position, height_cm, weight, birth_date, is_captain, gender, nickname, nationality, photo, is_libero1, is_libero2)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teamId,
        parseNullablePersonName(first_name),
        parseNullablePersonName(last_name),
        cleanNumber,
        parseNullableString(position),
        cleanHeight,
        cleanWeight,
        cleanBirthDate,
        cleanIsCaptain,
        parseNullableString(gender),
        parseNullablePersonName(nickname),
        parseNullableString(nationality),
        parseNullableString(photo),
        cleanIsLibero1,
        cleanIsLibero2
      ]
    );
    const insertedPlayer = await db.query('SELECT * FROM players WHERE id = ?', [result.insertId]);

    res.json(insertedPlayer.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, number, position, height_cm, weight, birth_date, is_captain, gender, nickname, nationality, photo, is_libero1, is_libero2, is_playing } = req.body;
    const userId = req.user.id;

    // Validation: number is required ONLY if being updated
    if (number !== undefined && (!number || number === '' || number === null)) {
      return res.status(400).json({ error: 'Player number is required' });
    }

    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const userTeamId = userRes.rows[0]?.team_id;
    if (!userTeamId) {
      return res.status(400).json({ error: 'You do not belong to any team.' });
    }

    const currentPlayerRes = await db.query('SELECT * FROM players WHERE id = ? AND team_id = ?', [id, userTeamId]);
    if (currentPlayerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found in your team.' });
    }

    const cleanIsLibero1 = position === 'L' && (is_libero1 === true || is_libero1 === 'true');
    const cleanIsLibero2 = position === 'L' && (is_libero2 === true || is_libero2 === 'true');

    // --- [LOGIC กัปตัน] --- Only run if is_captain is being updated
    if (is_captain !== undefined && (is_captain === true || is_captain === 'true')) {
        // 1. หา team_id ของนักกีฬาคนนี้ก่อน เพื่อจะได้รีเซ็ตถูกทีม
        const playerCheck = await db.query('SELECT team_id FROM players WHERE id = ?', [id]);
        
        if (playerCheck.rows.length > 0) {
            const teamId = playerCheck.rows[0].team_id;
            // 2. ปลดกัปตันทุกคนในทีมนี้ออก
            await db.query('UPDATE players SET is_captain = false WHERE team_id = ?', [teamId]);
        }
    }
    // ---------------------

    // --- [LOGIC ลิเบอโร่] --- Only run if position or libero flags are being updated
    if (position !== undefined && (is_libero1 !== undefined || is_libero2 !== undefined)) {
        const playerCheck = await db.query('SELECT team_id FROM players WHERE id = ?', [id]);
        if (playerCheck.rows.length > 0) {
            const teamId = playerCheck.rows[0].team_id;
            if (cleanIsLibero1) {
                await db.query('UPDATE players SET is_libero1 = false WHERE team_id = ?', [teamId]);
            }
            if (cleanIsLibero2) {
                await db.query('UPDATE players SET is_libero2 = false WHERE team_id = ?', [teamId]);
            }
        }
    }
    // ---------------------

    const cleanNumber = parseNullableInt(number);
    const cleanHeight = parsePositiveNullableInt(height_cm);
    const cleanWeight = parsePositiveNullableInt(weight);
    const cleanBirthDate = parseNullableString(birth_date);
    const cleanIsCaptain = is_captain !== undefined ? (is_captain === true || is_captain === 'true') : undefined;
    // Normalize is_playing reliably and log for debugging
    const cleanIsPlaying = is_playing !== undefined ? (String(is_playing) === 'true') : undefined;

    // Debug logging to trace toggle issues (remove in production)
    console.log(`[teamController.updatePlayer] id=${id} received is_playing=${is_playing} normalized=${cleanIsPlaying}`);

    // Build dynamic UPDATE query - only include fields that were provided
    const updateFields = [];
    const updateValues = [];
    
    if (number !== undefined && (!cleanNumber || Number.isNaN(cleanNumber))) {
      return res.status(400).json({ error: 'Player number must be a valid number' });
    }

    if (number !== undefined) {
      const duplicateEntryNumbers = await db.query(`
        SELECT te.id, c.title, ag.name as age_group_name, c.gender
        FROM team_entry_players own
        JOIN team_entries te ON te.id = own.team_entry_id
        JOIN competitions c ON c.id = te.competition_id
        LEFT JOIN age_groups ag ON ag.id = te.age_group_id
        JOIN team_entry_players other
          ON other.team_entry_id = own.team_entry_id
         AND other.player_id <> own.player_id
         AND other.number = ?
        WHERE own.player_id = ?
      `, [cleanNumber, id]);

      if (duplicateEntryNumbers.rows.length > 0) {
        return res.status(400).json({
          error: 'Player number is already used in one or more registered category/age rosters.'
        });
      }
    }

    if (first_name !== undefined) { updateFields.push('first_name=?'); updateValues.push(parseNullablePersonName(first_name)); }
    if (last_name !== undefined) { updateFields.push('last_name=?'); updateValues.push(parseNullablePersonName(last_name)); }
    if (number !== undefined) { updateFields.push('number=?'); updateValues.push(cleanNumber); }
    if (position !== undefined) { updateFields.push('position=?'); updateValues.push(parseNullableString(position)); }
    if (height_cm !== undefined) { updateFields.push('height_cm=?'); updateValues.push(cleanHeight); }
    if (weight !== undefined) { updateFields.push('weight=?'); updateValues.push(cleanWeight); }
    if (birth_date !== undefined) { updateFields.push('birth_date=?'); updateValues.push(cleanBirthDate); }
    if (is_captain !== undefined) { updateFields.push('is_captain=?'); updateValues.push(cleanIsCaptain); }
    if (gender !== undefined) { updateFields.push('gender=?'); updateValues.push(parseNullableString(gender)); }
    if (nickname !== undefined) { updateFields.push('nickname=?'); updateValues.push(parseNullablePersonName(nickname)); }
    if (nationality !== undefined) { updateFields.push('nationality=?'); updateValues.push(parseNullableString(nationality)); }
    if (photo !== undefined) { updateFields.push('photo=?'); updateValues.push(parseNullableString(photo)); }
    if (is_libero1 !== undefined) { updateFields.push('is_libero1=?'); updateValues.push(cleanIsLibero1); }
    if (is_libero2 !== undefined) { updateFields.push('is_libero2=?'); updateValues.push(cleanIsLibero2); }
    if (is_playing !== undefined) { updateFields.push('is_playing=?'); updateValues.push(cleanIsPlaying); }

    if (updateFields.length > 0) {
      console.log(`[teamController.updatePlayer] id=${id} updateFields=${updateFields.join(', ')} updateValues=${JSON.stringify(updateValues)}`);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    updateValues.push(id);
    const result = await db.query(
      `UPDATE players SET ${updateFields.join(', ')} WHERE id=?`,
      updateValues
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Player not found" });
    }

    if (number !== undefined) {
      await db.query('UPDATE team_entry_players SET number = ? WHERE player_id = ?', [cleanNumber, id]);
    }

    const updatedPlayer = await db.query('SELECT * FROM players WHERE id = ?', [id]);
    if (updatedPlayer.rows.length === 0) return res.status(404).json({ error: "Player not found" });

    res.json(updatedPlayer.rows[0]);
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

    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;
    if (!teamId) {
      return res.status(403).json({ error: "User does not belong to a team." });
    }

    const { rowCount } = await db.query('DELETE FROM players WHERE id = ? AND team_id = ?', [playerId, teamId]);
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

// [เพิ่ม] ลบทีม (ระวัง! การลบทีมควรลบ Players ที่สังกัดทีมนั้นด้วย -> ตั้งค่า CASCADE ใน DB หรือยัง?)
exports.getAllTeamEntries = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        te.id as team_entry_id,
        te.team_id,
        te.competition_id,
        te.display_name as entry_display_name,
        te.gender as entry_gender,
        te.age_group_id as entry_age_group_id,
        te.status as registration_status,
        te.registered_at,
        t.name as team_name,
        t.code as team_code,
        t.logo_url,
        t.manager_name,
        t.coach,
        t.phone,
        t.email,
        c.title as competition_title,
        c.sport,
        c.gender as competition_gender,
        ag.name as age_group_name,
        COUNT(tep.player_id) as player_count
      FROM team_entries te
      JOIN teams t ON t.id = te.team_id
      JOIN competitions c ON c.id = te.competition_id
      LEFT JOIN age_groups ag ON ag.id = te.age_group_id
      LEFT JOIN team_entry_players tep ON tep.team_entry_id = te.id
      GROUP BY
        te.id, te.team_id, te.competition_id, te.display_name, te.gender,
        te.age_group_id, te.status, te.registered_at, t.name, t.code,
        t.logo_url, t.manager_name, t.coach, t.phone, t.email,
        c.title, c.sport, c.gender, ag.name
      ORDER BY c.title ASC, ag.name ASC, te.gender ASC, t.name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Get All Team Entries Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateTeamEntryStatus = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { entryId } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['pending', 'approved', 'rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid registration status' });
    }

    await client.query('BEGIN');

    const entryRes = await client.query(
      'SELECT team_id, competition_id FROM team_entries WHERE id = ?',
      [entryId]
    );

    if (entryRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Team registration not found' });
    }

    const entry = entryRes.rows[0];

    await client.query(
      'UPDATE team_entries SET status = ? WHERE id = ?',
      [status, entryId]
    );

    await client.query(
      'UPDATE team_competitions SET status = ? WHERE team_id = ? AND competition_id = ?',
      [status, entry.team_id, entry.competition_id]
    );

    const updatedEntry = await client.query(
      'SELECT id, team_id, competition_id, status FROM team_entries WHERE id = ?',
      [entryId]
    );

    await client.query('COMMIT');
    res.json({
      message: 'Registration status updated',
      entry: updatedEntry.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Update Team Entry Status Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.deleteTeam = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');

    // 1. ปลด User ออกจากทีมก่อน (สำคัญมาก เพราะติด FK users.team_id -> teams.id)
    await client.query('UPDATE users SET team_id = NULL WHERE team_id = ?', [id]);

    // 2. ลบข้อมูลสมาชิกในทีม (Players, Staff)
    await client.query('DELETE FROM players WHERE team_id = ?', [id]);
    await client.query('DELETE FROM team_staff WHERE team_id = ?', [id]);

    // 3. ลบข้อมูลการสมัครแข่งขัน
    await client.query('DELETE FROM team_competitions WHERE team_id = ?', [id]);

    // 4. ค้นหาแมตช์ทั้งหมดที่ทีมนี้เกี่ยวข้อง เพื่อลบข้อมูลที่เชื่อมโยง (Sets, Actions, Events, Lineups)
    const matchesRes = await client.query(
      'SELECT id FROM matches WHERE home_team_id = ? OR away_team_id = ?',
      [id]
    );
    const matchIds = matchesRes.rows.map(m => m.id);

    if (matchIds.length > 0) {
      const matchIdPlaceholders = matchIds.map(() => '?').join(',');
      // ลบข้อมูลรายเซต, สถิติ, และรายชื่อผู้เล่นในแต่ละแมตช์
      await client.query(`DELETE FROM match_sets WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      await client.query(`DELETE FROM match_actions WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      await client.query(`DELETE FROM match_events WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      await client.query(`DELETE FROM match_lineups WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      
      // ลบแมตช์จริง
      await client.query(`DELETE FROM matches WHERE id IN (${matchIdPlaceholders})`, matchIds);
    }

    // 5. ลบทีม
    const result = await client.query('DELETE FROM teams WHERE id = ?', [id]);

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
      'SELECT * FROM players WHERE team_id = ? ORDER BY number ASC', 
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
      'SELECT * FROM team_staff WHERE team_id = ? ORDER BY role ASC', 
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching staff by team:", err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
};

// [เพิ่ม] ดึงรายการแข่งขันที่เปิดรับสมัคร (Open)
exports.getOpenCompetitions = async (req, res) => {
  try {
    // สมมติว่าตารางชื่อ competitions และมี column status
    const result = await db.query("SELECT * FROM competitions WHERE status = 'open' ORDER BY start_date ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [เพิ่ม] ดึงรายการแข่งขันที่ทีมตัวเองเข้าร่วม
exports.getMyCompetitions = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.json([]); // ยังไม่มีทีม ก็ยังไม่มีรายการแข่ง

    const result = await db.query(`
        SELECT c.*, tc.created_at as joined_at
        FROM competitions c
        JOIN team_competitions tc ON c.id = tc.competition_id
        WHERE tc.team_id = ?
        ORDER BY c.start_date DESC
    `, [teamId]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [เพิ่ม] ดึงสถิติผู้เล่นทั้งหมดในทีม
exports.getMyPlayersStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const userRes = await db.query('SELECT team_id FROM users WHERE id = ?', [userId]);
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
                SUM(CASE WHEN skill = 'A' AND grade = '#' THEN 1 ELSE 0 END) as attack_kills,
                SUM(CASE WHEN skill = 'A' AND grade = '=' THEN 1 ELSE 0 END) as attack_errors,
                SUM(CASE WHEN skill = 'A' THEN 1 ELSE 0 END) as attack_attempts,
                SUM(CASE WHEN skill = 'B' AND grade = '#' THEN 1 ELSE 0 END) as block_points,
                SUM(CASE WHEN skill = 'S' AND grade = '#' THEN 1 ELSE 0 END) as serve_aces,
                SUM(CASE WHEN skill = 'S' AND grade = '=' THEN 1 ELSE 0 END) as serve_errors,
                SUM(CASE WHEN skill = 'D' THEN 1 ELSE 0 END) as digs,
                SUM(CASE WHEN skill = 'R' THEN 1 ELSE 0 END) as receptions
            FROM match_actions
            GROUP BY player_id
        ) s ON p.id = s.player_id
        WHERE p.team_id = ?
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

// [เพิ่ม] สมัครเข้าร่วมการแข่งขัน
exports.joinCompetition = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    const { competition_id } = req.body;

    const userRes = await client.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.status(400).json({ error: "You must create a team first." });

    await client.query('BEGIN');
    // ตรวจสอบว่าสมัครไปหรือยัง
    const check = await client.query('SELECT * FROM team_competitions WHERE team_id = ? AND competition_id = ?', [teamId, competition_id]);
    if (check.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Already joined this competition." });
    }

    await client.query('INSERT INTO team_competitions (team_id, competition_id) VALUES (?, ?)', [teamId, competition_id]);
    await client.query('COMMIT');

    res.json({ message: "Joined successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// [เพิ่ม] ถอนตัวจากการแข่งขัน
exports.leaveCompetition = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    const { competition_id } = req.body;

    const userRes = await client.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) return res.status(400).json({ error: "You must create a team first." });

    await client.query('BEGIN');
    
    const check = await client.query('SELECT * FROM team_competitions WHERE team_id = ? AND competition_id = ?', [teamId, competition_id]);
    if (check.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "You have not joined this competition." });
    }

    await client.query('DELETE FROM team_competitions WHERE team_id = ? AND competition_id = ?', [teamId, competition_id]);
    await client.query('COMMIT');

    res.json({ message: "Left competition successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// [เพิ่ม] Public: ดึงข้อมูลทีมทั้งหมดพร้อมนักกีฬา (สำหรับหน้า PublicTeams)
exports.getPublicTeamsList = async (req, res) => {
  try {
    const teamsRes = await db.query('SELECT * FROM teams ORDER BY name ASC');
    const playersRes = await db.query('SELECT * FROM players ORDER BY team_id ASC, number ASC');

    const playersByTeam = playersRes.rows.reduce((acc, player) => {
      if (!acc[player.team_id]) acc[player.team_id] = [];
      acc[player.team_id].push(player);
      return acc;
    }, {});

    const teams = teamsRes.rows.map((team) => ({
      ...team,
      players: playersByTeam[team.id] || []
    }));

    res.json(teams);
  } catch (err) {
    console.error("Get Public Teams List Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// [เพิ่ม] ลบทีมของตัวเอง (เจ้าหน้าที่ทีมลบเอง)
exports.deleteMyTeam = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    
    // 1. หา team_id ของ User
    const userRes = await client.query('SELECT team_id FROM users WHERE id = ?', [userId]);
    const teamId = userRes.rows[0]?.team_id;

    if (!teamId) {
      return res.status(400).json({ error: "You do not belong to any team." });
    }

    await client.query('BEGIN');

    // 2. ปลดทุกคนที่สังกัดทีมนี้ออก (รวมถึงตัวเอง)
    await client.query('UPDATE users SET team_id = NULL WHERE team_id = ?', [teamId]);

    // 3. ลบข้อมูลสมาชิกในทีม (Players, Staff)
    await client.query('DELETE FROM players WHERE team_id = ?', [teamId]);
    await client.query('DELETE FROM team_staff WHERE team_id = ?', [teamId]);

    // 4. ลบข้อมูลการสมัครแข่งขัน
    await client.query('DELETE FROM team_competitions WHERE team_id = ?', [teamId]);

    // 5. ค้นหาแมตช์ทั้งหมดที่ทีมนี้เกี่ยวข้อง เพื่อลบข้อมูลที่เชื่อมโยง
    const matchesRes = await client.query(
      'SELECT id FROM matches WHERE home_team_id = ? OR away_team_id = ?',
      [teamId]
    );
    const matchIds = matchesRes.rows.map(m => m.id);

    if (matchIds.length > 0) {
      const matchIdPlaceholders = matchIds.map(() => '?').join(',');
      await client.query(`DELETE FROM match_sets WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      await client.query(`DELETE FROM match_actions WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      await client.query(`DELETE FROM match_events WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      await client.query(`DELETE FROM match_lineups WHERE match_id IN (${matchIdPlaceholders})`, matchIds);
      await client.query(`DELETE FROM matches WHERE id IN (${matchIdPlaceholders})`, matchIds);
    }

    // 6. ลบทีม
    await client.query('DELETE FROM teams WHERE id = ?', [teamId]);

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

// [เพิ่ม] ดึงรายการแข่งขัน (Matches) ของทีมตัวเอง
exports.getMyMatches = async (req, res) => {
  try {
    const userId = req.user.id;
    const teamIds = await getOwnedTeamIds(userId);

    if (teamIds.length === 0) {
      return res.json([]);
    }
    const placeholders = teamIds.map(() => '?').join(',');

    const result = await db.query(`
        SELECT 
            m.id, m.competition_id, c.title as competition_name, m.round_name, m.match_date, m.start_time, m.location, m.status,
            m.match_number, m.pool_name, COALESCE(m.gender, c.gender) as gender,
            COALESCE(m.age_group_id, c.age_group_id) as age_group_id,
            ag.name as age_group_name,
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
        LEFT JOIN age_groups ag ON ag.id = COALESCE(m.age_group_id, c.age_group_id)
        WHERE m.home_team_id IN (${placeholders}) OR m.away_team_id IN (${placeholders})
        ORDER BY IF(m.match_date IS NULL, 1, 0), m.match_date ASC,
                 IF(m.start_time IS NULL, 1, 0), m.start_time ASC, m.id ASC
    `, [...teamIds, ...teamIds]);

    const normalizedRows = result.rows.map(row => ({
        ...row,
        match_date: normalizeDateOnly(row.match_date),
        start_time: normalizeTimeOnly(row.start_time),
        status: row.status ? row.status.toLowerCase() : row.status
    }));

    res.json(normalizedRows);
  } catch (err) {
    console.error("Get My Matches Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// [เพิ่ม] ดึงข้อมูลแข่งขัน ตามประเภทเพศ (หญิง/ชาย)
exports.getMyMatchesByGender = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gender } = req.params; // 'female' or 'male'

    if (!gender || !['female', 'male'].includes(gender.toLowerCase())) {
      return res.status(400).json({ error: 'Gender must be either female or male' });
    }

    const teamIds = await getOwnedTeamIds(userId);
    if (teamIds.length === 0) {
      return res.json([]);
    }
    const placeholders = teamIds.map(() => '?').join(',');

    const result = await db.query(`
        SELECT 
            m.id, m.competition_id, c.title as competition_name, m.round_name, m.match_date, m.start_time, m.location, m.status,
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
        WHERE (m.home_team_id IN (${placeholders}) OR m.away_team_id IN (${placeholders})) AND m.gender = ?
        ORDER BY IF(m.match_date IS NULL, 1, 0), m.match_date ASC,
                 IF(m.start_time IS NULL, 1, 0), m.start_time ASC, m.id ASC
    `, [...teamIds, ...teamIds, gender.toLowerCase()]);

    const normalizedRows = result.rows.map(row => ({
        ...row,
        match_date: normalizeDateOnly(row.match_date),
        start_time: normalizeTimeOnly(row.start_time),
        status: row.status ? row.status.toLowerCase() : row.status
    }));

    res.json(normalizedRows);
  } catch (err) {
    console.error("Get My Matches By Gender Error:", err);
    res.status(500).json({ error: err.message });
  }
};

