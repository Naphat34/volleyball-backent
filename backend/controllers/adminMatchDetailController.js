const db = require('../config/db');
const { denied, assertCompetition } = require('../utils/accessScope');
const { administratorRoles, roleHasPermission } = require('../config/permissions');
const { restoreSnapshot } = require('../utils/automaticEntryRoster');
const { applyMatchSetup, setupPlayers, setupStaff } = require('../utils/matchSetup');
const { teamCompositionStaff } = require('../utils/teamCompositionStaff');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value || {};
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key,value[key]]));
const playerKeys = ['id','number','first_name','last_name','first_name_th','last_name_th','first_name_en','last_name_en','role','position','is_captain','is_libero1','is_libero2','is_playing'];

exports.detail = async (req,res) => {
    let c;
    try {
        const organizer=req.user?.role==='organizer';
        if (!administratorRoles.has(req.user?.role)&&!organizer) throw denied();
        const id=String(req.params.id), uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (!uuid && !/^[1-9]\d*$/.test(id)) throw denied('Invalid match ID',400);
        if (!uuid && !Number.isSafeInteger(Number(id))) throw denied('Invalid match ID',400);
        const page=Number(req.query.eventPage||1);
        if (!Number.isSafeInteger(page)||page<1||page>1000000) throw denied('Invalid event page',400);
        c=await db.connect();
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const row=(await c.query(`SELECT m.*,c.title AS competition_name,c.title_th,c.title_en,c.gender AS competition_gender,
            ag.name AS age_group_name,s.name AS stadium_name,sc.firstname AS scorer_firstname,sc.lastname AS scorer_lastname,
            h.name AS home_team_name,a.name AS away_team_name,
            r1.firstname AS referee_1_firstname,r1.lastname AS referee_1_lastname,
            r2.firstname AS referee_2_firstname,r2.lastname AS referee_2_lastname,
            asc1.firstname AS assistant_firstname,asc1.lastname AS assistant_lastname
            FROM matches m LEFT JOIN competitions c ON c.id=m.competition_id
            LEFT JOIN age_groups ag ON ag.id=COALESCE(m.age_group_id,c.age_group_id)
            LEFT JOIN stadiums s ON s.id=m.stadium_id LEFT JOIN scorers sc ON sc.id=m.scorer_id
            LEFT JOIN teams h ON h.id=m.home_team_id LEFT JOIN teams a ON a.id=m.away_team_id
            LEFT JOIN referees r1 ON r1.id=m.referee_1_id LEFT JOIN referees r2 ON r2.id=m.referee_2_id
            LEFT JOIN scorers asc1 ON asc1.id=m.assistant_scorer_id
            WHERE m.${uuid?'public_id':'id'}=?`,[id])).rows[0];
        if(!row)throw denied('Match not found',404);
        await assertCompetition(c,req.user,row.competition_id);
        const match=applyMatchSetup({...row});
        const roster={};
        for(const side of ['home','away']){
            const entry=(await c.query(`SELECT id,status,roster_locked_at,roster_sync_error FROM team_entries
                WHERE competition_id=? AND team_id=?`,[row.competition_id,row[`${side}_team_id`]])).rows[0];
            const players=entry?(await c.query(`SELECT p.id,p.first_name,p.last_name,p.first_name_th,p.last_name_th,p.first_name_en,p.last_name_en,
                ep.number,ep.role,ep.is_captain,ep.is_libero1,ep.is_libero2,ep.is_playing,ep.athlete_snapshot
                FROM team_entry_players ep JOIN players p ON p.id=ep.player_id AND p.team_id=?
                WHERE ep.team_entry_id=? ORDER BY ep.number,p.id`,[row[`${side}_team_id`],entry.id])).rows.map(restoreSnapshot):[];
            const staff=entry?await teamCompositionStaff(c,entry.id):{staff:[],source:'none'};
            const saved=parse(row.match_setup)?.[side];
            roster[side]={ team_id:row[`${side}_team_id`],name:match[`${side}_team_name`],entry_id:entry?.id||null,
                registration_status:entry?.status||null,roster_locked_at:entry?.roster_locked_at||null,
                has_sync_error:Boolean(entry?.roster_sync_error),setup_revision:Number(row.match_setup_revision||0),
                source:row.status==='scheduled'&&!row.manual_owner_id?'registration':Array.isArray(saved?.players)?'match_snapshot':'registration',
                players:setupPlayers(row,side,players,{syncBeforeLive:true}).map(p=>pick(p,playerKeys)),
                staff:setupStaff(row,side,staff.staff).map(p=>pick(p,['id','first_name','last_name','role'])),staff_source:saved?.staff?'match_snapshot':staff.source };
        }
        const sets=(await c.query('SELECT id,set_number,home_score,away_score,start_time,end_time FROM match_sets WHERE match_id=? ORDER BY set_number',[row.id])).rows;
        const lineups=(await c.query('SELECT set_number,team_id,player_id_p1,player_id_p2,player_id_p3,player_id_p4,player_id_p5,player_id_p6,libero_id FROM match_lineups WHERE match_id=? ORDER BY set_number,team_id',[row.id])).rows;
        const total=organizer?0:Number((await c.query('SELECT COUNT(*) AS count FROM match_events WHERE match_id=?',[row.id])).rows[0].count);
        const events=organizer?[]:(await c.query(`SELECT e.id,s.set_number,e.team_id,e.player_id,e.skill,e.grade,e.event_type,
            e.score_home,e.score_away,e.created_at,e.details FROM match_events e LEFT JOIN match_sets s ON s.id=e.set_id
            WHERE e.match_id=? ORDER BY e.id DESC LIMIT 100 OFFSET ?`,[row.id,(page-1)*100])).rows.map(e=>({...pick(e,['id','set_number','team_id','player_id','skill','grade','event_type','score_home','score_away','created_at']),
                details:pick(parse(e.details),['player_in_id','player_out_id','playerIn','playerOut','sanction_type','type'])}));
        const reviews=(await c.query(`SELECT r.id,r.domain,r.revision,r.status,r.submitted_by,r.submitted_at,r.decided_at,r.reason,
            u.username AS submitted_username,d.username AS decided_username FROM match_reviews r
            JOIN users u ON u.id=r.submitted_by LEFT JOIN users d ON d.id=r.decided_by WHERE r.match_id=? ORDER BY r.revision DESC,r.id DESC`,[row.id])).rows;
        const latest={};
        for(const review of reviews)if(!latest[review.domain]){
            const allowed=!organizer&&String(review.submitted_by)!==String(req.user.id);
            latest[review.domain]={...(organizer?pick(review,['domain','revision','status','submitted_at','decided_at']):review),actions:allowed?[
                ...(review.status==='submitted'&&roleHasPermission(req.user.role,`${review.domain}.review`)?['confirm','return']:[]),
                ...(review.status==='confirmed'&&roleHasPermission(req.user.role,`${review.domain}.reopen`)?['reopen']:[]),
                ...(review.status==='confirmed'&&row.manual_owner_id&&review.domain==='score'&&roleHasPermission(req.user.role,'score.publish')?['publish']:[]),
            ]:[]};
        }
        const history=organizer?[]:(await c.query(`SELECT id,action,username,created_at,details FROM audit_logs
            WHERE entity_type='match' AND entity_id=? AND (action LIKE 'score.%' OR action LIKE 'vims.%')
            ORDER BY id DESC LIMIT 200`,[String(row.id)])).rows.map(a=>({...pick(a,['id','action','username','created_at']),...pick(parse(a.details),['revision','reason'])}));
        const statisticCount=Number((await c.query("SELECT COUNT(*) AS count FROM match_actions WHERE match_id=? AND action_type='VIS_STAT'",[row.id])).rows[0].count);
        const statistics=roleHasPermission(req.user.role,'vims.monitor')?(await c.query(`SELECT id,set_number,team_id,player_id,skill,grade,score_home,score_away
            FROM match_actions WHERE match_id=? AND action_type='VIS_STAT' ORDER BY id DESC LIMIT 100`,[row.id])).rows:[];
        const correction=pick(parse(row.live_state).resultCorrection||{},['reviewRevision','correctedAt','signaturesRetained']);
        const name=(first,last)=>[first,last].filter(Boolean).join(' ');
        const officials=[{role:'ผู้ตัดสินที่ 1',name:name(row.referee_1_firstname,row.referee_1_lastname)},
            {role:'ผู้ตัดสินที่ 2',name:name(row.referee_2_firstname,row.referee_2_lastname)},
            {role:'ผู้บันทึกคะแนน',name:name(row.scorer_firstname,row.scorer_lastname)||row.scorer_name||''},
            {role:'ผู้ช่วยผู้บันทึกคะแนน',name:name(row.assistant_firstname,row.assistant_lastname)||row.assistant_scorer_name||''}];
        await c.query('ROLLBACK');
        res.setHeader('Cache-Control','no-store');
        res.json({match:pick(match,['id','public_id','competition_id','competition_name','title_th','title_en','competition_gender','gender','age_group_name',
            'match_number','round_name','pool_name','match_date','start_time','stadium_name','location','court_number','status','home_team_name','away_team_name',
            'home_set_score','away_set_score','scorer_firstname','scorer_lastname','scorer_name']),roster,sets,lineups,events,eventPage:page,eventTotal:total,
            latest,reviews:organizer?[]:reviews,history,historyLimit:200,statisticCount,statistics,statisticsLimit:100,correction,officials,
            publication:row.manual_owner_id?{kind:'private',published:Number(row.manual_published)===1}:{kind:'official',published:true}});
    } catch(error){
        if(c)await c.query('ROLLBACK').catch(()=>{});
        if(!error.status)console.error('Admin match detail failed:',error.code||error.name);
        res.status(error.status||500).json({error:error.status?error.message:'Could not load match details'});
    } finally { c?.release(); }
};
