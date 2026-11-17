const {createHash}=require('node:crypto');
const {sqlDialect}=require('./sqlDialect');
const {denied}=require('./accessScope');
const rules=require('./competitionWorkflow');
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const resultHash=match=>digest([match.id,match.status,match.home_team_id,match.away_team_id,match.home_set_score,match.away_set_score,match.winner_team_id,match.set_scores,match.max_sets,match.result_type]);

async function lock(c,competitionId){
    if(process.env.DB_PROVIDER==='postgres')await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[`competition-workflow:${competitionId}`]);
}
async function read(c,id,forUpdate=false){
    const row=(await c.query(`SELECT * FROM competition_workflows WHERE competition_id=?${forUpdate?' FOR UPDATE':''}`,[id])).rows[0];
    return row?{...row,state:parse(row.state)}:null;
}
async function write(c,row,userId){
    const updated=await c.query('UPDATE competition_workflows SET state=?,revision=revision+1,updated_by=?,updated_at=NOW() WHERE competition_id=? AND revision=?',[JSON.stringify(row.state),userId,row.competition_id,row.revision]);
    rules.check(updated.affectedRows===1,'ข้อมูลถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาโหลดใหม่');row.revision++;
}
async function audit(c,req,action,competitionId,details){
    await c.query('INSERT INTO audit_logs (user_id,username,role,action,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?,NOW())',
        [req.user.id,req.user.username||null,req.user.role,`workflow.${action}`,'competition',competitionId,JSON.stringify(details)]);
}
async function matches(c,id){
    return (await c.query(`SELECT m.*,w.phase,w.pool_name AS workflow_pool,w.slot_key,w.home_source,w.away_source FROM competition_workflow_matches w JOIN matches m ON m.id=w.match_id WHERE w.competition_id=? ORDER BY m.id`,[id])).rows;
}
async function started(c,match){
    if(match.status!=='scheduled'||match.home_set_score||match.away_set_score)return true;
    const lease=(await c.query('SELECT released,expires_at FROM scorer_offline_sessions WHERE match_id=?',[match.id])).rows[0];
    if(lease&&!lease.released&&Number(lease.expires_at)>Date.now())return true;
    try{if(Number(parse(match.vis_state)?.offlineVis?.payload?.offlineLease?.expiresAt)>Date.now())return true;}catch{return true;}
    if(match.vis_state&&parse(match.vis_state)?.offlineVis?.payload?.offlineLease?.expiresAt>Date.now())return true;
    for(const table of ['match_events','match_sets','match_lineups','match_actions'])if((await c.query(`SELECT id FROM ${table} WHERE match_id=? LIMIT 1`,[match.id])).rows.length)return true;
    return false;
}
async function evidence(c,match,state){
    if(state.holds?.[match.id])return null;
    if(match.status!=='completed')return null;
    if(match.result_type==='forfeit')return state.forfeits?.[match.id]?.hash===resultHash(match)?`forfeit:${state.forfeits[match.id].hash}`:null;
    const review=(await c.query("SELECT revision,status,fingerprint FROM match_reviews WHERE match_id=? AND domain='score' ORDER BY revision DESC LIMIT 1",[match.id])).rows[0];
    if(review?.status!=='confirmed')return null;
    const fingerprint=await require('../controllers/accessController').scoreFingerprint(c,match,false,'score');
    if(review.fingerprint!==fingerprint)return null;
    await require('./reviewValidation').validateScore(c,match);
    return `review:${review.revision}:${fingerprint}`;
}
async function lockMatch(c,id){
    if(process.env.DB_PROVIDER==='postgres')await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[require('../middleware/recordingLock').lockKey('match',id)]);
    await c.query('SELECT id FROM matches WHERE id=? FOR UPDATE',[id]);
}
async function snapshot(c,match){
    const value={match};
    for(const [key,table]of [['sets','match_sets'],['events','match_events'],['lineups','match_lineups'],['actions','match_actions'],['reviews','match_reviews']])value[key]=(await c.query(`SELECT * FROM ${table} WHERE match_id=? ORDER BY id`,[match.id])).rows;
    return require('../middleware/accessBoundary').publicProjection(value);
}
async function restoreSets(c,id,sets){
    await c.query('DELETE FROM match_sets WHERE match_id=?',[id]);
    for(const set of sets){
        const fields=['id','public_id','match_id','set_number','home_score','away_score','start_time','end_time','duration_minutes'].filter(key=>set[key]!==undefined);
        const values=fields.map(key=>['start_time','end_time'].includes(key)&&set[key]?new Date(set[key]):set[key]);
        await c.query(`INSERT INTO match_sets (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,values);
    }
}
async function qualifications(c,row,rankDraws={},strict=true){
    const competition=(await c.query('SELECT max_sets,scoring_config FROM competitions WHERE id=?',[row.competition_id])).rows[0];
    const all=(await matches(c,row.competition_id)).filter(match=>match.phase==='group');
    const ranking=[],qualifiers=[],sources={},blocked=[];
    rules.validateExistingMatches(row.state.format,row.state.groups,all);
    for(const match of all){const proof=await evidence(c,match,row.state);if(!proof)blocked.push(match.id);else sources[match.id]=proof;}
    if(strict)rules.check(!blocked.length,'ยังมีแมตช์ที่ผลไม่ครบ ไม่ผ่านตรวจรับ หรือมีการแก้ไขผล กรุณาจัดการให้ครบก่อนยืนยันอันดับ');
    for(const group of row.state.groups){
        const poolMatches=all.filter(match=>match.workflow_pool===group.name);
        const complete=poolMatches.every(match=>sources[match.id]);
        let ranks=[];
        if(complete||!strict){
            ranks=rules.calculatePoolRanking(group,poolMatches.filter(match=>sources[match.id]),parse(competition?.scoring_config)?.maxSets||competition?.max_sets);
            if(strict){ranks=rules.applyRankDraw(ranks,rankDraws[group.name]||[]);qualifiers.push(...ranks.slice(0,2).map(team=>({...team,pool:group.name})));}
        }
        const ties=[];
        for(let index=0;index<ranks.length;){let end=index+1;while(end<ranks.length&&rules.compareRank(ranks[index],ranks[end])===0)end++;if(end-index>1)ties.push(ranks.slice(index,end).map(team=>team.teamId));index=end;}
        ranking.push({pool:group.name,complete,ranks,ties});
    }
    if(strict)rules.check(!qualifiers.some(team=>row.state.withdrawn?.[team.teamId]),'ทีมที่ถอนตัวยังติดอันดับเข้ารอบ ระงับไว้ให้ผู้จัดตัดสิน ไม่มีการเลื่อนทีมแทนอัตโนมัติ');
    return {ranking,qualifiers,sources,blocked,hash:digest(sources)};
}
async function insertMatch(c,competition,home,away,round,pool,number){
    const result=await c.query(sqlDialect(
        'INSERT INTO matches (competition_id,home_team_id,away_team_id,round_name,pool_name,match_number,status,age_group_id,gender,max_sets,stadium_id,set_scores) VALUES (?,?,?,?,?,?,\'scheduled\',?,?,?,?,\'[]\')',
        'INSERT INTO matches (competition_id,home_team_id,away_team_id,round_name,pool_name,match_number,status,age_group_id,gender,max_sets,stadium_id,set_scores) VALUES (?,?,?,?,?,?,\'scheduled\',?,?,?,?,\'[]\') RETURNING id'),
    [competition.id,home||null,away||null,round,pool||null,String(number),competition.age_group_id,competition.gender,competition.max_sets||5,competition.stadium_id]);
    return result.insertId;
}
async function nextNumber(c,id){
    const rows=(await c.query('SELECT match_number FROM matches WHERE competition_id=?',[id])).rows;
    return Math.max(0,...rows.map(row=>/^\d+$/.test(String(row.match_number))?Number(row.match_number):0))+1;
}
async function propagate(c,row,userId=null){
    if(row.state.invalidated)return;
    const all=(await matches(c,row.competition_id)).filter(match=>match.phase==='knockout'),byKey=new Map(all.map(match=>[match.slot_key,match]));
    const proofs=new Map();
    const confirmed=async match=>{if(!proofs.has(match.id))proofs.set(match.id,await evidence(c,match,row.state));return proofs.get(match.id);};
    for(const target of all){
        const resolved=[];
        for(const field of ['home_source','away_source']){
            const source=parse(target[field]);
            if(source.type==='team'){resolved.push(source.teamId);continue;}
            if(source.type==='pool'){resolved.push(row.state.qualification?.qualifiers.find(team=>team.pool===source.pool&&team.rank===source.rank)?.teamId||null);continue;}
            const from=byKey.get(source.slot);
            if(!from||!await confirmed(from)){resolved.push(null);continue;}
            const win=from.winner_team_id,lose=String(win)===String(from.home_team_id)?from.away_team_id:from.home_team_id;
            resolved.push(source.type==='winner'?win:lose);
        }
        if(String(resolved[0])!==String(target.home_team_id)||String(resolved[1])!==String(target.away_team_id)){
            rules.check(!await started(c,target),'แมตช์ปลายทางเริ่มดำเนินการแล้ว ไม่สามารถเปลี่ยนทีมอัตโนมัติ');
            await c.query('UPDATE matches SET home_team_id=?,away_team_id=? WHERE id=?',[...resolved,target.id]);
            target.home_team_id=resolved[0];target.away_team_id=resolved[1];
        }
    }
    if(all.length&&userId){
        let finished=true;for(const match of all)if(!await confirmed(match)){finished=false;break;}
        if(finished&&row.state.status!=='completed'){
            const final=byKey.get('R2-1'),bronze=byKey.get('BRONZE-1');
            const loser=match=>String(match.winner_team_id)===String(match.home_team_id)?match.away_team_id:match.home_team_id;
            row.state.status='completed';row.state.podium={champion:final.winner_team_id,runnerUp:loser(final),...(row.state.format.thirdPlace===false?{thirdJoint:[loser(byKey.get('R4-1')),loser(byKey.get('R4-2'))]}:{third:bronze.winner_team_id,fourth:loser(bronze)})};
            await write(c,row,userId);
        }
    }
}
async function lockForMatch(c,id){
    const link=(await c.query('SELECT competition_id FROM competition_workflow_matches WHERE match_id=?',[id])).rows[0];
    if(link)await lock(c,link.competition_id);
    return link;
}
async function onReviewChange(c,id,action,userId){
    const link=(await c.query('SELECT * FROM competition_workflow_matches WHERE match_id=?',[id])).rows[0];if(!link)return;
    const row=await read(c,link.competition_id,true);
    if(action==='confirm'){await propagate(c,row,userId);return;}
    if(action!=='reopen')return;
    const all=(await matches(c,row.competition_id)).filter(match=>match.phase==='knockout');
    if(link.phase==='group'&&row.state.qualification){
        for(const match of all){await lockMatch(c,match.id);rules.check(!await started(c,(await c.query('SELECT * FROM matches WHERE id=?',[match.id])).rows[0]),'รอบถัดไปเริ่มดำเนินการแล้ว ต้องให้ผู้จัดจัดการผลกระทบก่อนเปิดแก้ไข');}
        row.state.invalidated=true;await write(c,row,userId);
    } else if(link.phase==='knockout'){
        const affected=new Set([link.slot_key]);
        for(const target of all){
            const sources=[parse(target.home_source),parse(target.away_source)];
            if(!sources.some(source=>affected.has(source.slot)))continue;
            await lockMatch(c,target.id);
            Object.assign(target,(await c.query('SELECT * FROM matches WHERE id=?',[target.id])).rows[0]);
            rules.check(!await started(c,target),'รอบปลายทางเริ่มดำเนินการแล้ว ไม่อนุญาตให้เปิดผลต้นทางใหม่');affected.add(target.slot_key);
            const home=sources[0].slot&&affected.has(sources[0].slot)?null:target.home_team_id;
            const away=sources[1].slot&&affected.has(sources[1].slot)?null:target.away_team_id;
            await c.query('UPDATE matches SET home_team_id=?,away_team_id=? WHERE id=?',[home,away,target.id]);
        }
        if(row.state.status==='completed'){row.state.status='bracket';delete row.state.podium;await write(c,row,userId);}
    }
}
async function assertRecording(c,id){
    const link=(await c.query('SELECT w.phase,f.state,m.home_team_id,m.away_team_id,m.result_type FROM competition_workflow_matches w JOIN competition_workflows f ON f.competition_id=w.competition_id JOIN matches m ON m.id=w.match_id WHERE w.match_id=?',[id])).rows[0];
    if(!link)return;
    rules.check(!parse(link.state).holds?.[id],'แมตช์ถูกระงับ ต้องมีคำตัดสินก่อนบันทึก');
    rules.check(link.result_type!=='forfeit','แมตช์นี้ยืนยันผลปรับแพ้แล้ว ต้องยกเลิกคำตัดสินก่อนบันทึก');
    if(link.phase==='knockout')rules.check(!parse(link.state).invalidated&&link.home_team_id&&link.away_team_id,'ผังยังไม่พร้อมหรือผลต้นทางถูกเปิดแก้ไข ไม่สามารถเริ่มบันทึกได้');
}
async function assertMetadata(c,id,body,remove=false,recording=false){
    const link=(await c.query('SELECT match_id FROM competition_workflow_matches WHERE match_id=?',[id])).rows[0];if(!link)return;
    if(remove)throw denied('แมตช์อยู่ใน workflow กรุณาจัดการจากหน้ารอบและสาย',409);
    const row=(await c.query('SELECT * FROM matches WHERE id=?',[id])).rows[0];
    for(const field of ['competition_id','home_team_id','away_team_id','pool_name','round_name','max_sets','result_type','forfeit_reason',...(recording?[]:['status'])])if(body[field]!==undefined&&String(body[field]??'')!==String(row[field]??''))throw denied('ทีม สาย รอบ และกติกาของแมตช์นี้ต้องจัดการจาก workflow',409);
}
async function attachRanks(c,competitionId,teams){
    const workflow=await read(c,competitionId);
    if(!workflow?.state.qualification||workflow.state.invalidated)return teams;
    const ranked=new Map(workflow.state.qualification.ranking.flatMap(pool=>pool.ranks.map(team=>[String(team.teamId),{workflow_pool:pool.pool,workflow_rank:team.rank}])));
    return teams.map(team=>({...team,...ranked.get(String(team.id))}));
}
module.exports={snapshot,restoreSets,lockMatch,parse,digest,resultHash,lock,read,write,audit,matches,started,evidence,qualifications,insertMatch,nextNumber,propagate,lockForMatch,onReviewChange,assertRecording,assertMetadata,attachRanks};
