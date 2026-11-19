const {assertMatch,denied}=require('./accessScope');
const {roleHasPermission}=require('../config/permissions');
const {applyMatchSetup}=require('./matchSetup');
const {restoreSnapshot}=require('./automaticEntryRoster');
const {projectOfficialState}=require('./visWorkflow');
const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
const playerKeys=['id','number','name','first_name','last_name','first_name_th','last_name_th','first_name_en','last_name_en','position','role','is_captain','is_libero1','is_libero2'];
const matchKeys=['id','public_id','competition_id','competition_name','competition_name_th','competition_name_en','match_number','match_date','start_time','location','location_th','location_en','gender','age_group_name','round_name','pool_name','status','home_team_id','away_team_id','home_team_name','away_team_name','home_team_name_th','home_team_name_en','away_team_name_th','away_team_name_en','home_set_score','away_set_score','max_sets','manual_owner_id','manual_vis_assignee_id'];

function reviewReadiness({match,custom=false,count,latest,user,offline=false,phase}) {
    const owner=custom?match.owner_id:match.manual_owner_id;
    const writer=!custom&&Number(match.manual_vis_shared)===1&&String(match.manual_vis_assignee_id)===String(user.id);
    const checks=[
        {key:'competition',ok:Boolean(match.competition_id)},
        {key:'completed',ok:match.status==='completed'},
        {key:'statistics',ok:count>0},
        {key:'offline',ok:!offline},
        {key:'revision',ok:(!latest||!['submitted','confirmed'].includes(latest.status))&&(!custom||match.vis_lifecycle==='review')},
        {key:'writer',ok:roleHasPermission(user.role,'vims.submit')&&(!owner||String(owner)===String(user.id)||writer)},
    ];
    return {canSubmit:checks.every(check=>check.ok),checks,warnings:phase!=='MATCH_FINISHED'?['vims_unfinished']:[]};
}

async function loadVimsReviewDetail(c,user,kind,id,eventPage=1) {
    if(!roleHasPermission(user.role,'vims.submit')&&!roleHasPermission(user.role,'vims.monitor'))throw denied();
    if(!['match','custom'].includes(kind)||!Number.isSafeInteger(eventPage)||eventPage<1||eventPage>100000)throw denied('Invalid review detail request',400);
    const {row,custom}=await assertMatch(c,user,kind,id,'match.view',{draftOwner:true,domain:'vims'});
    let match,state,roster,sets,actions,lastActions,count,offline;
    if(custom){
        const payload=parse(row.payload),current=require('./customVis').view(payload);
        match={...current.match,competition_id:row.competition_id,owner_id:row.owner_id};state=current.state;
        const comp=row.competition_id?(await c.query('SELECT title,title_th,title_en FROM competitions WHERE id=?',[row.competition_id])).rows[0]:null;
        if(comp)Object.assign(match,{competition_name:comp.title,competition_name_th:comp.title_th,competition_name_en:comp.title_en});
        roster=Object.fromEntries(['home','away'].map(side=>[side,{players:(payload.config?.[side]?.players||[]).map(player=>pick(player,playerKeys)),staff:(payload.config?.[side]?.staff||[]).map(person=>pick(person,['id','first_name','last_name','name','role']))}]));
        actions=(payload.actions||[]).map(action=>({...action,team:action.team||actionDetails(action).team||(String(action.team_id)===String(match.home_team_id)?'home':String(action.team_id)===String(match.away_team_id)?'away':null)}));count=actions.length;
        lastActions=actions;sets=(state.completedSets||[]).map(set=>({set_number:set.set||set.number,home_score:set.home,away_score:set.away}));
        offline=false;
    }else{
        match=(await c.query(`SELECT m.*,c.title AS competition_name,c.title_th AS competition_name_th,c.title_en AS competition_name_en,
            h.name AS home_team_name,h.name_th AS home_team_name_th,h.name_en AS home_team_name_en,
            a.name AS away_team_name,a.name_th AS away_team_name_th,a.name_en AS away_team_name_en,
            ag.name AS age_group_name,s.name_th AS location_th,s.name_en AS location_en
            FROM matches m LEFT JOIN competitions c ON c.id=m.competition_id
            LEFT JOIN teams h ON h.id=m.home_team_id LEFT JOIN teams a ON a.id=m.away_team_id
            LEFT JOIN age_groups ag ON ag.id=COALESCE(m.age_group_id,c.age_group_id)
            LEFT JOIN stadiums s ON s.id=COALESCE(m.stadium_id,c.stadium_id)
                AND (NULLIF(TRIM(m.location),'') IS NULL OR TRIM(m.location) IN(s.name,s.name_th,s.name_en))
            WHERE m.id=?`,[row.id])).rows[0];
        if(match.manual_title){match.competition_name=match.manual_title;delete match.competition_name_th;delete match.competition_name_en;}
        match=applyMatchSetup(match);roster={};
        const setup=parse(row.match_setup);
        for(const side of ['home','away']){
            const entry=(await c.query(`SELECT te.id FROM team_entries te JOIN competitions co ON co.id=te.competition_id
                WHERE te.competition_id=? AND te.team_id=? AND te.status='approved'
                AND COALESCE(te.age_group_id,co.age_group_id,0)=COALESCE(?,co.age_group_id,0) ORDER BY te.id LIMIT 1`,[row.competition_id,row[`${side}_team_id`],row.age_group_id])).rows[0];
            const registered=entry?(await c.query(`SELECT p.*,ep.number,ep.role,ep.is_captain,ep.is_libero1,ep.is_libero2,ep.athlete_snapshot
                FROM team_entry_players ep JOIN players p ON p.id=ep.player_id WHERE ep.team_entry_id=? AND p.team_id=? ORDER BY ep.number,p.id`,[entry.id,row[`${side}_team_id`]])).rows.map(restoreSnapshot):[];
            const staff=Array.isArray(setup[side]?.staff)?setup[side].staff:entry?(await require('./teamCompositionStaff').teamCompositionStaff(c,entry.id)).staff:[];
            roster[side]={players:(Array.isArray(setup[side]?.players)?setup[side].players:registered).map(player=>pick(player,playerKeys)),staff:staff.map(person=>pick(person,['id','first_name','last_name','role']))};
        }
        sets=(await c.query('SELECT set_number,home_score,away_score,end_time FROM match_sets WHERE match_id=? ORDER BY set_number',[row.id])).rows;
        count=Number((await c.query("SELECT COUNT(*) AS count FROM match_actions WHERE match_id=? AND action_type='VIS_STAT'",[row.id])).rows[0].count);
        actions=(await c.query("SELECT id,set_number,team_id,player_id,skill,grade,score_home,score_away,created_at FROM match_actions WHERE match_id=? AND action_type='VIS_STAT' ORDER BY id DESC LIMIT 100 OFFSET ?",[row.id,(eventPage-1)*100])).rows;
        lastActions=(await c.query(`SELECT a.* FROM match_actions a JOIN (SELECT MAX(id) AS id FROM match_actions
            WHERE match_id=? AND action_type='VIS_STAT' GROUP BY set_number) last_action ON last_action.id=a.id ORDER BY a.id`,[row.id])).rows;
        state=projectOfficialState(row,lastActions);
        const lease=(await c.query('SELECT released,expires_at FROM scorer_offline_sessions WHERE match_id=?',[row.id])).rows[0];
        offline=Boolean((lease&&!lease.released&&Number(lease.expires_at)>Date.now())||parse(row.vis_state).offlineVis?.payload?.offlineLease?.expiresAt>Date.now());
    }
    const column=custom?'custom_match_id':'match_id';
    const reviews=(await c.query(`SELECT r.id,r.domain,r.revision,r.status,r.submitted_at,r.decided_at,r.reason,
        u.username AS submitted_username,d.username AS decided_username FROM match_reviews r
        LEFT JOIN users u ON u.id=r.submitted_by LEFT JOIN users d ON d.id=r.decided_by
        WHERE r.${column}=? AND r.domain='vims' ORDER BY r.revision DESC`,[row.id])).rows;
    const statistics=custom?aggregate(actions): (await c.query(`SELECT set_number,team_id,player_id,skill,grade,COUNT(*) AS count FROM match_actions
        WHERE match_id=? AND action_type='VIS_STAT' GROUP BY set_number,team_id,player_id,skill,grade ORDER BY set_number,team_id,player_id`,[row.id])).rows.map(stat=>({...stat,count:Number(stat.count),team:String(stat.team_id)===String(row.home_team_id)?'home':String(stat.team_id)===String(row.away_team_id)?'away':null}));
    const checks=reviewReadiness({match:{...match,owner_id:row.owner_id},custom,count,latest:reviews[0],user,offline,phase:state.phase});
    if(state.phase==='MATCH_FINISHED'&&['home','away'].some(side=>match[`${side}_set_score`]!=null&&Number(match[`${side}_set_score`])!==Number(state.setsWon?.[side])))checks.warnings.push('score_mismatch');
    const events=custom?actions.slice().reverse().slice((eventPage-1)*100,eventPage*100):actions;
    return {match:pick(match,matchKeys),roster,sets,statistics,reviews,readiness:checks,
        lineups:pick(state,['setLineups','lineups','currentSet','phase','completedSets','setsWon']),
        events:events.map(event=>pick({...event,team:event.team||(String(event.team_id)===String(row.home_team_id)?'home':String(event.team_id)===String(row.away_team_id)?'away':null)},['id','set_number','team','team_id','player_id','skill','grade','score_home','score_away','created_at'])),eventPage,eventCount:count,eventPages:Math.max(1,Math.ceil(count/100)),offlineVisible:false};
}
function actionDetails(action){try{return parse(action.details??action.description);}catch{return {};}}
function aggregate(actions){const map=new Map();for(const event of actions){const key=JSON.stringify([event.set_number,event.team,event.player_id,event.skill,event.grade]);const row=map.get(key)||{...pick(event,['set_number','team','player_id','skill','grade']),count:0};row.count++;map.set(key,row);}return [...map.values()];}
module.exports={loadVimsReviewDetail,reviewReadiness};
