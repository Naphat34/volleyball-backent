const { teamCompositionStaff } = require('../utils/teamCompositionStaff');
const db = require('../config/db');
const { refreshTeamEntries, restoreSnapshot } = require('../utils/automaticEntryRoster');
exports.entries = async (_req, res) => {
    try {
        const result = await db.query(`SELECT te.id AS team_entry_id, te.competition_id, te.team_id, te.status,
            COALESCE(te.gender,c.gender) AS gender, COALESCE(te.age_group_id,c.age_group_id) AS age_group_id,
            c.title, c.title_th, c.title_en, ag.name AS age_group_name,
            t.name AS team_name, t.name_th AS team_name_th, t.name_en AS team_name_en, t.code AS team_code
            FROM team_entries te JOIN competitions c ON c.id=te.competition_id
            JOIN teams t ON t.id=te.team_id
            LEFT JOIN age_groups ag ON ag.id=COALESCE(te.age_group_id,c.age_group_id)
            ORDER BY c.start_date DESC,c.id,ag.name,t.name,te.id`);
        res.json(result.rows);
    } catch (error) {
        console.error('Team composition entries:', error.message);
        res.status(500).json({ error: 'Could not load registered teams' });
    }
};

exports.detail = async (req, res) => {
    const entryId = Number(req.params.entryId);
    if (!Number.isSafeInteger(entryId) || entryId < 1) return res.status(400).json({ error: 'Invalid team entry ID' });
    let connection;
    try {
        const entry = await db.query('SELECT team_id FROM team_entries WHERE id=?', [entryId]);
        if (entry.rows[0]) await refreshTeamEntries(db, entry.rows[0].team_id);
        connection = await db.connect();
        await connection.query('BEGIN');
        const metadata = await connection.query(`SELECT t.*, te.id AS team_entry_id, te.competition_id,
            COALESCE(te.gender,c.gender) AS entry_gender, te.status AS entry_status,
            c.title AS competition_name, c.title_th AS competition_name_th, c.title_en AS competition_name_en,
            c.logo_url AS competition_logo_url, ag.name AS age_group_name
            FROM team_entries te JOIN teams t ON t.id=te.team_id JOIN competitions c ON c.id=te.competition_id
            LEFT JOIN age_groups ag ON ag.id=COALESCE(te.age_group_id,c.age_group_id)
            WHERE te.id=?`, [entryId]);
        if (!metadata.rows.length) { await connection.query('ROLLBACK'); return res.status(404).json({ error: 'Team entry not found' }); }
        const players = await connection.query(`SELECT p.*, 1 AS selected, ep.number AS entry_number, ep.role AS entry_role,
            ep.is_captain AS entry_is_captain, ep.is_libero1 AS entry_is_libero1, ep.is_libero2 AS entry_is_libero2,
            ep.is_playing AS entry_is_playing,ep.athlete_snapshot
            FROM team_entry_players ep JOIN team_entries te ON te.id=ep.team_entry_id
            JOIN players p ON p.id=ep.player_id AND p.team_id=te.team_id
            WHERE ep.team_entry_id=? ORDER BY ep.number,p.id`, [entryId]);
        const staff = await teamCompositionStaff(connection, entryId);
        await connection.query('COMMIT');
        res.setHeader('Cache-Control', 'no-store');
        res.json({ teamInfo: metadata.rows[0], players: players.rows.map(restoreSnapshot), staff: staff.staff, staff_source: staff.source });
    } catch (error) {
        if (connection) await connection.query('ROLLBACK');
        console.error('Team composition report:', error.message);
        res.status(500).json({ error: 'Could not load team composition' });
    } finally { connection?.release(); }
};
