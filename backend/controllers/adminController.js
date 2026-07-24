const db = require('../config/db');

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
  return !text || text === '0' || text === '-0' || /^\d+$/.test(text) ? null : text;
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

            // ✅ Validation: number is required
            if (!number || number === '' || number === null || number === undefined) {
                return res.status(400).json({ error: 'Player number is required' });
            }

            // ✅ Validation: at least first_name or last_name must be provided
            const cleanFirstName = parseNullablePersonName(first_name);
            const cleanLastName = parseNullablePersonName(last_name);
            if (!cleanFirstName && !cleanLastName) {
                return res.status(400).json({ error: 'At least first name or last name must be provided' });
            }

            const cleanNumber = parseNullableInt(number);
            const cleanHeight = parseNullableInt(height_cm);
            const cleanWeight = parseNullableInt(weight);
            const cleanBirthDate = parseNullableString(birth_date);
            const cleanIsCaptain = is_captain === true || is_captain === 'true';
            const cleanIsLibero1 = position === 'L' && (is_libero1 === true || is_libero1 === 'true');
            const cleanIsLibero2 = position === 'L' && (is_libero2 === true || is_libero2 === 'true');

            // --- [LOGIC กัปตัน] ---
            if (cleanIsCaptain) {
                await db.query('UPDATE players SET is_captain = false WHERE team_id = ?', [teamId]);
            }

            // --- [LOGIC ลิเบอโร่] ---
            if (cleanIsLibero1) {
                await db.query('UPDATE players SET is_libero1 = false WHERE team_id = ?', [teamId]);
            }
            if (cleanIsLibero2) {
                await db.query('UPDATE players SET is_libero2 = false WHERE team_id = ?', [teamId]);
            }

            const result = await db.query(
                `INSERT INTO players 
                (team_id, number, first_name, last_name, nickname, position, height_cm, weight, birth_date, nationality, photo, gender, is_captain, is_libero1, is_libero2)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    teamId, cleanNumber, cleanFirstName, cleanLastName, nickname, position,
                    cleanHeight, cleanWeight, cleanBirthDate, nationality, photo, 
                    gender, cleanIsCaptain, cleanIsLibero1, cleanIsLibero2
                ]
            );
            const insertedPlayer = await db.query('SELECT * FROM players WHERE id = ?', [result.insertId]);
            res.status(201).json(insertedPlayer.rows[0]);
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
                gender, is_captain, is_libero1, is_libero2, is_playing
            } = req.body;

            // ✅ Validation: number is required ONLY if being updated
            if (number !== undefined && (!number || number === '' || number === null)) {
                return res.status(400).json({ error: 'Player number is required' });
            }

            // ✅ Validation: at least first_name or last_name ONLY if names are being updated
            if ((first_name !== undefined || last_name !== undefined) && 
                (!first_name || first_name === '') && (!last_name || last_name === '')) {
                return res.status(400).json({ error: 'At least first name or last name must be provided' });
            }

            const cleanFirstName = first_name !== undefined ? parseNullablePersonName(first_name) : undefined;
            const cleanLastName = last_name !== undefined ? parseNullablePersonName(last_name) : undefined;
            const cleanNumber = parseNullableInt(number);
            const cleanHeight = parseNullableInt(height_cm);
            const cleanWeight = parseNullableInt(weight);
            const cleanBirthDate = parseNullableString(birth_date);
            const cleanIsCaptain = is_captain !== undefined ? (is_captain === true || is_captain === 'true') : undefined;
            const cleanIsLibero1 = position === 'L' && (is_libero1 === true || is_libero1 === 'true');
            const cleanIsLibero2 = position === 'L' && (is_libero2 === true || is_libero2 === 'true');

            if (first_name !== undefined || last_name !== undefined) {
                const currentPlayer = await db.query('SELECT first_name, last_name FROM players WHERE id = ?', [id]);
                if (!currentPlayer.rows.length) return res.status(404).json({ error: 'Player not found' });
                const finalFirstName = first_name !== undefined ? cleanFirstName : parseNullablePersonName(currentPlayer.rows[0].first_name);
                const finalLastName = last_name !== undefined ? cleanLastName : parseNullablePersonName(currentPlayer.rows[0].last_name);
                if (!finalFirstName && !finalLastName) {
                    return res.status(400).json({ error: 'At least first name or last name must be provided' });
                }
            }

            // --- [LOGIC กัปตัน] --- Only run if is_captain is being updated
            if (is_captain !== undefined && cleanIsCaptain) {
                const playerCheck = await db.query('SELECT team_id FROM players WHERE id = ?', [id]);
                if (playerCheck.rows.length > 0) {
                    const teamId = playerCheck.rows[0].team_id;
                    await db.query('UPDATE players SET is_captain = false WHERE team_id = ?', [teamId]);
                }
            }

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

            // Build dynamic UPDATE query - only include fields that were provided
            const updateFields = [];
            const updateValues = [];
            
            if (number !== undefined) { updateFields.push('number=?'); updateValues.push(cleanNumber); }
            if (first_name !== undefined) { updateFields.push('first_name=?'); updateValues.push(cleanFirstName); }
            if (last_name !== undefined) { updateFields.push('last_name=?'); updateValues.push(cleanLastName); }
            if (nickname !== undefined) { updateFields.push('nickname=?'); updateValues.push(nickname); }
            if (position !== undefined) { updateFields.push('position=?'); updateValues.push(position); }
            if (height_cm !== undefined) { updateFields.push('height_cm=?'); updateValues.push(cleanHeight); }
            if (weight !== undefined) { updateFields.push('weight=?'); updateValues.push(cleanWeight); }
            if (birth_date !== undefined) { updateFields.push('birth_date=?'); updateValues.push(cleanBirthDate); }
            if (nationality !== undefined) { updateFields.push('nationality=?'); updateValues.push(nationality); }
            if (photo !== undefined) { updateFields.push('photo=?'); updateValues.push(photo); }
            if (gender !== undefined) { updateFields.push('gender=?'); updateValues.push(gender); }
            if (is_captain !== undefined) { updateFields.push('is_captain=?'); updateValues.push(cleanIsCaptain); }
            if (is_libero1 !== undefined) { updateFields.push('is_libero1=?'); updateValues.push(cleanIsLibero1); }
            if (is_libero2 !== undefined) { updateFields.push('is_libero2=?'); updateValues.push(cleanIsLibero2); }
            if (is_playing !== undefined) { updateFields.push('is_playing=?'); updateValues.push(is_playing === true || is_playing === 'true'); }

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

            const updatedPlayer = await db.query('SELECT * FROM players WHERE id = ?', [id]);
            if (updatedPlayer.rows.length === 0) {
                return res.status(404).json({ error: "Player not found" });
            }
            res.json(updatedPlayer.rows[0]);
        } catch (err) {
            console.error("Update Player Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // Delete Player (Admin)
    async deletePlayer(req, res) {
        try {
            const { id } = req.params;
            const result = await db.query('DELETE FROM players WHERE id = ?', [id]);
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Player not found" });
            }
            res.json({ message: "Player deleted successfully" });
        } catch (err) {
            console.error("Delete Player Error:", err);
            res.status(500).json({ error: err.message });
        }
    }
};
