// Repair one legacy empty lock only while registration is open and this team has no match history.
const db = require('../config/db');
const { loadTeamRosterEntries, syncTeamEntries } = require('../utils/automaticEntryRoster');

async function repair(entryId, apply = false) {
    const connection = await db.connect();
    try {
        await connection.beginTransaction();
        const row = (await connection.query('SELECT team_id FROM team_entries WHERE id=?', [entryId])).rows[0];
        if (!row) throw new Error('Team entry not found');
        await connection.query('SELECT id FROM teams WHERE id=? FOR UPDATE', [row.team_id]);
        const entry = (await loadTeamRosterEntries(connection, row.team_id)).find(e => Number(e.id) === entryId);
        const count = (await connection.query('SELECT COUNT(*) AS count FROM team_entry_players WHERE team_entry_id=?', [entryId])).rows[0];
        if (!entry.roster_locked_at || Number(count.count) !== 0 || Number(entry.has_history)
            || entry.competition_status !== 'open' || !entry.start_date
            || String(entry.start_date instanceof Date ? entry.start_date.toISOString().slice(0, 10) : entry.start_date).slice(0, 10) <= entry.today) {
            throw new Error('Repair refused: entry must be empty, locked, open, before start date, and unused by this team');
        }
        if (!apply) {
            console.log(JSON.stringify({ entryId, teamId: row.team_id, eligibleForRepair: true, applied: false }));
            await connection.rollback();
            return;
        }
        await connection.query('UPDATE team_entries SET roster_locked_at=NULL,roster_source_hash=NULL WHERE id=?', [entryId]);
        await syncTeamEntries(connection, row.team_id);
        const result = (await connection.query('SELECT roster_sync_error,roster_locked_at FROM team_entries WHERE id=?', [entryId])).rows[0];
        if (result.roster_sync_error || result.roster_locked_at) throw new Error(result.roster_sync_error || 'Entry was locked again');
        const after = (await connection.query('SELECT COUNT(*) AS count FROM team_entry_players WHERE team_entry_id=?', [entryId])).rows[0];
        if (!Number(after.count)) throw new Error('Repair refused: no eligible registered players');
        await connection.commit();
        console.log(JSON.stringify({ entryId, teamId: row.team_id, rosterCount: Number(after.count), applied: true }));
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}

if (require.main === module) {
    const entryId = Number(process.argv.find(arg => arg.startsWith('--entry-id='))?.split('=')[1]);
    (async () => {
        try {
            if (!Number.isInteger(entryId) || entryId < 1) throw new Error('Use --entry-id=ID [--apply]');
            await repair(entryId, process.argv.includes('--apply'));
        } catch (error) { console.error(error.message); process.exitCode = 1; }
        finally { await db.pool.end(); }
    })();
}
module.exports = { repair };
