const db = require('../config/db');

// --- Referees ---
exports.getAllReferees = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM referees ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createReferee = async (req, res) => {
    try {
        const { firstname, lastname, country, code } = req.body;
        const result = await db.query(
            'INSERT INTO referees (firstname, lastname, country, code) VALUES (?, ?, ?, ?)',
            [firstname, lastname, country, code]
        );
        const inserted = await db.query('SELECT * FROM referees WHERE id = ?', [result.insertId]);
        res.status(201).json(inserted.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateReferee = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstname, lastname, country } = req.body;
        await db.query(
            'UPDATE referees SET firstname = ?, lastname = ?, country = ? WHERE id = ?',
            [firstname, lastname, country, id]
        );
        const updated = await db.query('SELECT * FROM referees WHERE id = ?', [id]);
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteReferee = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM referees WHERE id = ?', [id]);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Scorers ---
exports.getAllScorers = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM scorers ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createScorer = async (req, res) => {
    try {
        const { firstname, lastname, country } = req.body;
        const result = await db.query(
            'INSERT INTO scorers (firstname, lastname, country) VALUES (?, ?, ?)',
            [firstname, lastname, country]
        );
        const inserted = await db.query('SELECT * FROM scorers WHERE id = ?', [result.insertId]);
        res.status(201).json(inserted.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateScorer = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstname, lastname, country } = req.body;
        await db.query(
            'UPDATE scorers SET firstname = ?, lastname = ?, country = ? WHERE id = ?',
            [firstname, lastname, country, id]
        );
        const updated = await db.query('SELECT * FROM scorers WHERE id = ?', [id]);
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteScorer = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM scorers WHERE id = ?', [id]);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Line Judges ---
exports.getAllLineJudges = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM line_judges ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createLineJudge = async (req, res) => {
    try {
        const { firstname, lastname, country } = req.body;
        const result = await db.query(
            'INSERT INTO line_judges (firstname, lastname, country) VALUES (?, ?, ?)',
            [firstname, lastname, country]
        );
        const inserted = await db.query('SELECT * FROM line_judges WHERE id = ?', [result.insertId]);
        res.status(201).json(inserted.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateLineJudge = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstname, lastname, country } = req.body;
        await db.query(
            'UPDATE line_judges SET firstname = ?, lastname = ?, country = ? WHERE id = ?',
            [firstname, lastname, country, id]
        );
        const updated = await db.query('SELECT * FROM line_judges WHERE id = ?', [id]);
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteLineJudge = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM line_judges WHERE id = ?', [id]);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
