const test=require('node:test');
const assert=require('node:assert/strict');
const r=require('../utils/competitionWorkflow');

test('24 teams form eight pools and a fixed 16-team bracket including third place',()=>{
    const format=r.validateFormat({teamCount:24,poolCount:8});
    const groups=Array.from({length:8},(_,i)=>({name:String.fromCharCode(65+i),teamIds:[i*3+1,i*3+2,i*3+3]}));
    r.validateGroups(format,groups,Array.from({length:24},(_,i)=>i+1));
    assert.equal(r.groupPairs(groups).length,24);
    const qualifiers=groups.flatMap(group=>group.teamIds.slice(0,2).map((teamId,i)=>({teamId,pool:group.name,rank:i+1})));
    const pairs=groups.map((group,i)=>({home:group.teamIds[0],away:groups[(i+1)%8].teamIds[1]}));
    const validated=r.validateDraw(qualifiers,pairs),slots=r.bracketPlan(validated);
    assert.equal(slots.length,16);
    assert.deepEqual(slots.find(slot=>slot.key==='R8-1').home,{type:'winner',slot:'R16-1'});
    assert.deepEqual(slots.find(slot=>slot.key==='BRONZE-1').away,{type:'loser',slot:'R4-2'});
    assert.throws(()=>r.validateDraw(qualifiers,pairs.map((pair,i)=>i===0?{...pair,away:groups[0].teamIds[1]}:pair)),/สายเดียวกัน/);
    assert.throws(()=>r.validateDraw(qualifiers,[pairs[0],pairs[0],...pairs.slice(2)]),/ซ้ำ/);
    assert.throws(()=>r.validateFormat({teamCount:24,poolCount:6}),/จำนวนทีมเข้ารอบ/);
});

test('eight-team configuration requires complete unique approved membership before publishing',()=>{
    const format=r.validateFormat({teamCount:8,poolCount:2});
    assert.equal(format.drawMode,'cross');
    const groups=[{name:'A',teamIds:[1,2,3,4]},{name:'B',teamIds:[5,6,7,8]}];
    assert.equal(r.groupPairs(groups).length,12);
    assert.throws(()=>r.validateGroups(format,[groups[0],{name:'B',teamIds:[4,5,6,7]}],[1,2,3,4,5,6,7,8]),/ไม่ซ้ำสาย/);
    assert.throws(()=>r.validateGroups(format,groups,[1,2,3,4,5,6,7]),/อนุมัติ/);
    const fixtures=r.groupPairs(groups).map(pair=>({home_team_id:pair.home,away_team_id:pair.away,pool_name:pair.pool,round_name:'Preliminary',status:'scheduled'}));
    r.validateExistingMatches(format,groups,fixtures);
    assert.throws(()=>r.validateExistingMatches(format,groups,fixtures.slice(1)),/จำนวนแมตช์/);
    assert.throws(()=>r.validateExistingMatches(format,groups,[fixtures[0],...fixtures.slice(0,-1)]),/ไม่ตรง/);
});

test('ranking follows points, wins and exact ratios; a full tie requires recorded draw order',()=>{
    const rows=[1,2,3].map(teamId=>({teamId,points:3,won:1,setsWon:3,setsLost:3,pointsWon:75,pointsLost:75}));
    assert.equal(r.compareRank(rows[0],rows[1]),0);
    assert.throws(()=>r.applyRankDraw(rows),/จับสลาก/);
    assert.deepEqual(r.applyRankDraw(rows,[3,1,2]).map(row=>[row.teamId,row.rank]),[[3,1],[1,2],[2,3]]);
    assert.throws(()=>r.applyRankDraw(rows,[3,3,1]),/จับสลาก/);
    assert.ok(r.compareRank({...rows[0],points:4},{...rows[1],won:5})<0);
    assert.ok(r.compareRank({...rows[0],setsWon:1,setsLost:0},{...rows[1],setsWon:10000,setsLost:1})<0);
    assert.notEqual(r.compareRank({...rows[0],pointsWon:1000001,pointsLost:1000000},{...rows[1],pointsWon:1000002,pointsLost:1000001}),0);
});
