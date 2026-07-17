const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./config/db');

(async () => {
  try {
    const matchId = 1005;
    const matchResult = await db.query(`
      SELECT 
        m.*, 
        t1.name as home_team_name, t1.code as home_team_code, t1.logo_url as home_logo_url,
        t2.name as away_team_name, t2.code as away_team_code, t2.logo_url as away_logo_url,
        c.title as competition_name, c.title as competition_title, 
        c.gender as competition_gender, c.sport as competition_sport,
        c.start_date as start_date, c.end_date as end_date,
        ag.name as age_group_name
      FROM matches m
      LEFT JOIN teams t1 ON m.home_team_id = t1.id
      LEFT JOIN teams t2 ON m.away_team_id = t2.id
      LEFT JOIN competitions c ON m.competition_id = c.id
      LEFT JOIN age_groups ag ON c.age_group_id = ag.id
      WHERE m.id = ?
    `, [matchId]);

    console.log('match rows', matchResult.rows.length);
    const match = matchResult.rows[0];

    if (match && match.location) {
      const stadiumResult = await db.query(`
        SELECT name, address
        FROM stadiums
        WHERE CAST(id AS CHAR) = ? OR name = ?
        ORDER BY CASE WHEN CAST(id AS CHAR) = ? THEN 0 ELSE 1 END
        LIMIT 1
      `, [String(match.location), String(match.location), String(match.location)]);
      console.log('stadium rows', stadiumResult.rows.length);
      console.log(JSON.stringify(stadiumResult.rows[0], null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
