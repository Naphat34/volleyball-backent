const db=require('../config/db');
const {createHash}=require('node:crypto');
const {assertCompetition,denied}=require('../utils/accessScope');
const {roleHasPermission,normalizeRole}=require('../config/permissions');
const {lockKey}=require('../middleware/recordingLock');
const {publicProjection}=require('../middleware/accessBoundary');
const {replayScore,replayVims}=require('../utils/reviewCorrections');
const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
const endpoint=fn=>async(req,res)=>{let c;try{c=await db.connect();await c.beginTransaction();const result=await fn(c,req);await c.commit();res.json(result);}
catch(error){if(c)await c.rollback();if(!error.status)console.error('Correction operation:',error.code||error.name);res.status(error.status||500).json({error:error.status?error.message:'Unable to process retrospective correction'});}finally{c?.release();}};
async function context(c,req){
    const {kind,id,domain}=req.params,custom=kind==='custom';
    if(!['match','custom'].includes(kind)||!['score','vims'].includes(domain)||(custom&&domain!=='vims'))throw denied('Invalid correction domain',400);
    if(!roleHasPermission(req.user.role,`${domain}.record`))throw denied();
    await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[lockKey(kind,id)]);
    const actor=(await c.query('SELECT role,status,authorization_version FROM users WHERE id=? FOR SHARE',[req.user.id])).rows[0];
    if(!actor||actor.status!=='active'||normalizeRole(actor.role)!==normalizeRole(req.user.role)
        ||(req.user.authorization_version!=null&&Number(actor.authorization_version)!==Number(req.user.authorization_version)))throw denied('Account permissions changed');
    const row=(await c.query(`SELECT * FROM ${custom?'custom_vis_matches':'matches'} WHERE id=? FOR UPDATE`,[id])).rows[0];
    if(!row)throw denied('Match not found',404);
    await assertCompetition(c,req.user,row.competition_id);
    const owner=custom?row.owner_id:row.manual_owner_id;
    const assigned=!custom&&domain==='vims'&&Number(row.manual_vis_shared)===1&&String(row.manual_vis_assignee_id)===String(req.user.id);
    if(owner&&String(owner)!==String(req.user.id)&&!assigned)throw denied('Only the private match owner or assigned statistics writer may correct events');
    const review=(await c.query(`SELECT * FROM match_reviews WHERE ${custom?'custom_match_id':'match_id'}=? AND domain=? ORDER BY revision DESC LIMIT 1 FOR UPDATE`,[id,domain])).rows[0];
    if(!review||!['returned','reopened'].includes(review.status))throw denied('The domain administrator must return or reopen this revision first',409);
    if(custom?require('../utils/customVis').view(parse(row.payload)).state.phase!=='MATCH_FINISHED':row.status!=='completed')throw denied('Retrospective correction requires a completed match',409);
    if(!custom){
        const lease=(await c.query('SELECT released,expires_at FROM scorer_offline_sessions WHERE match_id=?',[id])).rows[0];
        if(lease&&!lease.released&&Number(lease.expires_at)>Date.now()||parse(row.vis_state).offlineVis?.payload?.offlineLease?.expiresAt>Date.now())throw denied('Sync and release all recording leases first',409);
        if(domain==='score'){
            const vims=(await c.query("SELECT status FROM match_reviews WHERE match_id=? AND domain='vims' ORDER BY revision DESC LIMIT 1",[id])).rows[0];
            if(vims&&['submitted','confirmed'].includes(vims.status))throw denied('Ask the VIMS administrator to return or reopen statistics before correcting scores',409);
        }
    }
    const events=custom?parse(row.payload).actions:(await c.query(`SELECT * FROM ${domain==='score'?'match_events':'match_actions'} WHERE match_id=?${domain==='vims'?" AND action_type='VIS_STAT'":''} ORDER BY id`,[id])).rows;
    const sets=custom?[]:(await c.query('SELECT * FROM match_sets WHERE match_id=? ORDER BY set_number',[id])).rows;
    const lineups=custom?[]:(await c.query('SELECT * FROM match_lineups WHERE match_id=? ORDER BY id',[id])).rows;
    const competition=(await c.query('SELECT max_sets,scoring_config FROM competitions WHERE id=?',[row.competition_id])).rows[0];
    let roster;
    if(custom)roster=['home','away'].flatMap(side=>parse(row.payload).config[side].players.map(p=>({...p,team_id:parse(row.payload).match[`${side}_team_id`]})));
    else{
        // Use the existing locked match/registration snapshots, never current master jersey numbers.
        const scorer=require('./scorerOfflineController');
        const saved=await scorer.call(scorer.scopedController(c),'getMatchRosterData',{...req,params:{matchId:row.id}},{});
        roster=['home','away'].flatMap(side=>(saved[side]?.players||[]).map(player=>({id:player.id,team_id:row[`${side}_team_id`],
            first_name:player.first_name,last_name:player.last_name,number:player.number,position:player.position,name:player.name})));
    }
    const fingerprint=createHash('sha256').update(JSON.stringify([row,review,events,sets,lineups,competition,roster])).digest('hex');
    return {row,review,events,sets,lineups,competition,roster,fingerprint,custom,domain};
}
exports.load=endpoint(async(c,req)=>{
    const ctx=await context(c,req);
    return {kind:req.params.kind,id:req.params.id,domain:ctx.domain,revision:ctx.review.revision,fingerprint:ctx.fingerprint,
        home_team_id:ctx.custom?parse(ctx.row.payload).match.home_team_id:ctx.row.home_team_id,
        away_team_id:ctx.custom?parse(ctx.row.payload).match.away_team_id:ctx.row.away_team_id,
        events:ctx.events.map(e=>({id:e.id,set_number:e.set_number||e.set_id,team_id:e.team_id,player_id:e.player_id,skill:e.skill,grade:e.grade,score_home:e.score_home,score_away:e.score_away})),roster:ctx.roster};
});
exports.save=endpoint(async(c,req)=>{
    const ctx=await context(c,req),{row,review,events,sets,lineups,competition,roster,custom,domain}=ctx;
    const reason=String(req.body.reason||'').trim();
    if(!reason||reason.length>2000)throw denied('A correction reason of 1–2000 characters is required',400);
    if(req.body.fingerprint!==ctx.fingerprint||Number(req.body.revision)!==Number(review.revision))throw denied('Correction data changed; reload the event journal',409);
    let result,after;
    if(domain==='score'){
        result=replayScore(row,events,lineups,sets,competition,req.body.edits);
        result.live.resultCorrection={reviewRevision:Number(review.revision)+1,correctedAt:new Date().toISOString(),
            signaturesRetained:Object.values(result.live.matchSignatures||{}).some(Boolean)};
        for(const event of result.events)await c.query('UPDATE match_events SET team_id=?,score_home=?,score_away=?,server_player_id=?,details=? WHERE id=? AND match_id=?',
            [event.team_id,event.score_home,event.score_away,event.server_player_id,event.details,event.id,row.id]);
        for(const set of result.sets)await c.query('UPDATE match_sets SET home_score=?,away_score=? WHERE id=? AND match_id=?',[set.home_score,set.away_score,set.id,row.id]);
        await c.query('UPDATE matches SET home_set_score=?,away_set_score=?,winner_team_id=?,set_scores=?,live_state=?,team_a_score=0,team_b_score=0 WHERE id=?',
            [result.won.home,result.won.away,result.winner,JSON.stringify(result.sets.map(s=>`${s.home_score}-${s.away_score}`)),JSON.stringify(result.live),row.id]);
        after={events:result.events,sets:result.sets,live_state:result.live};
    }else{
        let payload;
        if(custom)payload=parse(row.payload);
        else{
            const setup=parse(row.match_setup),maxSets=Number(setup.maxSets||competition.max_sets||row.max_sets||5);
            payload={config:{title:'Retrospective VIMS',maxSets,...Object.fromEntries(['home','away'].map(side=>[side,{name:side,players:roster.filter(p=>String(p.team_id)===String(row[`${side}_team_id`]))}]))},
                match:{...row,max_sets:maxSets,is_custom_vis:false,vis_state:parse(row.vis_state)},actions:events,revision:0,nextId:1,operations:[],lifecycle:'review'};
        }
        result=replayVims(payload,req.body.edits);
        if(custom)await c.query('UPDATE custom_vis_matches SET payload=?,published=0 WHERE id=?',[JSON.stringify(result),row.id]);
        else{
            for(const event of result.actions)await c.query("UPDATE match_actions SET team_id=?,player_id=?,skill=?,grade=?,score_home=?,score_away=?,description=?,details=? WHERE id=? AND match_id=? AND action_type='VIS_STAT'",
                [event.team_id,event.player_id,event.skill,event.grade,event.score_home,event.score_away,event.event_code,JSON.stringify(event.details),event.id,row.id]);
            const state={...parse(row.vis_state),...result.match.vis_state,controlRevision:Number(parse(row.vis_state).controlRevision||0)+1};
            delete state.offlineVis;await c.query('UPDATE matches SET vis_state=? WHERE id=?',[JSON.stringify(state),row.id]);
        }
        after=custom?result:{actions:result.actions,vis_state:result.match.vis_state};
    }
    await c.query('INSERT INTO audit_logs(user_id,username,role,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?,?)',
        [req.user.id,req.user.username||null,req.user.role,`${domain}.correct_events`,'match',String(row.id),JSON.stringify({kind:req.params.kind,revision:review.revision,reason,
            before:publicProjection({events,sets,live_state:row.live_state,vis_state:row.vis_state,payload:custom?row.payload:undefined}),after:publicProjection(after)})]);
    // A fresh submission is explicit; the previous review and the completed match status remain intact.
    return {success:true,revision:review.revision,requires_resubmission:true,status:'completed'};
});
