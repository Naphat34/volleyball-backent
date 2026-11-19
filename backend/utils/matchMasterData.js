const {sqlDialect}=require('./sqlDialect');
const {assertMatch,denied}=require('./accessScope');
const {roleHasPermission}=require('../config/permissions');
const {normalizeNames,playerNameFields}=require('./bilingualNames');
const {validateTeamPlayerNumber}=require('./athleteIntegrity');
const {eligibility,snapshot}=require('./automaticEntryRoster');
const staffRoles=new Set(['Team Manager','Head Coach','Assistant Coach','Assistant Coach 2','Doctor','Therapist/Trainer']);
const fail=(message,status=400)=>{throw denied(message,status);};
const text=(value,max=50)=>{
    if(value==null)return '';
    if(typeof value!=='string'||value.trim().length>max)fail('ชื่อหรือข้อมูลบุคคลยาวเกินกำหนด / Invalid person details');
    return value.trim().replace(/\s+/g,' ');
};
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10);
const hasNewMasterData=draft=>['home','away'].some(side=>['players','staff'].some(key=>draft?.[side]?.[key]?.some?.(row=>row?.create_master===true)));

// The match settings transaction owns every insert, link and audit entry.
async function createMatchMasterData(connection,req,match,input,current){
    if(!hasNewMasterData(input))return [];
    if(!roleHasPermission(req.user?.role,'score.record'))fail('ไม่มีสิทธิ์เพิ่มข้อมูลหลักจากแมตช์นี้',403);
    await assertMatch(connection,req.user,'match',match.id,'score.record',{draftOwner:true,writing:true,domain:'score'});
    if(match.status!=='scheduled')fail('เริ่มแข่งขันแล้ว ไม่สามารถเพิ่มข้อมูลหลักเข้าแมตช์ได้',409);
    const actor=(await connection.query('SELECT role,status,authorization_version FROM users WHERE id=? FOR SHARE',[req.user.id])).rows[0];
    if(!actor||actor.status!=='active'||actor.role!==req.user.role||(req.user.authorization_version!=null&&Number(actor.authorization_version)!==Number(req.user.authorization_version)))fail('สิทธิ์ผู้ใช้เปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่',403);
    await assertMatch(connection,req.user,'match',match.id,'score.record',{draftOwner:true,writing:true,domain:'score'});
    const sides=['home','away'].filter(side=>['players','staff'].some(key=>input[side]?.[key]?.some?.(row=>row?.create_master===true)));
    const teams=[...new Set(sides.map(side=>Number(match[`${side}_team_id`])))].sort((a,b)=>a-b);
    for(const teamId of teams){
        if(!Number.isSafeInteger(teamId)||teamId<1)fail('ต้องผูกทีมในข้อมูลหลักก่อนเพิ่มบุคคล / Link a registered team first',409);
        if(!(await connection.query('SELECT id FROM teams WHERE id=? FOR UPDATE',[teamId])).rows.length)fail('ไม่พบทีมในข้อมูลหลัก',404);
    }
    const created=[];
    for(const side of sides){
        const teamId=Number(match[`${side}_team_id`]),team=input[side];
        if(!Array.isArray(team.players)||team.players.length>30||!Array.isArray(team.staff)||team.staff.length>20)fail('จำนวนรายชื่อเกินกำหนด');
        let entry=null;
        if(match.competition_id){
            const category=match.age_group_id||(await connection.query('SELECT age_group_id FROM competitions WHERE id=?',[match.competition_id])).rows[0]?.age_group_id||null;
            const entries=(await connection.query(sqlDialect(`SELECT te.*,c.gender AS competition_gender,c.start_date,c.max_players,ag.name AS age_group_name
                FROM team_entries te JOIN competitions c ON c.id=te.competition_id LEFT JOIN age_groups ag ON ag.id=COALESCE(te.age_group_id,c.age_group_id)
                WHERE te.team_id=? AND te.competition_id=? AND te.status='approved'
                AND (COALESCE(te.age_group_id,c.age_group_id)=? OR (COALESCE(te.age_group_id,c.age_group_id) IS NULL AND ? IS NULL)) ORDER BY te.id FOR UPDATE`,
                `SELECT te.*,c.gender AS competition_gender,c.start_date,c.max_players,ag.name AS age_group_name
                FROM team_entries te JOIN competitions c ON c.id=te.competition_id LEFT JOIN age_groups ag ON ag.id=COALESCE(te.age_group_id,c.age_group_id)
                WHERE te.team_id=? AND te.competition_id=? AND te.status='approved'
                AND (COALESCE(te.age_group_id,c.age_group_id)=? OR (COALESCE(te.age_group_id,c.age_group_id) IS NULL AND CAST(? AS integer) IS NULL)) ORDER BY te.id FOR UPDATE OF te`),
            [teamId,match.competition_id,category,category])).rows;
            if(entries.length!==1)fail('ไม่พบทะเบียนทีมที่อนุมัติตรงกับรุ่นของแมตช์ หรือมีหลายทะเบียน กรุณาให้ผู้จัดตรวจสอบ',409);
            entry=entries[0];
            if(entry.roster_locked_at)fail('ทะเบียนทีมถูกล็อกแล้ว ไม่สามารถเพิ่มรายชื่อ / Team registration is locked',409);
            const newPlayers=team.players.filter(row=>row.create_master===true).length;
            const count=Number((await connection.query('SELECT COUNT(*) AS count FROM team_entry_players WHERE team_entry_id=?',[entry.id])).rows[0].count);
            if(entry.max_players&&count+newPlayers>Number(entry.max_players))fail('จำนวนผู้เล่นเกินจำนวนสูงสุดของรายการ',409);
        }
        for(const kind of ['players','staff'])for(const row of team[kind]){
            if(row?.create_master!==true)continue;
            const names=normalizeNames(row),first=text(names.first_name),last=text(names.last_name);
            if(!first)fail('กรุณาระบุชื่อบุคคล / Enter a first name');
            const table=kind==='players'?'players':'team_staff';
            const same=(await connection.query(`SELECT id FROM ${table} WHERE team_id=? AND LOWER(TRIM(COALESCE(first_name,'')))=? AND LOWER(TRIM(COALESCE(last_name,'')))=? LIMIT 1`,[teamId,first.toLowerCase(),last.toLowerCase()])).rows;
            if(same.length)fail('มีชื่อนี้ในข้อมูลหลักของทีมแล้ว กรุณาเลือกจากรายชื่อที่ลงทะเบียน / Select the existing registered person',409);
            let personId;
            if(kind==='players'){
                await validateTeamPlayerNumber(connection,teamId,row.number);
                const birth=text(row.birth_date,10),gender=text(row.gender,10);
                if(birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||Number.isNaN(Date.parse(birth))||day(new Date(birth))!==birth||birth>new Date().toISOString().slice(0,10)))fail('วันเกิดไม่ถูกต้อง / Invalid birth date');
                if(!['Male','Female'].includes(gender))fail('กรุณาระบุเพศนักกีฬา / Select athlete gender');
                const athlete={...names,first_name:first,last_name:last,birth_date:birth||null,gender,number:Number(row.number),position:['S','OH','MB','OPP'].includes(row.position)?row.position:null,is_active:1};
                const reason=entry&&eligibility(athlete,entry);
                if(reason)fail(`นักกีฬาไม่ผ่านเงื่อนไขเพศหรือรุ่นอายุของรายการ (${reason}) / Athlete is not eligible`,409);
                const fields=['team_id','number','first_name','last_name',...playerNameFields,'birth_date','gender','position','is_captain','is_libero1','is_libero2','is_playing'];
                const args=[teamId,athlete.number,first,last,...playerNameFields.map(key=>names[key]||null),athlete.birth_date,gender,athlete.position,0,0,0,1];
                const insert=`INSERT INTO players(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`;
                personId=(await connection.query(sqlDialect(insert,insert+' RETURNING id'),args)).insertId;
                if(entry)await connection.query('INSERT INTO team_entry_players(team_entry_id,player_id,number,role,is_captain,is_libero1,is_libero2,is_playing,athlete_snapshot) VALUES(?,?,?,?,0,0,0,1,?)',[entry.id,personId,athlete.number,athlete.position||'',snapshot(athlete)]);
                current.available[side].push({id:personId});
                Object.assign(row,{id:personId,first_name:first,last_name:last,...Object.fromEntries(playerNameFields.map(key=>[key,names[key]||null]))});
            }else{
                const role=text(row.role);
                if(!staffRoles.has(role))fail('ตำแหน่งเจ้าหน้าที่ทีมไม่ถูกต้อง / Invalid team staff role');
                const insert='INSERT INTO team_staff(team_id,first_name,last_name,role) VALUES(?,?,?,?)';
                personId=(await connection.query(sqlDialect(insert,insert+' RETURNING id'),[teamId,first,last,role])).insertId;
                if(entry)await connection.query('INSERT INTO team_entry_staff(team_entry_id,staff_id,staff_snapshot) VALUES(?,?,?)',[entry.id,personId,JSON.stringify({first_name:first,last_name:last,role})]);
                current.availableStaff[side].push({id:personId});
                Object.assign(row,{id:personId,first_name:first,last_name:last,role});
            }
            delete row.create_master;
            created.push({kind,side,id:personId,teamId,entryId:entry?.id||null});
            if(entry?.roster_mode==='manual')await connection.query('UPDATE team_entries SET roster_source_hash=NULL,roster_revision=roster_revision+1 WHERE id=?',[entry.id]);
            await connection.query('INSERT INTO audit_logs(user_id,username,role,action,entity_type,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?,NOW())',
                [req.user.id,req.user.username||null,req.user.role,'match.master.create',kind==='players'?'player':'team_staff',String(personId),JSON.stringify({matchId:match.id,teamId,entryId:entry?.id||null,side})]);
        }
    }
    return created;
}
module.exports={createMatchMasterData,hasNewMasterData};
