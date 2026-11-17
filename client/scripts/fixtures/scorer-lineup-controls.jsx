import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from '../../src/context/LanguageContext';
import TeamQuickControls from '../../src/components/scorer/partials/TeamQuickControls';
import MobileTeamDrawer from '../../src/components/scorer/partials/MobileTeamDrawer';
import ControlActionsPanel from '../../src/components/scorer/partials/ControlActionsPanel';
import SanctionModal from '../../src/components/scorer/modals/SanctionModal';
import CourtView from '../../src/components/scorer/CourtView';
import '../../src/index.css';
import '../../src/components/scorer/ScorerResponsive.css';

const full=offset=>Array.from({length:6},(_,index)=>({id:offset+index,number:index+1}));
function Fixture(){
    const [home,setHome]=useState([]),[away,setAway]=useState([]),[phase,setPhase]=useState('SERVING'),[mode,setMode]=useState('desktop'),[events,setEvents]=useState(0),[swapped,setSwapped]=useState(false);
    const homeTeam={code:'home',name:'Home Team',lineup:home,roster:full(1),color:'#004499'},awayTeam={code:'away',name:'Away Team',lineup:away,roster:full(11),color:'#990044'};
    const leftTeam=swapped?awayTeam:homeTeam,rightTeam=swapped?homeTeam:awayTeam;
    const hit=()=>setEvents(previous=>previous+1);
    const common={workflowStep:phase,challenges:{home:2,away:2},timeouts:{home:0,away:0},substitutions:{home:0,away:0},onOpenLiberoSwap:hit,onOpenChallenge:hit,onActionSelect:hit,onOpenSubstitution:hit,onPointScored:hit};
    return <>
        <nav style={{position:'relative',zIndex:300,background:'white'}}>
            <button onClick={()=>setHome(full(1))}>Fill home</button><button onClick={()=>setAway(full(11))}>Fill away</button><button onClick={()=>setHome(full(1).slice(0,5))}>Five home</button><button onClick={()=>setHome(full(1).map(player=>({...player,id:1})))}>Duplicate home</button><button onClick={()=>{setHome([]);setAway([]);}}>New set</button><button onClick={()=>setSwapped(value=>!value)}>Swap ends</button>
            <select aria-label="Phase" value={phase} onChange={event=>setPhase(event.target.value)}>{['SERVING','RALLY','LINEUP','READY'].map(value=><option key={value}>{value}</option>)}</select>
            <select aria-label="Surface" value={mode} onChange={event=>setMode(event.target.value)}>{['desktop','home','away','official','sanction','court'].map(value=><option key={value}>{value}</option>)}</select><output data-testid="events">{events}</output>
        </nav>
        {mode==='desktop'&&[leftTeam,rightTeam].map(team=><section data-team={team.code} key={team.code}><TeamQuickControls {...common} team={team}/></section>)}
        {['home','away'].includes(mode)&&<MobileTeamDrawer {...common} mobilePanelTeam={mode} leftTeam={leftTeam} rightTeam={rightTeam} teamColors={{home:'#004499',away:'#990044'}} onClose={()=>{}} onPlayerClick={hit}/>}
        {mode==='official'&&<ControlActionsPanel {...common} leftTeam={leftTeam} rightTeam={rightTeam} handleInjury={hit} setShowSanctionModal={hit} handleStartMatch={hit} matchData={{}}/>}
        {mode==='sanction'&&<SanctionModal isOpen onClose={()=>{}} onConfirm={hit} teams={{home:{...homeTeam,actionsDisabled:home.length!==6},away:{...awayTeam,actionsDisabled:away.length!==6}}}/>}
        {mode==='court'&&<div className="scorer-shell bg-slate-900 p-4" data-testid="court"><CourtView jerseyTokens homePositions={full(1).map((player,index)=>({...player,number:[1,10,99,7,2,5][index],isCaptain:index===4,first_name:'Player',isLibero:index===5}))} awayPositions={full(11).map((player,index)=>({...player,number:[4,6,3,8,1,9][index],first_name:'Player'}))} leftTeam={{...homeTeam,bg:'#dc2626'}} rightTeam={{...awayTeam,bg:'#2563eb'}} servingSide="left" onPlayerClick={hit}/></div>}
    </>;
}
localStorage.setItem('language','ENG');
createRoot(document.getElementById('root')).render(<LanguageProvider><Fixture/></LanguageProvider>);
