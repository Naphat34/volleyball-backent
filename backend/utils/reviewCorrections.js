const {denied}=require('./accessScope');
const {view,commandPayload}=require('./customVis');
const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
const copy=value=>JSON.parse(JSON.stringify(value));
function editsFor(events,edits,domain){
    if(!Array.isArray(edits)||!edits.length||edits.length>2000)throw denied('Supply 1–2000 event corrections',400);
    const indexed=new Map(events.map(e=>[String(e.id),e])),seen=new Set();
    for(const edit of edits){
        const event=indexed.get(String(edit.id));
        if(!event||seen.has(String(edit.id)))throw denied('Unknown or duplicate event',400);
        seen.add(String(edit.id));
        const allowed=domain==='score'?['id','team_id']:['id','team_id','player_id','skill','grade'];
        if(Object.keys(edit).some(key=>!allowed.includes(key)))throw denied('Unsupported event correction field',400);
        if(domain==='score'&&(event.skill!=='POINT'||!Object.hasOwn(edit,'team_id')))throw denied('Select a POINT event and its winning team',400);
    }
    return events.map(event=>({...event,...edits.find(edit=>String(edit.id)===String(event.id))}));
}
function replayScore(match,events,lineups,sets,competition,edits){
    const changed=editsFor(events,edits,'score');
    const config=match.manual_owner_id?parse(match.manual_config):{...parse(competition.scoring_config),...parse(match.match_setup)};
    const maxSets=Number(config.maxSets||competition.max_sets||match.max_sets||5),needed=Math.ceil(maxSets/2);
    const completed=[],won={home:0,away:0};let finalLineups,finalServer;
    for(const [index,set]of sets.entries()){
        if(Number(set.set_number)!==index+1||won.home>=needed||won.away>=needed)throw denied('Invalid set sequence',409);
        const number=Number(set.set_number),group=changed.filter(e=>Number(e.set_id)===number);
        const onCourt={};
        for(const side of ['home','away']){
            const lineup=lineups.filter(l=>Number(l.set_number)===number&&String(l.team_id)===String(match[`${side}_team_id`])).at(-1);
            const ids=lineup?Array.from({length:6},(_,i)=>Number(lineup[`player_id_p${i+1}`])):[];
            if(ids.length!==6||ids.some(id=>!id)||new Set(ids).size!==6)throw denied(`Missing initial lineup for set ${number}`,409);
            onCourt[side]=ids;
        }
        let server=null,finished=false;const score={home:0,away:0};
        const target=number===maxSets?Number(config.decidingSetPoints||config.deciding_set_points||15):Number(config.pointsPerSet||config.regular_set_points||25);
        for(const event of group){
            const details=copy(parse(event.details));
            const side=String(event.team_id)===String(match.home_team_id)?'home':String(event.team_id)===String(match.away_team_id)?'away':null;
            const before=copy(score),beforeLineups=copy(onCourt),previousServerPlayer=server?onCourt[server][0]:null;
            if(event.skill==='FIRST_SERVE'){if(!side)throw denied('Invalid serving team',409);server=side;}
            if(event.skill==='POINT'){
                if(!side||!server||finished)throw denied(`Invalid rally sequence in set ${number}`,409);
                score[side]++;
                details.previousServingTeam=server;details.isSideOut=server!==side;details.servingTeam=side;
                if(server!==side)onCourt[side]=[...onCourt[side].slice(1),onCourt[side][0]];
                server=side;details.newScore=copy(score);
                finished=Math.max(score.home,score.away)>=target&&Math.abs(score.home-score.away)>=Number(config.win_by||2);
            }
            if(['SUBSTITUTION','SUBSTITUTION_BATCH','LIBERO_REPLACEMENT','LIBERO_SWAP'].includes(event.skill)){
                if(!side)throw denied('Invalid replacement team',409);
                const pairs=event.skill==='SUBSTITUTION_BATCH'?details.pairs:[{out:details.details?.out,in:event.player_id}];
                if(!Array.isArray(pairs)||!pairs.length)throw denied('Missing replacement details',409);
                for(const pair of pairs){
                    const out=Number(pair.out),incoming=Number(pair.in),position=onCourt[side].indexOf(out);
                    if(position<0||!incoming||onCourt[side].includes(incoming))throw denied('Correction conflicts with a recorded replacement',409);
                    onCourt[side][position]=incoming;
                }
            }
            details.lineups=beforeLineups;details.scoreBefore=before;
            details.score_home=score.home;details.score_away=score.away;details.team_id=event.team_id;
            if(details.finalScore)details.finalScore=copy(score);
            event.score_home=score.home;event.score_away=score.away;
            event.server_player_id=event.skill==='POINT'?previousServerPlayer:server?onCourt[server][0]:null;
            details.server_player_id=event.server_player_id;
            event.details=JSON.stringify(details);
        }
        if(!finished)throw denied(`Corrected set ${number} is incomplete; correct the full rally sequence`,409);
        won[score.home>score.away?'home':'away']++;
        completed.push({...set,home_score:score.home,away_score:score.away});finalLineups=onCourt;finalServer=server;
    }
    if(Math.max(won.home,won.away)!==needed||changed.some(e=>!sets.some(s=>Number(s.set_number)===Number(e.set_id))))throw denied('Corrected match is incomplete or contains events outside its sets',409);
    const live=copy(parse(match.live_state)),last=completed.at(-1);
    live.workflowStep='MATCH_FINISHED';live.score={home:last.home_score,away:last.away_score};live.setsWon=won;
    live.completedSets=completed.map(s=>({set:s.set_number,home:s.home_score,away:s.away_score}));
    live.servingTeam=finalServer;
    for(const side of ['home','away'])live[`${side}Lineup`]=finalLineups[side].map(id=>{
        const saved=[...(live[`${side}Roster`]||[]),...(live[`${side}Lineup`]||[])].find(p=>Number(p.id)===id);
        return saved||{id};
    });
    // Replace cached event display/history with the canonical corrected journal.
    live.matchEvents=changed.map(e=>({id:parse(e.details).localEventId||e.id,local_event_id:parse(e.details).local_event_id,set:e.set_id,
        score:`${e.score_home}-${e.score_away}`,description:e.skill,metadata:{type:e.skill,teamCode:String(e.team_id)===String(match.home_team_id)?'home':'away'}})).reverse();
    live.history=[];
    live.updatedAt=Date.now();live.isTimerRunning=false;live.setTimerStartedAt=null;
    for(const event of changed)if(event.skill==='MATCH_FINISHED')event.details=JSON.stringify({...parse(event.details),setsWon:won});
    return {events:changed,sets:completed,live,won,winner:match[`${won.home>won.away?'home':'away'}_team_id`]};
}
function replayVims(payload,edits){
    const source=copy(payload),actions=editsFor(source.actions,edits,'vims');
    const setup=source.match.vis_state,controls=[...(setup.controls||[])].sort((a,b)=>Number(a.afterEventId||0)-Number(b.afterEventId||0));
    let next={...source,actions:[],operations:[],revision:0,nextId:1,lifecycle:'review',match:{...source.match,vis_state:{...setup,setups:{},controls:[]}}};
    delete next.match.vis_state.lineups;
    const mapping=new Map();let operation=0;
    const send=command=>{
        const state=view(next).state;
        next=commandPayload(next,{operationId:`correction-replay-${++operation}`,revision:next.revision,command:{...command,context:{key:state.context.key}}}).payload;
    };
    let cursor=0;
    const applyControls=after=>{
        while(cursor<controls.length&&Number(controls[cursor].afterEventId||0)<=after){
            const event=controls[cursor++],details=event.details||{};
            if(Number(event.set_id)!==view(next).state.currentSet)throw denied('Control no longer belongs to its recorded set',409);
            send({type:event.skill,team:event.team,playerIn:details.playerIn,playerOut:details.playerOut});
            const generated=next.match.vis_state.controls.at(-1);
            Object.assign(generated,{...event,...generated,id:event.id,details:{...details,...generated.details}});
        }
    };
    const groups=[];
    for(const action of actions){
        const key=parse(action.details).rallyId||`event-${action.id}`;
        if(groups.at(-1)?.key!==key)groups.push({key,events:[]});
        groups.at(-1).events.push(action);
    }
    let currentSet=0;
    for(const group of groups){
        const number=Number(group.events[0].set_number);
        if(currentSet!==number){
            if(number!==view(next).state.currentSet)throw denied('Correction changes set boundaries; adjust the affected rally events',409);
            const saved=setup.setups?.[number]||(number===1?setup:null);
            if(!saved)throw denied('Missing recorded VIMS lineup',409);
            send({type:'SET_LINEUP',lineups:saved.lineups,servingTeam:saved.servingTeam,firstSetHomeLeft:saved.firstSetHomeLeft});currentSet=number;
        }
        applyControls(Number(group.events[0].id)-1);
        const input=group.events.map(event=>({team:String(event.team_id)===String(source.match.home_team_id)?'home':String(event.team_id)===String(source.match.away_team_id)?'away':null,
            player:event.player_id==null?null:Number(event.player_id),skill:event.skill,grade:event.grade}));
        send({type:'RALLY',events:input});
        const generated=next.actions.slice(-input.length);
        generated.forEach((event,i)=>{
            const old=group.events[i];mapping.set(event.id,old.id);
            event.created_at=old.created_at;
            event.details={...parse(old.details),...event.details,rawGrade:input[i].grade,operationId:parse(old.details).operationId,rallyId:parse(old.details).rallyId,visTiming:parse(old.details).visTiming};
        });
    }
    applyControls(Infinity);
    if(view(next).state.phase!=='MATCH_FINISHED')throw denied('Corrected VIMS match is incomplete',409);
    next.actions=next.actions.map(event=>({...event,id:mapping.get(event.id)}));
    next.match.vis_state.controls=next.match.vis_state.controls.map(event=>({...event,afterEventId:mapping.get(event.afterEventId)||0}));
    next.nextId=Math.max(source.nextId||1,...next.actions.map(e=>Number(e.id)+1));
    next.revision=Number(source.revision||0)+1;next.operations=source.operations;next.lifecycle='review';
    return next;
}
module.exports={replayScore,replayVims};
