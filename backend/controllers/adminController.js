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
                gender, is_captain 
            } = req.body;

            const cleanNumber = parseNullableInt(number);
            const cleanHeight = parseNullableInt(height_cm);
            const cleanWeight = parseNullableInt(weight);
            const cleanBirthDate = parseNullableString(birth_date);
            const cleanIsCaptain = is_captain === true || is_captain === 'true';

            const result = await db.query(
                `INSERT INTO players 
                (team_id, number, first_name, last_name, nickname, position, height_cm, weight, birth_date, nationality, photo, gender, is_captain)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *`,
                [
                    teamId, cleanNumber, first_name, last_name, nickname, position, 
                    cleanHeight, cleanWeight, cleanBirthDate, nationality, photo, 
                    gender, cleanIsCaptain
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
                gender, is_captain 
            } = req.body;

            const cleanNumber = parseNullableInt(number);
            const cleanHeight = parseNullableInt(height_cm);
            const cleanWeight = parseNullableInt(weight);
            const cleanBirthDate = parseNullableString(birth_date);
            const cleanIsCaptain = is_captain === true || is_captain === 'true';

            const result = await db.query(
                `UPDATE players 
                SET number=$1, first_name=$2, last_name=$3, nickname=$4, position=$5, 
                    height_cm=$6, weight=$7, birth_date=$8, nationality=$9, photo=$10, 
                    gender=$11, is_captain=$12
                WHERE id=$13
                RETURNING *`,
                [
                    cleanNumber, first_name, last_name, nickname, position, 
                    cleanHeight, cleanWeight, cleanBirthDate, nationality, photo, 
                    gender, cleanIsCaptain, id
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