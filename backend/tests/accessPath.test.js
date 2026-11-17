const test=require('node:test');
const assert=require('node:assert/strict');
const {accessPath}=require('../utils/accessPath');
const {lockKey}=require('../middleware/recordingLock');
test('ACL path decoding matches one Express parameter decode and retains UUID identifiers',()=>{
    assert.equal(accessPath('/scorer/match/1%30/state/'),'/scorer/match/10/state');
    assert.equal(accessPath('/scorer/match/%31%30/offline-sync'),'/scorer/match/10/offline-sync');
    assert.equal(accessPath('/public/teams/11111111-1111-4111-8111-111111111111/players'),'/public/teams/11111111-1111-4111-8111-111111111111/players');
    assert.equal(accessPath('/scorer/match/1%2530/state'),'/scorer/match/1%30/state');
    assert.equal(lockKey('match','00010'),lockKey('match',10));
    for(const path of ['/scorer/match/1%2f0/state','/scorer/match/1%5c0/state','/scorer/match/1%00/state','/scorer/match/%zz/state'])assert.throws(()=>accessPath(path),{status:400});
});
