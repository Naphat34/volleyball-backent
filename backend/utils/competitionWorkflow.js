const { denied } = require('./accessScope');
const check = (condition, message) => { if (!condition) throw denied(message,409); };
const same = (a,b) => String(a) === String(b);
const key = (a,b) => [Number(a),Number(b)].sort((x,y)=>x-y).join(':');

function validateFormat(input) {
    const teamCount=Number(input.teamCount), poolCount=Number(input.poolCount), qualifiersPerPool=Number(input.qualifiersPerPool||2);
    check(Number.isInteger(teamCount)&&teamCount>=4&&teamCount<=128,'จำนวนทีมต้องอยู่ระหว่าง 4–128 ทีม');
    check(Number.isInteger(poolCount)&&poolCount>=2&&poolCount<=32,'จำนวนสายต้องอยู่ระหว่าง 2–32 สาย');
    check(qualifiersPerPool===2,'รูปแบบนี้คัดอันดับ 1–2 ของแต่ละสาย');
    const size=poolCount*qualifiersPerPool;
    check((size&(size-1))===0&&size>=4,'จำนวนทีมเข้ารอบต้องเป็น 4, 8, 16, 32 หรือ 64 ทีม');
    check(teamCount>=size,'จำนวนทีมต้องไม่น้อยกว่าจำนวนทีมเข้ารอบ');
    return {teamCount,poolCount,qualifiersPerPool,thirdPlace:input.thirdPlace!==false,groupRoundName:String(input.groupRoundName||'Preliminary').trim().slice(0,100),
        drawMode:size===4?'cross':'manual',ranking:['points','won','setRatio','pointRatio','draw']};
}

function validateGroups(format, groups, approvedIds) {
    check(Array.isArray(groups)&&groups.length===format.poolCount,'จำนวนสายไม่ตรงกับรูปแบบ');
    const seen=new Set(),names=new Set(),approved=new Set(approvedIds.map(String));
    const clean=groups.map(group=>{
        const name=String(group.name||'').trim();
        check(name.length>0&&name.length<=50&&!names.has(name),'ชื่อสายต้องไม่ว่างและไม่ซ้ำ');names.add(name);
        check(Array.isArray(group.teamIds)&&group.teamIds.length>=2,'แต่ละสายต้องมีอย่างน้อย 2 ทีม');
        const teamIds=group.teamIds.map(id=>{
            check(Number.isSafeInteger(Number(id))&&approved.has(String(id))&&!seen.has(String(id)),'ทีมต้องได้รับอนุมัติ อยู่ในรายการนี้ และไม่ซ้ำสาย');
            seen.add(String(id));return Number(id);
        });
        return {name,teamIds};
    });
    check(seen.size===format.teamCount,'จำนวนทีมที่ลงสายไม่ครบตามรูปแบบ');
    return clean;
}

function groupPairs(groups) {
    return groups.flatMap(group=>group.teamIds.flatMap((id,index)=>group.teamIds.slice(index+1).map(other=>({pool:group.name,home:id,away:other}))));
}
function validateExistingMatches(format,groups,matches) {
    const expected=new Map(groupPairs(groups).map(pair=>[key(pair.home,pair.away),pair.pool]));
    check(matches.length===expected.size,'จำนวนแมตช์เดิมไม่ครบหรือเกินคู่พบกันหมดในสาย');
    for(const match of matches){
        const pair=key(match.home_team_id,match.away_team_id);
        check(expected.get(pair)===match.pool_name&&match.round_name===format.groupRoundName,'คู่แข่งขัน สาย หรือรอบของแมตช์เดิมไม่ตรงกับที่กำหนด');
        check(match.status!=='cancelled'&&!match.manual_owner_id,'ไม่สามารถนำแมตช์ยกเลิกหรือแมตช์สร้างเองมาใช้ได้');
        expected.delete(pair);
    }
    check(!expected.size,'ยังขาดคู่แข่งขันในสาย');
}

// Compare exact fractions. Display rounding and names never decide qualification.
function compareRatio(aWon,aLost,bWon,bLost) {
    const aInfinity=aLost===0&&aWon>0,bInfinity=bLost===0&&bWon>0;
    if(aInfinity||bInfinity)return Number(bInfinity)-Number(aInfinity);
    const left=BigInt(aWon)*BigInt(bLost||1),right=BigInt(bWon)*BigInt(aLost||1);
    return left===right?0:left>right?-1:1;
}
function compareRank(a,b) {
    return b.points-a.points||b.won-a.won||compareRatio(a.setsWon,a.setsLost,b.setsWon,b.setsLost)||compareRatio(a.pointsWon,a.pointsLost,b.pointsWon,b.pointsLost);
}
function calculatePoolRanking(group,matches,maxSets=null) {
    const stats=new Map(group.teamIds.map(id=>[String(id),{teamId:id,played:0,won:0,lost:0,points:0,setsWon:0,setsLost:0,pointsWon:0,pointsLost:0}]));
    for(const match of matches){
        const h=stats.get(String(match.home_team_id)),a=stats.get(String(match.away_team_id));
        check(h&&a,'พบทีมที่ไม่ได้อยู่ในสาย');
        let setup=match.match_setup||{};if(typeof setup==='string')setup=JSON.parse(setup);
        const hs=Number(match.home_set_score),as=Number(match.away_set_score),needed=Math.floor(Number(setup.maxSets||maxSets||match.max_sets||5)/2)+1;
        check(match.status==='completed'&&Math.max(hs,as)===needed&&Math.min(hs,as)>=0&&Math.min(hs,as)<needed,'ผลการแข่งขันยังไม่ครบ');
        h.played++;a.played++;h.setsWon+=hs;h.setsLost+=as;a.setsWon+=as;a.setsLost+=hs;
        const winner=hs>as?h:a,loser=hs>as?a:h;winner.won++;loser.lost++;
        const close=Math.min(hs,as)===needed-1;winner.points+=close?2:3;loser.points+=close?1:0;
        let sets=match.set_scores||[];if(typeof sets==='string'){try{sets=JSON.parse(sets);}catch{sets=[];}}
        check(Array.isArray(sets)&&sets.length===hs+as,'ต้องมีคะแนนรายเซตครบเพื่อใช้จัดอันดับ');
        for(const set of sets){
            const parts=typeof set==='string'?set.split('-'):[];
            const x=Number(set?.home??set?.team_a??set?.home_score??parts[0]),y=Number(set?.away??set?.team_b??set?.away_score??parts[1]);
            check(Number.isSafeInteger(x)&&Number.isSafeInteger(y)&&x>=0&&y>=0&&x!==y,'คะแนนรายเซตไม่ถูกต้อง');
            h.pointsWon+=x;h.pointsLost+=y;a.pointsWon+=y;a.pointsLost+=x;
        }
    }
    return [...stats.values()].sort(compareRank);
}
function applyRankDraw(ranking,order=[]) {
    const result=[];let start=0;
    while(start<ranking.length){
        let end=start+1;while(end<ranking.length&&compareRank(ranking[start],ranking[end])===0)end++;
        let tied=ranking.slice(start,end);
        if(tied.length>1){
            const chosen=order.filter(id=>tied.some(row=>same(row.teamId,id)));
            check(chosen.length===tied.length&&new Set(chosen.map(String)).size===tied.length,'อันดับยังเท่ากันทุกเกณฑ์ กรุณากรอกลำดับผลจับสลากของทีมที่เสมอให้ครบ');
            tied=chosen.map(id=>tied.find(row=>same(row.teamId,id)));
        }
        result.push(...tied);start=end;
    }
    return result.map((row,index)=>({...row,rank:index+1}));
}

function validateDraw(qualifiers,pairs) {
    check(Array.isArray(pairs)&&pairs.length===qualifiers.length/2,'จำนวนคู่ไม่ครบ');
    const seen=new Set();
    return pairs.map((pair,index)=>{
        const home=qualifiers.find(q=>same(q.teamId,pair.home)),away=qualifiers.find(q=>same(q.teamId,pair.away));
        check(home&&away&&home.rank===1&&away.rank===2,'แต่ละคู่ต้องเป็นอันดับ 1 พบอันดับ 2');
        check(home.pool!==away.pool,'ทีมจากสายเดียวกันห้ามพบกันในรอบแรก');
        for(const row of [home,away]){check(!seen.has(String(row.teamId)),'ทีมซ้ำในผัง');seen.add(String(row.teamId));}
        return {slot:index+1,home:Number(home.teamId),away:Number(away.teamId)};
    });
}
function bracketPlan(firstPairs, thirdPlace=true) {
    const slots=[];let size=firstPairs.length*2;
    firstPairs.forEach(pair=>slots.push({key:`R${size}-${pair.slot}`,round:`R${size}`,position:pair.slot,home:{type:'team',teamId:pair.home},away:{type:'team',teamId:pair.away}}));
    while(size>2){const next=size/2;for(let i=1;i<=next/2;i++)slots.push({key:`R${next}-${i}`,round:`R${next}`,position:i,home:{type:'winner',slot:`R${size}-${i*2-1}`},away:{type:'winner',slot:`R${size}-${i*2}`}});size=next;}
    if(thirdPlace)slots.push({key:'BRONZE-1',round:'BRONZE',position:1,home:{type:'loser',slot:'R4-1'},away:{type:'loser',slot:'R4-2'}});
    return slots;
}
module.exports={check,validateFormat,validateGroups,groupPairs,validateExistingMatches,compareRank,calculatePoolRanking,applyRankDraw,validateDraw,bracketPlan};
