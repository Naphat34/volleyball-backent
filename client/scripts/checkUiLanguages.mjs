import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// Real components and provider, without fetching or modifying any match.
const server = await createServer({ server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error' });
const previousStorage = globalThis.localStorage;
const noop = () => {};
const roster=Array.from({length:8},(_,i)=>({id:i+1,number:i+1,first_name:'ชื่อเดิม',last_name:'เดิม',first_name_th:'นักกีฬาไทย',last_name_th:'นามสกุลไทย',first_name_en:'Registered',last_name_en:'Athlete'}));
const away=roster.map(p=>({...p,id:p.id+20})), original=structuredClone(roster);
const tracker={count:0,positions:{},usedPlayers:[]};
const cases=[
 ['LineupModal',{homeLineup:roster.slice(0,6),awayLineup:away.slice(0,6),homeRoster:roster,awayRoster:away,homeTeamCode:'HOME',awayTeamCode:'AWAY'},['รายชื่อผู้เล่นตัวจริง','Starting lineup'],true],
 ['PlayerPickerModal',{lineup:[],liberos:{},context:{posIndex:0}},['เลือกผู้เล่น','Select player'],true],
 ['BatchSubstitutionModal',{currentLineup:roster.slice(0,6),subTracker:tracker,playerOut:null,posIndex:null},['เปลี่ยนตัวผู้เล่น','Substitutions'],true],
 ['SubstitutionModal',{currentLineup:roster.slice(0,6),playerOut:roster[0],posIndex:0,subTracker:tracker},['การเปลี่ยนตัว','Substitution'],true],
 ['CoinTossModal',{},['ทีมชนะการเสี่ยงเหรียญ','Coin Toss Winner']],
 ['ChallengeModal',{remaining:2},['เหตุผลการชาลเลนจ์','Challenge Reason']],
 ['ChallengeConfirmModal',{activeChallengeRequest:{team_id:1,team_name:'HOME',details:{}}},['ยืนยันการชาลเลนจ์','Video Challenge Confirmation']],
 ['StaffRequestModal',{request:{team_id:1,request_type:'TIMEOUT',team_name:'HOME'}},['คำขอเวลานอก','Timeout request']],
 ['SanctionModal',{},['ออกบทลงโทษ','Issue Sanction']],
 ['SignatureModal',{},['ลงนามก่อนแข่ง','OFFICIAL SIGNATURES']],
 ['ManualEditModal',{score:{home:12,away:10},currentSet:1},['ปรับคะแนนปัจจุบัน','Adjust Current Score']],
 ['PreMatchSetupModal',{match:{id:1,home_team_id:1,away_team_id:2},homeRoster:roster,awayRoster:away,referees:{}},['ผู้เล่นที่เลือกได้','Available Players'],true],
 ['../partials/TeamInfoPanel',{team:{code:'home',name:'HOME',roster,lineup:roster.slice(0,6)}},['ในสนาม','On court'],true],
];
try {
 const {LanguageProvider}=await server.ssrLoadModule('/src/context/LanguageContext.jsx');let count=0;
 for(const[language,index]of[['THA',0],['ENG',1],['TH',0]]){
  globalThis.localStorage={getItem:key=>key==='language'?language:null,setItem:noop};
  for(const[name,extra,labels,names]of cases){
   const{default:Component}=await server.ssrLoadModule(`/src/components/scorer/modals/${name}.jsx`);
   const props={isOpen:true,onClose:noop,onConfirm:noop,teamHome:'HOME',teamAway:'AWAY',teamName:'HOME',teamColors:{home:'#2563eb',away:'#10b981'},roster,matchData:{teamHomeId:1,teamAwayId:2,teamHome:'HOME',teamAway:'AWAY',currentSet:1},...extra};
   const html=renderToStaticMarkup(React.createElement(LanguageProvider,null,React.createElement(Component,props)));
   assert.ok(html.includes(labels[index]),`${name} ${language}: missing ${labels[index]}`);
   if(names){assert.ok(html.includes(index===0?'นักกีฬาไทย':'Registered'),`${name} ${language}: wrong player name`);assert.ok(!html.includes(index===0?'Registered Athlete':'นักกีฬาไทย'),`${name} ${language}: mixed names`);}
   if(name==='LineupModal'&&index===0)for(const phrase of['Starting lineup','Clear Lineup','Set roster','Approvals - Roster','Shirt color','Captainโรง','Coachโรง'])assert.ok(!html.includes(phrase),`Untranslated lineup text: ${phrase}`);
   count++;
  }
 }
 assert.deepEqual(roster,original,'Rendering must preserve player data and IDs');
 console.log(`Passed ${count} real component renders in Thai, English and legacy TH.`);
} finally {
 if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;
 await server.close();
}
