import React from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider,useLanguage} from '../../src/context/LanguageContext';
import {api} from '../../src/api';
import WorkflowScheduleEditor from '../../src/components/admin/WorkflowScheduleEditor';
import '../../src/index.css';
import '../../src/styles/AppTheme.css';
import '../../src/components/admin/CompetitionWorkflowTab.css';
localStorage.setItem('language','ENG');
let requests=0;
api.getStadiums=async()=>{requests++;if(location.search.includes('fail')&&requests===1)throw Error('Test failure');return {data:[{id:1,name:'สนามหลัก',name_th:'สนามหลัก',name_en:'Main Gym'},{id:2,name:'สนามสอง',name_th:'สนามสอง',name_en:'Second Gym'}]};};
const state={groups:[{name:'A'},{name:'B'}],format:{thirdPlace:false},status:'groups'};
const matches=['R4-1','R4-2','R2-1'].map((slot_key,index)=>({id:index+1,slot_key,phase:'knockout',status:index===2?'live':'scheduled',match_number:index+19,round_name:index===2?'Final':'Semi Final',match_date:'2026-11-28',start_time:'11:30',location:index===1?'Legacy Court':'สนามหลัก',stadium_id:index===1?null:1,home_source:{type:'pool',pool:'A',rank:1},away_source:{type:'pool',pool:'B',rank:2}}));
function Fixture(){const {language,setLanguage}=useLanguage();return <><button onClick={()=>setLanguage('ENG')}>Use English</button><button onClick={()=>setLanguage('THA')}>Use Thai</button><div className="cw"><WorkflowScheduleEditor state={state} matches={matches} existing={[]} busy={false} th={language==='THA'} teamName={id=>String(id)} command={(action,payload)=>{window.savedWorkflow=JSON.parse(JSON.stringify({action,...payload}));}}/></div></>;}
createRoot(document.getElementById('root')).render(<LanguageProvider><Fixture/></LanguageProvider>);
