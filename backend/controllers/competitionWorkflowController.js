const db=require('../config/db');
const {roleHasPermission}=require('../config/permissions');
const {assertCompetition,denied}=require('../utils/accessScope');
const r=require('../utils/competitionWorkflow');
const s=require('../utils/competitionWorkflowStore');

async function authorize(c,req){
    if(!roleHasPermission(req.user?.role,'match.manage'))throw denied();
    await assertCompetition(c,req.user,req.params.competitionId);
    const competition=(await c.query('SELECT id,public_id,title,title_th,title_en,gender,age_group_id,max_sets,stadium_id FROM competitions WHERE id=?',[req.params.competitionId])).rows[0];
    if(!competition)throw denied('ไม่พบรายการแข่งขัน',404);
    return competition;
}
async function approved(c,id){return (await c.query("SELECT DISTINCT t.id,t.public_id,t.name,t.name_th,t.name_en FROM team_entries e JOIN teams t ON t.id=e.team_id WHERE e.competition_id=? AND e.status='approved' ORDER BY t.id",[id])).rows;}
const pickMatch=match=>Object.fromEntries(['id','public_id','home_team_id','away_team_id','match_number','round_name','pool_name','match_date','start_time','location','stadium_id','status','home_set_score','away_set_score','winner_team_id','result_type','forfeit_reason','phase','slot_key','home_source','away_source'].map(key=>[key,match[key]]));
exports.read=async(req,res)=>{
    try{
        const competition=await authorize(db,req),workflow=await s.read(db,competition.id);
        const current=workflow?await s.matches(db,competition.id):[];
        let preview=null;
        if(workflow&&workflow.state.status!=='draft')preview=await s.qualifications(db,workflow,{},false);
        const existing=(await db.query('SELECT id,public_id,home_team_id,away_team_id,pool_name,round_name,status,match_number FROM matches WHERE competition_id=? AND manual_owner_id IS NULL ORDER BY id',[competition.id])).rows;
        const history=(await db.query("SELECT id,username,role,action,details,created_at FROM audit_logs WHERE entity_type='competition' AND entity_id=? AND action LIKE 'workflow.%' ORDER BY id DESC LIMIT 50",[String(competition.id)])).rows;
        res.json({competition,workflow,teams:await approved(db,competition.id),matches:current.map(match=>require('../utils/matchSchedule').normalizeMatchSchedule(pickMatch(match))),existing,preview,history});
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'ไม่สามารถโหลด workflow ได้'});}
};
async function forfeit(c,row,matchId,losingId,reason,actor){
    r.check(reason.length>=3,'ต้องระบุเหตุผลคำตัดสิน');
    const belongs=(await c.query('SELECT match_id FROM competition_workflow_matches WHERE competition_id=? AND match_id=?',[row.competition_id,matchId])).rows[0];
    r.check(belongs,'แมตช์ไม่อยู่ใน workflow นี้');
    await s.lockMatch(c,matchId);
    const match=(await s.matches(c,row.competition_id)).find(item=>String(item.id)===String(matchId));
    r.check(match&&match.home_team_id&&match.away_team_id,'คู่แข่งขันยังไม่พร้อม');
    r.check(!await s.started(c,match),'ผลปรับแพ้นี้ใช้กับแมตช์ที่ยังไม่เริ่มเท่านั้น');
    r.check([String(match.home_team_id),String(match.away_team_id)].includes(String(losingId)),'ทีมที่ปรับแพ้ต้องอยู่ในแมตช์');
    const homeWins=String(losingId)===String(match.away_team_id);
    const competition=(await c.query('SELECT max_sets,scoring_config FROM competitions WHERE id=?',[row.competition_id])).rows[0];
    const config={...s.parse(competition.scoring_config),...s.parse(match.match_setup)};
    const best=Number(config.maxSets||competition.max_sets||match.max_sets||5);
    r.check([3,5].includes(best),'ผลปรับแพ้นี้รองรับ Best of 3 หรือ Best of 5');
    const needed=Math.ceil(best/2),home=homeWins?needed:0,away=homeWins?0:needed;
    const sets=Array.from({length:needed},()=>homeWins?'25-0':'0-25'),winner=homeWins?match.home_team_id:match.away_team_id;
    await c.query("UPDATE matches SET status='completed',home_set_score=?,away_set_score=?,winner_team_id=?,set_scores=?,result_type='forfeit',forfeit_reason=? WHERE id=?",[home,away,winner,JSON.stringify(sets),reason,match.id]);
    for(let index=1;index<=needed;index++)await c.query('INSERT INTO match_sets(match_id,set_number,home_score,away_score,end_time) VALUES(?,?,?,?,NOW())',[match.id,index,homeWins?25:0,homeWins?0:25]);
    const changed=(await c.query('SELECT * FROM matches WHERE id=?',[match.id])).rows[0];
    row.state.forfeits||={};row.state.forfeits[match.id]={losingTeamId:Number(losingId),winnerTeamId:winner,reason,actor,at:new Date().toISOString(),hash:s.resultHash(changed)};
    if(row.state.holds)delete row.state.holds[match.id];
}
exports.mutate=async(req,res)=>{
    let c;
    try{
        c=await db.connect();await c.beginTransaction();
        const competition=await authorize(c,req),id=competition.id,action=req.params.action,body=req.body||{};
        await s.lock(c,id);
        const actor=(await c.query('SELECT role,status,authorization_version FROM users WHERE id=? FOR SHARE',[req.user.id])).rows[0];
        if(!actor||actor.status!=='active'||actor.role!==req.user.role||(req.user.authorization_version!=null&&Number(actor.authorization_version)!==Number(req.user.authorization_version)))throw denied('สิทธิ์บัญชีเปลี่ยน กรุณาเข้าสู่ระบบใหม่');
        await assertCompetition(c,req.user,id);
        let row=await s.read(c,id,true);
        r.check(Number(body.revision)===Number(row?.revision||0),'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่ก่อนดำเนินการ');
        if(action==='configure'){
            if(req.user.role!=='super_admin')throw denied('Super Admin เท่านั้นที่ตั้งค่ารูปแบบรายการได้');
            r.check(!row||row.state.status==='draft','เผยแพร่รอบแรกแล้ว ไม่สามารถเปลี่ยนโครงสร้างรายการได้');
            const format=r.validateFormat(body.format);
            if(!row){
                await c.query('INSERT INTO competition_workflows(competition_id,state,updated_by) VALUES(?,?,?)',[id,JSON.stringify({status:'draft',format,groups:[],withdrawn:{},forfeits:{}}),req.user.id]);
                row=await s.read(c,id,true);
            }else{
                const changed=s.digest(row.state.format)!==s.digest(format);
                if(changed&&row.state.groups.length)r.check(body.resetGroups===true,'การเปลี่ยนรูปแบบจะล้างสายฉบับร่าง ต้องยืนยันเริ่มจัดสายใหม่');
                row.state.format=format;if(changed)row.state.groups=[];await s.write(c,row,req.user.id);
            }
        }else{
            r.check(row,'ให้ Super Admin ตั้งค่ารูปแบบก่อน');
            if(action==='third-place'){
                if(req.user.role!=='super_admin')throw denied();
                r.check(typeof body.enabled==='boolean','ต้องระบุว่ามีชิงอันดับ 3 หรือไม่');
                r.check(row.state.status!=='completed','รายการจบแล้ว ไม่สามารถเปลี่ยนกติกาได้');
                const all=await s.matches(c,id),bronze=all.find(match=>match.slot_key==='BRONZE-1');
                if(!body.enabled&&bronze){
                    await s.lockMatch(c,bronze.id);
                    r.check(!await s.started(c,(await c.query('SELECT * FROM matches WHERE id=?',[bronze.id])).rows[0]),'คู่ชิงอันดับ 3 เริ่มบันทึกแล้ว ไม่สามารถยกเลิกได้');
                    r.check(body.confirmRemoval===true,'ต้องยืนยันยกเลิกคู่ชิงอันดับ 3 และตารางของคู่นี้');
                    r.check(!(await c.query('SELECT id FROM match_reviews WHERE match_id=? LIMIT 1',[bronze.id])).rows.length,'คู่ชิงอันดับ 3 มีประวัติตรวจรับแล้ว ไม่สามารถยกเลิกได้');
                    await c.query('DELETE FROM competition_workflow_matches WHERE match_id=?',[bronze.id]);
                    await c.query('DELETE FROM matches WHERE id=?',[bronze.id]);
                    if(row.state.holds)delete row.state.holds[bronze.id];
                }else if(body.enabled&&!bronze&&all.some(match=>match.phase==='knockout')){
                    const number=await s.nextNumber(c,id);
                    const matchId=await s.insertMatch(c,competition,null,null,'BRONZE',null,number);
                    await c.query("INSERT INTO competition_workflow_matches(match_id,competition_id,phase,slot_key,home_source,away_source) VALUES(?,?,'knockout',?,?,?)",[matchId,id,'BRONZE-1',JSON.stringify({type:'loser',slot:'R4-1'}),JSON.stringify({type:'loser',slot:'R4-2'})]);
                }
                row.state.format.thirdPlace=body.enabled;
                if(row.state.qualification&&!row.state.invalidated)await s.propagate(c,row,req.user.id);
            }else if(action==='groups'){
                r.check(row.state.status==='draft','ยืนยันตารางแล้ว ไม่สามารถย้ายทีมข้ามสายได้');
                row.state.groups=r.validateGroups(row.state.format,body.groups,(await approved(c,id)).map(team=>team.id));
            }else if(action==='publish'){
                r.check(row.state.status==='draft','ยืนยันรอบแรกไปแล้ว');
                const groups=r.validateGroups(row.state.format,row.state.groups,(await approved(c,id)).map(team=>team.id));
                const existing=(await c.query('SELECT * FROM matches WHERE competition_id=? FOR UPDATE',[id])).rows;
                if(body.adopt){
                    r.validateExistingMatches(row.state.format,groups,existing);
                    for(const match of existing)await c.query("INSERT INTO competition_workflow_matches(match_id,competition_id,phase,pool_name) VALUES(?,?,'group',?)",[match.id,id,match.pool_name]);
                }else{
                    r.check(!existing.length,'รายการมีแมตช์อยู่แล้ว ให้เลือกตรวจสอบและเชื่อมแมตช์เดิม');
                    let number=await s.nextNumber(c,id);
                    for(const pair of r.groupPairs(groups)){
                        const matchId=await s.insertMatch(c,competition,pair.home,pair.away,row.state.format.groupRoundName,pair.pool,number++);
                        await c.query("INSERT INTO competition_workflow_matches(match_id,competition_id,phase,pool_name) VALUES(?,?,'group',?)",[matchId,id,pair.pool]);
                    }
                }
                row.state.status='groups';
            }else if(action==='plan-bracket'){
                r.check(body.mode===undefined||['selected','waiting'].includes(body.mode),'Invalid pairing method');
                r.check(row.state.status==='groups'&&!row.state.invalidated,'Publish group fixtures before planning knockout fixtures');
                r.check(!(await s.matches(c,id)).some(match=>match.phase==='knockout'),'Knockout fixtures already exist');
                const pending=body.mode==='waiting';
                const defaultPairs=row.state.groups.map((group,index)=>({home:index*2+1,away:((index+1)%row.state.groups.length)*2+2}));
                const plan=require('../utils/workflowSchedule').poolBracket(row.state.groups,pending?defaultPairs:body.pairs,row.state.format.thirdPlace!==false);
                if(pending)for(const slot of plan)for(const side of ['home','away'])if(slot[side].type==='pool')slot[side]={type:'draw',position:slot.position,side};
                let number=await s.nextNumber(c,id);
                if(body.startNumber!==undefined){r.check(Number.isSafeInteger(Number(body.startNumber))&&Number(body.startNumber)>=number&&Number(body.startNumber)+plan.length-1<=999999999,'Starting match number must follow existing fixtures and stay within 9 digits');number=Number(body.startNumber);}
                for(const slot of plan){
                    const matchId=await s.insertMatch(c,competition,null,null,slot.round,null,number++);
                    await c.query("INSERT INTO competition_workflow_matches(match_id,competition_id,phase,slot_key,home_source,away_source) VALUES(?,?,'knockout',?,?,?)",[matchId,id,slot.key,JSON.stringify(slot.home),JSON.stringify(slot.away)]);
                }
                row.state.plannedBracket=true;row.state.plannedDrawPending=pending;
            }else if(action==='schedule'){
                r.check(Array.isArray(body.matches)&&body.matches.length>0&&body.matches.length<=128,'Invalid schedule');
                const all=await s.matches(c,id),seen=new Set();
                const updates=body.matches.map(input=>{
                    r.check(input&&typeof input==='object','Invalid schedule entry');
                    const match=all.find(item=>String(item.id)===String(input.id));
                    r.check(match&&match.phase==='knockout'&&!seen.has(String(input.id)),'Invalid or duplicate knockout match');seen.add(String(input.id));
                    const number=String(input.match_number||'').trim(),date=String(input.match_date||''),time=String(input.start_time||''),location=String(input.location||'').trim();
                    const round=input.round_name===undefined?match.round_name:String(input.round_name??'').trim();
                    r.check(typeof round==='string'&&round.trim().length>0&&round.length<=100,'ชื่อรอบต้องไม่ว่างและยาวไม่เกิน 100 ตัวอักษร');
                    r.check(/^[1-9][0-9]{0,8}$/.test(number),'Match number must be a positive integer');
                    r.check(!date||(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date),'Invalid match date');
                    r.check(!time||/^([01]\d|2[0-3]):[0-5]\d$/.test(time),'Invalid start time');
                    r.check(!time||date,'Set match date before time');r.check(location.length<=255,'Venue name is too long');
                    const hasStadium=Object.hasOwn(input,'stadium_id');
                    const stadiumId=hasStadium&&input.stadium_id!==null&&input.stadium_id!==''?Number(input.stadium_id):null;
                    r.check(!hasStadium||stadiumId===null||(Number.isSafeInteger(stadiumId)&&stadiumId>0),'Invalid stadium');
                    return {match,number,date,time,location,round,hasStadium,stadiumId};
                });
                const venueIds=[...new Set(updates.filter(update=>update.hasStadium&&update.stadiumId!==null).map(update=>update.stadiumId))];
                const venues=venueIds.length?(await c.query(`SELECT id,name FROM stadiums WHERE id IN (${venueIds.map(()=>'?').join(',')}) ORDER BY id FOR SHARE`,venueIds)).rows:[];
                for(const update of updates)if(update.hasStadium){
                    const venue=venues.find(item=>Number(item.id)===update.stadiumId);
                    r.check(update.stadiumId===null||venue,'Stadium not found');
                    update.location=venue?.name||'';
                }
                const others=(await c.query('SELECT id,match_number FROM matches WHERE competition_id=?',[id])).rows.filter(match=>!seen.has(String(match.id)));
                const numbers=new Set(others.map(match=>String(match.match_number)));
                for(const update of updates){r.check(!numbers.has(update.number),'Duplicate match number');numbers.add(update.number);await s.lockMatch(c,update.match.id);r.check(!await s.started(c,(await c.query('SELECT * FROM matches WHERE id=?',[update.match.id])).rows[0]),'Cannot reschedule a started match');
                    await c.query('UPDATE matches SET match_number=?,round_name=?,match_date=?,start_time=?,location=?,stadium_id=? WHERE id=?',[update.number,update.round,update.date||null,update.time?update.time+':00':null,update.location||null,update.hasStadium?update.stadiumId:update.match.stadium_id??null,update.match.id]);
                }
            }else if(action==='qualify'){
                r.check(row.state.status==='groups'&&!row.state.invalidated,'ต้องจัดการผังเดิมที่ผลเปลี่ยนก่อนยืนยันอันดับใหม่');
                const result=await s.qualifications(c,row,body.rankDraws||{});
                row.state.qualification={...result,rankDraws:body.rankDraws||{},actor:req.user.id,at:new Date().toISOString()};row.state.status='qualified';
                if(!row.state.plannedDrawPending&&(await s.matches(c,id)).some(match=>match.phase==='knockout')){row.state.status='bracket';await s.propagate(c,row);}
            }else if(action==='draw'){
                r.check(row.state.status==='qualified'&&!row.state.invalidated,'ต้องยืนยันทีมเข้ารอบก่อน');
                const proof=await s.qualifications(c,row,row.state.qualification.rankDraws);
                r.check(proof.hash===row.state.qualification.hash,'ผลต้นทางเปลี่ยน ต้องยืนยันอันดับใหม่');
                let pairs=body.pairs;
                if(row.state.format.drawMode==='cross'){
                    const [a,b]=row.state.groups.map(group=>proof.qualifiers.filter(team=>team.pool===group.name));
                    pairs=[{home:a.find(team=>team.rank===1).teamId,away:b.find(team=>team.rank===2).teamId},{home:b.find(team=>team.rank===1).teamId,away:a.find(team=>team.rank===2).teamId}];
                }
                const confirmed=r.validateDraw(proof.qualifiers,pairs);let number=await s.nextNumber(c,id);
                const planned=(await s.matches(c,id)).filter(match=>match.phase==='knockout');
                for(const slot of r.bracketPlan(confirmed,row.state.format.thirdPlace!==false)){
                    const current=planned.find(match=>match.slot_key===slot.key);
                    if(current){await s.lockMatch(c,current.id);r.check(!await s.started(c,(await c.query('SELECT * FROM matches WHERE id=?',[current.id])).rows[0]),'Cannot change a started bracket');
                        const sourceFor=source=>{if(source.type!=='team')return source;const qualifier=proof.qualifiers.find(team=>String(team.teamId)===String(source.teamId));return {type:'pool',pool:qualifier.pool,rank:qualifier.rank};};
                        await c.query('UPDATE competition_workflow_matches SET home_source=?,away_source=? WHERE match_id=?',[JSON.stringify(sourceFor(slot.home)),JSON.stringify(sourceFor(slot.away)),current.id]);
                        await c.query('UPDATE matches SET home_team_id=?,away_team_id=? WHERE id=?',[slot.home.teamId||null,slot.away.teamId||null,current.id]);continue;}
                    const matchId=await s.insertMatch(c,competition,slot.home.teamId,slot.away.teamId,slot.round,null,number++);
                    await c.query("INSERT INTO competition_workflow_matches(match_id,competition_id,phase,slot_key,home_source,away_source) VALUES(?,?,'knockout',?,?,?)",[matchId,id,slot.key,JSON.stringify(slot.home),JSON.stringify(slot.away)]);
                }
                row.state.plannedDrawPending=false;row.state.status='bracket';row.state.draw={pairs:confirmed,actor:req.user.id,at:new Date().toISOString()};
            }else if(action==='advance'){
                r.check(row.state.status==='bracket'&&!row.state.invalidated,'ผังยังไม่พร้อม');await s.propagate(c,row,req.user.id);
            }else if(action==='forfeit'){
                r.check(['groups','bracket'].includes(row.state.status)&&!row.state.invalidated,'ต้องมีคู่แข่งขันที่ยืนยันแล้ว');
                await forfeit(c,row,body.matchId,body.losingTeamId,String(body.reason||'').trim(),req.user.id);
            }else if(action==='hold'){
                r.check((await c.query('SELECT match_id FROM competition_workflow_matches WHERE competition_id=? AND match_id=?',[id,body.matchId])).rows.length,'แมตช์ไม่อยู่ใน workflow นี้');
                await s.lockMatch(c,body.matchId);
                const match=(await s.matches(c,id)).find(item=>String(item.id)===String(body.matchId));
                r.check(match&&!await s.started(c,match)&&String(body.reason||'').trim().length>=3,'ต้องเป็นแมตช์ที่ยังไม่เริ่มและระบุเหตุผล');
                row.state.holds||={};row.state.holds[match.id]={reason:body.reason,actor:req.user.id,at:new Date().toISOString()};
            }else if(action==='unhold'){
                r.check(row.state.holds?.[body.matchId]&&String(body.reason||'').trim().length>=3,'ต้องมีรายการระงับและระบุเหตุผล');
                delete row.state.holds[body.matchId];
            }else if(action==='clear-forfeit'){
                r.check(row.state.forfeits?.[body.matchId]&&String(body.reason||'').trim().length>=3,'ต้องมีคำตัดสินปรับแพ้และระบุเหตุผล');
                await s.onReviewChange(c,body.matchId,'reopen',req.user.id);
                const refreshed=await s.read(c,id,true);row.revision=refreshed.revision;row.state=refreshed.state;
                await c.query('DELETE FROM match_sets WHERE match_id=?',[body.matchId]);
                await c.query("UPDATE matches SET status='scheduled',home_set_score=0,away_set_score=0,winner_team_id=NULL,set_scores='[]',result_type='normal',forfeit_reason=NULL WHERE id=?",[body.matchId]);
                delete row.state.forfeits[body.matchId];
            }else if(action==='withdraw'){
                r.check(row.state.status==='groups','ถอนทีมในรอบแบ่งสายได้ก่อนยืนยันอันดับเท่านั้น');
                r.check(row.state.groups.some(group=>group.teamIds.some(team=>String(team)===String(body.teamId))),'ทีมไม่อยู่ในรายการ');
                r.check(!row.state.withdrawn?.[body.teamId],'ทีมนี้ถอนตัวแล้ว');
                r.check(String(body.reason||'').trim().length>=3,'ต้องระบุเหตุผลการถอนทีม');
                for(const match of await s.matches(c,id))if([String(match.home_team_id),String(match.away_team_id)].includes(String(body.teamId))){
                    if(match.status==='completed')continue;
                    const opponent=String(match.home_team_id)===String(body.teamId)?match.away_team_id:match.home_team_id;
                    if(row.state.withdrawn?.[opponent]){
                        row.state.holds||={};row.state.holds[match.id]={reason:'ทั้งสองทีมถอนตัว ต้องให้ผู้จัดตัดสิน',actor:req.user.id};
                    }else if(match.status!=='completed')await forfeit(c,row,match.id,body.teamId,String(body.reason).trim(),req.user.id);
                }
                row.state.withdrawn||={};row.state.withdrawn[body.teamId]={reason:body.reason,actor:req.user.id,at:new Date().toISOString()};
            }else if(action==='reset-bracket'){
                r.check(row.state.plannedBracket||['qualified','bracket'].includes(row.state.status)||row.state.invalidated,'ยังไม่มีผลเข้ารอบหรือผังให้ยกเลิก');
                r.check(String(body.reason||'').trim().length>=3,'ต้องระบุเหตุผลการยกเลิกผัง');
                const knockout=(await s.matches(c,id)).filter(match=>match.phase==='knockout');
                for(const match of knockout){await s.lockMatch(c,match.id);r.check(!await s.started(c,(await c.query('SELECT * FROM matches WHERE id=?',[match.id])).rows[0]),'มีแมตช์รอบถัดไปเริ่มดำเนินการแล้ว ไม่สามารถยกเลิกผังได้');}
                await c.query("DELETE FROM competition_workflow_matches WHERE competition_id=? AND phase='knockout'",[id]);
                for(const match of knockout)await c.query('DELETE FROM matches WHERE id=?',[match.id]);
                delete row.state.plannedDrawPending;delete row.state.plannedBracket;delete row.state.qualification;delete row.state.draw;delete row.state.invalidated;row.state.status='groups';
            }else throw denied('ไม่พบคำสั่ง',400);
            await s.write(c,row,req.user.id);
            if(action==='forfeit')await s.propagate(c,row,req.user.id);
        }
        await s.audit(c,req,action,id,{revision:row.revision,input:body,state:row.state});
        await c.commit();res.json({success:true,revision:row.revision});
    }catch(error){if(c)await c.rollback();res.status(error.status||500).json({error:error.status?error.message:'ไม่สามารถบันทึก workflow ได้'});}
    finally{if(c)c.release();}
};
