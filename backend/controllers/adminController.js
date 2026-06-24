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

    // Add Player to Team (Admin)
    async addPlayerToTeam(req, res) {
        try {
            const { teamId } = req.params;
            const { 
                number, first_name, last_name, nickname, position, 
                height_cm, weight, birth_date, nationality, photo, 
                gender, is_captain, is_libero1, is_libero2
            } = req.body;

            const cleanNumber = parseNullableInt(number);
            const cleanHeight = parseNullableInt(height_cm);
            const cleanWeight = parseNullableInt(weight);
            const cleanBirthDate = parseNullableString(birth_date);
            const cleanIsCaptain = is_captain === true || is_captain === 'true';
            const cleanIsLibero1 = position === 'L' && (is_libero1 === true || is_libero1 === 'true');
            const cleanIsLibero2 = position === 'L' && (is_libero2 === true || is_libero2 === 'true');

            // --- [LOGIC กัปตัน] ---
            if (cleanIsCaptain) {
                await db.query('UPDATE players SET is_captain = false WHERE team_id = $1', [teamId]);
            }

            // --- [LOGIC ลิเบอโร่] ---
            if (cleanIsLibero1) {
                await db.query('UPDATE players SET is_libero1 = false WHERE team_id = $1', [teamId]);
            }
            if (cleanIsLibero2) {
                await db.query('UPDATE players SET is_libero2 = false WHERE team_id = $1', [teamId]);
            }

            const result = await db.query(
                `INSERT INTO players 
                (team_id, number, first_name, last_name, nickname, position, height_cm, weight, birth_date, nationality, photo, gender, is_captain, is_libero1, is_libero2)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *`,
                [
                    teamId, cleanNumber, first_name, last_name, nickname, position, 
                    cleanHeight, cleanWeight, cleanBirthDate, nationality, photo, 
                    gender, cleanIsCaptain, cleanIsLibero1, cleanIsLibero2
                ]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error("Add Player Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // Update Player (Admin)
    async updatePlayer(req, res) {
        try {
            const { id } = req.params;
            const { 
                number, first_name, last_name, nickname, position, 
                height_cm, weight, birth_date, nationality, photo, 
                gender, is_captain, is_libero1, is_libero2
            } = req.body;

            const cleanNumber = parseNullableInt(number);
            const cleanHeight = parseNullableInt(height_cm);
            const cleanWeight = parseNullableInt(weight);
            const cleanBirthDate = parseNullableString(birth_date);
            const cleanIsCaptain = is_captain === true || is_captain === 'true';
            const cleanIsLibero1 = position === 'L' && (is_libero1 === true || is_libero1 === 'true');
            const cleanIsLibero2 = position === 'L' && (is_libero2 === true || is_libero2 === 'true');

            // --- [LOGIC กัปตัน] ---
            if (cleanIsCaptain) {
                const playerCheck = await db.query('SELECT team_id FROM players WHERE id = $1', [id]);
                if (playerCheck.rows.length > 0) {
                    const teamId = playerCheck.rows[0].team_id;
                    await db.query('UPDATE players SET is_captain = false WHERE team_id = $1', [teamId]);
                }
            }

            // --- [LOGIC ลิเบอโร่] ---
            if (cleanIsLibero1 || cleanIsLibero2) {
                const playerCheck = await db.query('SELECT team_id FROM players WHERE id = $1', [id]);
                if (playerCheck.rows.length > 0) {
                    const teamId = playerCheck.rows[0].team_id;
                    if (cleanIsLibero1) {
                        await db.query('UPDATE players SET is_libero1 = false WHERE team_id = $1', [teamId]);
                    }
                    if (cleanIsLibero2) {
                        await db.query('UPDATE players SET is_libero2 = false WHERE team_id = $1', [teamId]);
                    }
                }
            }

            const result = await db.query(
                `UPDATE players 
                SET number=$1, first_name=$2, last_name=$3, nickname=$4, position=$5, 
                    height_cm=$6, weight=$7, birth_date=$8, nationality=$9, photo=$10, 
                    gender=$11, is_captain=$12, is_libero1=$13, is_libero2=$14
                WHERE id=$15
                RETURNING *`,
                [
                    cleanNumber, first_name, last_name, nickname, position, 
                    cleanHeight, cleanWeight, cleanBirthDate, nationality, photo, 
                    gender, cleanIsCaptain, cleanIsLibero1, cleanIsLibero2, id
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Player not found" });
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error("Update Player Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // Delete Player (Admin)
    async deletePlayer(req, res) {
        try {
            const { id } = req.params;
            const result = await db.query('DELETE FROM players WHERE id = $1 RETURNING id', [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Player not found" });
            }
            res.json({ message: "Player deleted successfully" });
        } catch (err) {
            console.error("Delete Player Error:", err);
            res.status(500).json({ error: err.message });
        }
    }
};