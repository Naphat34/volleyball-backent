const db = require('../config/db');

const ageGroupController = {
  async getAllAgeGroups(req, res) {
    try {
      const result = await db.query(`
        SELECT *
        FROM age_groups
        ORDER BY
          CASE name
            WHEN 'U12' THEN 1
            WHEN 'U14' THEN 2
            WHEN 'U16' THEN 3
            WHEN 'U18' THEN 4
            WHEN 'Open' THEN 5
            ELSE 99
          END,
          name ASC
      `);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  }
};

module.exports = ageGroupController;
