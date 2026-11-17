const db=require('../config/db');
const {assertCompetition,denied}=require('../utils/accessScope');
const {roleHasPermission}=require('../config/permissions');
async function update(req,res){
    try{
        if(!roleHasPermission(req.user.role,'score.record'))throw denied();
        const match=(await db.query('SELECT home_team_id,away_team_id,competition_id FROM matches WHERE id=?',[req.params.matchId])).rows[0];
        if(!match||![match.home_team_id,match.away_team_id].some(id=>String(id)===String(req.params.teamId)))throw denied('Team does not belong to this match');
        if(!match.competition_id){
            const controller=require('./scorerController');
            return req.params.playerId?controller.updateMatchTeamPlayer(req,res):controller.createMatchTeamPlayer(req,res);
        }
        await assertCompetition(db,req.user,match.competition_id);
        const lease=(await db.query('SELECT released,expires_at FROM scorer_offline_sessions WHERE match_id=?',[req.params.matchId])).rows[0];
        if(lease&&!lease.released&&Number(lease.expires_at)>Date.now())throw denied('Release the offline match lease before editing this registry',409);
        await require('./officialVisOfflineController').assertOnline(db,req.params.matchId);
        const admin=require('./adminController');
        if(req.params.playerId){
            const player=(await db.query('SELECT team_id FROM players WHERE id=?',[req.params.playerId])).rows[0];
            if(!player||String(player.team_id)!==String(req.params.teamId))throw denied('Player does not belong to this team');
            req.params.id=req.params.playerId;
            return admin.updatePlayer(req,res);
        }
        return admin.addPlayerToTeam(req,res);
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'Cannot update athlete registry'});}
}
module.exports={update};
