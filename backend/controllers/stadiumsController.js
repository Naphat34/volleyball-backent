const db = require('../config/db');

module.exports = {
  // 1. ดึงข้อมูลสนามทั้งหมด
  async getAllStadiums(req, res) {
    try {
      const result = await db.query("SELECT * FROM stadiums ORDER BY id ASC");
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  },

  // 2. สร้างสนามใหม่
  async createStadium(req, res) {
    const client = await db.pool.connect();
    try {
      const { name, code, address, google_map_url, capacity, number_of_courts, status } = req.body;
      
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO stadiums (name, code, address, google_map_url, capacity, number_of_courts, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, code, address, google_map_url, capacity || 0, number_of_courts || 1, status || 'active']
      );
      const insertedId = result.insertId;
      const created = await client.query('SELECT * FROM stadiums WHERE id = ?', [insertedId]);
      await client.query('COMMIT');
      res.json(created.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },

  // 3. อัปเดตข้อมูลสนาม
  async updateStadium(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { name, code, address, google_map_url, capacity, number_of_courts, status } = req.body;

      const cleanCapacity = (capacity === '' || capacity === null || capacity === undefined) ? 0 : parseInt(capacity, 10);
      const cleanCourts = (number_of_courts === '' || number_of_courts === null || number_of_courts === undefined) ? 1 : parseInt(number_of_courts, 10);

      await client.query('BEGIN');
      await client.query(
        `UPDATE stadiums SET 
         name=?, code=?, address=?, google_map_url=?, capacity=?, number_of_courts=?, status=?, updated_at=NOW()
         WHERE id=?`,
        [name, code, address, google_map_url, cleanCapacity, cleanCourts, status, id]
      );
      const result = await client.query('SELECT * FROM stadiums WHERE id = ?', [id]);
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },

  // 4. ลบสนาม
  async deleteStadium(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      await client.query('BEGIN');
      // เช็คก่อนว่ามีการใช้งานอยู่ไหม (Optional)
      await client.query('DELETE FROM stadiums WHERE id = ?', [id]);
      await client.query('COMMIT');
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Cannot delete: Stadium is likely in use.' });
    } finally {
      client.release();
    }
  }
};