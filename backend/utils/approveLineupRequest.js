const { roleHasPermission } = require('../config/permissions');

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const isActive = value => value == null || value === '' || value === true || value === 1 || value === '1';

async function approveLineupRequest(db, req) {
    if (!roleHasPermission(req.user?.role, 'match.score')) fail('Insufficient permissions', 403);
    const connection = await db.connect();
    try {
        await connection.beginTransaction();
        const matchId = req.params.matchId;
        const match = (await connection.query('SELECT * FROM matches WHERE id=? FOR UPDATE', [matchId])).rows[0];
        if (!match) fail('Match not found', 404);
        const request = (await connection.query('SELECT * FROM match_requests WHERE id=? AND match_id=? FOR UPDATE', [req.params.requestId,matchId])).rows[0];
        if (!request || request.request_type !== 'LINEUP') fail('Lineup request not found', 404);
        if (request.status === 'APPROVED') { await connection.commit(); return request; }
        if (request.status !== 'PENDING') fail('Only pending requests can be approved', 409);
        if (!['scheduled','live'].includes(match.status)) fail('Match is locked', 409);
        if (![match.home_team_id,match.away_team_id].some(id => String(id) === String(request.team_id))) fail('Team is not part of this match');
        const live = parse(match.live_state) || {};
        const details = parse(request.details) || {};
        const set = Number(details.setNumber ?? details.set_number ?? 1);
        const activeSet = Number(live.matchData?.currentSet ?? live.matchData?.current_set ?? match.current_set ?? 1);
        if (!Number.isInteger(set) || set < 1 || set !== activeSet) fail('Lineup does not belong to the current set', 409);
        if (live.workflowStep && live.workflowStep !== 'LINEUP') fail('Lineups can be accepted only during the lineup workflow', 409);
        const submitted = Array.isArray(details.lineup) ? [...details.lineup].sort((a,b)=>Number(a.position)-Number(b.position)) : [];
        const ids = submitted.map(player => Number(player.player_id ?? player.id));
        if (submitted.length !== 6 || submitted.some((player,index)=>Number(player.position)!==index+1)
            || ids.some(id=>!Number.isSafeInteger(id)||id<1) || new Set(ids).size !== 6) fail('Lineup requires six different players in positions 1–6');
        const offline = require('../controllers/scorerOfflineController');
        await require('../controllers/officialVisOfflineController').assertOnline(connection,matchId);
        const lease = (await connection.query('SELECT * FROM scorer_offline_sessions WHERE match_id=? FOR UPDATE',[matchId])).rows[0];
        if (lease && !lease.released && Number(lease.expires_at)>Date.now()) fail('Match is checked out offline',409);
        const controller = offline.scopedController(connection);
        const roster = await offline.call(controller,'getMatchRosterData',req,{});
        const side = String(request.team_id) === String(match.home_team_id) ? 'home' : 'away';
        const players = roster[side]?.players || [];
        for (const id of ids) {
            const player = players.find(player=>Number(player.id)===id);
            const flag = value => value === true || value === 1 || value === '1';
            if (!player || !isActive(player.is_playing)
                || flag(player.is_libero) || flag(player.is_libero1) || flag(player.is_libero2)
                || /^(L|L1|L2|L1\+C|L2\+C)$/i.test(player.role || player.position || '')) fail('Lineup includes an unavailable player or Libero');
        }
        await offline.call(controller,'saveLineup',req,{team_id:request.team_id,set_number:set,player_positions:ids,libero_id:null});
        await connection.query("UPDATE match_requests SET status='APPROVED' WHERE id=? AND match_id=?",[request.id,matchId]);
        await connection.commit();
        return {...request,status:'APPROVED',details,lineup:ids};
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}

module.exports = { approveLineupRequest };
