import { GuardedButton } from '../../components/ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { buildPoolStandings } from '../../utils/scorer/standingsPools';
import { isMatchFinished } from '../../utils/scorer/standings';
import { Feedback } from '../../components/ui/SystemUI';
import PublicHeader from '../../components/layout/PublicHeader';
import React, { useEffect, useMemo, useState } from 'react';
import client from '../../api';
import { Trophy, Filter, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { groupPublicCompetitionCategories } from '../../utils/scorer/publicCompetitionGrouping';

export default function PublicStandings() {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();

    const { language, t } = useLanguage();
    const [competitionResults, setCompetitionResults] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState(null);

    useEffect(() => {
        let active = true;
        const loadStandings = async () => {
            try {
                const { data } = await client.get('/public/competitions');
                const open = data.filter(competition => competition.status?.toLowerCase() === 'open');
                const results = await Promise.all(open.map(async competition => {
                    const id = competition.public_id || competition.id;
                    const [matches, teams] = await Promise.all([
                        client.get(`/public/matches?competitionId=${id}`),
                        client.get(`/public/competitions/${id}/teams`),
                    ]);
                    return { competition, matches: matches.data, teams: teams.data };
                }));
                if (active) setCompetitionResults(results);
            } catch (error) {
                console.error('Error loading standings:', error);
                if (active) setLoadError(true);
            } finally {
                if (active) setLoading(false);
            }
        };
        void loadStandings();
        return () => { active = false; };
    }, [reloadKey]);

    const categories = useMemo(() => groupPublicCompetitionCategories(
        competitionResults.map(result => result.competition), language
    ), [competitionResults, language]);
    const boardsByCategory = useMemo(() => {
        const results = new Map(competitionResults.map(result => [String(result.competition.id), result]));
        return categories.filter(category => selectedCategory === 'all' || category.key === selectedCategory)
            .map(category => ({
                ...category,
                boards: category.items.flatMap(competition => {
                    const result = results.get(String(competition.id));
                    return buildPoolStandings(competition, result.teams, result.matches);
                }),
            }))
            .filter(category => category.boards.length);
    }, [categories, competitionResults, selectedCategory]);

    const history = selectedTeam?.matches.filter(match =>
        isMatchFinished(match.status) && [match.home_team_id, match.away_team_id].some(id => String(id) === String(selectedTeam.id))
    ).sort((a, b) => b.id - a.id) || [];

    return (
        <div className="app-page min-h-screen text-gray-800 font-sans pb-20">
            {/* Navbar */}
            <PublicHeader />
            {loadError && <div className="mx-auto max-w-[1400px] px-4 py-4"><Feedback error title={language === 'THA' ? ui('โหลดข้อมูลไม่สำเร็จ') : ui('Unable to load data')} onRetry={() => { setLoadError(false); setLoading(true); setSelectedCategory('all'); setReloadKey(key => key + 1); }} retryLabel={language === 'THA' ? 'ลองใหม่' : 'Retry'} /></div>}
            <div id="main-content" tabIndex={-1} />

            {/* Header */}
            <div className="bg-[#122b52] text-white py-12 px-4 shadow-lg mb-8">
                <div className="w-full max-w-[1400px] mx-auto text-center">
                    <h1 className="text-4xl font-extrabold flex items-center justify-center gap-3 mb-2">
                        <Trophy className="text-yellow-400" size={40} /> {language === 'THA' ? ui('อันดับทีมแข่งขัน') : ui('Team Standings')}
                    </h1>
                    <p className="text-indigo-200">{language === 'THA' ? ui('ตารางคะแนนและอันดับทีมล่าสุด') : ui('Latest standings and tournament statistics')}</p>
                </div>
            </div>

            {/* Category filter */}
            <div className="w-full max-w-[1400px] mx-auto px-4 mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <label className="font-bold text-gray-700 flex items-center gap-2"><Filter size={18} className="text-blue-600"/> {language === 'THA' ? ui('\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17:') : ui('Category:')}</label>
                    <div className="flex w-full flex-wrap gap-2 md:justify-end">
                        <GuardedButton type="button" onClick={() => setSelectedCategory('all')} className={`rounded-full border px-3 py-2 text-sm font-bold ${selectedCategory === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}>{language === 'THA' ? ui('\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14') : ui('All')}</GuardedButton>
                        {categories.map((category) => <GuardedButton key={category.key} type="button" onClick={() => setSelectedCategory(category.key)} className={`rounded-full border px-3 py-2 text-sm font-bold ${selectedCategory === category.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}>{ui(category.label)}</GuardedButton>)}
                    </div>
                </div>
            </div>

            {/* Match History Modal */}
            {selectedTeam && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setSelectedTeam(null)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>

                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                {selectedTeam.logo_url ? (
                                    <img src={selectedTeam.logo_url} alt="" className="w-10 h-10 object-contain bg-white rounded-full p-1 shadow-sm"/>
                                ) : (
                                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                        {displayNames.teamName(selectedTeam).charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{displayNames.teamName(selectedTeam)}</h3>
                                    <p className="text-xs text-gray-500">{ui("Match History")}</p>
                                </div>
                            </div>
                            <GuardedButton onClick={() => setSelectedTeam(null)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500">
                                <X size={20} />
                            </GuardedButton>
                        </div>

                        {/* Modal Body */}
                        <div className="p-0 overflow-y-auto">
                            {history.length === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    <p>{language === 'THA' ? ui('ยังไม่มีประวัติการแข่งขัน') : ui('No match history yet')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {history.map(match => {
                                            const isHome = String(match.home_team_id) === String(selectedTeam.id);
                                            const opponentId = isHome ? match.away_team_id : match.home_team_id;
                                            const opponent = selectedTeam.teams.find(team => String(team.id) === String(opponentId));
                                            const opponentName = opponent ? displayNames.teamName(opponent) : (isHome ? match.team_b_name : match.team_a_name);
                                            const myScore = isHome ? match.home_set_score : match.away_set_score;
                                            const opScore = isHome ? match.away_set_score : match.home_set_score;
                                            const isWin = parseInt(myScore) > parseInt(opScore);

                                            return (
                                                <div key={match.id} className="p-4 hover:bg-gray-50 transition flex items-center justify-between">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className={`w-1.5 h-12 rounded-full ${isWin ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                        <div>
                                                            <p className="text-xs text-gray-400 mb-1">{ui("VS")}</p>
                                                            <p className="font-bold text-gray-800 text-lg">{opponentName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`text-2xl font-semibold ${isWin ? 'text-green-600' : 'text-red-500'}`}>
                                                            {myScore} - {opScore}
                                                        </div>
                                                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${isWin ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {isWin ? ui('W') : ui('L')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="w-full max-w-[1400px] mx-auto px-4">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900 mx-auto"></div>
                        <p className="mt-4 text-gray-500">{t('common.loading')}</p>
                    </div>
                ) : boardsByCategory.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
                        <p className="text-gray-400">{language === 'THA' ? ui('ยังไม่มีข้อมูลการแข่งขันสำหรับรายการนี้') : ui('No standings information available for this tournament yet.')}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {boardsByCategory.map(category => (
                            <section key={category.key} className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900">{category.label}</h2>
                                {category.boards.map(board => {
                                    const name = board.pool.replace(/^(?:สาย|pool)\s+/i, '');
                                    const poolLabel = name
                                        ? (language === 'THA' ? `สาย ${name}` : `Pool ${name}`)
                                        : (language === 'THA' ? 'ไม่ระบุสาย' : 'No pool assigned');
                                    return (
                                        <section key={JSON.stringify([board.competition.id, board.pool])} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                            <div className="border-b border-gray-100 px-4 py-3">
                                                <h3 className="font-bold text-gray-900">{poolLabel}</h3>
                                                <p className="text-sm text-gray-600">{displayNames.competitionName(board.competition)}</p>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table aria-label={`${category.label} · ${poolLabel} · ${displayNames.competitionName(board.competition)}`} className="w-full text-left border-collapse">
                                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                                        <tr>
                                                            <th className="px-4 py-3 text-center w-16">{ui("Rank")}</th>
                                                            <th className="px-4 py-3">{ui("Team")}</th>
                                                            <th className="px-2 py-3 text-center">{ui("Totals")}</th>
                                                            <th className="px-2 py-3 text-center text-green-600">{ui("Won")}</th>
                                                            <th className="px-2 py-3 text-center text-red-500">{ui("Lost")}</th>
                                                            <th className="px-4 py-3 text-center bg-blue-50 text-indigo-700 text-base">{ui("Points")}</th>
                                                            <th className="px-2 py-3 text-center border-l">{ui("Sets W")}</th>
                                                            <th className="px-2 py-3 text-center">{ui("Sets L")}</th>
                                                            <th className="px-2 py-3 text-center text-[10px]">{ui("Ratio")}</th>
                                                            <th className="px-2 py-3 text-center border-l">{ui("Pts W")}</th>
                                                            <th className="px-2 py-3 text-center">{ui("Pts L")}</th>
                                                            <th className="px-2 py-3 text-center text-[10px]">{ui("Ratio")}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {board.standings.map((team, index) => (
                                                            <tr key={team.id} className="hover:bg-gray-50 transition">
                                                                <td className="px-4 py-3 text-center font-bold text-gray-700">
                                                                    {index + 1}
                                                                </td>
                                                                <td className="px-4 py-3 cursor-pointer group" onClick={() => setSelectedTeam({ ...team, matches: board.matches, teams: board.teams })}>
                                                                    <div className="flex items-center gap-3">
                                                                        {team.logo_url && <img src={team.logo_url} alt="" className="w-8 h-8 object-contain" />}
                                                                        <span className="font-bold text-gray-800 group-hover:text-blue-600 group-hover:underline decoration-indigo-600 underline-offset-2 transition-colors">
                                                                            {displayNames.teamName(team)}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-3 text-center">{team.played}</td>
                                                                <td className="px-2 py-3 text-center font-bold text-green-600">{team.won}</td>
                                                                <td className="px-2 py-3 text-center text-red-500">{team.lost}</td>
                                                                <td className="px-4 py-3 text-center font-semibold text-lg bg-blue-50 text-indigo-700">{team.points}</td>
                                                                <td className="px-2 py-3 text-center border-l">{team.sets_won}</td>
                                                                <td className="px-2 py-3 text-center">{team.sets_lost}</td>
                                                                <td className="px-2 py-3 text-center text-xs text-gray-500 font-mono">{team.setRatioStr}</td>
                                                                <td className="px-2 py-3 text-center border-l">{team.points_won}</td>
                                                                <td className="px-2 py-3 text-center">{team.points_lost}</td>
                                                                <td className="px-2 py-3 text-center text-xs text-gray-500 font-mono">{team.pointRatioStr}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    );
                                })}
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
