const { fail } = require('./visWorkflow');

async function linkAthlete(connection, payload, matchId, actor, command) {
    if (actor.role !== 'admin') fail('เฉพาะผู้ดูแลระบบสามารถยืนยันตัวตนนักกีฬาได้', 403);
    const { side, localPlayerId, playerId } = command;
    if (!['home', 'away'].includes(side) || !Number.isSafeInteger(localPlayerId)
        || !payload.config[side].players.some(player => player.id === localPlayerId)) fail('ไม่พบนักกีฬาในแมตช์');
    if (playerId == null) {
        await connection.query('DELETE FROM custom_vis_player_links WHERE match_id=? AND side=? AND local_player_id=?', [matchId, side, localPlayerId]);
        return;
    }
    if (!Number.isSafeInteger(playerId) || playerId <= 0) fail('รหัสนักกีฬาไม่ถูกต้อง');
    const master = await connection.query('SELECT id FROM players WHERE id=? AND COALESCE(is_active,1)=1 FOR UPDATE', [playerId]);
    if (!master.rows.length) fail('ไม่พบนักกีฬาที่ใช้งานอยู่ในทะเบียนหลัก');
    await connection.query('DELETE FROM custom_vis_player_links WHERE match_id=? AND side=? AND local_player_id=?', [matchId, side, localPlayerId]);
    await connection.query(`INSERT INTO custom_vis_player_links(match_id,side,local_player_id,player_id,linked_by)
        VALUES(?,?,?,?,?)`,
    [matchId, side, localPlayerId, playerId, actor.id]);
}

async function retainUnchangedLinks(connection, matchId, previous, next) {
    const links = await connection.query('SELECT side,local_player_id FROM custom_vis_player_links WHERE match_id=?', [matchId]);
    for (const link of links.rows) {
        const before = previous.config[link.side].players.find(p => p.id === link.local_player_id);
        const after = next.config[link.side].players.find(p => p.id === link.local_player_id);
        if (!before || !after || before.first_name !== after.first_name || before.last_name !== after.last_name) {
            await connection.query('DELETE FROM custom_vis_player_links WHERE match_id=? AND side=? AND local_player_id=?', [matchId, link.side, link.local_player_id]);
        }
    }
}
module.exports = { linkAthlete, retainUnchangedLinks };
