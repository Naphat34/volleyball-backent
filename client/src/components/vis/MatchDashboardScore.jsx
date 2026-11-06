import { dashboardSetResult, officialCompletedSetScores } from '../../utils/vis/dashboardResult';

export default function MatchDashboardScore({ match, source = 'vis' }) {
    if (source === 'vis') return <strong className="vd-set-result">{dashboardSetResult(match)}</strong>;
    const setsWon = match.official_summary?.setsWon;
    const home = Number(setsWon?.home ?? match.home_set_score ?? 0);
    const away = Number(setsWon?.away ?? match.away_set_score ?? 0);
    const completedSets = officialCompletedSetScores(match);
    return <div className="vd-score-details">
        {!match.is_custom_vis && <div className={source === 'official' ? 'vd-score-official is-primary' : 'vd-score-official'}>
            <span className="vd-official-result"><span className={home > away ? 'vd-winning-score' : ''}>{home}</span><span className="vd-score-separator">-</span><span className={away > home ? 'vd-winning-score' : ''}>{away}</span></span>
            {completedSets.length > 0 && <div className="vd-completed-set-scores">{completedSets.map((score, index) => {
                const [homePoints, awayPoints] = score.split(':').map(Number);
                return <span className="vd-set-score-chip" key={index}><span className={homePoints > awayPoints ? 'vd-winning-score' : ''}>{homePoints}</span><span className="vd-score-separator">:</span><span className={awayPoints > homePoints ? 'vd-winning-score' : ''}>{awayPoints}</span></span>;
            })}</div>}
        </div>}
    </div>;
}
