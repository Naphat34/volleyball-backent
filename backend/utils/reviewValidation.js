const {denied}=require('./accessScope');
async function validateScore(c,match) {
    const competition=(await c.query('SELECT max_sets,scoring_config FROM competitions WHERE id=?',[match.competition_id])).rows[0];
    const parse=v=>typeof v==='string'?JSON.parse(v):v||{};
    const config=match.manual_owner_id?parse(match.manual_config):{...parse(competition?.scoring_config),...parse(match.match_setup)};
    const maxSets=Number(config.maxSets||competition?.max_sets||match.max_sets||5),needed=Math.ceil(maxSets/2);
    const sets=(await c.query('SELECT set_number,home_score,away_score FROM match_sets WHERE match_id=? AND end_time IS NOT NULL ORDER BY set_number',[match.id])).rows;
    let home=0,away=0;
    if(!sets.length)throw denied('No completed sets to review',409);
    for(const [index,set]of sets.entries()){
        const a=Number(set.home_score),b=Number(set.away_score),winBy=Number(config.win_by||2),target=Number(set.set_number)===maxSets?Number(config.decidingSetPoints||config.deciding_set_points||15):Number(config.pointsPerSet||config.regular_set_points||25);
        if(Number(set.set_number)!==index+1||index>=maxSets||home>=needed||away>=needed||!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||Math.min(a,b)<0||Math.max(a,b)<target||Math.abs(a-b)<winBy)throw denied('Completed set scores do not satisfy the match rules',409);
        if(a>b)home++;else away++;
    }
    if(Math.max(home,away)!==needed)throw denied('Match result is incomplete',409);
    if(Number(match.home_set_score)!==home||Number(match.away_set_score)!==away)throw denied('Match total and completed sets disagree',409);
    const winner=home>away?match.home_team_id:match.away_team_id;
    if(!winner||String(match.winner_team_id)!==String(winner))throw denied('Winner does not match the completed sets',409);
    return {home,away,sets};
}
module.exports={validateScore};
