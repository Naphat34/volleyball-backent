import { calculateStandings as buildStandings } from '../../utils/scorer/standings';
import { Feedback } from '../../components/ui/SystemUI';
import PublicHeader from '../../components/layout/PublicHeader';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../../api';
import { Trophy, Filter, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { groupPublicCompetitionCategories } from '../../utils/scorer/publicCompetitionGrouping';

export default function PublicStandings() {

    const { language, t } = useLanguage();
    const [competitions, setCompetitions] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [standings, setStandings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [allMatches, setAllMatches] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);

    // 1. ดึงรายการแข่งขัน
    useEffect(() => {
        const fetchComps = async () => {
            try {
                const res = await client.get('/public/competitions');
                const openComps = res.data.filter(c => c.status?.toLowerCase() === 'open');
                setCompetitions(openComps);
                setSelectedCategory('all');
            } catch (err) {
                console.error("Error fetching competitions:", err);
                setLoadError(true);
            }
        };
        fetchComps();
    }, [reloadKey]);

    // 2. คำนวณตารางคะแนนเมื่อเลือกรายการแข่งขัน
    const calculateStandings = useCallback(async (categoryKey) => {
        setLoading(true);
        try {
            const categoryGroup = categoryKey === 'all' ? null : groupPublicCompetitionCategories(competitions, language).find((item) => item.key === categoryKey);
            const competitionIds = (categoryGroup?.items || competitions)
                .map((competition) => competition.id)
                .filter((id) => id !== undefined && id !== null && id !== '');

            if (competitionIds.length === 0) {
                setAllMatches([]);
                setStandings([]);
                return;
            }

            const [matchResults, teamResults] = await Promise.all([
                Promise.all(competitionIds.map((id) => client.get(`/public/matches?competitionId=${id}`))),
                Promise.all(competitionIds.map((id) => client.get(`/public/competitions/${id}/teams`)))
            ]);

            const matches = matchResults.flatMap((result) => result.data || []);
            setAllMatches(matches);
            const teamsByKey = new Map();
            teamResults.flatMap((result) => result.data).forEach((team) => {
                const key = String(team.id);
                if (!teamsByKey.has(key)) teamsByKey.set(key, team);
            });
            const teams = Array.from(teamsByKey.values());

            const standingsArray = buildStandings(teams, matches, competitions);

            setStandings(standingsArray);

        } catch (err) {
            console.error("Error calculating standings:", err);
                setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [competitions, language]);

    useEffect(() => {
        if (competitions.length === 0) return;
        calculateStandings(selectedCategory);
    }, [calculateStandings, competitions.length, selectedCategory, reloadKey]);

    const getTeamName = (id) => {
        const t = standings.find(s => s.id === id);
        return t ? t.name : 'Unknown Team';
    };
    const categories = useMemo(() => groupPublicCompetitionCategories(competitions, language), [competitions, language]);

    return (
        <div className="app-page min-h-screen text-gray-800 font-sans pb-20">
            {/* Navbar */}
            <PublicHeader />
            {loadError && <div className="mx-auto max-w-[1400px] px-4 py-4"><Feedback error title={language === 'THA' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Unable to load data'} onRetry={() => { setLoadError(false); setReloadKey(key => key + 1); }} retryLabel={language === 'THA' ? 'ลองใหม่' : 'Retry'} /></div>}
            <div id="main-content" tabIndex={-1} />

            {/* Header */}
            <div className="bg-[#122b52] text-white py-12 px-4 shadow-lg mb-8">
                <div className="w-full max-w-[1400px] mx-auto text-center">
                    <h1 className="text-4xl font-extrabold flex items-center justify-center gap-3 mb-2">
                        <Trophy className="text-yellow-400" size={40} /> {language === 'THA' ? 'อันดับทีมแข่งขัน' : 'Team Standings'}
                    </h1>
                    <p className="text-indigo-200">{language === 'THA' ? 'ตารางคะแนนและอันดับทีมล่าสุด' : 'Latest standings and tournament statistics'}</p>
                </div>
            </div>

            {/* Category filter */}
            <div className="w-full max-w-[1400px] mx-auto px-4 mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <label className="font-bold text-gray-700 flex items-center gap-2"><Filter size={18} className="text-blue-600"/> {language === 'THA' ? '\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17:' : 'Category:'}</label>
                    <div className="flex w-full flex-wrap gap-2 md:justify-end">
                        <button type="button" onClick={() => setSelectedCategory('all')} className={`rounded-full border px-3 py-2 text-sm font-bold ${selectedCategory === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}>{language === 'THA' ? '\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14' : 'All'}</button>
                        {categories.map((category) => <button key={category.key} type="button" onClick={() => setSelectedCategory(category.key)} className={`rounded-full border px-3 py-2 text-sm font-bold ${selectedCategory === category.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}>{category.label}</button>)}
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
                                        {selectedTeam.name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{selectedTeam.name}</h3>
                                    <p className="text-xs text-gray-500">Match History</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedTeam(null)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-0 overflow-y-auto">
                            {allMatches.filter(m => m.home_team_id === selectedTeam.id || m.away_team_id === selectedTeam.id).length === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    <p>{language === 'THA' ? 'ยังไม่มีประวัติการแข่งขัน' : 'No match history yet'}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {allMatches
                                        .filter(m => m.home_team_id === selectedTeam.id || m.away_team_id === selectedTeam.id)
                                        .sort((a, b) => (b.id - a.id)) // เรียงตาม ID ล่าสุด (หรือใช้วันที่ถ้ามี)
                                        .map((match, idx) => {
                                            const isHome = match.home_team_id === selectedTeam.id;
                                            const opponentId = isHome ? match.away_team_id : match.home_team_id;
                                            const opponentName = getTeamName(opponentId);
                                            const myScore = isHome ? match.home_set_score : match.away_set_score;
                                            const opScore = isHome ? match.away_set_score : match.home_set_score;
                                            const isWin = parseInt(myScore) > parseInt(opScore);

                                            return (
                                                <div key={idx} className="p-4 hover:bg-gray-50 transition flex items-center justify-between">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className={`w-1.5 h-12 rounded-full ${isWin ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                        <div>
                                                            <p className="text-xs text-gray-400 mb-1">VS</p>
                                                            <p className="font-bold text-gray-800 text-lg">{opponentName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`text-2xl font-semibold ${isWin ? 'text-green-600' : 'text-red-500'}`}>
                                                            {myScore} - {opScore}
                                                        </div>
                                                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${isWin ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {isWin ? 'W' : 'L'}
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
                ) : standings.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
                        <p className="text-gray-400">{language === 'THA' ? 'ยังไม่มีข้อมูลการแข่งขันสำหรับรายการนี้' : 'No standings information available for this tournament yet.'}</p>
                    </div>
                ) : (
                    <div className="bg-white/95 rounded-3xl shadow-xl border border-white overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-16">Rank</th>
                                        <th className="px-4 py-3">Team</th>
                                        <th className="px-2 py-3 text-center">Totals</th>
                                        <th className="px-2 py-3 text-center text-green-600">Won</th>
                                        <th className="px-2 py-3 text-center text-red-500">Lost</th>
                                        <th className="px-4 py-3 text-center bg-blue-50 text-indigo-700 text-base">Points</th>
                                        <th className="px-2 py-3 text-center border-l">Sets W</th>
                                        <th className="px-2 py-3 text-center">Sets L</th>
                                        <th className="px-2 py-3 text-center text-[10px]">Ratio</th>
                                        <th className="px-2 py-3 text-center border-l">Pts W</th>
                                        <th className="px-2 py-3 text-center">Pts L</th>
                                        <th className="px-2 py-3 text-center text-[10px]">Ratio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {standings.map((team, index) => (
                                        <tr key={team.id} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 text-center font-bold text-gray-700">
                                                {index + 1}
                                            </td>
                                            <td className="px-4 py-3 cursor-pointer group" onClick={() => setSelectedTeam(team)}>
                                                <div className="flex items-center gap-3">
                                                    {team.logo_url && <img src={team.logo_url} alt="" className="w-8 h-8 object-contain" />}
                                                    <span className="font-bold text-gray-800 group-hover:text-blue-600 group-hover:underline decoration-indigo-600 underline-offset-2 transition-colors">
                                                        {team.name}
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
                    </div>
                )}
            </div>
        </div>
    );
}
