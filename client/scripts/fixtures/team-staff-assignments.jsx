import React from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from '../../src/context/LanguageContext';
import TeamStaffAssignments from '../../src/components/team/TeamStaffAssignments';
import client from '../../src/api';
import '../../src/index.css';
localStorage.setItem('language','ENG');
window.assignmentRequests=[];let assigned=[];
client.defaults.adapter=async config=>{
 window.assignmentRequests.push({url:config.url,method:config.method});
 if(!config.url.startsWith('/my-team/entries/83/staff'))throw Error('Unexpected assignment scope');
 let data;
 if(config.method==='put'){assigned=JSON.parse(config.data).staff_ids;window.savedTeamStaff=assigned;data={staff_count:assigned.length};}
 else data={entry:{id:83},staff:[{id:7,first_name:'Test',last_name:'Coach',role:'Head Coach',selected:assigned.includes(7)?1:0}]};
 return {config,status:200,statusText:'OK',headers:{},data};
};
createRoot(document.getElementById('root')).render(<LanguageProvider><TeamStaffAssignments competitions={[{team_entry_id:83,title:'Test competition',title_en:'Test competition',age_group_name:'U15',gender:'Male'}]} /></LanguageProvider>);
