const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { createHash } = require('node:crypto');
const { permissionsByRole, normalizeRole, roleHasPermission } = require('../config/permissions');
const { denied, isSystemAdmin, loadCapabilities, assertCompetition, scopeSql } = require('../utils/accessScope');
const { lockKey } = require('../middleware/recordingLock');
const { publicProjection } = require('../middleware/accessBoundary');
const {competitionAccessGroups,expandCompetitionAccess}=require('../utils/competitionAccessGroups');
const domainOf = user => normalizeRole(user.role)==='super_admin_scorer'?'score':normalizeRole(user.role)==='super_admin_vims'?'vims':null;
const workerOf = user => domainOf(user)==='score'?'scorer':domainOf(user)==='vims'?'vims_operator':null;
const endpoint = handler => async(req,res)=>{
    try { await handler(req,res); }
    catch(error){ if(!error.status)console.error('Access operation failed:',error.code||error.name);res.status(error.code==='ER_DUP_ENTRY'?409:error.status||500).json({error:error.code==='ER_DUP_ENTRY'?'Username or grant already exists':error.status?error.message:'Access operation failed'}); }
};
async function transaction(fn) {
    const c=await db.connect();
    try { await c.beginTransaction();const result=await fn(c);await c.commit();return result; }
    catch(error){await c.rollback();throw error;}finally{c.release();}
}
function requirePermission(user,p) { if(!roleHasPermission(user?.role,p))throw denied(); }
function competitionIds(value) {
    if(!Array.isArray(value)||value.some(id=>!Number.isSafeInteger(Number(id))||Number(id)<1))throw denied('Competition IDs must be a list of positive integers',400);
    return [...new Set(value.map(Number))];
}
async function strictAudit(c,req,action,type,id,details={}) {
    // Access/review mutations must fail atomically if their audit record cannot be written.
    await c.query('INSERT INTO audit_logs(user_id,username,role,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?,?)',
        [req.user.id,req.user.username||null,req.user.role,action,type,String(id),JSON.stringify(details)]);
}
async function lockActor(c,req){
    await c.query("SELECT pg_advisory_xact_lock(hashtext('volley-account-administration'))");
    const row=(await c.query('SELECT role,status,authorization_version FROM users WHERE id=? FOR SHARE',[req.user.id])).rows[0];
    if(!row||row.status!=='active'||normalizeRole(row.role)!==normalizeRole(req.user.role)
        ||(req.user.authorization_version!=null&&Number(row.authorization_version)!==Number(req.user.authorization_version)))throw denied('Account permissions changed');
}
exports.session=endpoint(async(req,res)=>res.json(await loadCapabilities(db,req.user)));
exports.catalog=endpoint(async(req,res)=>res.json({roles:Object.keys(permissionsByRole),permissions:permissionsByRole,
    managed_roles:isSystemAdmin(req.user)?Object.keys(permissionsByRole):workerOf(req.user)?[workerOf(req.user)]:[]}));
exports.competitions=endpoint(async(req,res)=>{
    const scope=scopeSql(req.user,'c.id');
    const rows=(await db.query(`SELECT c.id,c.title,c.title_th,c.title_en,c.status,c.sport,c.gender,c.age_group_id,c.start_date,c.end_date,c.location,c.stadium_id FROM competitions c WHERE ${scope.sql} ORDER BY c.id DESC`,scope.params)).rows;
    const groups=competitionAccessGroups(rows);
    res.json(rows.map(row=>{
        const group=groups.find(item=>item.competition_ids.includes(Number(row.id)));
        return {...row,access_group_key:group.key,access_group_title:group.title,access_group_competition_ids:group.competition_ids};
    }));
});
exports.matches=endpoint(async(req,res)=>{
    const scope=scopeSql(req.user,'m.competition_id');
    const worker=['scorer','vims_operator'].includes(req.user.role);
    const matches=(await db.query(`SELECT m.id,m.public_id,m.competition_id,m.status,m.match_number,m.manual_owner_id,m.manual_vis_shared,m.manual_vis_assignee_id,
        m.match_date,m.start_time,m.location,COALESCE(m.gender,c.gender) AS gender,m.round_name,m.pool_name,m.home_set_score,m.away_set_score,m.home_team_id,m.away_team_id,
        venue.name_th AS location_th,venue.name_en AS location_en,ag.name AS age_group_name,
        (SELECT COUNT(*) FROM match_actions va WHERE va.match_id=m.id AND va.action_type='VIS_STAT') AS vims_count,
        (SELECT vr.status FROM match_reviews vr WHERE vr.match_id=m.id AND vr.domain='vims' ORDER BY vr.revision DESC LIMIT 1) AS vims_review_status,
        c.title AS competition_name,c.title_th AS competition_name_th,c.title_en AS competition_name_en,
        h.name AS home_team,a.name AS away_team,h.name_th AS home_team_name_th,h.name_en AS home_team_name_en,
        a.name_th AS away_team_name_th,a.name_en AS away_team_name_en
        FROM matches m LEFT JOIN competitions c ON c.id=m.competition_id
        LEFT JOIN age_groups ag ON ag.id=COALESCE(m.age_group_id,c.age_group_id)
        LEFT JOIN stadiums venue ON venue.id=COALESCE(m.stadium_id,c.stadium_id)
            AND (NULLIF(TRIM(m.location),'') IS NULL OR TRIM(m.location) IN(venue.name,venue.name_th,venue.name_en))
        LEFT JOIN teams h ON h.id=m.home_team_id LEFT JOIN teams a ON a.id=m.away_team_id WHERE (${scope.sql})${worker?' OR (m.manual_owner_id=? AND m.competition_id IS NULL)':''} ORDER BY m.id DESC`,[...scope.params,...(worker?[req.user.id]:[])])).rows;
    const customScope=scopeSql(req.user,'v.competition_id');
    const custom=roleHasPermission(req.user.role,'vims.monitor')||req.user.role==='vims_operator'?(await db.query(`SELECT v.id,v.competition_id,v.owner_id,v.payload,c.title AS competition_name,c.title_th AS competition_name_th,c.title_en AS competition_name_en,
        (SELECT vr.status FROM match_reviews vr WHERE vr.custom_match_id=v.id AND vr.domain='vims' ORDER BY vr.revision DESC LIMIT 1) AS vims_review_status
        FROM custom_vis_matches v LEFT JOIN competitions c ON c.id=v.competition_id WHERE (${customScope.sql})${req.user.role==='vims_operator'?' OR (v.owner_id=? AND v.competition_id IS NULL)':''} ORDER BY v.created_at DESC`,[...customScope.params,...(req.user.role==='vims_operator'?[req.user.id]:[])])).rows:[];
    const customSummary=custom.map(({payload,...row})=>{
        const snapshot=typeof payload==='string'?JSON.parse(payload):payload;
        const current=require('../utils/customVis').view(snapshot);
        return {...row,title:snapshot.config.title,home_team:snapshot.config.home.name,away_team:snapshot.config.away.name,
            vims_count:(snapshot.actions||[]).length,gender:snapshot.config.gender,match_date:snapshot.config.date,start_time:snapshot.config.time,location:snapshot.config.location,
            home_team_id:current.match.home_team_id,away_team_id:current.match.away_team_id,
            home_set_score:current.state.setsWon.home,away_set_score:current.state.setsWon.away,
            home_team_name_th:snapshot.config.home.name_th,home_team_name_en:snapshot.config.home.name_en,
            away_team_name_th:snapshot.config.away.name_th,away_team_name_en:snapshot.config.away.name_en,
            status:current.match.status};
    });
    res.json({matches,custom:customSummary});
});
exports.users=endpoint(async(req,res)=>{
    if(!isSystemAdmin(req.user)&&!workerOf(req.user))throw denied();
    const scope=scopeSql(req.user,'g.competition_id');
    const where=isSystemAdmin(req.user)?'1=1':`u.role=? AND EXISTS(SELECT 1 FROM user_competition_access g WHERE g.user_id=u.id AND g.revoked_at IS NULL AND ${scope.sql})`;
    const rows=(await db.query(`SELECT u.id,u.username,u.role,u.status FROM users u WHERE ${where} ORDER BY u.id`,isSystemAdmin(req.user)?[]:[workerOf(req.user),...scope.params])).rows;
    const grants=(await db.query(`SELECT g.user_id,g.competition_id FROM user_competition_access g WHERE g.revoked_at IS NULL AND ${scope.sql}`,scope.params)).rows;
    res.json(rows.map(u=>({...u,competition_ids:grants.filter(g=>String(g.user_id)===String(u.id)).map(g=>Number(g.competition_id))})));
});
exports.createUser=endpoint(async(req,res)=>{
    const role=String(req.body.role||''),ids=competitionIds(req.body.competition_ids||[]);
    if(!Object.hasOwn(permissionsByRole,role)||(!isSystemAdmin(req.user)&&role!==workerOf(req.user)))throw denied('Cannot create this role');
    const username=String(req.body.username||'').trim(),password=String(req.body.password||'');
    if(!username||username.length>50||password.length<8)throw denied('Username and a password of at least 8 characters are required',400);
    if(!isSystemAdmin(req.user)&&ids.length===0)throw denied('Select at least one managed competition',400);
    const hash=await bcrypt.hash(password,10);
    const user=await transaction(async c=>{
        await lockActor(c,req);
        const expandedIds=await expandCompetitionAccess(c,ids);
        for(const id of expandedIds)await assertCompetition(c,req.user,id);
        const inserted=(await c.query('INSERT INTO users(username,password_hash,role,status) VALUES(?,?,?,?) RETURNING id,username,role,status',[username,hash,role,'active'])).rows[0];
        if(['scorer','referee'].includes(role)){
            const firstname=String(req.body.firstname||'').trim(),lastname=String(req.body.lastname||'').trim();
            if(!firstname||!lastname)throw denied('First and last name are required for officials',400);
            await c.query(`INSERT INTO ${role==='scorer'?'scorers':'referees'}(firstname,lastname,user_id) VALUES(?,?,?)`,[firstname,lastname,inserted.id]);
        }
        for(const id of expandedIds)await c.query('INSERT INTO user_competition_access(user_id,competition_id,granted_by) VALUES(?,?,?)',[inserted.id,id,req.user.id]);
        await strictAudit(c,req,'identity.create','user',inserted.id,{role,competition_ids:expandedIds});return inserted;
    });
    res.status(201).json(user);
});
exports.updateUser=endpoint(async(req,res)=>{
    if(!isSystemAdmin(req.user))throw denied('Only super_admin can change account role, status or password');
    const role=req.body.role,status=req.body.status,password=req.body.password;
    if(role!==undefined&&!Object.hasOwn(permissionsByRole,role))throw denied('Invalid role',400);
    if(status!==undefined&&!['pending','active','inactive','banned','rejected'].includes(status))throw denied('Invalid status',400);
    if(password!==undefined&&String(password).length<8)throw denied('Password must contain at least 8 characters',400);
    const hash=password===undefined?undefined:await bcrypt.hash(String(password),10);
    const user=await transaction(async c=>{
        await lockActor(c,req);
        // Serialize administrator changes so the last active central administrator cannot disappear.
        await c.query("SELECT pg_advisory_xact_lock(hashtext('volley-account-administration'))");
        const previous=(await c.query('SELECT id,role,status FROM users WHERE id=? FOR UPDATE',[req.params.id])).rows[0];
        if(!previous)throw denied('User not found',404);
        if(previous.role==='super_admin'&&previous.status==='active'&&(role&&role!=='super_admin'||status&&status!=='active')){
            const count=Number((await c.query("SELECT COUNT(*) AS count FROM users WHERE role='super_admin' AND status='active'")).rows[0].count);
            if(count<=1)throw denied('Cannot disable the last active super_admin',409);
        }
        const fields=[],values=[];
        for(const [name,value]of [['role',role],['status',status],['password_hash',hash]])if(value!==undefined){fields.push(`${name}=?`);values.push(value);}
        if(hash!==undefined)fields.push('authorization_version=authorization_version+1');
        if(!fields.length)throw denied('No account changes supplied',400);
        await c.query(`UPDATE users SET ${fields.join(',')} WHERE id=?`,[...values,previous.id]);
        if(role&&role!==previous.role)await c.query('UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[previous.id]);
        await strictAudit(c,req,'identity.update','user',previous.id,{previous,next:{role:role||previous.role,status:status||previous.status},password_reset:hash!==undefined});
        return (await c.query('SELECT id,username,role,status FROM users WHERE id=?',[previous.id])).rows[0];
    });res.json(user);
});
exports.setCompetitions=endpoint(async(req,res)=>{
    if(!isSystemAdmin(req.user)&&!workerOf(req.user))throw denied();
    const ids=competitionIds(req.body.competition_ids);
    await transaction(async c=>{
        await lockActor(c,req);
        const user=(await c.query('SELECT id,role FROM users WHERE id=? FOR UPDATE',[req.params.id])).rows[0];
        if(!user||(!isSystemAdmin(req.user)&&user.role!==workerOf(req.user)))throw denied('Cannot manage this account');
        const expandedIds=await expandCompetitionAccess(c,ids);
        for(const id of expandedIds)await assertCompetition(c,req.user,id);
        const managed=scopeSql(req.user,'competition_id');
        await c.query(`UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL AND ${managed.sql}`,[user.id,...managed.params]);
        for(const id of expandedIds)await c.query(`INSERT INTO user_competition_access(user_id,competition_id,granted_by) VALUES(?,?,?)
            ON CONFLICT(user_id,competition_id) DO UPDATE SET revoked_at=NULL,granted_by=EXCLUDED.granted_by,granted_at=NOW()`,[user.id,id,req.user.id]);
        await strictAudit(c,req,'identity.competition_access','user',user.id,{competition_ids:expandedIds});
    });res.json({success:true});
});
exports.linkCompetition=endpoint(async(req,res)=>{
    const custom=req.params.kind==='custom';if(!custom&&req.params.kind!=='match')throw denied('Invalid match kind',400);
    requirePermission(req.user,custom?'vims.record':'score.record');
    await transaction(async c=>{
        await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[lockKey(req.params.kind,req.params.id)]);
        const table=custom?'custom_vis_matches':'matches',owner=custom?'owner_id':'manual_owner_id';
        const row=(await c.query(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`,[req.params.id])).rows[0];
        if(!row||!row[owner]||String(row[owner])!==String(req.user.id))throw denied('Only the private match owner can link this match');
        const review=(await c.query(`SELECT id FROM match_reviews WHERE ${custom?'custom_match_id':'match_id'}=?`,[row.id])).rows[0];
        if(review)throw denied('Competition link is fixed after the first review submission',409);
        await assertCompetition(c,req.user,req.body.competition_id);
        await c.query(`UPDATE ${table} SET competition_id=? WHERE id=?`,[req.body.competition_id,row.id]);
        await strictAudit(c,req,'match.link_competition','match',row.id,{competition_id:req.body.competition_id});
    });res.json({success:true});
});
async function fingerprint(c,row,custom,domain) {
    const pieces=custom?[row.payload]:domain==='vims'?[row.vis_state]:[row.live_state,row.match_setup,row.set_scores,row.home_set_score,row.away_set_score,row.winner_team_id];
    pieces.push(row.competition_id);
    if(domain==='score'){
        pieces.push(row.manual_config,row.max_sets);
        pieces.push((await c.query('SELECT max_sets,scoring_config FROM competitions WHERE id=?',[row.competition_id])).rows[0]);
    }
    if(!custom)for(const table of domain==='vims'?['match_actions']:['match_events','match_sets','match_lineups']){
        pieces.push((await c.query(`SELECT * FROM ${table} WHERE match_id=?${table==='match_actions'?" AND action_type='VIS_STAT'":''} ORDER BY id`,[row.id])).rows);
    }
    return createHash('sha256').update(JSON.stringify(pieces)).digest('hex');
}
exports.scoreFingerprint=fingerprint;
exports.reviews=endpoint(async(req,res)=>{
    const worker=['scorer','vims_operator'].includes(req.user.role);
    const domain=domainOf(req.user)||(worker?(req.user.role==='scorer'?'score':'vims'):null);
    if(!domain&&!isSystemAdmin(req.user))throw denied();
    const scope=scopeSql(req.user,'r.competition_id');
    res.json((await db.query(`SELECT r.*,c.title AS competition_name,c.title_th AS competition_name_th,c.title_en AS competition_name_en,u.username AS submitted_username FROM match_reviews r
        JOIN competitions c ON c.id=r.competition_id JOIN users u ON u.id=r.submitted_by
        WHERE ${scope.sql}${domain?' AND r.domain=?':''}${worker?' AND r.submitted_by=?':''} ORDER BY r.id DESC`,[...scope.params,...(domain?[domain]:[]),...(worker?[req.user.id]:[])])).rows);
});
exports.review=endpoint(async(req,res)=>{
    const {kind,id,domain,action}=req.params,custom=kind==='custom';
    if(!['match','custom'].includes(kind)||!['score','vims'].includes(domain)||(custom&&domain!=='vims')||!['submit','confirm','return','reopen','publish'].includes(action))throw denied('Invalid review action',400);
    requirePermission(req.user,`${domain}.${action==='submit'?'submit':action==='publish'?'publish':action==='reopen'?'reopen':'review'}`);
    const reason=String(req.body.reason||'').trim();
    if(action==='publish'&&typeof req.body.published!=='boolean')throw denied('Select a publication status',400);
    if(['return','reopen'].includes(action)&&!reason)throw denied('A reason is required',400);
    const result=await transaction(async c=>{
        if(!custom)await require('../utils/competitionWorkflowStore').lockForMatch(c,id);
        await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[lockKey(kind,id)]);
        const current=(await c.query('SELECT role,status FROM users WHERE id=? FOR SHARE',[req.user.id])).rows[0];
        if(!current||current.status!=='active'||normalizeRole(current.role)!==normalizeRole(req.user.role))throw denied('Account permissions changed');
        const table=custom?'custom_vis_matches':'matches',column=custom?'custom_match_id':'match_id';
        const row=(await c.query(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`,[id])).rows[0];
        if(!row)throw denied('Match not found',404);
        if(domain==='score'&&row.result_type==='forfeit')throw denied('ผลปรับแพ้จัดการและยืนยันจาก workflow เท่านั้น',409);
        await assertCompetition(c,req.user,row.competition_id);
        const latest=(await c.query(`SELECT * FROM match_reviews WHERE ${column}=? AND domain=? ORDER BY revision DESC LIMIT 1 FOR UPDATE`,[id,domain])).rows[0];
        if(action==='submit'){
            const owner=custom?row.owner_id:row.manual_owner_id;
            const statisticsWriter=!custom&&domain==='vims'&&Number(row.manual_vis_shared)===1&&String(row.manual_vis_assignee_id)===String(req.user.id);
            if(owner&&String(owner)!==String(req.user.id)&&!statisticsWriter)throw denied('Only the owner or assigned statistics writer can submit this private match');
            if(latest&&['submitted','confirmed'].includes(latest.status))throw denied('This revision is already submitted or confirmed',409);
            const payload=custom?(typeof row.payload==='string'?JSON.parse(row.payload):row.payload):null;
            if(domain==='score'&&row.status!=='completed')throw denied('Complete the match before submitting scores',409);
            if(domain==='score')await require('../utils/reviewValidation').validateScore(c,row);
            if(custom&&(payload.lifecycle!=='review'||require('../utils/customVis').view(payload).state.phase!=='MATCH_FINISHED'))throw denied('Complete the statistics match before submission',409);
            if(!custom&&domain==='vims'){
                if(row.status!=='completed')throw denied('Complete the match before submitting statistics',409);
                const count=Number((await c.query("SELECT COUNT(*) AS count FROM match_actions WHERE match_id=? AND action_type='VIS_STAT'",[id])).rows[0].count);
                if(!count)throw denied('No statistics to submit',409);
                const state=typeof row.vis_state==='string'?JSON.parse(row.vis_state):row.vis_state;
                if(state?.offlineVis?.payload?.offlineLease?.expiresAt>Date.now())throw denied('Release the offline statistics lease first',409);
            }
            const lease=!custom?(await c.query('SELECT released,expires_at FROM scorer_offline_sessions WHERE match_id=?',[id])).rows[0]:null;
            if(lease&&!lease.released&&Number(lease.expires_at)>Date.now())throw denied('Sync and release the offline lease first',409);
            const hash=await fingerprint(c,row,custom,domain);
            const review=(await c.query(`INSERT INTO match_reviews(${column},domain,competition_id,revision,fingerprint,status,submitted_by)
                VALUES(?,?,?,?,?,'submitted',?) RETURNING *`,[id,domain,row.competition_id,Number(latest?.revision||0)+1,hash,req.user.id])).rows[0];
            await strictAudit(c,req,`${domain}.submit`,'match',id,{review_id:review.id,revision:review.revision});return review;
        }
        if(!latest||Number(req.body.revision)!==Number(latest.revision))throw denied('Review revision changed; reload first',409);
        if(String(latest.submitted_by)===String(req.user.id))throw denied('Cannot review your own work');
        if(action==='publish'){
            if(latest.status!=='confirmed')throw denied('Confirm this revision first',409);
            if(custom)await c.query('UPDATE custom_vis_matches SET published=? WHERE id=?',[req.body.published===true?1:0,id]);
            else if(row.manual_owner_id&&domain==='score')await c.query('UPDATE matches SET manual_published=? WHERE id=?',[req.body.published===true?1:0,id]);
            else if(row.manual_owner_id)throw denied('VIMS review cannot publish private score data',400);
            // Official matches remain publicly readable regardless of review/publication status.
        }else{
            if(action==='reopen'&&latest.status!=='confirmed'||action!=='reopen'&&latest.status!=='submitted')throw denied('Invalid review transition',409);
            if(action==='confirm'&&await fingerprint(c,row,custom,domain)!==latest.fingerprint)throw denied('Recorded data changed; return this revision for correction',409);
            const status=action==='confirm'?'confirmed':action==='return'?'returned':'reopened';
            await c.query('UPDATE match_reviews SET status=?,decided_by=?,decided_at=NOW(),reason=? WHERE id=?',[status,req.user.id,reason||null,latest.id]);
            if(!custom&&domain==='score')await require('../utils/competitionWorkflowStore').onReviewChange(c,id,action,req.user.id);
            if(domain==='score'&&row.manual_owner_id){
                await c.query('UPDATE matches SET manual_lifecycle=?,manual_published=? WHERE id=?',[action==='confirm'?'confirmed':'review',action==='reopen'?0:row.manual_published,id]);
            }
            if(custom){
                const payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
                payload.lifecycle=action==='confirm'?'confirmed':'review';
                await c.query('UPDATE custom_vis_matches SET payload=?,published=? WHERE id=?',[JSON.stringify(payload),action==='reopen'?0:row.published,id]);
            }
        }
        await strictAudit(c,req,`${domain}.${action}`,'match',id,{revision:latest.revision,reason:reason||null});
        return {success:true,revision:latest.revision};
    });res.json(result);
});
// Useful for a readonly review preview. It intentionally excludes athlete documents and leases.
exports.preview=endpoint(async(req,res)=>{
    const custom=req.params.kind==='custom';if(!custom&&req.params.kind!=='match')throw denied('Invalid match kind',400);
    const row=(await db.query(`SELECT * FROM ${custom?'custom_vis_matches':'matches'} WHERE id=?`,[req.params.id])).rows[0];
    if(!row)throw denied('Match not found',404);
    await assertCompetition(db,req.user,row.competition_id);
    requirePermission(req.user,'match.view');
    const sets=custom?[]:(await db.query('SELECT set_number,home_score,away_score,start_time,end_time FROM match_sets WHERE match_id=? ORDER BY set_number',[row.id])).rows;
    let statistics;
    if(custom){
        const payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
        statistics=(payload.actions||[]).map(a=>({...a,player_name:['home','away'].flatMap(side=>payload.config?.[side]?.players||[]).find(p=>Number(p.id)===Number(a.player_id))?.name||''}));
    }else statistics=(await db.query(`SELECT a.id,a.set_number,a.skill,a.grade,a.description AS event_code,a.score_home,a.score_away,
        p.first_name,p.last_name FROM match_actions a LEFT JOIN players p ON p.id=a.player_id WHERE a.match_id=? AND a.action_type='VIS_STAT' ORDER BY a.id`,[row.id])).rows;
    res.json({match:publicProjection(row),sets,statistics:publicProjection(statistics)});
});
module.exports.domainOf=domainOf;
exports.vimsDetail=endpoint(async(req,res)=>{
    const c=await db.connect();
    try {
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const detail=await require('../utils/vimsReviewDetail').loadVimsReviewDetail(c,req.user,req.params.kind,req.params.id,Number(req.query.eventPage??1));
        await c.query('ROLLBACK');res.setHeader('Cache-Control','no-store');res.json(detail);
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
});
