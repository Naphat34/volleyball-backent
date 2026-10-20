const { fail } = require('./visWorkflow');
const copy = value => JSON.parse(JSON.stringify(value));
const equalScore = (a,b) => Number(a?.home) === Number(b?.home) && Number(a?.away) === Number(b?.away);
function initialCheckpoint(match, sets = []) {
    const state = typeof match.live_state === 'string' ? JSON.parse(match.live_state || '{}') : match.live_state || {};
    const set = Number(state.matchData?.currentSet || match.current_set || 1);
    return { set, scores: { [set]: state.score || { home: Number(match.team_a_score || 0), away: Number(match.team_b_score || 0) } },
        completed: Object.fromEntries(sets.filter(s => s.home_score != null && s.away_score != null).map(s => [s.set_number, {home:s.home_score,away:s.away_score}])),
        homeId: match.home_team_id, awayId: match.away_team_id, maxSets: Number(match.max_sets || 5), history: [] };
}
function checkOperation(previous, operation) {
    const state = copy(previous), body = operation.body || {};
    if (operation.path === 'undo') {
        const target = body.state, set = Number(target?.matchData?.currentSet || state.set);
        const index = state.history.findLastIndex(item => item.set === set && equalScore(item.scores[set], target?.score)
            && Object.keys(item.completed).length === (target.completedSets?.length || 0));
        if (index < 0) fail('ย้อนรายการได้เฉพาะสถานะที่บันทึกในช่วง Offline นี้', 409);
        return { ...state.history[index], history: state.history.slice(0,index) };
    }
    if (operation.path !== 'state') { const {history: _history, ...snapshot} = state; state.history.push(copy(snapshot)); }
    if (operation.path === 'event' && body.event_type === 'POINT') {
        const set = Number(body.set_number), team = String(body.team_id) === String(state.homeId) ? 'home' : String(body.team_id) === String(state.awayId) ? 'away' : null;
        if (!team || set !== state.set || !state.scores[set]) fail('ทีม/เซตได้แต้มไม่ถูกต้อง');
        state.scores[set][team]++;
        if (!equalScore(state.scores[set], {home:body.score_home,away:body.score_away})) fail('คะแนนต้องเพิ่มจากเหตุการณ์ POINT ครั้งละหนึ่งแต้ม');
    }
    if (operation.path === 'end-set') {
        const set = Number(body.setNumber), score = {home:Number(body.homeScore),away:Number(body.awayScore)}, target = set === state.maxSets ? 15 : 25;
        if (!equalScore(score,state.scores[set]) || Math.max(score.home,score.away) < target || Math.abs(score.home-score.away) < 2) fail('คะแนนจบเซตไม่ผ่านกติกา');
        state.completed[set] = score;
    }
    if (operation.path === 'state') {
        const set = Number(body.state?.matchData?.currentSet || state.set);
        if (!Number.isInteger(set) || set < 1 || set > state.maxSets || (set !== state.set && (set !== state.set + 1 || !state.completed[state.set]))) fail('ลำดับเซตไม่ถูกต้อง');
        state.scores[set] ||= {home:0,away:0};
        if (!equalScore(state.scores[set], body.state?.score)) fail('สแนปช็อตคะแนนไม่ตรงกับคำสั่งที่ตรวจสอบแล้ว');
        state.set = set;
    }
    return state;
}
module.exports = { initialCheckpoint, checkOperation };
