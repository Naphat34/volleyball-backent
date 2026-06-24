exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query('SELECT id, username, role, status, team_id FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || 'mySuperSecretKey123';

// 1. ลงทะเบียน (Register)
exports.register = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { username, password, role, name, code, coach } = req.body;

    // ตรวจสอบว่ามี Username นี้ในระบบหรือยัง
    const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 8);
    const initialStatus = role === 'admin' ? 'approved' : 'pending';

    await client.query('BEGIN');

    // ตรวจสอบว่ามีคอลัมน์ email / phone ในตาราง users หรือไม่
    const usersColsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    );
    const usersCols = usersColsRes.rows.map(r => r.column_name);

    let userFields = ['username', 'password_hash', 'role', 'status'];
    let userParams = [username, hashedPassword, role, initialStatus];
    
    if (usersCols.includes('email') && req.body.email) {
      userFields.push('email');
      userParams.push(req.body.email);
    }
    if (usersCols.includes('phone') && req.body.phone) {
      userFields.push('phone');
      userParams.push(req.body.phone);
    }

    const userPlaceholders = userParams.map((_, i) => `$${i + 1}`).join(', ');
    const userInsertQuery = `INSERT INTO users (${userFields.join(', ')}) VALUES (${userPlaceholders}) RETURNING id, username, role, status`;
    
    const userResult = await client.query(userInsertQuery, userParams);
    const user = userResult.rows[0];

    // ถ้าเป็น team_staff และมีชื่อทีมและรหัสทีมส่งเข้ามา ให้ทำการสร้างทีมและเชื่อมโยงทันที
    if (role === 'team_staff' && name && code) {
      const teamsColsRes = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'teams'"
      );
      const teamsCols = teamsColsRes.rows.map(r => r.column_name);

      let teamFields = ['name', 'code', 'user_id', 'coach'];
      let teamParams = [name, code, user.id, coach || null];

      if (teamsCols.includes('phone') && req.body.phone) {
        teamFields.push('phone');
        teamParams.push(req.body.phone);
      }
      if (teamsCols.includes('email') && req.body.email) {
        teamFields.push('email');
        teamParams.push(req.body.email);
      }
      if (teamsCols.includes('province') && req.body.province) {
        teamFields.push('province');
        teamParams.push(req.body.province);
      }
      if (teamsCols.includes('category') && req.body.category) {
        teamFields.push('category');
        teamParams.push(req.body.category);
      }
      if (teamsCols.includes('manager_name') && req.body.manager_name) {
        teamFields.push('manager_name');
        teamParams.push(req.body.manager_name);
      }

      const teamPlaceholders = teamParams.map((_, i) => `$${i + 1}`).join(', ');
      const teamInsertQuery = `INSERT INTO teams (${teamFields.join(', ')}) VALUES (${teamPlaceholders}) RETURNING id`;
      
      const teamResult = await client.query(teamInsertQuery, teamParams);
      const team = teamResult.rows[0];

      // อัปเดต user ให้มี team_id ชี้ไปยังทีมที่สร้างใหม่
      await client.query('UPDATE users SET team_id = $1 WHERE id = $2', [team.id, user.id]);
      user.team_id = team.id;
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'User registered successfully',
      user: user
    });
  } catch (err) {
    console.error("Register Error:", err);
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error("Rollback Error:", rollbackErr);
      }
    }
    res.status(500).json({ error: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// 2. ล็อกอิน (Login)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // ดึงข้อมูล User รวมถึงสถานะและ Team ID
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1', 
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // สร้าง Token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        team_id: user.team_id
      },
       SECRET_KEY,
      { expiresIn: '2d' }
    );

   // ส่งข้อมูลกลับไปให้ Frontend ตัดสินใจ Routing
    res.json({
  message: "Login successful",
  token: token,
  user: {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    team_id: user.team_id
  }
});

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ฟังก์ชัน Logout (เพื่อล้าง Cookie)
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.clearCookie('role');
  res.json({ message: 'Logged out successfully' });
};

// 3. Admin อนุมัติ User (Approve)
exports.approveUser = async (req, res) => {
  try {
    const { userId, id, status } = req.body; // รับค่า status มาด้วย (เผื่อจะแก้เป็น rejected)
    const targetId = userId || id; // รองรับทั้ง userId และ id

    // ถ้าไม่ส่ง status มา ให้ default เป็น 'approved'
    const newStatus = status || 'approved';

    await db.query('UPDATE users SET status = $1 WHERE id = $2', [newStatus, targetId]);
    res.json({ message: `User ID ${targetId} is now ${newStatus}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. ดึงรายชื่อคนรออนุมัติ
exports.getPendingUsers = async (req, res) => {
  try {
    // เช็คว่ามีคอลัมน์ email ในตาราง users หรือไม่
    const usersColsRes = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    );
    const usersCols = usersColsRes.rows.map(r => r.column_name);

    let emailSelect = '';
    if (usersCols.includes('email')) {
      emailSelect = ', u.email';
    }

    // ดึงรายชื่อผู้ใช้ที่รออนุมัติ พร้อมชื่อทีมและอีเมล
    const query = `
      SELECT u.id, u.username, u.role, u.status, u.created_at, t.name${emailSelect}
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.status = 'pending' AND u.role != 'admin'
      ORDER BY u.created_at DESC
    `;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] ดึง User ทั้งหมด (ไม่เกี่ยงว่า Approve หรือยัง)
exports.getAllUsers = async (req, res) => {
  try {
    const result = await db.query(`
        SELECT u.id, u.username, u.role, u.status, u.created_at, t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        ORDER BY u.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] Admin: สร้าง User ใหม่ (กำหนด Role/Status ได้เลย)
exports.createUser = async (req, res) => {
  try {
    const { username, password, role, status } = req.body;
    
    // เช็คว่ามี username ซ้ำไหม
    const check = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 8);
    const result = await db.query(
      'INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, username, role, status',
      [username, hashedPassword, role, status || 'active']
    );

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ [เพิ่ม] ลบ User (เช่น ไล่คนออก หรือลบ Account ผี)
exports.deleteUser = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');

    // 1. ปลด User ออกจากการเป็นเจ้าของทีม (ถ้ามี) เพื่อป้องกัน Error FK
    await client.query('UPDATE teams SET user_id = NULL WHERE user_id = $1', [id]);

    // 2. ลบ User
    const result = await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ✅ [เพิ่ม] แก้ไขข้อมูล User
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, status } = req.body;

    // 1. ตรวจสอบว่า User มีอยู่จริงไหม
    const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. สร้าง Query แบบ Dynamic (เพราะ password อาจจะไม่แก้)
    let fields = [];
    let values = [];
    let index = 1;

    if (username) {
      fields.push(`username = $${index++}`);
      values.push(username);
    }
    if (role) {
      fields.push(`role = $${index++}`);
      values.push(role);
    }
    if (status) {
      fields.push(`status = $${index++}`);
      values.push(status);
    }
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 8);
      fields.push(`password_hash = $${index++}`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // เพิ่ม ID เป็น parameter สุดท้าย
    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${index} RETURNING id, username, role, status`;

    const result = await db.query(query, values);

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
