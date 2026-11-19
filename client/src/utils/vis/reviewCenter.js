export function latestVimsReview(match,reviews) {
    return reviews.filter(review=>review.domain==='vims'&&String(match.kind==='custom'?review.custom_match_id:review.match_id)===String(match.id))
        .sort((a,b)=>Number(b.revision)-Number(a.revision))[0]||null;
}
export function vimsReviewStage(match,reviews) {
    if(match.status==='cancelled')return 'cancelled';
    const status=match.vims_review_status||latestVimsReview(match,reviews)?.status;
    if(status==='submitted'||status==='confirmed')return status;
    if(status==='returned'||status==='reopened')return 'returned';
    if(match.status==='completed'&&Number(match.vims_count)>0)return 'ready';
    return Number(match.vims_count)>0||match.status==='live'?'recording':'idle';
}
export function vimsMayRecord(match,user,reviews) {
    const owner=match.kind==='custom'?match.owner_id:match.manual_owner_id;
    const assigned=match.kind!=='custom'&&Number(match.manual_vis_shared)===1&&String(match.manual_vis_assignee_id)===String(user.id);
    return match.status!=='cancelled'&&match.home_team_id!==null&&match.away_team_id!==null&&(!owner||String(owner)===String(user.id)||assigned)&&!['submitted','confirmed','returned'].includes(vimsReviewStage(match,reviews));
}
export function vimsPlayerTotals(statistics,set='') {
    const totals=new Map();
    for(const stat of statistics) {
        if(set&&String(stat.set_number)!==set)continue;
        const key=`${stat.team}:${stat.player_id??'team'}`,row=totals.get(key)||{team:stat.team,player_id:stat.player_id,attack:0,block:0,ace:0,attempts:0};
        const count=Number(stat.count)||0;row.attempts+=count;
        if(stat.grade==='#'){if(stat.skill==='A')row.attack+=count;if(stat.skill==='B')row.block+=count;if(stat.skill==='S')row.ace+=count;}
        totals.set(key,row);
    }
    return [...totals.values()];
}
