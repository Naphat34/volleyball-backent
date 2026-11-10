async function getMatchTeamStaff(database, match, side) {
    const teamId = match[`${side}_team_id`];
    if (!teamId) return [];
    if (match.competition_id) {
        const assigned = await database.query(`SELECT ts.id,ts.team_id,ts.first_name,ts.last_name,ts.role,ts.gender
            FROM team_entry_staff tes JOIN team_entries te ON te.id=tes.team_entry_id
            JOIN team_staff ts ON ts.id=tes.staff_id AND ts.team_id=te.team_id
            WHERE te.competition_id=? AND te.team_id=? ORDER BY ts.role,ts.id`, [match.competition_id,teamId]);
        if (assigned.rows.length) return assigned.rows;
    }
    const staff = await database.query(`SELECT id,team_id,first_name,last_name,role,gender FROM team_staff
        WHERE team_id=? ORDER BY role,first_name,last_name,id`, [teamId]);
    if (staff.rows.length) return staff.rows;
    const legacy = match[`${side}_coach_name`] || match[`${side}_coach`];
    return typeof legacy === 'string' && legacy.trim() ? [{team_id:teamId,first_name:legacy.trim(),last_name:'',role:'Head Coach'}] : [];
}
module.exports = { getMatchTeamStaff };
