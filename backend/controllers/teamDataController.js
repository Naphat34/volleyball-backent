const db=require('../config/db');
const {denied}=require('../utils/accessScope');
const roster=require('../utils/manualTeamRoster');
const integrity=require('../utils/teamMasterIntegrity');
const staffRoles=new Set(['Team Manager','Head Coach','Assistant Coach','Assistant Coach 2','Doctor','Therapist/Trainer']);
const endpoint=handler=>async(req,res)=>{const c=await db.connect();try{await c.beginTransaction();const result=await handler(c,req);await c.commit();res.json(result);}catch(error){await c.rollback();if(!error.status&&error.code==='ER_DUP_ENTRY'){error.status=409;error.message='Duplicate team record; reload and review the selection';}if(!error.status&&error.code==='ER_CHECK_CONSTRAINT_VIOLATED'){error.status=400;error.message='Check roster roles and person details';}if(!error.status)console.error('Team data:',error.code||error.name);res.status(error.status||500).json({error:error.status?error.message:'Unable to save team data',...(error.candidates?{candidates:error.candidates,duplicate:error.duplicate}:{})});}finally{c.release();}};
async function own(c,req){
    if(req.user.role!=='team_staff')throw denied();
    const user=(await c.query('SELECT team_id FROM users WHERE id=?',[req.user.id])).rows[0];
    if(!user?.team_id)throw denied('You do not belong to a team',400);
    await c.query('SELECT id FROM teams WHERE id=? FOR UPDATE',[user.team_id]);return user.team_id;
}
async function invalidateStaff(c,teamId,personId){
    const entries=await require('../utils/automaticEntryRoster').loadTeamRosterEntries(c,teamId);
    const assigned=(await c.query('SELECT team_entry_id FROM team_entry_staff WHERE staff_id=?',[personId])).rows;
    for(const entry of entries)if(entry.roster_mode==='manual'&&!entry.roster_locked_at&&!Number(entry.has_live_match)&&!Number(entry.has_completed_match)&&assigned.some(row=>row.team_entry_id===entry.id))await c.query('UPDATE team_entries SET roster_confirmed_at=NULL,roster_revision=roster_revision+1,roster_sync_error=? WHERE id=?',['Team staff changed; review and confirm the roster',entry.id]);
}
exports.overview=endpoint(async(c,req)=>{
    const teamId=await own(c,req);
    await require('../utils/automaticEntryRoster').syncTeamEntries(c,teamId);
    const players=(await c.query(`SELECT id,public_id,first_name,last_name,first_name_th,last_name_th,first_name_en,last_name_en,birth_date,gender,number,position,is_captain,is_libero1,is_libero2,is_active,master_revision,photo FROM players WHERE team_id=? ORDER BY number,id`,[teamId])).rows;
    const staff=(await c.query('SELECT id,first_name,last_name,role,gender,is_active,master_revision FROM team_staff WHERE team_id=? ORDER BY role,id',[teamId])).rows;
    const entries=await require('../utils/automaticEntryRoster').loadTeamRosterEntries(c,teamId);
    const requests=(await c.query('SELECT id,entry_id,status,reason,decision_reason,created_at,decided_at FROM team_roster_change_requests WHERE team_id=? ORDER BY id DESC',[teamId])).rows;
    return {team:(await c.query('SELECT id,name,name_th,name_en,gender,code FROM teams WHERE id=?',[teamId])).rows[0],players,staff,
        entries:entries.map(entry=>Object.fromEntries(['id','competition_id','competition_title','competition_title_th','competition_title_en','competition_gender','start_date','age_group_name','max_players','status','roster_mode','roster_revision','roster_confirmed_at','roster_locked_at','roster_sync_error','has_live_match','has_completed_match'].map(key=>[key,entry[key]]))),requests};
});
exports.entry=endpoint(async(c,req)=>{
    const teamId=await own(c,req),{entry}=await roster.loadEntry(c,teamId,req.params.entryId);
    const selected=(await c.query('SELECT player_id,number,role,is_captain,is_libero1,is_libero2 FROM team_entry_players WHERE team_entry_id=? ORDER BY number,player_id',[entry.id])).rows;
    const selectedStaff=(await c.query('SELECT staff_id FROM team_entry_staff WHERE team_entry_id=?',[entry.id])).rows.map(row=>row.staff_id);
    const master=(await c.query('SELECT * FROM players WHERE team_id=? ORDER BY number,id',[teamId])).rows;
    return {entry,players:selected.map(row=>({...row,master_revision:master.find(person=>person.id===row.player_id)?.master_revision})),staff_ids:selectedStaff,eligibility:master.map(player=>({id:player.id,revision:player.master_revision,reason:require('../utils/automaticEntryRoster').eligibility(player,entry)}))};
});
exports.saveEntry=endpoint(async(c,req)=>{
    const teamId=await own(c,req),{entry,entries}=await roster.loadEntry(c,teamId,req.params.entryId);
    if(Number(req.body.revision)!==Number(entry.roster_revision))throw denied('Roster changed on another screen; reload before saving',409);
    if(entry.roster_locked_at||Number(entry.has_live_match)||Number(entry.has_completed_match))throw denied('Roster is locked; send a change request to Super Admin',409);
    const selection=await roster.validateSelection(c,teamId,entry,req.body,entries);
    if(req.body.confirm===true&&selection.rows.length<6)throw denied('Select at least 6 athletes before confirming',409);
    await roster.persistSelection(c,teamId,entry,selection,req.user.id,{confirmed:req.body.confirm===true});
    return {success:true,revision:Number(entry.roster_revision)+1,confirmed:req.body.confirm===true};
});
exports.requestChange=endpoint(async(c,req)=>{
    const teamId=await own(c,req),{entry,entries}=await roster.loadEntry(c,teamId,req.params.entryId);
    if(!entry.roster_locked_at&&!Number(entry.has_live_match)&&!Number(entry.has_completed_match))throw denied('Use normal roster editing before the roster locks',409);
    if(Number(req.body.revision)!==Number(entry.roster_revision))throw denied('Roster changed on another screen; reload before saving',409);
    const reason=String(req.body.reason||'').trim();if(reason.length<5||reason.length>2000)throw denied('Explain the requested change (5–2000 characters)',400);
    const selected=await roster.validateSelection(c,teamId,entry,req.body,entries);if(selected.rows.length<6)throw denied('Select at least 6 athletes',400);
    if((await c.query("SELECT id FROM team_roster_change_requests WHERE entry_id=? AND status='pending'",[entry.id])).rows.length)throw denied('A change request is already pending',409);
    const proposal={players:selected.rows.map(row=>({...row,athlete_snapshot:undefined})),staff_ids:selected.staff?.map(person=>person.id),master_versions:Object.fromEntries(selected.master.filter(person=>selected.rows.some(row=>row.player_id===person.id)).map(person=>[person.id,person.master_revision])),staff_versions:Object.fromEntries((selected.staff||[]).map(person=>[person.id,person.master_revision]))};
    const before={players:(await c.query('SELECT player_id,number,role,is_captain,is_libero1,is_libero2 FROM team_entry_players WHERE team_entry_id=?',[entry.id])).rows,staff_ids:(await c.query('SELECT staff_id FROM team_entry_staff WHERE team_entry_id=?',[entry.id])).rows.map(row=>row.staff_id)};
    const result=await c.query('INSERT INTO team_roster_change_requests(team_id,entry_id,requested_by,reason,proposal,before_data,base_revision) VALUES(?,?,?,?,?,?,?) RETURNING id',[teamId,entry.id,req.user.id,reason,JSON.stringify(proposal),JSON.stringify(before),entry.roster_revision]);
    return {success:true,id:result.rows[0].id};
});
exports.saveStaff=endpoint(async(c,req)=>{
    const teamId=await own(c,req),id=req.params.id;
    const before=id?(await c.query('SELECT * FROM team_staff WHERE id=? AND team_id=? FOR UPDATE',[id,teamId])).rows[0]:null;
    if(id&&!before)throw denied('Staff member not found',404);
    if(before&&Number(req.body.master_revision)!==Number(before.master_revision))throw denied('Staff was changed on another screen; reload before saving',409);
    const first=String(req.body.first_name??before?.first_name??'').trim(),last=String(req.body.last_name??before?.last_name??'').trim(),role=String(req.body.role??before?.role??'');
    if(!first||!last||first.length>100||last.length>100||!staffRoles.has(role))throw denied('Check staff names and role',400);
    await integrity.checkDuplicatePerson(c,'team_staff',teamId,{...req.body,first_name:first,last_name:last},before);
    if(before)await require('../utils/freezeTeamHistory').freezeTeamHistory(c,teamId);
    let personId=id;
    if(before)await c.query('UPDATE team_staff SET first_name=?,last_name=?,role=?,gender=?,master_revision=master_revision+1 WHERE id=?',[first,last,role,req.body.gender??before.gender,id]);
    else personId=(await c.query('INSERT INTO team_staff(team_id,first_name,last_name,role,gender) VALUES(?,?,?,?,?) RETURNING id',[teamId,first,last,role,req.body.gender||null])).rows[0].id;
    if(before)await invalidateStaff(c,teamId,personId);
    const after=(await c.query('SELECT * FROM team_staff WHERE id=?',[personId])).rows[0];await integrity.history(c,req,teamId,'staff',before,after,before?'master.update':'master.create');return after;
});
exports.staffStatus=endpoint(async(c,req)=>{
    const teamId=await own(c,req),before=(await c.query('SELECT * FROM team_staff WHERE id=? AND team_id=? FOR UPDATE',[req.params.id,teamId])).rows[0];
    if(!before)throw denied('Staff member not found',404);
    if(req.body.master_revision!==undefined&&Number(req.body.master_revision)!==Number(before.master_revision))throw denied('Staff was changed on another screen; reload before saving',409);
    const active=req.method==='DELETE'?0:Number(req.body.is_active);if(![0,1].includes(active))throw denied('Invalid staff status',400);
    await require('../utils/freezeTeamHistory').freezeTeamHistory(c,teamId);
    await c.query('UPDATE team_staff SET is_active=?,master_revision=master_revision+1 WHERE id=?',[active,before.id]);
    await invalidateStaff(c,teamId,before.id);
    const after={...before,is_active:active,master_revision:Number(before.master_revision)+1};await integrity.history(c,req,teamId,'staff',before,after,'master.status');return after;
});
exports.playerStatus=endpoint(async(c,req)=>{
    const teamId=await own(c,req),before=(await c.query('SELECT * FROM players WHERE id=? AND team_id=? FOR UPDATE',[req.params.id,teamId])).rows[0];
    if(!before)throw denied('Player not found',404);
    if(Number(req.body.master_revision)!==Number(before.master_revision))throw denied('Athlete was changed on another screen; reload before saving',409);
    const active=Number(req.body.is_active);if(![0,1].includes(active))throw denied('Invalid athlete status',400);
    if(active)await require('../utils/athleteIntegrity').validateTeamPlayerNumber(c,teamId,before.number,before.id);
    await c.query('UPDATE players SET is_active=?,master_revision=master_revision+1 WHERE id=?',[active,before.id]);
    await require('../utils/automaticEntryRoster').syncTeamEntries(c,teamId);
    const after={...before,is_active:active,master_revision:Number(before.master_revision)+1};await integrity.history(c,req,teamId,'player',before,after,'master.status');return after;
});
exports.history=endpoint(async(c,req)=>{const teamId=await own(c,req);return (await c.query('SELECT h.*,u.username AS actor_name FROM team_data_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.team_id=? ORDER BY h.id DESC LIMIT 200',[teamId])).rows;});
exports.bulk=endpoint(async(c,req)=>{
    const teamId=await own(c,req),kind=req.body.kind,items=req.body.items,patch=req.body.patch||{};
    if(!['players','staff'].includes(kind)||!Array.isArray(items)||!items.length||items.length>100||new Set(items.map(item=>Number(item.id))).size!==items.length)throw denied('Select 1–100 unique team records',400);
    const table=kind==='players'?'players':'team_staff',allowed=kind==='players'?['position','is_active']:['is_active'];
    if(!Object.keys(patch).length||Object.keys(patch).some(key=>!allowed.includes(key)))throw denied('Unsupported bulk change',400);
    if(patch.position!==undefined&&!['S','OH','OPP','MB','L'].includes(patch.position)||patch.is_active!==undefined&&![0,1].includes(Number(patch.is_active)))throw denied('Invalid bulk value',400);
    if(kind==='staff')await require('../utils/freezeTeamHistory').freezeTeamHistory(c,teamId);
    for(const item of items.slice().sort((a,b)=>Number(a.id)-Number(b.id))){
        const before=(await c.query(`SELECT * FROM ${table} WHERE id=? AND team_id=? FOR UPDATE`,[item.id,teamId])).rows[0];
        if(!before)throw denied('Record not found in your team',404);
        if(Number(item.revision)!==Number(before.master_revision))throw denied('A selected record changed; reload and review the selection',409);
        if(kind==='players'&&Number(patch.is_active)===1)await require('../utils/athleteIntegrity').validateTeamPlayerNumber(c,teamId,before.number,before.id);
        const fields=Object.keys(patch),values=fields.map(key=>patch[key]);
        await c.query(`UPDATE ${table} SET ${fields.map(key=>key+'=?').join(',')},master_revision=master_revision+1${patch.position&&patch.position!=='L'?',is_libero1=0,is_libero2=0':''} WHERE id=?`,[...values,before.id]);
        if(kind==='staff')await invalidateStaff(c,teamId,before.id);
        await integrity.history(c,req,teamId,kind==='players'?'player':'staff',before,{...before,...patch},'master.bulk');
    }
    if(kind==='players')await require('../utils/automaticEntryRoster').syncTeamEntries(c,teamId);
    return {success:true,count:items.length};
});
exports.adminRequests=endpoint(async(c,req)=>{
    if(req.user.role!=='super_admin')throw denied();
    const requests=(await c.query(`SELECT r.*,t.name AS team_name,co.title AS competition_title,u.username AS requested_username FROM team_roster_change_requests r
        JOIN teams t ON t.id=r.team_id JOIN team_entries te ON te.id=r.entry_id JOIN competitions co ON co.id=te.competition_id
        JOIN users u ON u.id=r.requested_by ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END,r.id DESC LIMIT 200`)).rows;
    const ids=[...new Set(requests.map(row=>row.team_id))];
    const players=ids.length?(await c.query(`SELECT id,first_name,last_name,number FROM players WHERE team_id IN(${ids.map(()=>'?').join(',')})`,ids)).rows:[];
    const staff=ids.length?(await c.query(`SELECT id,first_name,last_name,role FROM team_staff WHERE team_id IN(${ids.map(()=>'?').join(',')})`,ids)).rows:[];
    return {requests,players,staff};
});
exports.decideRequest=endpoint(async(c,req)=>{
    if(req.user.role!=='super_admin')throw denied();
    const request=(await c.query('SELECT * FROM team_roster_change_requests WHERE id=?',[req.body.request_id])).rows[0];
    if(!request)throw denied('Change request not found',404);
    const {entry,entries}=await roster.loadEntry(c,request.team_id,request.entry_id);
    const locked=(await c.query('SELECT * FROM team_roster_change_requests WHERE id=? FOR UPDATE',[request.id])).rows[0];
    if(locked.status!=='pending')throw denied('Change request already decided',409);
    const decision=req.body.decision,note=String(req.body.reason||'').trim();
    if(!['approved','rejected'].includes(decision)||note.length<5||note.length>2000)throw denied('Decision and reason (5–2000 characters) are required',400);
    if(decision==='approved'){
        if(Number(entry.roster_revision)!==Number(locked.base_revision))throw denied('Roster changed after the request; ask the team to submit a new request',409);
        const proposal=roster.parse(locked.proposal),selection=await roster.validateSelection(c,request.team_id,entry,proposal,entries);
        if(selection.master.some(person=>proposal.master_versions?.[person.id]!==undefined&&Number(proposal.master_versions[person.id])!==Number(person.master_revision))||(selection.staff||[]).some(person=>Number(proposal.staff_versions?.[person.id])!==Number(person.master_revision)))throw denied('Master data changed after the request; ask the team to submit a new request',409);
        if(selection.rows.length<6)throw denied('Select at least 6 eligible athletes',409);
        await require('../utils/freezeTeamHistory').freezeEntryHistory(c,entry);
        await roster.persistSelection(c,request.team_id,entry,selection,req.user.id,{confirmed:true,reason:note});
    }
    await c.query('UPDATE team_roster_change_requests SET status=?,decided_by=?,decision_reason=?,decided_at=CURRENT_TIMESTAMP WHERE id=?',[decision,req.user.id,note,request.id]);
    await c.query('INSERT INTO team_data_history(team_id,actor_id,action,entry_id,after_data,reason) VALUES(?,?,?,?,?,?)',[request.team_id,req.user.id,`roster.request.${decision}`,entry.id,JSON.stringify({request_id:request.id}),note]);
    return {success:true};
});
module.exports.endpoint=endpoint;
