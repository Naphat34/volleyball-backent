const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { getAuthCookieOptions, getJwtSecret } = require('../config/security');
const { writeAuditLog } = require('../utils/auditLogger');
const { normalizeTeamGender } = require('../utils/teamGender');

const SECRET_KEY = getJwtSecret();
const PUBLIC_REGISTER_ROLE = 'team_staff';
const getColumnName = (row) => row.column_name ?? row.COLUMN_NAME;
const ACTIVE_STATUSES = new Set(['active']);
const normalizeAccountStatus = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  return normalizedStatus === 'approved' ? 'active' : normalizedStatus;
};
const ADMIN_MANAGED_ROLES = new Set([
  'admin', 'organizer', 'team_staff', 'staff', 'user', 'score', 'scorer', 'statistician', 'referee'
]);
const ADMIN_MANAGED_STATUSES = new Set(['active', 'pending', 'inactive', 'banned']);

const getOfficialKind = (role) => {
  if (['score', 'scorer', 'statistician'].includes(role)) return 'scorer';
  if (role === 'referee') return 'referee';
  return null;
};

const cleanOfficialProfile = (body = {}) => ({
  firstname: String(body.firstname || '').trim(),
  lastname: String(body.lastname || '').trim(),
  country: String(body.country || '').trim() || null,
  code: String(body.code || '').trim() || null,
});

const insertOfficialProfile = async (client, kind, userId, profile) => {
  if (kind === 'referee') {
    return client.query(
      'INSERT INTO referees (firstname, lastname, country, code, user_id) VALUES (?, ?, ?, ?, ?)',
      [profile.firstname, profile.lastname, profile.country, profile.code, userId]
    );
  }
  return client.query(
    'INSERT INTO scorers (firstname, lastname, country, user_id) VALUES (?, ?, ?, ?)',
    [profile.firstname, profile.lastname, profile.country, userId]
  );
};

const getOfficialProfile = async (client, kind, userId) => {
  if (!kind) return null;
  const result = await client.query(
    `SELECT * FROM ${kind === 'referee' ? 'referees' : 'scorers'} WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

const getUsersColumns = async (client = db) => {
  const result = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = DATABASE()"
  );
  return new Set(result.rows.map((row) => row.column_name));
};

const buildSafeUserSelect = (columns) => {
  const optionalFields = [];
  if (columns.has('email')) optionalFields.push('email');
  if (columns.has('phone')) optionalFields.push('phone');
  return ['id', 'username', 'role', 'status', 'team_id', ...optionalFields].join(', ');
};

const buildAuthToken = (user) => jwt.sign(
  {
    id: user.id,
    username: user.username,
    role: user.role,
    team_id: user.team_id
  },
  SECRET_KEY,
  { expiresIn: '2d' }
);

const sendUserWithToken = (res, user, message = 'User updated successfully') => {
  const token = buildAuthToken(user);
  res.cookie('token', token, getAuthCookieOptions());
  return res.json({ message, token, user });
};

exports.getMe = async (req, res) => {
  try {
    const columns = await getUsersColumns();
    const selectFields = buildSafeUserSelect(columns);
    const result = await db.query(
      `SELECT ${selectFields} FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const columns = await getUsersColumns();
    const missingContactColumns = ['email', 'phone'].filter(
      (field) => req.body[field] !== undefined && !columns.has(field)
    );
    if (missingContactColumns.length > 0) {
      return res.status(503).json({
        error: `Account contact fields are unavailable. Apply the user contact migration first (${missingContactColumns.join(', ')}).`
      });
    }
    const allowedFields = ['username', 'email', 'phone'].filter((field) => field === 'username' || columns.has(field));
    const updates = [];
    const values = [];

    if (req.body.username !== undefined) {
      const username = String(req.body.username || '').trim();
      if (!username) return res.status(400).json({ error: 'Username is required' });

      const existing = await db.query(
        'SELECT id FROM users WHERE username = ? AND id <> ?',
        [username, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      updates.push('username = ?');
      values.push(username);
    }

    for (const field of allowedFields.filter((item) => item !== 'username')) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(String(req.body[field] || '').trim() || null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const selectFields = buildSafeUserSelect(columns);
    const updatedUser = await db.query(`SELECT ${selectFields} FROM users WHERE id = ?`, [userId]);
    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await writeAuditLog(req, 'user.profile_update', 'user', userId, {
      fields: updates.map((field) => field.split('=')[0].trim())
    });

    return sendUserWithToken(res, updatedUser.rows[0]);
  } catch (err) {
    console.error("Update Me Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.changeMyPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'Password confirmation does not match' });
    }

    const userResult = await db.query(
      'SELECT id, username, password_hash FROM users WHERE id = ?',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentPasswordMatches = await bcrypt.compare(current_password, user.password_hash);
    if (!currentPasswordMatches) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const samePassword = await bcrypt.compare(new_password, user.password_hash);
    if (samePassword) {
      return res.status(400).json({ error: 'New password must be different from the current password' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 8);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

    await writeAuditLog(req, 'user.password_change', 'user', userId, {});

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 1. ลงทะเบียน (Register)
exports.register = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { username, password, name } = req.body;
    const code = String(req.body.code || '').trim().toUpperCase();
    const role = PUBLIC_REGISTER_ROLE;
    const teamGender = normalizeTeamGender(req.body.gender || req.body.category);
    if (!name || !code) return res.status(400).json({ error: 'Team name and team code are required.' });
    if (!teamGender) return res.status(400).json({ error: 'Select one team type: Male or Female.' });

    const requiredRegistrationFields = [
      ['manager_name', 'Manager name is required.'],
      ['email', 'Email is required.'],
      ['mobile_phone', 'Mobile phone is required.'],
      ['province', 'Team province is required.'],
      ['district', 'Team district is required.'],
      ['address_number', 'Contact address is required.'],
      ['address_province', 'Contact province is required.'],
      ['address_district', 'Contact district is required.'],
      ['subdistrict', 'Contact subdistrict is required.'],
      ['postal_code', 'Postal code is required.']
    ];
    for (const [field, message] of requiredRegistrationFields) {
      if (typeof req.body[field] !== 'string' || !req.body[field].trim()) {
        return res.status(400).json({ error: message });
      }
    }

    // ตรวจสอบว่ามี Username นี้ในระบบหรือยัง
    const userCheck = await client.query('SELECT id FROM users WHERE username = ?', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 8);
    const initialStatus = 'pending';

    await client.query('BEGIN');

    const existingTeamCode = await client.query('SELECT id FROM teams WHERE code = ? LIMIT 1', [code]);
    if (existingTeamCode.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Team code is already in use. Please choose another code.' });
    }

    // ตรวจสอบว่ามีคอลัมน์ email / phone ในตาราง users หรือไม่
    const usersColsRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = DATABASE()"
    );
    const usersCols = new Set(usersColsRes.rows.map(getColumnName).filter(Boolean));

    let userFields = ['username', 'password_hash', 'role', 'status'];
    let userParams = [username, hashedPassword, role, initialStatus];
    
    if (usersCols.has('email')) {
      userFields.push('email');
      userParams.push(req.body.email.trim());
    }
    const mobilePhone = String(req.body.mobile_phone || req.body.phone || '').trim();
    if (usersCols.has('phone')) {
      userFields.push('phone');
      userParams.push(mobilePhone);
    }

    const userPlaceholders = userParams.map(() => '?').join(', ');
    const userInsertQuery = `INSERT INTO users (${userFields.join(', ')}) VALUES (${userPlaceholders})`;
    
    const userResult = await client.query(userInsertQuery, userParams);
    const userRow = await client.query('SELECT id, username, role, status FROM users WHERE id = ?', [userResult.insertId]);
    const user = userRow.rows[0];

    // ถ้าเป็น team_staff และมีชื่อทีมและรหัสทีมส่งเข้ามา ให้ทำการสร้างทีมและเชื่อมโยงทันที
    if (role === 'team_staff' && name && code) {
      const teamsColsRes = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' AND table_schema = DATABASE()"
      );
      const teamsCols = new Set(teamsColsRes.rows.map(getColumnName).filter(Boolean));

      const requiredTeamColumns = [
        'name', 'code', 'user_id', 'gender', 'manager_name', 'email', 'logo_url', 'province', 'district',
        'office_phone', 'mobile_phone', 'fax', 'line_id', 'address_number', 'building', 'moo',
        'soi', 'road', 'address_province', 'address_district', 'subdistrict', 'postal_code'
      ];
      const missingTeamColumns = requiredTeamColumns.filter((column) => !teamsCols.has(column));
      if (missingTeamColumns.length) {
        throw new Error(`Team registration database schema is missing required columns: ${missingTeamColumns.join(', ')}. Apply the team registration migrations before accepting registrations.`);
      }

      let teamFields = ['name', 'code', 'user_id', 'gender', 'manager_name', 'logo_url', 'province', 'district', 'mobile_phone', 'address_number', 'address_province', 'address_district', 'subdistrict', 'postal_code'];
      let teamParams = [
        name.trim(), code, user.id, teamGender, req.body.manager_name.trim(), req.body.logo_url || null,
        req.body.province.trim(), req.body.district.trim(), mobilePhone,
        req.body.address_number.trim(), req.body.address_province.trim(),
        req.body.address_district.trim(), req.body.subdistrict.trim(), req.body.postal_code.trim()
      ];

      if (teamsCols.has('coach')) {
        teamFields.push('coach');
        teamParams.push(req.body.coach || null);
      }
      if (teamsCols.has('phone')) {
        teamFields.push('phone');
        teamParams.push(mobilePhone);
      }
      if (teamsCols.has('email')) {
        teamFields.push('email');
        teamParams.push(req.body.email.trim());
      }
      if (teamsCols.has('category') && req.body.category) {
        teamFields.push('category');
        teamParams.push(req.body.category);
      }
      const registrationTeamFields = ['office_phone', 'fax', 'line_id', 'building', 'moo', 'soi', 'road'];
      for (const field of registrationTeamFields) {
        if (teamsCols.has(field) && req.body[field] !== undefined && req.body[field] !== '') {
          teamFields.push(field);
          teamParams.push(typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field]);
        }
      }

      const teamPlaceholders = teamParams.map(() => '?').join(', ');
      const teamInsertQuery = `INSERT INTO teams (${teamFields.join(', ')}) VALUES (${teamPlaceholders})`;
      
      const teamResult = await client.query(teamInsertQuery, teamParams);
      const teamRow = await client.query('SELECT id FROM teams WHERE id = ?', [teamResult.insertId]);
      const team = teamRow.rows[0];

      // อัปเดต user ให้มี team_id ชี้ไปยังทีมที่สร้างใหม่
      await client.query('UPDATE users SET team_id = ? WHERE id = ?', [team.id, user.id]);
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
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or team code is already in use.' });
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
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    // ดึงข้อมูล User รวมถึงสถานะและ Team ID
    const result = await db.query(
      'SELECT * FROM users WHERE username = ?', 
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!ACTIVE_STATUSES.has(String(user.status || '').trim().toLowerCase())) {
      return res.status(403).json({ error: 'Account is not active' });
    }

    // สร้าง Token
    const token = buildAuthToken(user);

    res.cookie('token', token, getAuthCookieOptions());

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
  res.clearCookie('token', getAuthCookieOptions());
  res.clearCookie('role');
  res.json({ message: 'Logged out successfully' });
};

// 3. Admin อนุมัติ User (Approve)
exports.approveUser = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { userId, id, status } = req.body; // รับค่า status มาด้วย (เผื่อจะแก้เป็น rejected)
    const targetId = userId || id; // รองรับทั้ง userId และ id

    // ถ้าไม่ส่ง status มา ให้ default เป็น 'approved'
    const requestedStatus = String(status || 'approved').trim().toLowerCase();
    const newStatus = normalizeAccountStatus(requestedStatus);
    if (!targetId) return res.status(400).json({ error: 'User ID is required.' });
    if (!['pending', 'rejected', 'active', 'inactive'].includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid user status.' });
    }

    await client.query('BEGIN');
    const targetUser = await client.query('SELECT id, role, team_id FROM users WHERE id = ? FOR UPDATE', [targetId]);
    if (!targetUser.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found.' });
    }

    await client.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, targetId]);
    if (targetUser.rows[0].role === 'team_staff') {
      const teamStatus = requestedStatus === 'approved'
        ? 'approved'
        : newStatus === 'active'
          ? 'active'
        : newStatus === 'rejected' ? 'rejected' : 'pending';
      const teamId = targetUser.rows[0].team_id;
      if (teamId) {
        await client.query('UPDATE teams SET status = ? WHERE id = ?', [teamStatus, teamId]);
      } else {
        await client.query('UPDATE teams SET status = ? WHERE user_id = ?', [teamStatus, targetId]);
      }
    }
    await client.query('COMMIT');
    res.json({ message: `User ID ${targetId} is now ${newStatus}.` });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Approval rollback failed:', rollbackErr); }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// 4. ดึงรายชื่อคนรออนุมัติ
exports.getPendingUsers = async (req, res) => {
  try {
    // เช็คว่ามีคอลัมน์ email ในตาราง users หรือไม่
    const usersColsRes = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = DATABASE()"
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

// [เพิ่ม] ดึง User ทั้งหมด (ไม่เกี่ยงว่า Approve หรือยัง)
exports.getAllUsers = async (req, res) => {
  try {
    const result = await db.query(`
        SELECT u.id, u.username, u.role, u.status, u.created_at, t.name as team_name,
          COALESCE(s.firstname, r.firstname) AS firstname,
          COALESCE(s.lastname, r.lastname) AS lastname,
          COALESCE(s.country, r.country) AS country,
          r.code AS code,
          s.id AS scorer_id,
          r.id AS referee_id
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN scorers s ON s.user_id = u.id
        LEFT JOIN referees r ON r.user_id = u.id
        ORDER BY u.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [เพิ่ม] Admin: สร้าง User ใหม่ (กำหนด Role/Status ได้เลย)
exports.createUser = async (req, res) => {
  let client;
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'user').trim().toLowerCase();
    const status = normalizeAccountStatus(req.body.status || 'active');

    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!ADMIN_MANAGED_ROLES.has(role)) return res.status(400).json({ error: 'Invalid user role' });
    if (!ADMIN_MANAGED_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid user status' });

    const officialKind = getOfficialKind(role);
    const officialProfile = cleanOfficialProfile(req.body);
    const requestedOfficialId = req.body.official_id ? Number(req.body.official_id) : null;
    if (officialKind && (!officialProfile.firstname || !officialProfile.lastname)) {
      return res.status(400).json({ error: 'First and last name are required for official accounts' });
    }
    
    // เช็คว่ามี username ซ้ำไหม
    client = await db.pool.connect();
    await client.query('BEGIN');

    let selectedOfficial = null;
    if (officialKind && requestedOfficialId) {
      const table = officialKind === 'referee' ? 'referees' : 'scorers';
      const selectedResult = await client.query(`SELECT id, user_id FROM ${table} WHERE id = ? FOR UPDATE`, [requestedOfficialId]);
      selectedOfficial = selectedResult.rows[0];
      if (!selectedOfficial) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Official record not found' });
      }
      if (selectedOfficial.user_id) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Official record is already linked to an account' });
      }
    }

    const check = await client.query('SELECT id FROM users WHERE username = ?', [username]);
    if (check.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 8);
    const result = await client.query(
      'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, status]
    );
    let officialRecordId = null;
    if (officialKind && selectedOfficial) {
      const table = officialKind === 'referee' ? 'referees' : 'scorers';
      if (officialKind === 'referee') {
        await client.query(
          `UPDATE ${table} SET firstname = ?, lastname = ?, country = ?, code = ?, user_id = ? WHERE id = ? AND user_id IS NULL`,
          [officialProfile.firstname, officialProfile.lastname, officialProfile.country, officialProfile.code, result.insertId, requestedOfficialId]
        );
      } else {
        await client.query(
          `UPDATE ${table} SET firstname = ?, lastname = ?, country = ?, user_id = ? WHERE id = ? AND user_id IS NULL`,
          [officialProfile.firstname, officialProfile.lastname, officialProfile.country, result.insertId, requestedOfficialId]
        );
      }
      officialRecordId = selectedOfficial.id;
    } else if (officialKind) {
      const officialResult = await insertOfficialProfile(client, officialKind, result.insertId, officialProfile);
      officialRecordId = officialResult.insertId;
    }
    const insertedUser = await client.query(
      'SELECT id, username, role, status, team_id FROM users WHERE id = ?',
      [result.insertId]
    );
    await client.query('COMMIT');

    res.status(201).json({
      message: 'User created successfully',
      user: {
        ...insertedUser.rows[0],
        ...officialProfile,
        ...(officialKind === 'referee' ? { referee_id: officialRecordId } : {}),
        ...(['score', 'scorer', 'statistician'].includes(role) ? { scorer_id: officialRecordId } : {})
      }
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    }
    console.error('Create user error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username or official account is already linked' });
    res.status(500).json({ error: err.message });
  } finally {
    client?.release();
  }
};

// [เพิ่ม] ลบ User (เช่น ไล่คนออก หรือลบ Account ผี)
exports.deleteUser = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');

    const userBeforeResult = await client.query(
      'SELECT id, username, role, status, team_id FROM users WHERE id = ?',
      [id]
    );
    if (userBeforeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. ปลด User ออกจากการเป็นเจ้าของทีม (ถ้ามี) เพื่อป้องกัน Error FK
    await client.query('UPDATE teams SET user_id = NULL WHERE user_id = ?', [id]);

    // 2. ลบ User
    const result = await client.query('DELETE FROM users WHERE id = ?', [id]);

    await writeAuditLog(req, 'user.delete', 'user', id, {
      deleted: userBeforeResult.rows[0] || null
    }, client);

    await client.query('COMMIT');

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// [เพิ่ม] แก้ไขข้อมูล User
exports.updateUser = async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const username = req.body.username === undefined ? undefined : String(req.body.username).trim();
    const password = req.body.password === undefined ? undefined : String(req.body.password);
    const role = req.body.role === undefined ? undefined : String(req.body.role).trim().toLowerCase();
    const status = req.body.status === undefined ? undefined : normalizeAccountStatus(req.body.status);

    if (username !== undefined && !username) return res.status(400).json({ error: 'Username is required' });
    if (role !== undefined && !ADMIN_MANAGED_ROLES.has(role)) return res.status(400).json({ error: 'Invalid user role' });
    if (status !== undefined && !ADMIN_MANAGED_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid user status' });
    if (password && password.trim() !== '' && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    const userCheck = await client.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [id]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const currentUser = userCheck.rows[0];
    const currentKind = getOfficialKind(currentUser.role);
    const nextRole = role || currentUser.role;
    const nextKind = getOfficialKind(nextRole);
    const currentProfile = currentKind ? await getOfficialProfile(client, currentKind, id) : null;
    let requestedOfficialId = req.body.official_id === undefined
      ? (currentProfile?.id || null)
      : (req.body.official_id ? Number(req.body.official_id) : null);

    let selectedProfile = null;
    if (nextKind && requestedOfficialId) {
      const table = nextKind === 'referee' ? 'referees' : 'scorers';
      const selectedResult = await client.query(`SELECT * FROM ${table} WHERE id = ? FOR UPDATE`, [requestedOfficialId]);
      selectedProfile = selectedResult.rows[0] || null;
      if (!selectedProfile) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Official record not found' });
      }
      if (selectedProfile.user_id && String(selectedProfile.user_id) !== String(id)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Official record is already linked to another account' });
      }
    }

    let nextProfile = null;
    if (nextKind) {
      const submittedProfile = cleanOfficialProfile(req.body);
      const profileNameWasProvided = Boolean(submittedProfile.firstname || submittedProfile.lastname);
      const needsProfile = nextKind !== currentKind || Boolean(selectedProfile) || profileNameWasProvided;
      if (needsProfile) {
        const baseProfile = selectedProfile || (currentKind === nextKind ? currentProfile : null);
        nextProfile = {
          firstname: req.body.firstname === undefined ? baseProfile?.firstname || submittedProfile.firstname : submittedProfile.firstname,
          lastname: req.body.lastname === undefined ? baseProfile?.lastname || submittedProfile.lastname : submittedProfile.lastname,
          country: req.body.country === undefined ? baseProfile?.country ?? submittedProfile.country : submittedProfile.country,
          code: req.body.code === undefined ? baseProfile?.code ?? submittedProfile.code : submittedProfile.code,
        };
        if (!nextProfile.firstname || !nextProfile.lastname) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'First and last name are required for official accounts' });
        }
      }
    }

    let fields = [];
    let values = [];

    if (username) {
      fields.push('username = ?');
      values.push(username);
    }
    if (role) {
      fields.push('role = ?');
      values.push(role);
    }
    if (status) {
      fields.push('status = ?');
      values.push(status);
    }
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 8);
      fields.push('password_hash = ?');
      values.push(hashedPassword);
    }

    const officialProfileChanged = Boolean(nextKind && nextProfile);
    const roleChanged = role !== undefined && role !== currentUser.role;
    if (fields.length === 0 && !officialProfileChanged && !roleChanged) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (fields.length > 0) {
      values.push(id);
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await client.query(query, values);
    }

    if (currentProfile && (currentKind !== nextKind || currentProfile.id !== requestedOfficialId)) {
      await client.query(
        `UPDATE ${currentKind === 'referee' ? 'referees' : 'scorers'} SET user_id = NULL WHERE user_id = ?`,
        [id]
      );
    }
    if (nextKind && nextProfile) {
      if (requestedOfficialId) {
        if (nextKind === 'referee') {
          await client.query(
            'UPDATE referees SET firstname = ?, lastname = ?, country = ?, code = ?, user_id = ? WHERE id = ?',
            [nextProfile.firstname, nextProfile.lastname, nextProfile.country, nextProfile.code, id, requestedOfficialId]
          );
        } else {
          await client.query(
            'UPDATE scorers SET firstname = ?, lastname = ?, country = ?, user_id = ? WHERE id = ?',
            [nextProfile.firstname, nextProfile.lastname, nextProfile.country, id, requestedOfficialId]
          );
        }
      } else {
        const officialResult = await insertOfficialProfile(client, nextKind, id, nextProfile);
        requestedOfficialId = officialResult.insertId;
      }
    }

    const updatedUser = await client.query('SELECT id, username, role, status, team_id FROM users WHERE id = ?', [id]);
    await client.query('COMMIT');

    res.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser.rows[0],
        ...(nextProfile || {}),
        ...(nextKind === 'referee' ? { referee_id: requestedOfficialId } : {}),
        ...(['score', 'scorer', 'statistician'].includes(nextRole) ? { scorer_id: requestedOfficialId } : {})
      }
    });

  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    }
    console.error('Update user error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username or official account is already linked' });
    res.status(500).json({ error: err.message });
  } finally {
    client?.release();
  }
};
