const test = require('node:test');
const assert = require('node:assert/strict');
const {poolBracket, sourceLabel, attachScheduleSources} = require('../utils/workflowSchedule');

test('pool placeholders describe a complete fixed bracket before any results exist', () => {
    const plan = poolBracket([{name:'A'}, {name:'B'}]);
    assert.equal(plan.length, 4);
    assert.deepEqual(plan[0].home, {type:'pool',pool:'A',rank:1});
    assert.deepEqual(plan[0].away, {type:'pool',pool:'B',rank:2});
    assert.equal(sourceLabel(plan[0].home), 'อันดับ 1 สาย A');
    assert.equal(sourceLabel(plan[3].home, new Map([['R4-1','19']]), true), 'Winner of match 19');
    assert.equal(sourceLabel(plan[2].away, new Map([['R4-2','20']])), 'ผู้แพ้คู่ที่ 20');
});

test('schedule responses retain source labels and real names after qualification', async () => {
    const db = {query:async()=>({rows:[{match_id:19,competition_id:1,slot_key:'R4-1',match_number:'19',home_source:JSON.stringify({type:'pool',pool:'A',rank:1}),away_source:JSON.stringify({type:'pool',pool:'B',rank:2})}]})};
    const [waiting] = await attachScheduleSources(db,[{id:19,competition_id:1,home_team_id:null,away_team_id:null}]);
    assert.equal(waiting.home_team_name_th,'อันดับ 1 สาย A');
    assert.equal(waiting.away_team_name_en,'Rank 2 Pool B');
    assert.equal(waiting.awaiting_teams,true);
    const [resolved] = await attachScheduleSources(db,[{id:19,competition_id:1,home_team_id:1,away_team_id:2,home_team:'Real A',away_team:'Real B'}]);
    assert.equal(resolved.home_team,'Real A');
    assert.equal(resolved.home_source_label_th,'อันดับ 1 สาย A');
    assert.equal(resolved.awaiting_teams,false);
});

test('manual pool-rank pairings reject repeated ranks and same-pool opponents', () => {
    const groups=['A','B','C','D'].map(name=>({name}));
    const pairs=[{home:1,away:4},{home:3,away:6},{home:5,away:8},{home:7,away:2}];
    const plan=poolBracket(groups,pairs);
    assert.equal(plan.length,8);
    assert.deepEqual(plan[0].away,{type:'pool',pool:'B',rank:2});
    assert.equal(plan.at(-1).round,'R2');
    assert.throws(()=>poolBracket(groups,[{home:1,away:2},...pairs.slice(1)]),/สายเดียวกัน/);
    assert.throws(()=>poolBracket(groups,[pairs[0],pairs[0],...pairs.slice(2)]),/ซ้ำ/);
});
