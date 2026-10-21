export default function MatchDashboardScore({ match, th = true, source = 'vis' }) {
    const vis = match.vis_summary, official = match.official_summary;
    const officialActive = ['live', 'completed'].includes(match.status);
    return <div className="vd-score-details">
        {source === 'vis' && <div className="vd-score-vis">{vis?.hasActivity ? <><span>VIS · {th ? 'เซต' : 'Set'} {vis.currentSet}</span><strong>{vis.score.home} – {vis.score.away}</strong><small>{th ? 'เซตที่ชนะ' : 'Sets won'} {vis.setsWon.home} : {vis.setsWon.away}</small></> : <span>VIS · {th ? 'ยังไม่มีแต้มบันทึก' : 'No recorded score'}</span>}</div>}
        {!match.is_custom_vis && <div className={source === 'official' ? 'vd-score-official is-primary' : 'vd-score-official'}>
            <span>{th ? 'ผลเซตทางการ' : 'Official sets'} · {officialActive ? `${official?.setsWon.home ?? match.home_set_score ?? 0} : ${official?.setsWon.away ?? match.away_set_score ?? 0}` : '—'}</span>
            {match.status === 'live' && official?.score && <small>{th ? 'แต้มเซต' : 'Set'} {official.currentSet} · {official.score.home} – {official.score.away}</small>}
        </div>}
    </div>;
}
