const {createHash}=require('node:crypto');
const {denied}=require('./accessScope');
const {flag}=require('./athleteIntegrity');
const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const title=value=>String(value||'').replace(/\s*\((Male|Female|Mixed|Mix|Men|Women|ชาย|หญิง)\)\s*$/i,'').trim().toLowerCase();
const fail=(text,status=409)=>{throw denied(text,status);};
function sourceHash(entry,rows,players){
    const {snapshot}=require('./automaticEntryRoster');
    return digest({gender:entry.competition_gender,age:entry.age_group_name,start:String(entry.start_date),max:entry.max_players,
        rows:rows.slice().sort((a,b)=>Number(a.player_id)-Number(b.player_id)).map(row=>{const player=players.find(person=>Number(person.id)===Number(row.player_id));return [row.player_id,row.number,row.role,flag(row.is_captain),flag(row.is_libero1),flag(row.is_libero2),player?snapshot(player):null,player?.is_active];})});
}
async function syncManualEntry(c,entry,players){
    const {eligibility,rosterError}=require('./automaticEntryRoster');
    const rows=(await c.query('SELECT * FROM team_entry_players WHERE team_entry_id=? ORDER BY player_id',[entry.id])).rows;
    const invalid=rows.some(row=>{const player=players.find(person=>Number(person.id)===Number(row.player_id));return !player||eligibility(player,entry);});
    const error=invalid?'Selected athlete eligibility changed; review and confirm the roster':rosterError(rows.map(row=>({...row,position:row.role})),entry);
    const hash=sourceHash(entry,rows,players);
    if(entry.roster_source_hash===hash)return;
    const changed=Boolean(entry.roster_source_hash);
    await c.query(`UPDATE team_entries SET roster_source_hash=?,roster_sync_error=?,roster_confirmed_at=CASE WHEN ? THEN NULL ELSE roster_confirmed_at END,
        roster_revision=roster_revision+? WHERE id=?`,[hash,error||(changed?'Master data changed; review and confirm the roster':null),changed||Boolean(error),changed?1:0,entry.id]);
}
async function loadEntry(c,teamId,entryId){
    await c.query('SELECT id FROM teams WHERE id=? FOR UPDATE',[teamId]);
    const entries=await require('./automaticEntryRoster').loadTeamRosterEntries(c,teamId);
    const entry=entries.find(row=>String(row.id)===String(entryId));if(!entry)fail('Team entry not found',404);
    return {entry,entries};
}
async function validateSelection(c,teamId,entry,input,entries){
    const {eligibility,rosterError,snapshot}=require('./automaticEntryRoster');
    if(!Array.isArray(input.players)||input.players.length>100)fail('Invalid roster selection',400);
    const master=(await c.query('SELECT * FROM players WHERE team_id=? ORDER BY id',[teamId])).rows,seen=new Set();
    const rows=input.players.map(item=>{
        const id=Number(item.player_id??item.id),player=master.find(person=>person.id===id);
        if(!player||seen.has(id))fail('Unknown or duplicate team athlete');seen.add(id);
        if(item.master_revision!==undefined&&Number(item.master_revision)!==Number(player.master_revision))fail('Athlete changed; reload the team register before selecting');
        const reason=eligibility(player,entry);if(reason)fail(`Athlete #${player.number}: ${reason}`);
        const number=Number(item.number??player.number),role=String(item.role??player.position??'OH');
        if(!['S','OH','OPP','MB','L','L1','L2'].includes(role))fail('Invalid playing position');
        const l1=flag(item.is_libero1),l2=flag(item.is_libero2),captain=flag(item.is_captain);
        if(l1&&l2||((l1||l2)&&!['L','L1','L2'].includes(role)))fail('Invalid Libero selection');
        return {player_id:id,number,role,is_captain:captain?1:0,is_libero1:l1?1:0,is_libero2:l2?1:0,is_playing:1,athlete_snapshot:snapshot(player)};
    });
    const error=rosterError(rows.map(row=>({...row,position:['L1','L2'].includes(row.role)?'L':row.role})),entry);if(error)fail(error);
    const siblings=entries.filter(other=>other.id!==entry.id&&title(other.competition_title)===title(entry.competition_title));
    if(siblings.length&&rows.length){
        const used=(await c.query(`SELECT ep.player_id,te.id FROM team_entry_players ep JOIN team_entries te ON te.id=ep.team_entry_id WHERE te.team_id=? AND te.id<>?`,[teamId,entry.id])).rows;
        if(used.some(row=>seen.has(Number(row.player_id))&&siblings.some(other=>Number(other.id)===Number(row.id))))fail('An athlete is already assigned to another category of this competition');
    }
    const staffIds=input.staff_ids===undefined?null:input.staff_ids;
    if(staffIds!==null&&(!Array.isArray(staffIds)||staffIds.length>20||new Set(staffIds.map(Number)).size!==staffIds.length))fail('Invalid staff selection');
    const staff=staffIds===null?null:(await c.query('SELECT id,first_name,last_name,role,master_revision FROM team_staff WHERE team_id=? AND is_active=1',[teamId])).rows.filter(person=>staffIds.map(Number).includes(person.id));
    if(staff&&staff.length!==staffIds.length)fail('Unknown or inactive team staff');
    if(staff&&staff.some(person=>!['Team Manager','Head Coach','Assistant Coach','Assistant Coach 2','Doctor','Therapist/Trainer'].includes(person.role)))fail('Invalid team staff role');
    if(staff&&new Set(staff.map(person=>person.role)).size!==staff.length)fail('Choose one team staff member per role');
    return {rows,master,staff};
}
async function persistSelection(c,teamId,entry,selection,userId,{confirmed=false,reason=null}={}){
    const before=(await c.query('SELECT player_id,number,role,is_captain,is_libero1,is_libero2 FROM team_entry_players WHERE team_entry_id=? ORDER BY player_id',[entry.id])).rows;
    await c.query('DELETE FROM team_entry_players WHERE team_entry_id=?',[entry.id]);
    for(const row of selection.rows)await c.query(`INSERT INTO team_entry_players(team_entry_id,player_id,number,role,is_captain,is_libero1,is_libero2,is_playing,athlete_snapshot) VALUES(?,?,?,?,?,?,?,?,?)`,[entry.id,row.player_id,row.number,row.role,row.is_captain,row.is_libero1,row.is_libero2,1,row.athlete_snapshot]);
    if(selection.staff!==null){await c.query('DELETE FROM team_entry_staff WHERE team_entry_id=?',[entry.id]);for(const person of selection.staff)await c.query('INSERT INTO team_entry_staff(team_entry_id,staff_id,staff_snapshot) VALUES(?,?,?)',[entry.id,person.id,JSON.stringify({first_name:person.first_name,last_name:person.last_name,role:person.role})]);}
    await c.query(`UPDATE team_entries SET roster_mode='manual',roster_revision=roster_revision+1,roster_source_hash=?,roster_sync_error=NULL,
        roster_confirmed_at=?,roster_confirmed_by=? WHERE id=?`,[sourceHash(entry,selection.rows,selection.master),confirmed?new Date():null,confirmed?userId:null,entry.id]);
    await c.query('INSERT INTO team_data_history(team_id,actor_id,action,entry_id,before_data,after_data,reason) VALUES(?,?,?,?,?,?,?)',[teamId,userId,confirmed?'roster.confirm':'roster.save',entry.id,JSON.stringify({players:before}),JSON.stringify({players:selection.rows.map(row=>({...row,athlete_snapshot:undefined})),staff_ids:selection.staff?.map(person=>person.id)}),reason]);
}
async function assertManualRostersReady(c,matchId){
    const match=(await c.query('SELECT id,competition_id,home_team_id,away_team_id,age_group_id,manual_owner_id,status FROM matches WHERE id=?',[matchId])).rows[0];
    if(!match?.competition_id||match.manual_owner_id||match.status!=='scheduled')return;
    const entries=(await c.query(`SELECT te.* FROM team_entries te JOIN competitions co ON co.id=te.competition_id WHERE te.competition_id=?
        AND (te.team_id=? OR te.team_id=?) AND COALESCE(te.age_group_id,co.age_group_id,0)=COALESCE(?,co.age_group_id,0)`,[match.competition_id,match.home_team_id,match.away_team_id,match.age_group_id])).rows;
    for(const entry of entries)if(entry.roster_mode==='manual'&&(!entry.roster_confirmed_at||entry.roster_sync_error))fail('Team must review and confirm its competition roster before recording');
}
module.exports={syncManualEntry,sourceHash,loadEntry,validateSelection,persistSelection,assertManualRostersReady,parse};
