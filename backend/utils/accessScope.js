const { normalizeRole, roleHasPermission, getRolePermissions } = require('../config/permissions');
const denied = (message = 'Insufficient permissions', status = 403) => Object.assign(new Error(message), { status });
const isSystemAdmin = user => normalizeRole(user?.role) === 'super_admin';
async function loadCapabilities(db, user) {
    const rows = isSystemAdmin(user) ? [] : (await db.query(
        'SELECT competition_id FROM user_competition_access WHERE user_id=? AND revoked_at IS NULL', [user.id])).rows;
    return { ...user, role: normalizeRole(user.role), permissions: getRolePermissions(user.role), competition_ids: rows.map(r => Number(r.competition_id)) };
}
async function assertCompetition(db, user, id) {
    if (!id) throw denied('Link a competition before this action', 409);
    if (isSystemAdmin(user)) return;
    const grant = await db.query('SELECT user_id FROM user_competition_access WHERE user_id=? AND competition_id=? AND revoked_at IS NULL', [user.id, id]);
    if (!grant.rows.length) throw denied('No access to this competition');
}
function scopeSql(user, column) {
    if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i.test(column)) throw Error('Invalid scope column');
    return isSystemAdmin(user) ? { sql: '1=1', params: [] } : {
        sql: `${column} IN (SELECT competition_id FROM user_competition_access WHERE user_id=? AND revoked_at IS NULL)`, params: [user.id],
    };
}
async function matchResource(db, kind, id) {
    const custom = kind === 'custom';
    const row = (await db.query(`SELECT * FROM ${custom ? 'custom_vis_matches' : 'matches'} WHERE id=?`, [id])).rows[0];
    if (!row) throw denied('Match not found', 404);
    return { row, custom };
}
async function assertMatch(db, user, kind, id, permission, { draftOwner = false, writing = false, domain } = {}) {
    if (!roleHasPermission(user?.role, permission)) throw denied();
    const resource = await matchResource(db, kind, id), { row, custom } = resource;
    const owner = custom ? row.owner_id : row.manual_owner_id;
    if (!(owner && draftOwner && String(owner) === String(user.id) && !row.competition_id)) await assertCompetition(db, user, row.competition_id);
    const statisticsWriter=domain==='vims'&&!custom&&Number(row.manual_vis_shared)===1&&String(row.manual_vis_assignee_id)===String(user.id);
    if (owner && writing && draftOwner && String(owner) !== String(user.id)&&!statisticsWriter) throw denied('Only the owner or assigned statistics writer can edit this private match');
    if (writing && domain) {
        const latest = (await db.query(`SELECT status FROM match_reviews WHERE ${custom ? 'custom_match_id' : 'match_id'}=? AND domain=? ORDER BY revision DESC LIMIT 1`, [id, domain])).rows[0];
        if (latest && ['submitted', 'confirmed'].includes(latest.status)) throw denied('This revision is locked for review; request a return or reopen', 409);
        if(latest&&['returned','reopened'].includes(latest.status)){
            const completed=custom?require('./customVis').view(typeof row.payload==='string'?JSON.parse(row.payload):row.payload).state.phase==='MATCH_FINISHED':row.status==='completed';
            if(completed)throw denied('Use the retrospective correction center for a completed match',409);
        }
    }
    return resource;
}
module.exports = { denied, isSystemAdmin, loadCapabilities, assertCompetition, scopeSql, matchResource, assertMatch };
