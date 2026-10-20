import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {prepareScorer,scorerRecord,installScorerOffline,syncScorer} from './scorerOffline.js';
const storage=()=>{const data={};return {getItem:key=>data[key]??null,setItem:(key,value)=>{data[key]=String(value);},removeItem:key=>{delete data[key];}};};
let id=700;
beforeEach(()=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window=new EventTarget();
 window.location={pathname:`/scorer/${++id}`};
 Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
 const user={id:7,role:'scorer'};sessionStorage.setItem('user',JSON.stringify(user));sessionStorage.setItem('token','test-token');
 sessionStorage.setItem('vis_offline_unlocked_v1',JSON.stringify({user,expiresAt:Date.now()+60000}));
});
const client=()=>({get:async()=>({data:{score:{home:0,away:0},home:{players:[]},away:{players:[]}}}),post:async()=>({data:{fingerprint:'base-fingerprint'}}),interceptors:{request:{use(fn){this.handler=fn;}}}});
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
 transport.post=async(_url,body)=>({data:{fingerprint:'synced',acknowledged:body.operations.map(op=>op.id),syncedAt:new Date().toISOString()}});
 await syncScorer(transport,id,true);const result=await scorerRecord(id);assert.equal(result.queue.length,0);assert.equal(result.released,true);
});
test('cached official data requires the original account and unlocked Offline permit',async()=>{
 const transport=client();await prepareScorer(transport,id);
 sessionStorage.setItem('user',JSON.stringify({id:99,role:'scorer'}));await assert.rejects(scorerRecord(id),/PIN/);
});
