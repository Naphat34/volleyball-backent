const test=require('node:test');
const assert=require('node:assert/strict');
const {stableJson,numeric,tableHash,insertOrder}=require('../utils/dataMigration');
test('JSON reconciliation ignores key order and numeric scale without losing large integer precision',()=>{
    assert.equal(stableJson('{"b":1.00,"a":[true,null,1e3]}'),stableJson('{"a":[true,null,1000],"b":1}'));
    assert.notEqual(stableJson('{"id":9007199254740992}'),stableJson('{"id":9007199254740993}'));
    assert.equal(numeric('000.01000'),'1e-2');
});
test('table reconciliation preserves password hashes and IDs while normalizing timestamp text',()=>{
    const columns=[{COLUMN_NAME:'id',DATA_TYPE:'bigint'},{COLUMN_NAME:'password_hash',DATA_TYPE:'varchar'},{COLUMN_NAME:'created_at',DATA_TYPE:'timestamp'}];
    const source=[{id:'123',password_hash:'original-hash',created_at:'2026-11-13 12:30:00'}];
    assert.equal(tableHash(source,columns),tableHash([{id:123,password_hash:'original-hash',created_at:'2026-11-13 12:30:00+00'}],columns));
    assert.notEqual(tableHash(source,columns),tableHash([{...source[0],password_hash:'changed'}],columns));
});
test('insertion orders parents before children and explicitly breaks only the users/team cycle',()=>{
    const keys=[{TABLE_NAME:'users',COLUMN_NAME:'team_id',REFERENCED_TABLE_NAME:'teams'},{TABLE_NAME:'teams',COLUMN_NAME:'user_id',REFERENCED_TABLE_NAME:'users'},{TABLE_NAME:'players',COLUMN_NAME:'team_id',REFERENCED_TABLE_NAME:'teams'}];
    assert.deepEqual(insertOrder(['players','teams','users'],keys),['users','teams','players']);
    assert.throws(()=>insertOrder(['a','b'],[{TABLE_NAME:'a',COLUMN_NAME:'b',REFERENCED_TABLE_NAME:'b'},{TABLE_NAME:'b',COLUMN_NAME:'a',REFERENCED_TABLE_NAME:'a'}]),/cycle/);
});
