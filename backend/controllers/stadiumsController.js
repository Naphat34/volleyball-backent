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
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, code, address, google_map_url, capacity || 0, number_of_courts || 1, status || 'active']
      );
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

  // 3. อัปเดตข้อมูลสนาม
  async updateStadium(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { name, code, address, google_map_url, capacity, number_of_courts, status } = req.body;

      const cleanCapacity = (capacity === '' || capacity === null || capacity === undefined) ? 0 : parseInt(capacity, 10);
      const cleanCourts = (number_of_courts === '' || number_of_courts === null || number_of_courts === undefined) ? 1 : parseInt(number_of_courts, 10);

      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE stadiums SET 
         name=$1, code=$2, address=$3, google_map_url=$4, capacity=$5, number_of_courts=$6, status=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [name, code, address, google_map_url, cleanCapacity, cleanCourts, status, id]
      );
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
      await client.query('DELETE FROM stadiums WHERE id = $1', [id]);
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