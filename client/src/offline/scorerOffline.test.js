import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {prepareScorer,scorerRecord,changeScorerRecord,installScorerOffline,syncScorer,importScorerBackup} from './scorerOffline.js';
const storage=()=>{const data={};return {getItem:key=>data[key]??null,setItem:(key,value)=>{data[key]=String(value);},removeItem:key=>{delete data[key];}};};
let id=700;
beforeEach(()=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window=new EventTarget();
 window.location={pathname:`/scorer/${++id}`};
 Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
 const user={id:7,role:'scorer'};sessionStorage.setItem('user',JSON.stringify(user));sessionStorage.setItem('token',`e30.${btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600}))}.test`);
 sessionStorage.setItem('vis_offline_unlocked_v1',JSON.stringify({user,expiresAt:Date.now()+60000}));
});
const snapshot=()=>({ [`/scorer/match/${id}`]: { id, home_team_id: 1, away_team_id: 2 },
 [`/scorer/match/${id}/state`]: {score:{home:0,away:0}}, [`/scorer/match/${id}/roster`]: {home:{players:[]},away:{players:[]}},
 [`/scorer/match/${id}/lineup`]: [], [`/scorer/match/${id}/events`]: [] });
const client=()=>({get:async path=>({data:path.endsWith('/offline-status')?{canCheckout:true}:[]}),post:async()=>({data:{fingerprint:'base-fingerprint',cache:snapshot(),leaseCreated:true}}),interceptors:{request:{use(fn){this.handler=fn;}}}});

test('download requires a live online session belonging to the unlocked PIN account',async()=>{
 const transport=client();let calls=0;transport.get=async()=>{calls++;return {data:{canCheckout:true}};};
 sessionStorage.removeItem('token');
 await assert.rejects(prepareScorer(transport,id),/ออนไลน์/);assert.equal(calls,0);
 sessionStorage.setItem('token',`e30.${btoa(JSON.stringify({exp:1}))}.test`);
 await assert.rejects(prepareScorer(transport,id),/ออนไลน์/);assert.equal(calls,0);
 sessionStorage.setItem('token',`e30.${btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+60}))}.test`);
 sessionStorage.setItem('user',JSON.stringify({id:8,role:'scorer'}));
 await assert.rejects(prepareScorer(transport,id),/PIN|บัญชี/);assert.equal(calls,0);
});

test('reservation preflight rejects another lease before creating a local record or calling checkout',async()=>{
 const transport=client();let posts=0;
 transport.get=async()=>({data:{canCheckout:false,reason:'แมตช์ถูกจองสำหรับ VIS Offline'}});
 transport.post=async()=>{posts++;};
 await assert.rejects(prepareScorer(transport,id),/VIS Offline/);assert.equal(posts,0);
 await assert.rejects(scorerRecord(id),/ไม่พบ/);
});

test('session is rechecked after reference downloads before reserving the match',async()=>{
 const transport=client();let posts=0;
 transport.get=async path=>{if(path.endsWith('/offline-status'))return {data:{canCheckout:true}};sessionStorage.removeItem('token');return {data:[]};};
 transport.post=async()=>{posts++;};
 await assert.rejects(prepareScorer(transport,id),/ออนไลน์/);assert.equal(posts,0);
 await assert.rejects(scorerRecord(id),/ไม่พบ/);
});

test('checkout conflicts after a successful preflight do not persist an incomplete match',async()=>{
 const transport=client();transport.post=async()=>{throw Error('มีเครื่องอื่นจองก่อนดาวน์โหลด');};
 await assert.rejects(prepareScorer(transport,id),/เครื่องอื่นจอง/);
 await assert.rejects(scorerRecord(id),/ไม่พบ/);
});
test('prepared official match serves cached reads and journals mutations in IndexedDB',async()=>{
 const transport=client();await prepareScorer(transport,id);installScorerOffline(transport);
 const send=async(path,method='get',data)=>{const config=await transport.interceptors.request.handler({url:`/scorer/match/${id}/${path}`,method,data});return config.adapter();};
 assert.deepEqual((await send('state')).data.score,{home:0,away:0});
 await send('event','post',{event_type:'POINT',score_home:1,score_away:0});
 await send('state','put',{state:{score:{home:1,away:0}}});
 await send('state','put',{state:{score:{home:1,away:0},updatedAt:Date.now()}});
 const record=await scorerRecord(id);assert.equal(record.queue.length,2);assert.deepEqual((await send('state')).data.score,{home:1,away:0});
 assert.equal(record.queue[0].path,'event');assert.equal(record.queue[1].path,'state');
 await assert.rejects(send('teams/1/players','post',{}),/ออนไลน์/);
});
test('network failure retains unchanged operation IDs; acknowledgement removes only committed commands',async()=>{
 const transport=client();await prepareScorer(transport,id);installScorerOffline(transport);
 const config=await transport.interceptors.request.handler({url:`/scorer/match/${id}/state`,method:'put',data:{state:{score:{home:0,away:0}}}});await config.adapter();
 const first=await scorerRecord(id);transport.post=async()=>{throw Error('Network lost');};
 await assert.rejects(syncScorer(transport,id),/Network lost/);
 assert.deepEqual((await scorerRecord(id)).queue,first.queue);
 transport.post=async(_url,body)=>({data:{fingerprint:'synced',acknowledged:body.operations.map(op=>op.id),released:body.release,syncedAt:new Date().toISOString()}});
 await syncScorer(transport,id,true);const result=await scorerRecord(id);assert.equal(result.queue.length,0);assert.equal(result.released,true);
});
test('cached official data requires the original account and unlocked Offline permit',async()=>{
 const transport=client();await prepareScorer(transport,id);
 sessionStorage.setItem('user',JSON.stringify({id:99,role:'scorer'}));await assert.rejects(scorerRecord(id),/PIN/);
});

test('checkout uses one server snapshot and a preparation lock blocks another tab',async()=>{
 const transport=client();localStorage.setItem(`match_${id}_score`,JSON.stringify({home:999,away:999}));await prepareScorer(transport,id);installScorerOffline(transport);
 assert.deepEqual(JSON.parse(localStorage.getItem(`match_${id}_score`)),{home:0,away:0});
 const original=transport.post;let enter,finish;
 const entered=new Promise(resolve=>enter=resolve),wait=new Promise(resolve=>finish=resolve);
 transport.post=async(...args)=>{enter();await wait;return original(...args);};
 const preparing=prepareScorer(transport,id);await entered;
 await assert.rejects(prepareScorer(transport,id),/อีกหน้าต่าง/);
 const config=await transport.interceptors.request.handler({url:`/scorer/match/${id}/event`,method:'post',data:{}});
 await assert.rejects(config.adapter(),/ดาวน์โหลด/);
 finish();await preparing;
 assert.equal((await scorerRecord(id)).cache[`/scorer/match/${id}`].home_team_id,1);
});

test('download refuses to overwrite a queue changed during the request and returns its new lease',async()=>{
 const transport=client();await prepareScorer(transport,id);
 const original=transport.post;let cancelled=false;
 transport.post=async(url,...args)=>{
  if(url.endsWith('offline-cancel-checkout')){cancelled=true;return {data:{released:true}};}
  await changeScorerRecord(id,r=>({...r,queue:[{id:'keep-this-operation'}]}));
  return original(url,...args);
 };
 await assert.rejects(prepareScorer(transport,id),/ไม่เขียนทับ/);
 assert.equal((await scorerRecord(id)).queue[0].id,'keep-this-operation');assert.equal(cancelled,true);
});

test('Scorer batches more than 5000 commands, persists progress and releases only the last batch',async()=>{
 const transport=client();await prepareScorer(transport,id);
 await changeScorerRecord(id,r=>({...r,queue:Array.from({length:5101},(_,i)=>({id:`operation-${i}`,method:'PUT',path:'state',body:{state:{score:{home:0,away:0}}}}))}));
 let calls=0,seen=0;
 transport.post=async(_url,body)=>{
  calls++;assert.ok(body.operations.length<=100);seen+=body.operations.length;
  assert.equal(body.release,seen===5101);
  assert.equal((await scorerRecord(id)).queue.length,5101-(seen-body.operations.length));
  return {data:{fingerprint:`batch-${calls}`,acknowledged:body.operations.map(op=>op.id),released:body.release}};
 };
 await syncScorer(transport,id,true);assert.equal(calls,52);assert.equal((await scorerRecord(id)).queue.length,0);
});

test('failed batch keeps sent IDs immutable but subsequent timer snapshots coalesce',async()=>{
 const transport=client();await prepareScorer(transport,id);installScorerOffline(transport);
 const state=async n=>{const cfg=await transport.interceptors.request.handler({url:`/scorer/match/${id}/state`,method:'put',data:{state:{score:{home:0,away:0},updatedAt:n}}});await cfg.adapter();};
 await state(1);const first=(await scorerRecord(id)).queue[0];
 transport.post=async()=>{throw Error('Lost response');};await assert.rejects(syncScorer(transport,id),/Lost response/);
 await state(2);await state(3);await state(4);
 const record=await scorerRecord(id);assert.equal(record.queue.length,2);assert.deepEqual(record.queue[0],first);assert.equal(record.queue[1].body.state.updatedAt,4);
});

test('cached lineup and event reads follow local mutations and Undo',async()=>{
 const transport=client();await prepareScorer(transport,id);installScorerOffline(transport);
 const send=async(path,method='get',data)=>{const cfg=await transport.interceptors.request.handler({url:`/scorer/match/${id}/${path}`,method,data});return (await cfg.adapter()).data;};
 await send('lineup','post',{team_id:1,set_number:1,player_positions:[1,2,3,4,5,6],libero_id:null});
 assert.deepEqual((await send('lineup'))[0].lineup.map(p=>p.id),[1,2,3,4,5,6]);
 await send('event','post',{local_event_id:'point-a',event_type:'POINT',set_number:1,score_home:1,score_away:0});
 await send('event','post',{local_event_id:'point-b',event_type:'POINT',set_number:1,score_home:2,score_away:0});
 assert.equal((await send('events')).length,2);
 await send('undo','post',{state:{score:{home:1,away:0}},keepLocalIds:['point-a']});
 assert.equal((await send('events')).length,1);assert.equal((await send('state')).score.home,1);
});

test('Scorer import preserves receipts and never overwrites an existing match',async()=>{
 const transport=client();await prepareScorer(transport,id);
 const record=await scorerRecord(id),dest=String(id+10000);
 record.id=dest;record.cache=Object.fromEntries(Object.entries(record.cache).map(([key,val])=>[key.replace(String(id),dest),val]));
 record.queue=[{id:crypto.randomUUID(),path:'state',method:'PUT',body:{state:{score:{home:0,away:0}}}}];
 record.sentIds=[record.queue[0].id];record.syncingUntil=Date.now()+60000;
 const value={format:'volley-scorer-offline',version:1,record};
 const saved=await importScorerBackup(value);assert.deepEqual(saved.sentIds,record.sentIds);assert.equal(saved.syncingUntil,undefined);assert.equal(saved.recoveryReadOnly,false);
 await assert.rejects(importScorerBackup(value),/เขียนทับ/);
 value.record.owner='999';await assert.rejects(importScorerBackup(value),/บัญชีอื่น/);
});

test('backup from another device stays read-only and cannot replace the primary identity',async()=>{
 const transport=client();await prepareScorer(transport,id);const record=await scorerRecord(id);
 const dest=String(id+20000);record.id=dest;record.deviceId=crypto.randomUUID();
 record.cache=Object.fromEntries(Object.entries(record.cache).map(([key,val])=>[key.replace(String(id),dest),val]));
 await importScorerBackup({format:'volley-scorer-offline',version:1,record});
 assert.equal((await scorerRecord(dest,{readOnly:true})).recoveryReadOnly,true);
 await assert.rejects(scorerRecord(dest),/เครื่องอื่น/);await assert.rejects(syncScorer(transport,dest),/เครื่องหลัก/);
});

test('a lost Scorer batch response preserves its frozen prefix and retries the same commands',async()=>{
 const transport=client();await prepareScorer(transport,id);
 const queue=Array.from({length:205},(_,i)=>({id:crypto.randomUUID(),path:'state',method:'PUT',body:{state:{score:{home:0,away:0},tick:i}}}));
 await changeScorerRecord(id,r=>({...r,queue}));
 const committed=new Set();let calls=0,lose=true;
 transport.post=async(_url,body)=>{
  calls++;for(const op of body.operations)committed.add(op.id);
  if(calls===2&&lose){lose=false;throw Error('Lost batch response');}
  return {data:{fingerprint:`fingerprint-${committed.size}`,acknowledged:body.operations.map(op=>op.id),released:body.release}};
 };
 await assert.rejects(syncScorer(transport,id,true),/Lost batch/);
 assert.deepEqual((await scorerRecord(id)).queue,queue.slice(100));
 await syncScorer(transport,id,true);
 assert.equal(committed.size,205);assert.equal((await scorerRecord(id)).released,true);assert.equal((await scorerRecord(id)).queue.length,0);
});

test('incomplete acknowledgements never discard the Scorer journal',async()=>{
 const transport=client();await prepareScorer(transport,id);
 const queue=[{id:crypto.randomUUID(),path:'state',method:'PUT',body:{state:{score:{home:0,away:0}}}}];
 await changeScorerRecord(id,r=>({...r,queue}));
 transport.post=async()=>({data:{fingerprint:'unchanged',acknowledged:[]}});
 await assert.rejects(syncScorer(transport,id),/ไม่ครบ/);assert.deepEqual((await scorerRecord(id)).queue,queue);
});
