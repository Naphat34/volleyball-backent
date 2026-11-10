const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNames } = require('../utils/bilingualNames');
const { createPayload, view } = require('../utils/customVis');

test('legacy Thai and English names populate only the matching language',()=>{
    assert.equal(normalizeNames({first_name:'สมชาย'}).first_name_th,'สมชาย');
    assert.equal(normalizeNames({first_name:'John'}).first_name_en,'John');
    assert.equal(normalizeNames({first_name:'สมชาย'}).first_name_en,undefined);
});
test('partial English edit retains the existing Thai display name',()=>{
    const actual=normalizeNames({first_name_en:'Somchai'},{first_name:'สมชาย',first_name_th:'สมชาย',first_name_en:null});
    assert.equal(actual.first_name,'สมชาย');assert.equal(actual.first_name_en,'Somchai');
    assert.equal(normalizeNames({name:'ทีมเก่า',name_en:'Team'},{},true).name_th,'ทีมเก่า');
    assert.equal(normalizeNames({name_en:'Team'},{},true).name,'Team');
});
test('blank optional language remains blank; oversize and non-string names fail',()=>{
    assert.equal(normalizeNames({first_name_en:''},{first_name:'สมชาย',first_name_th:'สมชาย'}).first_name_en,null);
    assert.throws(()=>normalizeNames({last_name_en:'A'.repeat(51)}),/50/);
    assert.throws(()=>normalizeNames({name_th:{}},{},true),/100/);
});
test('custom match bilingual names survive generated offline engine and JSON reload',async()=>{
    const offline=await import('../../client/src/offline/visEngine.js');
    const source={title:'Names',maxSets:3,home:{name:'ทีม',name_th:'ทีม',name_en:'Team',players:[{number:1,first_name:'สมชาย',last_name:'ใจดี',first_name_th:'สมชาย',last_name_th:'ใจดี',first_name_en:'Somchai',last_name_en:'Jaidee'}]},away:{name:'Away',players:[]}};
    const payload=createPayload(source,'custom-names');
    assert.deepEqual(offline.createPayload(source,'custom-names'),payload);
    const result=view(JSON.parse(JSON.stringify(payload)));
    assert.equal(result.match.home_team_name_en,'Team');
    assert.equal(result.roster.home.players[0].first_name_en,'Somchai');
});
