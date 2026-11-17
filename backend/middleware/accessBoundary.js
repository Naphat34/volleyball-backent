const db = require('../config/db');
const auth = require('./authMiddleware');
const { roleHasPermission } = require('../config/permissions');
const { denied, isSystemAdmin, assertCompetition, assertMatch, loadCapabilities } = require('../utils/accessScope');
const { holdRecordingAccess } = require('./recordingLock');
const { accessPath } = require('../utils/accessPath');

const privateFields = new Set(['password_hash','national_id','identity_document_url','student_certificate_url','guardian_consent_url',
    'contact_phone','email','phone','mobile_phone','verification_doc_url','authorization_version','manual_owner_id','manual_config','manual_creation_id',
    'manual_vis_assignee_id','manual_vis_claimed_at','offlineVis','offlineLease','checkpoint','fingerprint','receipts',
    'checkoutToken','deviceId','device_id','owner_id','offlineDevice','public_token','vis_state']);
function publicProjection(value) {
    if (Array.isArray(value)) return value.map(publicProjection);
    if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !privateFields.has(key)).map(([key, item]) => {
        if(['live_state','match_state','match_setup'].includes(key)&&typeof item==='string'){
            try{return [key,JSON.stringify(publicProjection(JSON.parse(item)))];}catch{return [key,null];}
        }
        return [key,publicProjection(item)];
    }));
}
async function runAuth(req,res) {
    let token=false, active=false;
    auth.verifyToken(req,res,()=>{ token=true; });
    if (!token) return false;
    await auth.requireApprovedUser(req,res,()=>{ active=true; });
    return active;
}
const publicRead = path => /^\/(?:public\/|age-groups$|competitions\/open$|vis-custom\/public\/)/.test(path)
    || /^\/scorer\/match\/\d+(?:\/(events|lineup|roster|scoresheet|state))?$/.test(path);

function scopedResponse(res, predicate, project = value => value) {
    const json = res.json.bind(res);
    res.json = value => json(Array.isArray(value) ? value.filter(predicate).map(project) : project(value));
}
async function boundary(req, res, next) {
    try {
        req.body ||= {};
        const p = accessPath(req.path), read = ['GET','HEAD'].includes(req.method);
        if (p.startsWith('/auth/') || (p === '/upload-image' && req.body.category === 'team_logo')) return next();
        if (read && publicRead(p)) {
            // Public readers never receive private recording/session metadata. Authorized consoles retain it.
            const match = p.match(/^\/scorer\/match\/(\d+)/);
            let internal = false;
            if (match && (req.headers.authorization || req.cookies?.token)) {
                try {
                    const jwt = require('jsonwebtoken');
                    const raw = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : req.cookies?.token;
                    const token = jwt.verify(raw, require('../config/security').getJwtSecret());
                    const user = (await db.query('SELECT id,role,status,team_id,authorization_version FROM users WHERE id=?',[token.id])).rows[0];
                    if (user?.status === 'active'&&Number(token.authorization_version)===Number(user.authorization_version)) {
                        const row = (await db.query('SELECT competition_id,manual_owner_id FROM matches WHERE id=?',[match[1]])).rows[0];
                        if (row && roleHasPermission(user.role,'match.view')) {
                            if (row.manual_owner_id && !row.competition_id && String(row.manual_owner_id) === String(user.id)) internal = true;
                            else { await assertCompetition(db,user,row.competition_id); internal = true; }
                        }
                    }
                } catch { /* Invalid/expired internal credentials still have public access. */ }
            }
            if (!internal) { const json = res.json.bind(res); res.json = value => json(publicProjection(value)); }
            return next();
        }
        if (!(await runAuth(req,res))) return;
        req.user = await loadCapabilities(db,req.user);
        if (p.startsWith('/competition-workflows/')) return next();
        const workflowRecording=p.match(/^\/scorer\/match\/(\d+)(?:\/|$)/);
        if(workflowRecording&&!read){
            await require('../utils/competitionWorkflowStore').assertRecording(db,workflowRecording[1]);
            await require('../utils/competitionWorkflowStore').assertMetadata(db,workflowRecording[1],req.body,false,true);
        }
        if (p.startsWith('/access/') || p === '/access') return next();
        if (/^\/(me(?:\/|$)|my-team|my-teams|player-documents|upload-player-document)/.test(p)
            || ['/competitions/join','/competitions/leave','/upload-image'].includes(p)) return next();
        if (isSystemAdmin(req.user)) return next();
        const ids = new Set(req.user.competition_ids.map(String));
        const permission = name => { if (!roleHasPermission(req.user.role,name)) throw denied(); };
        const match = p.match(/^\/(?:scorer\/match|match|matches)\/(\d+)(?:\/|$)/);
        const bodyMatch = p.startsWith('/match-data/') ? req.body.match_id : null;
        if (match || bodyMatch) {
            const id = match?.[1] || bodyMatch;
            if (req.user.role === 'team_staff' && /\/requests?(?:\/|$)|\/lineup\//.test(p)) return next();
            const vims = /\/vis(?:$|-offline-)/.test(p);
            const metadata = /^\/matches\/\d+$/.test(p);
            if (metadata && !read) {
                const previous=(await db.query('SELECT * FROM matches WHERE id=?',[id])).rows[0];
                require('../utils/adminRecordingPolicy').assertAdminRecordingPolicy({role:'super_admin'},req.body,previous||{});
                if(req.body.status&&req.body.status!==previous?.status&&!['scheduled','cancelled'].includes(req.body.status))throw denied('Recording workflow controls Live and completed statuses');
            }
            const needed = read ? 'match.view' : metadata ? 'match.manage' : vims ? 'vims.record' : 'score.record';
            const options={draftOwner:true,writing:!read,domain:!read&&!metadata?(vims?'vims':'score'):undefined};
            if (!read) {await assertMatch(db,req.user,'match',id,needed,options);await holdRecordingAccess(req,res,'match',id,needed,options);}
            else await assertMatch(db,req.user,'match',id,needed,options);
            if (req.body.competition_id) await assertCompetition(db,req.user,req.body.competition_id);
            return next();
        }
        const custom = p.match(/^\/vis-custom\/(custom-[\w-]+)(?:\/|$)/);
        if (custom) {
            const needed = p.endsWith('/publish')?'vims.publish':p.endsWith('/reopen')?'vims.reopen':read?'match.view':'vims.record';
            const options={draftOwner:true,writing:!read,domain:!read&&!/\/(publish|reopen)$/.test(p)?'vims':undefined,
                allowCreate:!read&&p.endsWith('/offline-sync')&&Boolean(req.body.config)};
            permission(needed);
            if (!read) await holdRecordingAccess(req,res,'custom',custom[1],needed,options);
            else await assertMatch(db,req.user,'custom',custom[1],needed,options);
            if (['CONFIRM','REOPEN'].includes(req.body.command?.type)) throw denied('Use the administrator review workflow');
            return next();
        }
        if (/^\/vis-custom(?:\/|$)/.test(p)) {
            if(!['/vis-custom','/vis-custom/offline-permit','/vis-custom/athlete-options'].includes(p))throw denied('Invalid resource identifier',400);
            permission(p.endsWith('/athlete-options')?'athlete.identity.link':'vims.record');
            if (read && p === '/vis-custom') scopedResponse(res,row=>(!row.competition_id&&String(row.owner_id)===String(req.user.id))||ids.has(String(row.competition_id)));
            return next();
        }
        const manual = p.match(/^\/scorer\/manual-matches\/(\d+)(?:\/|$)/);
        if (manual) {
            const options={draftOwner:true,writing:!read,domain:!read?'score':undefined};
            if (!read) await holdRecordingAccess(req,res,'match',manual[1],'score.record',options);
            else await assertMatch(db,req.user,'match',manual[1],'match.view',options);
            if (/\/(confirm|publish)$/.test(p)) throw denied('Use the administrator review workflow');
            return next();
        }
        if (p.startsWith('/scorer/manual-matches')) {
            if(p!=='/scorer/manual-matches')throw denied('Invalid resource identifier',400);
            permission('score.record');if(read&&p==='/scorer/manual-matches')scopedResponse(res,row=>(!row.competition_id&&String(row.manual_owner_id)===String(req.user.id))||ids.has(String(row.competition_id)));
            return next();
        }
        if (p.startsWith('/scorer/manual-vis-matches')) {
            permission('vims.record');
            const id = p.match(/manual-vis-matches\/(\d+)(?:\/|$)/)?.[1];
            if(!id&&p!=='/scorer/manual-vis-matches')throw denied('Invalid resource identifier',400);
            if (id) {
                const options={writing:!read,domain:!read?'vims':undefined};
                await assertMatch(db,req.user,'match',id,'vims.record',options);
                if(!read)await holdRecordingAccess(req,res,'match',id,'vims.record',options);
            }
            else scopedResponse(res,row=>ids.has(String(row.competition_id)));
            return next();
        }
        if (p === '/scorer/offline-permit') { permission('score.offline'); return next(); }
        if (p === '/scorer/matches') {
            permission('match.view'); scopedResponse(res,row=>ids.has(String(row.competition_id))); return next();
        }
        if (/^\/(scorer|admin)\/(referees|scorers|line-judges)$/.test(p)&&read) {
            permission('official.view');
            const kind=p.split('/').at(-1),columns=kind==='referees'?['referee_1_id','referee_2_id']:kind==='scorers'?['scorer_id','assistant_scorer_id']:['line_judge_1_id','line_judge_2_id','line_judge_3_id','line_judge_4_id'];
            const rows=(await db.query(`SELECT ${columns.join(',')} FROM matches WHERE competition_id IN
                (SELECT competition_id FROM user_competition_access WHERE user_id=? AND revoked_at IS NULL)`,[req.user.id])).rows;
            const allowed=new Set(rows.flatMap(r=>Object.values(r)).filter(Boolean).map(String));
            if(kind!=='line-judges'){
                const table=kind==='scorers'?'scorers':'referees';
                const profiles=(await db.query(`SELECT id FROM ${table} WHERE user_id=? OR user_id IN (
                    SELECT user_id FROM user_competition_access WHERE revoked_at IS NULL AND competition_id IN
                    (SELECT competition_id FROM user_competition_access WHERE user_id=? AND revoked_at IS NULL))`,[req.user.id,req.user.id])).rows;
                for(const r of profiles)allowed.add(String(r.id));
            }
            scopedResponse(res,row=>allowed.has(String(row.id)),row=>{const {account_username:_account,...profile}=row;return profile;});return next();
        }
        if (p === '/admin/competitions' && read) {
            permission('competition.manage'); scopedResponse(res,row=>ids.has(String(row.id))); return next();
        }
        if(p==='/admin/stadiums'&&read){permission('competition.manage');scopedResponse(res,()=>true,publicProjection);return next();}
        if(read&&/^\/admin\/(teams|players)(?:\/|$)/.test(p)){
            permission('team.read');
            const teams=(await db.query(`SELECT DISTINCT team_id FROM team_entries WHERE competition_id IN
                (SELECT competition_id FROM user_competition_access WHERE user_id=? AND revoked_at IS NULL)`,[req.user.id])).rows;
            const teamIds=new Set(teams.map(t=>String(t.team_id))),target=p.match(/^\/admin\/teams\/(\d+)/)?.[1];
            if(target&&!teamIds.has(target))throw denied('No access to this team');
            scopedResponse(res,row=>target?true:teamIds.has(String(p==='/admin/players'?row.team_id:row.id)),publicProjection);return next();
        }
        const competition = p.match(/^\/(?:admin\/)?competitions\/([^/]+)/);
        if (competition) {
            permission(read?'match.view':p.endsWith('/generate-matches')?'match.manage':'competition.manage');
            await assertCompetition(db,req.user,competition[1]); return next();
        }
        if (p === '/matches' && !read) { permission('match.manage');require('../utils/adminRecordingPolicy').assertAdminRecordingPolicy({role:'super_admin'},req.body);await assertCompetition(db,req.user,req.body.competition_id); return next(); }
        if (p === '/admin/matches/all') { permission('match.manage'); scopedResponse(res,row=>ids.has(String(row.competition_id))); return next(); }
        if (p === '/admin/team-entries') { permission('registration.manage'); scopedResponse(res,row=>ids.has(String(row.competition_id))); return next(); }
        const entry = p.match(/^\/(?:admin\/team-entries|reports\/team-composition)\/(\d+)/);
        if (entry) {
            permission(read?'report.export':'registration.manage');
            const row=(await db.query('SELECT competition_id FROM team_entries WHERE id=?',[entry[1]])).rows[0];
            await assertCompetition(db,req.user,row?.competition_id); return next();
        }
        if (p === '/reports/team-composition/entries') { permission('report.export'); scopedResponse(res,row=>ids.has(String(row.competition_id))); return next(); }
        if (p === '/admin/vis/overview') { permission('vims.monitor'); return next(); }
        if (p.startsWith('/reports/')) { permission('report.export'); return next(); }
        if (p.startsWith('/players/') && read) { const json=res.json.bind(res);res.json=value=>json(publicProjection(value)); return next(); }
        // Shared master identities and system endpoints require the central administrator.
        throw denied('This operation requires the system administrator');
    } catch(error) { res.status(error.status||500).json({error:error.status?error.message:'Unable to authorize access'}); }
}
module.exports = { boundary, publicProjection };
