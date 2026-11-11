// Prefer explicit entry assignments. Legacy team staff are report-only defaults;
// never borrow staff assigned to another entry or write inferred assignments.
async function teamCompositionStaff(database, entryId, assigned) {
    if (!assigned) {
        const result = await database.query(`SELECT s.*, 1 AS selected FROM team_entry_staff es
            JOIN team_entries te ON te.id=es.team_entry_id
            JOIN team_staff s ON s.id=es.staff_id AND s.team_id=te.team_id
            WHERE es.team_entry_id=? ORDER BY s.role,s.id`, [entryId]);
        assigned = result.rows;
    }
    if (assigned.length) return { staff: assigned, source: 'entry' };
    const result = await database.query(`SELECT s.*, 1 AS selected FROM team_entries te
        JOIN team_staff s ON s.team_id=te.team_id
        WHERE te.id=? AND NOT EXISTS (SELECT 1 FROM team_entry_staff es WHERE es.staff_id=s.id)
        ORDER BY s.role,s.id`, [entryId]);
    return { staff: result.rows, source: result.rows.length ? 'team' : 'none' };
}
module.exports = { teamCompositionStaff };
