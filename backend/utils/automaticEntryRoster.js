const { normalizeTeamGender } = require('./teamGender');
const { flag } = require('./athleteIntegrity');
const { createHash } = require('node:crypto');

// Use the database's date for both cutoff and age calculation.
const dateText = value => value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value || '').slice(0, 10);
const ageLimit = entry => {
    const name = String(entry.age_group_name || '').trim();
    if (/^(open|general|ทั่วไป|ประชาชน)$/i.test(name)) return Infinity;
    const match = name.match(/^U\s*(\d+)$/i);
    return match ? Number(match[1]) : null;
};
function eligibility(player, entry) {
    if (Number(player.is_active) === 0) return 'inactive';
    if (normalizeTeamGender(player.gender) !== normalizeTeamGender(entry.competition_gender)) return 'gender';
    const limit = ageLimit(entry);
    if (limit === null) return 'unknown_age_group';
    if (limit === Infinity) return null;
    const birth = dateText(player.birth_date), reference = dateText(entry.start_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(reference)
        || !Number.isFinite(Date.parse(birth)) || new Date(birth).toISOString().slice(0, 10) !== birth || birth > reference) return 'birth_date';
    const age = Number(reference.slice(0, 4)) - Number(birth.slice(0, 4)) - (reference.slice(5) < birth.slice(5) ? 1 : 0);
    // U18 in this application means age at most 18 on the competition start date.
    return age <= limit ? null : 'age';
}
function rosterError(players, entry) {
    if (entry.max_players && players.length > Number(entry.max_players)) return `รายชื่อ ${players.length} คน เกินจำนวนสูงสุด ${entry.max_players} คน / Roster exceeds player limit`;
    const numbers = new Set();
    for (const player of players) {
        const number = Number(player.number);
        if (!Number.isInteger(number) || number < 1 || number > 999 || numbers.has(number)) return 'เบอร์เสื้อต้องเป็น 1–999 และไม่ซ้ำในรายการ / Invalid or duplicate jersey number';
        numbers.add(number);
    }
    if (players.filter(p => flag(p.is_captain)).length > 1
        || players.filter(p => flag(p.is_libero1)).length > 1
        || players.filter(p => flag(p.is_libero2)).length > 1
        || players.filter(p => p.position === 'L').length > 2) return 'กรุณาตรวจบทบาทกัปตันและ Libero ในทะเบียนทีม / Invalid captain or Libero roles';
    return null;
}
const snapshotFields = ['first_name','last_name','first_name_th','last_name_th','first_name_en','last_name_en','birth_date','gender','height_cm','weight','nationality','photo','nickname'];
function snapshot(player) {
    return JSON.stringify(Object.fromEntries(snapshotFields.map(key => [key, key === 'birth_date' ? dateText(player[key]) || null : player[key] ?? null])));
}
function restoreSnapshot(player) {
    const { athlete_snapshot: raw, ...rest } = player;
    if (!raw) return rest;
    const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...rest, ...Object.fromEntries(snapshotFields.filter(key => Object.hasOwn(saved, key)).map(key => [key, saved[key]])) };
}

// Caller owns the transaction. Lock the team before editing master players or entries.
async function syncTeamEntries(connection, teamId) {
    if (!teamId) return;
    await connection.query('SELECT id FROM teams WHERE id=? FOR UPDATE', [teamId]);
    const result = await connection.query(`SELECT te.*, c.title AS competition_title, c.gender AS competition_gender,
        c.start_date,c.status AS competition_status,c.max_players,ag.name AS age_group_name,
        DATE_FORMAT(CURRENT_DATE,'%Y-%m-%d') AS today,
        EXISTS (SELECT 1 FROM matches m WHERE m.competition_id=te.competition_id
            AND (m.home_team_id=te.team_id OR m.away_team_id=te.team_id)
            AND (m.status <> 'scheduled' OR m.match_setup IS NOT NULL OR EXISTS (SELECT 1 FROM match_actions a WHERE a.match_id=m.id)
                OR EXISTS (SELECT 1 FROM match_events e WHERE e.match_id=m.id)
                OR EXISTS (SELECT 1 FROM match_lineups l WHERE l.match_id=m.id))) AS has_history
        FROM team_entries te JOIN competitions c ON c.id=te.competition_id
        LEFT JOIN age_groups ag ON ag.id=COALESCE(te.age_group_id,c.age_group_id)
        WHERE te.team_id=? ORDER BY te.id FOR UPDATE`, [teamId]);
    const entries = result.rows;
    if (!entries.length) return;
    const players = (await connection.query('SELECT * FROM players WHERE team_id=? ORDER BY id', [teamId])).rows;
    const assigned = (await connection.query(`SELECT ep.player_id,ep.team_entry_id FROM team_entry_players ep
        JOIN team_entries te ON te.id=ep.team_entry_id WHERE te.team_id=?`, [teamId])).rows;
    for (const entry of entries) {
        if (!entry.roster_locked_at && (entry.competition_status !== 'open' || Number(entry.has_history)
            || (dateText(entry.start_date) && dateText(entry.start_date) <= entry.today))) {
            await connection.query('UPDATE team_entries SET roster_locked_at=CURRENT_TIMESTAMP WHERE id=?', [entry.id]);
            entry.roster_locked_at = true;
        }
    }
    const normalizeTitle = title => String(title || '').replace(/\s*\((Male|Female|Mixed|Mix|Men|Women)\)\s*$/i, '').trim().toLowerCase();
    for (const entry of entries.filter(e => !e.roster_locked_at)) {
        const siblings = entries.filter(e => normalizeTitle(e.competition_title) === normalizeTitle(entry.competition_title));
        const selected = players.filter(player => {
            if (eligibility(player, entry)) return false;
            if (assigned.some(a => Number(a.player_id) === Number(player.id) && siblings.some(e => Number(e.id) === Number(a.team_entry_id) && e.roster_locked_at))) return false;
            const target = siblings.filter(e => !e.roster_locked_at && !eligibility(player,e))
                .sort((a,b) => (ageLimit(a) - ageLimit(b)) || Number(a.id) - Number(b.id))[0];
            return Number(target?.id) === Number(entry.id);
        });
        const invalid = players.filter(p => ['birth_date','unknown_age_group'].includes(eligibility(p,entry)));
        const error = invalid.length ? `ตรวจวันเกิดหรือรุ่นอายุของนักกีฬา ${invalid.length} คน / Check birth dates or age category` : rosterError(selected,entry);
        const hash = createHash('sha256').update(JSON.stringify({ error, players: selected.map(p => [p.id,p.number,p.position,flag(p.is_captain),flag(p.is_libero1),flag(p.is_libero2),snapshot(p)]) })).digest('hex');
        if (entry.roster_source_hash === hash) continue;
        await connection.query('UPDATE team_entries SET roster_sync_error=?,roster_source_hash=? WHERE id=?', [error, hash, entry.id]);
        // Never publish a truncated roster or retain a stale roster that appears valid.
        await connection.query('DELETE FROM team_entry_players WHERE team_entry_id=?', [entry.id]);
        if (error) continue;
        for (const player of selected) {
            await connection.query(`INSERT INTO team_entry_players
                (team_entry_id,player_id,number,role,is_captain,is_libero1,is_libero2,is_playing,athlete_snapshot)
                VALUES (?,?,?,?,?,?,?,?,?)`, [entry.id,player.id,player.number,player.position,
                flag(player.is_captain)?1:0,flag(player.is_libero1)?1:0,flag(player.is_libero2)?1:0,1,snapshot(player)]);
        }
    }
}
async function refreshTeamEntries(database, teamId) {
    const connection = await database.connect();
    try {
        await connection.beginTransaction();
        await syncTeamEntries(connection, teamId);
        await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}
async function refreshCompetitionEntries(database, competitionId) {
    const teams = await database.query('SELECT DISTINCT team_id FROM team_entries WHERE competition_id=? ORDER BY team_id', [competitionId]);
    for (const { team_id } of teams.rows) await refreshTeamEntries(database, team_id);
}
module.exports = { eligibility, ageLimit, rosterError, snapshot, restoreSnapshot, syncTeamEntries, refreshTeamEntries, refreshCompetitionEntries };
