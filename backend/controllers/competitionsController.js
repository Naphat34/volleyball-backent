const db = require('../config/db');

const parseNullableInt = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return parseInt(val, 10);
};

const parseNullableString = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  return val;
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
        (SELECT COUNT(*) FROM team_competitions tc WHERE tc.competition_id = c.id) as team_count
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
    console.log("Create Comp Body:", req.body); // Debug log
    const client = await db.pool.connect();
    
    try {
        const { title, details, sport, gender, age_group_id, start_date, end_date, location, status, max_sets, max_players, stadium_id } = req.body;
        
        const cleanAgeGroup = parseNullableInt(age_group_id);
        const cleanMaxSets = parseNullableInt(max_sets);
        const cleanMaxPlayers = parseNullableInt(max_players);
        const cleanStadium = parseNullableInt(stadium_id);
        const cleanStartDate = parseNullableString(start_date);
        const cleanEndDate = parseNullableString(end_date);

        // 1. แปลง String "Male,Female" -> Array ["Male", "Female"]
        // ใช้ filter เพื่อตัดค่าว่างทิ้ง
        const selectedGenders = gender ? gender.split(',').filter(g => g.trim() !== '') : [];

        if (selectedGenders.length === 0) {
            return res.status(400).json({ error: 'Please select at least one gender category' });
        }

        await client.query('BEGIN');

        // 2. Loop สร้างรายการตามจำนวนเพศที่เลือก
        let createdCount = 0;
        for (const g of selectedGenders) {
            
            // ถ้าเลือกมากกว่า 1 ให้เติมวงเล็บท้ายชื่อ เช่น "Hat Yai Open (Male)"
            const suffix = selectedGenders.length > 1 ? ` (${g})` : ''; 
            const finalTitle = `${title}${suffix}`;

            await client.query(
                `INSERT INTO competitions 
                (title, details, sport, gender, age_group_id, start_date, end_date, location, status, max_sets, max_players, stadium_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    finalTitle, 
                    details, 
                    sport, 
                    g, // ✅ ใช้ค่า g ที่วนลูปได้ (Male หรือ Female)
                    cleanAgeGroup, 
                    cleanStartDate, 
                    cleanEndDate, 
                    location, 
                    status, 
                    cleanMaxSets, 
                    cleanMaxPlayers, 
                    cleanStadium
                ]
            );
            createdCount++;
        }

        await client.query('COMMIT');
        res.json({ message: `Successfully created ${createdCount} competition(s)` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Create Competition Error:", err);
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
      const cleanMaxSets = parseNullableInt(max_sets);
      const cleanMaxPlayers = parseNullableInt(max_players);
      const cleanStadium = parseNullableInt(stadium_id);
      const cleanStartDate = parseNullableString(start_date);
      const cleanEndDate = parseNullableString(end_date);

      const result = await db.query(
        `UPDATE competitions 
         SET title=$1, details=$2, sport=$3, gender=$4, age_group_id=$5, start_date=$6, end_date=$7, location=$8, status=$9, max_sets=$10, max_players=$11, stadium_id=$12
         WHERE id=$13 RETURNING *`,
        [
          title, details, sport, 
          singleGender, // ใช้ค่าเดียว
          cleanAgeGroup, cleanStartDate, cleanEndDate, location, status, cleanMaxSets, cleanMaxPlayers, cleanStadium,
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Competition not found" });
      }

      res.json(result.rows[0]);
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
      await client.query('DELETE FROM matches WHERE competition_id = $1', [id]);
      await client.query('DELETE FROM team_competitions WHERE competition_id = $1', [id]);
      
      const result = await client.query('DELETE FROM competitions WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
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
      const result = await db.query(
        'UPDATE competitions SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      res.json(result.rows[0]);
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
      const userRes = await db.query('SELECT team_id FROM users WHERE id = $1', [userId]);
      const teamId = userRes.rows[0]?.team_id;

      if (!teamId) return res.json([]);

      const result = await db.query(`
        SELECT c.*, tc.status as registration_status, tc.registered_at
        FROM competitions c
        JOIN team_competitions tc ON c.id = tc.competition_id
        WHERE tc.team_id = $1
        ORDER BY c.start_date DESC
      `, [teamId]);

      res.json(result.rows);
    } catch (err) {
      console.error("Get My Comp Error:", err);
      res.status(500).json({ error: 'Database error' });
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
      const userRes = await client.query('SELECT team_id FROM users WHERE id = $1', [userId]);
      const teamId = userRes.rows[0]?.team_id;

      if (!teamId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "คุณต้องสร้างทีมก่อนสมัครแข่งขัน (You must create a team first)" });
      }

      // 2. ตรวจสอบว่าเคยสมัครไปแล้วหรือยัง
      const check = await client.query(
        "SELECT * FROM team_competitions WHERE team_id = $1 AND competition_id = $2",
        [teamId, compId]
      );

      if (check.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "ทีมของคุณสมัครรายการนี้ไปแล้ว (Already registered)" });
      }

      // 3. บันทึกการสมัคร
      await client.query(
        "INSERT INTO team_competitions (team_id, competition_id, registered_at, status) VALUES ($1, $2, NOW(), 'pending')",
        [teamId, compId]
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

      if (!competition_id) {
        return res.status(400).json({ error: "Missing competition ID" });
      }

      await client.query('BEGIN');

      // 1. หา team_id ของ user
      const userRes = await client.query('SELECT team_id FROM users WHERE id = $1', [userId]);
      const teamId = userRes.rows[0]?.team_id;

      if (!teamId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Team not found" });
      }

      // 2. ลบการสมัคร
      const result = await client.query(
        "DELETE FROM team_competitions WHERE team_id = $1 AND competition_id = $2 RETURNING *",
        [teamId, competition_id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Registration not found or already removed" });
      }

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
        SELECT t.id, t.name, t.code, t.logo_url, t.coach, tc.status, tc.registered_at
        FROM teams t
        JOIN team_competitions tc ON t.id = tc.team_id
        WHERE tc.competition_id = $1
      `;
      const params = [competitionId];

      if (status) {
        query += ` AND tc.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY t.name ASC`;

      const result = await db.query(query, params);
      res.json(result.rows);
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