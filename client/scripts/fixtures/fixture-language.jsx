import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '../../src/context/LanguageContext';
import { api } from '../../src/api';
import { setAuthSession } from '../../src/auth/authStorage';
import MatchManagementTab from '../../src/components/admin/MatchManagementTab';
import '../../src/index.css';
import '../../src/styles/AppTheme.css';
setAuthSession({token:'fixture-only',user:{id:1,role:'super_admin',username:'Test'}});
localStorage.setItem('language','ENG');
const competition={id:7,title:'รายการไทย',title_th:'รายการไทย',title_en:'English Cup',gender:'Male',age_group_id:1};
const teams=[{id:1,name:'ทีมเหย้า',name_th:'ทีมเหย้า',name_en:'Home Team',code:'H',age_group_name:'ประชาชน',entry_gender:'Male',status:'approved'},
    {id:2,name:'ทีมเยือน',name_th:'ทีมเยือน',name_en:'Away Team',code:'A',age_group_name:'ประชาชน',entry_gender:'Male',status:'approved'}];
const match={id:42,competition_id:7,match_number:19,gender:'Male',age_group_id:1,home_team_id:1,away_team_id:2,home_team:'ทีมเหย้า',away_team:'ทีมเยือน',home_team_name_en:'Home Team',home_team_name_th:'ทีมเหย้า',away_team_name_en:'Away Team',away_team_name_th:'ทีมเยือน',match_date:'2026-11-25',start_time:'08:30:00',location:'สนามไทย',location_th:'สนามไทย',location_en:'English Gym',round_name:'Preliminary',pool_name:'A',status:'scheduled',max_sets:3};
api.getAllCompetitions=async()=>({data:[competition]});
api.getAllAgeGroups=async()=>({data:[{id:1,name:'ประชาชน',name_th:'ประชาชน',name_en:'Open'}]});
api.getStadiums=async()=>({data:[{id:1,name:'สนามไทย',name_th:'สนามไทย',name_en:'English Gym'}]});
api.getMatchesByCompetition=async()=>({data:[match]});
api.getTeamsByCompetition=async()=>({data:teams});
api.updateMatch=async(id,payload)=>{window.fixtureSaved={id,payload};return {data:{success:true}};};
function Fixture(){const {setLanguage}=useLanguage();return <><button onClick={()=>setLanguage('ENG')}>Use English</button><button onClick={()=>setLanguage('THA')}>Use Thai</button><MatchManagementTab initialCompetitionId={7}/></>;}
createRoot(document.getElementById('root')).render(<LanguageProvider><BrowserRouter><Fixture/></BrowserRouter></LanguageProvider>);
