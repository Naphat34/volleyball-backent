import { GuardedButton } from '../ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import React, { useEffect, useState, useCallback } from 'react';
import { api, getSocketServerUrl } from '../../api';
import { buildTeamRankingWorkbook, loadRankingLogo } from '../../utils/reports/teamRankingExcel';
import { Trophy, Filter, X, Calendar, Download, BarChart2 } from 'lucide-react';
import { EmptyState } from './AdminShared';
import { formatThaiDate } from '../../utils/formatters';

const ageGroupOrder = ['U12', 'U14', 'U16', 'U18', 'OPEN'];

const getCompetitionBaseName = (competition) => {
    const rawTitle = competition?.title || competition?.name || '';
    return rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
};

const normalizeAgeGroupName = (name) => {
    const normalized = String(name || '').trim();
    if (!normalized) return '';
    if (/^(open|senior|general)$/i.test(normalized) || normalized.includes('ประชาชน')) return 'ประชาชนทั่วไป';
    return normalized.toUpperCase();
};

const getAgeGroupKey = (competition) => String(competition?.age_group_id || competition?.entry_age_group_id || '');

const getAgeGroupLabel = (competition) => normalizeAgeGroupName(
    competition?.age_group_name || competition?.age_group || competition?.category || ''
);

const sortAgeGroups = (a, b) => {
    const aName = normalizeAgeGroupName(a.label);
    const bName = normalizeAgeGroupName(b.label);
    const aOrder = ageGroupOrder.indexOf(aName === 'ประชาชนทั่วไป' ? 'OPEN' : aName);
    const bOrder = ageGroupOrder.indexOf(bName === 'ประชาชนทั่วไป' ? 'OPEN' : bName);
    if (aOrder !== -1 || bOrder !== -1) return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
    return aName.localeCompare(bName, 'th');
};

const getDefaultMaxSetsByAgeGroup = (competition) => {
    const label = getAgeGroupLabel(competition);
    if (['U12', 'U14', 'U16'].includes(label)) return 3;
    if (label === 'U18' || label === 'ประชาชนทั่วไป') return 5;
    return 0;
};

const getMatchDisplayDate = (match) => {
    const dateValue =
        match?.match_date ||
        match?.start_date ||
        (typeof match?.start_time === 'string' && match.start_time.includes('T') ? match.start_time : null);

    return dateValue ? formatThaiDate(dateValue) : 'TBD';
};

export default function TeamRankingTab() {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const [competitions, setCompetitions] = useState([]);
    const [uniqueBaseNames, setUniqueBaseNames] = useState([]);
    const [selectedBaseName, setSelectedBaseName] = useState('');
    const [standings, setStandings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const [genderFilter, setGenderFilter] = useState('Female'); // Default Gender
    const [allMatches, setAllMatches] = useState([]); // เก็บข้อมูลแมตช์ทั้งหมดไว้ใช้แสดง History
    const [viewingHistoryTeam, setViewingHistoryTeam] = useState(null); // ทีมที่กำลังดูประวัติ
    const [resultCols, setResultCols] = useState([]); // เก็บชื่อคอลัมน์ผลการแข่งขัน (เช่น 3-0, 3-1)
    const [availableGenders, setAvailableGenders] = useState([]); // เก็บเพศที่มีในรายการนั้นๆ
    const [availableAgeGroups, setAvailableAgeGroups] = useState([]);
    const [selectedAgeGroupId, setSelectedAgeGroupId] = useState('');
    const [pools, setPools] = useState([]); // รายชื่อ Pool ทั้งหมดในรายการนี้
    const [selectedPool, setSelectedPool] = useState(''); // Pool ที่เลือกใช้งาน

    const fetchCompetitions = useCallback(async () => {
        try {
            const res = await api.getAllCompetitions();
            setCompetitions(res.data.filter(c => c.status?.toLowerCase() === 'open'));

            // จัดกลุ่มชื่อรายการ (ตัดวงเล็บเพศออก)
            const bases = new Set();
            res.data.forEach(c => {
                const base = getCompetitionBaseName(c);
                if (base) {
                    bases.add(base);
                }
            });
            const sortedBases = Array.from(bases).sort();
            setUniqueBaseNames(sortedBases);

            if (sortedBases.length > 0) {
                setSelectedBaseName(sortedBases[0]);
            }
        } catch (err) {
            console.error("Error fetching competitions:", err);
        }
    }, []);

    const calculateStandings = useCallback(async (competition) => {
        setLoading(true);
        try {
            const compId = competition?.id || competition;
            // ดึงข้อมูลแมตช์และทีมของรายการนั้นๆ
            const [matchesRes, teamsRes] = await Promise.all([
                api.getMatchesByCompetition(compId),
                api.getTeamsByCompetition(compId)
            ]);

            const matches = matchesRes.data;
            setAllMatches(matches); // เก็บแมตช์ดิบไว้ใช้งาน
            let teams = Array.isArray(teamsRes.data) ? teamsRes.data : [];

            // --- [NEW] จัดการ Pool Filtering ---
            // 1. หา Pool ทั้งหมดที่มีในรายการนี้ (จาก matches)
            const uniquePools = [...new Set(matches.map(m => m.pool_name).filter(Boolean))].sort();
            setPools(uniquePools);

            // 2. ถ้ามี Pool และมีการเลือก Pool ให้กรองข้อมูล
            let filteredMatches = matches;
            if (selectedPool) {
                filteredMatches = matches.filter(m => m.pool_name === selectedPool);

                // กรองเฉพาะทีมที่มีแข่งใน Pool นี้
                const teamIdsInPool = new Set();
                filteredMatches.forEach(m => {
                    if (m.home_team_id) teamIdsInPool.add(String(m.home_team_id));
                    if (m.away_team_id) teamIdsInPool.add(String(m.away_team_id));
                });
                teams = teams.filter(t => teamIdsInPool.has(String(t.id)));
            }

            const teamsById = new Map();
            teams.forEach(team => {
                if (team?.id) teamsById.set(String(team.id), team);
            });
            filteredMatches.forEach(match => {
                if (match.home_team_id && !teamsById.has(String(match.home_team_id))) {
                    teamsById.set(String(match.home_team_id), {
                        id: match.home_team_id,
                        name: match.home_team || match.team_a_name || 'Home Team',
                        code: match.home_team_code || match.team_a_code || '',
                        logo_url: match.home_team_logo_url || ''
                    });
                }
                if (match.away_team_id && !teamsById.has(String(match.away_team_id))) {
                    teamsById.set(String(match.away_team_id), {
                        id: match.away_team_id,
                        name: match.away_team || match.team_b_name || 'Away Team',
                        code: match.away_team_code || match.team_b_code || '',
                        logo_url: match.away_team_logo_url || ''
                    });
                }
            });
            teams = Array.from(teamsById.values());

            // 1. หา max_sets ของรายการนี้เพื่อสร้างคอลัมน์ Result Details
            const competitionMaxSets = Number(competition?.max_sets || competition?.maxSets || 0) || getDefaultMaxSetsByAgeGroup(competition);
            const maxSets = competitionMaxSets || 5;
            const setsToWin = Math.ceil(maxSets / 2);

            const cols = [];
            for (let i = 0; i < setsToWin; i++) cols.push(`${setsToWin}-${i}`); // Wins (e.g. 3-0, 3-1, 3-2)
            for (let i = setsToWin - 1; i >= 0; i--) cols.push(`${i}-${setsToWin}`); // Losses (e.g. 2-3, 1-3, 0-3)
            setResultCols(cols);

            // เตรียม Object สำหรับเก็บสถิติ
            const stats = {};
            teams.forEach(team => {
                const teamKey = String(team.id);
                stats[teamKey] = {
                    id: team.id,
                    name: team.name,
                    code: team.code, // เพิ่มชื่อย่อ
                    logo_url: team.logo_url,
                    played: 0,
                    won: 0,
                    lost: 0,
                    points: 0,
                    sets_won: 0,
                    sets_lost: 0,
                    points_won: 0,
                    points_lost: 0,
                    // Result Details
                    results: {} // เก็บแบบ Dynamic
                };
                cols.forEach(k => stats[teamKey].results[k] = 0);
            });

            const isCompletedMatch = (match) => String(match.status || '').toLowerCase() === 'completed';
            const parseSetScores = (rawScores) => {
                if (!rawScores) return [];
                let scores = rawScores;
                if (typeof scores === 'string') {
                    try {
                        scores = JSON.parse(scores);
                    } catch {
                        scores = scores.split(',').map(s => s.trim()).filter(Boolean);
                    }
                }
                if (!Array.isArray(scores)) return [];

                return scores.map(setScore => {
                    if (typeof setScore === 'string') {
                        const [home, away] = setScore.split('-').map(v => Number.parseInt(v, 10));
                        return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
                    }
                    const home = Number.parseInt(setScore?.home ?? setScore?.home_score ?? setScore?.h, 10);
                    const away = Number.parseInt(setScore?.away ?? setScore?.away_score ?? setScore?.a, 10);
                    return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
                }).filter(Boolean);
            };

            const getSetsFromScores = (setScores) => setScores.reduce((acc, setScore) => {
                if (setScore.home > setScore.away) acc.home += 1;
                if (setScore.away > setScore.home) acc.away += 1;
                return acc;
            }, { home: 0, away: 0 });

            const addRankingPoints = (winnerStats, loserStats, loserSets, matchSetsToWin) => {
                if (loserSets === matchSetsToWin - 1) {
                    winnerStats.points += 2;
                    loserStats.points += 1;
                } else {
                    winnerStats.points += 3;
                }
            };

            filteredMatches.forEach(m => {
                if (!isCompletedMatch(m)) return;

                const homeId = String(m.home_team_id);
                const awayId = String(m.away_team_id);
                if (!stats[homeId] || !stats[awayId]) return;

                const setScores = parseSetScores(m.set_scores);
                const calculatedSets = getSetsFromScores(setScores);
                const homeSets = calculatedSets.home || (Number.parseInt(m.home_set_score, 10) || 0);
                const awaySets = calculatedSets.away || (Number.parseInt(m.away_set_score, 10) || 0);

                if (homeSets === awaySets) return;

                const matchSetsToWin = Math.ceil(maxSets / 2);

                stats[homeId].played++;
                stats[awayId].played++;

                stats[homeId].sets_won += homeSets;
                stats[homeId].sets_lost += awaySets;
                stats[awayId].sets_won += awaySets;
                stats[awayId].sets_lost += homeSets;

                const scoreKey = `${homeSets}-${awaySets}`;
                const reverseScoreKey = `${awaySets}-${homeSets}`;
                if (stats[homeId].results[scoreKey] !== undefined) stats[homeId].results[scoreKey]++;
                if (stats[awayId].results[reverseScoreKey] !== undefined) stats[awayId].results[reverseScoreKey]++;

                if (homeSets > awaySets) {
                    stats[homeId].won++;
                    stats[awayId].lost++;
                    addRankingPoints(stats[homeId], stats[awayId], awaySets, matchSetsToWin);
                } else {
                    stats[awayId].won++;
                    stats[homeId].lost++;
                    addRankingPoints(stats[awayId], stats[homeId], homeSets, matchSetsToWin);
                }

                setScores.forEach(setScore => {
                    stats[homeId].points_won += setScore.home;
                    stats[homeId].points_lost += setScore.away;
                    stats[awayId].points_won += setScore.away;
                    stats[awayId].points_lost += setScore.home;
                });
            });
            // แปลงเป็น Array และคำนวณ Ratio
            const standingsArray = Object.values(stats).map(t => {
                // ถ้ายังไม่ได้แข่ง ให้ Ratio เป็น 0
                const setRatio = t.sets_lost === 0 ? (t.sets_won > 0 ? 'MAX' : 0.000) : (t.sets_won / t.sets_lost).toFixed(3);
                const pointRatio = t.points_lost === 0 ? (t.points_won > 0 ? 'MAX' : 0.000) : (t.points_won / t.points_lost).toFixed(3);

                return { ...t, setRatio, pointRatio, setRatioVal: t.sets_lost === 0 ? 9999 : t.sets_won / t.sets_lost, pointRatioVal: t.points_lost === 0 ? 9999 : t.points_won / t.points_lost };
            });

            // เรียงลำดับตามความสำคัญ: 1. คะแนน (Points) > 2. จำนวนแมตช์ที่ชนะ (Won Matches) > 3. Set Ratio > 4. Point Ratio
            standingsArray.sort((a, b) => {
                // จัดเรียงจาก คะแนน (Points) มากไปหาน้อย
                if (b.points !== a.points) return (b.points || 0) - (a.points || 0);
                // ถ้าคะแนนเท่ากัน ให้ดูจำนวนแมตช์ที่ชนะ (Won Matches)
                if (b.won !== a.won) return (b.won || 0) - (a.won || 0);
                // ถ้ายังเท่ากัน ให้ดู Set Ratio
                if (b.setRatioVal !== a.setRatioVal) return (b.setRatioVal || 0) - (a.setRatioVal || 0);
                // สุดท้ายดู Point Ratio
                return (b.pointRatioVal || 0) - (a.pointRatioVal || 0);
            });

            setStandings(standingsArray);

        } catch (err) {
            console.error("Error calculating standings:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedPool]);

    useEffect(() => {
        fetchCompetitions();
    }, [fetchCompetitions]);

    useEffect(() => {
        if (selectedBaseName && genderFilter) {
            // ค้นหา Competition ID ที่ตรงกับ ชื่อรายการ + เพศ
            const targetComp = competitions.find(c => {
                const cBase = getCompetitionBaseName(c);
                return cBase === selectedBaseName &&
                    c.gender === genderFilter &&
                    String(getAgeGroupKey(c)) === String(selectedAgeGroupId);
            });

            if (targetComp) {
                calculateStandings(targetComp);
            } else {
                setStandings([]); // ไม่พบรายการสำหรับเพศนี้
            }
        } else {
            setStandings([]);
        }
    }, [selectedBaseName, genderFilter, selectedAgeGroupId, competitions, calculateStandings]);

    // เมื่อเลือกรายการแข่งขัน (Base Name) ให้หาว่ามีเพศอะไรบ้าง
    useEffect(() => {
        if (selectedBaseName && competitions.length > 0) {
            const relatedComps = competitions.filter(c => {
                const cBase = getCompetitionBaseName(c);
                return cBase === selectedBaseName;
            });
            const genders = [...new Set(relatedComps.map(c => c.gender))].filter(Boolean).sort();
            setAvailableGenders(genders);

            // ถ้าเพศที่เลือกอยู่ ไม่มีในรายการนี้ ให้เลือกเพศแรกที่เจอแทน
            if (genders.length > 0 && !genders.includes(genderFilter)) {
                setGenderFilter(genders[0]);
            }

            const genderForAgeGroups = genders.includes(genderFilter) ? genderFilter : genders[0];
            const ageGroups = relatedComps
                .filter(c => !genderForAgeGroups || c.gender === genderForAgeGroups)
                .map(c => ({
                    id: getAgeGroupKey(c),
                    label: getAgeGroupLabel(c) || `รุ่น ${getAgeGroupKey(c)}`
                }))
                .filter(group => group.id);
            const uniqueAgeGroups = Array.from(
                new Map(ageGroups.map(group => [group.id, group])).values()
            ).sort(sortAgeGroups);
            setAvailableAgeGroups(uniqueAgeGroups);

            if (uniqueAgeGroups.length > 0 && !uniqueAgeGroups.some(group => String(group.id) === String(selectedAgeGroupId))) {
                setSelectedAgeGroupId(uniqueAgeGroups[0].id);
            }
        }
    }, [selectedBaseName, competitions, genderFilter, selectedAgeGroupId]);

    const handleExportExcel = async () => {
        if (!standings.length || exporting) return;
        setExporting(true); setExportError('');
        try {
            const siblings = competitions.filter(c => getCompetitionBaseName(c) === selectedBaseName);
            const competition = siblings.find(c => c.gender === genderFilter && getAgeGroupKey(c) === String(selectedAgeGroupId)) || siblings[0] || {};
            const logo = await loadRankingLogo(competition.logo_url || siblings.find(c => c.logo_url)?.logo_url, getSocketServerUrl());
            const workbook = await buildTeamRankingWorkbook({ competition, title: selectedBaseName, gender: genderFilter,
                ageGroup: availableAgeGroups.find(group => String(group.id) === String(selectedAgeGroupId))?.label,
                pool: selectedPool, standings, resultCols, logo });
            const blob = new Blob([await workbook.xlsx.writeBuffer()], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            const url=URL.createObjectURL(blob), link=document.createElement('a');
            link.href=url;
            link.download='team_rankings_'+[selectedBaseName,genderFilter,selectedPool||'all-pools'].join('_').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_')+'.xlsx';
            document.body.appendChild(link);link.click();link.remove();
            setTimeout(()=>URL.revokeObjectURL(url),1000);
        } catch (error) {
            console.error('Export team rankings failed:',error);
            setExportError('ไม่สามารถส่งออก Excel หรือโหลดโลโก้รายการได้ กรุณาลองอีกครั้ง / Could not export rankings or load the competition logo. Please retry.');
        } finally {setExporting(false);}
    };

    return (
        <div className="official-page min-h-screen -m-6 p-6 space-y-6">
            <div className="official-header rounded-md px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{ui("Standings Inspection")}</p>
                <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <BarChart2 size={24} />{ui("Team Rankings")}</h2>
            </div>

            {/* Filter Section */}
            <div className="official-panel rounded-md p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4 xl:grid-cols-5">
                    <div className="md:col-span-2 xl:col-span-2">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">{ui("Competition")}</label>
                            <select
                            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm outline-none transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={selectedBaseName}
                                onChange={(e) => setSelectedBaseName(e.target.value)}
                            >
                                {uniqueBaseNames.map(name => (
                                    <option key={name} value={name}>
                                        {displayNames.competitionGroupName(name, competitions)}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">{ui("Gender")}</label>
                        <div className="flex min-h-[42px] items-center rounded-md border border-gray-200 bg-slate-50 p-1 shadow-sm">
                                {availableGenders.map(g => (
                                <GuardedButton key={g} onClick={() => setGenderFilter(g)} className={`w-full rounded-md px-4 py-1.5 text-sm font-medium transition-all ${genderFilter === g ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-blue-50 hover:text-blue-700'}`}>
                                        {g}
                                    </GuardedButton>
                                ))}
                            </div>
                        </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">{ui("Age Group")}</label>
                            <select
                            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm outline-none transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={selectedAgeGroupId}
                                onChange={(e) => setSelectedAgeGroupId(e.target.value)}
                            >
                                {availableAgeGroups.map(group => (
                                    <option key={group.id} value={group.id}>{ui(group.label)}</option>
                                ))}
                        </select>
                    </div>

                    {pools.length > 0 && (
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">{ui("Pool")}</label>
                                <select
                                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm outline-none transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    value={selectedPool}
                                    onChange={(e) => setSelectedPool(e.target.value)}
                                >
                                    <option value="">{ui("All Pools")}</option>
                                    {pools.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-end">
                    <GuardedButton
                        type="button"
                        onClick={handleExportExcel}
                        disabled={loading || exporting || standings.length === 0}
                            className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                        title={ui("Export rankings as Excel")}
                    >
                        <Download size={16} />{exporting ? ui("กำลังส่งออก…") : ui("Export Excel")}</GuardedButton>
                    </div>
                </div>
            </div>

            {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}
            {/* Table Section */}
            <div className="official-panel rounded-md overflow-hidden">
                <div className="official-panel-header flex items-center justify-between px-6 py-4">
                    <h3 className="flex items-center gap-2 font-semibold tracking-tight text-gray-900">
                        <Trophy size={18} className="text-blue-600" />{ui("Ranking Table")}</h3>
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {standings.length}{ui("Teams")}</span>
                </div>
                {loading ? (
                    <div className="p-10 text-center text-sm font-semibold text-slate-500">{ui("Loading standings...")}</div>
                ) : standings.length === 0 ? (
                    <EmptyState text="No teams or matches found for this competition." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead className="official-table-head border-b border-gray-200 sticky top-0 z-10">
                                {/* Header Grouping */}
                                <tr className="border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <th colSpan="2" className="border-r border-gray-200 py-2 text-center">{ui("Ranking")}</th>
                                    <th colSpan="3" className="border-r border-gray-200 bg-gray-50/60 py-2 text-center">{ui("Matches")}</th>
                                    <th colSpan={resultCols.length} className="border-r border-gray-200 bg-blue-50/40 py-2 text-center text-blue-600">{ui("Result Details")}</th>
                                    <th colSpan="1" className="border-r border-gray-200 py-2 text-center font-bold text-blue-600">{ui("Total")}</th>
                                    <th colSpan="3" className="border-r border-gray-200 py-2 text-center">{ui("Sets")}</th>
                                    <th colSpan="3" className="py-2 text-center">{ui("Points")}</th>
                                </tr>
                                <tr className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <th className="px-4 py-4 text-center w-16">{ui("Rank")}</th>
                                    <th className="px-4 py-4">{ui("Team")}</th>
                                    <th className="bg-gray-50/60 px-2 py-4 text-center" title={ui("Total Matches")}>{ui("Total")}</th>
                                    <th className="bg-gray-50/60 px-2 py-4 text-center" title={ui("Won")}>{ui("W")}</th>
                                    <th className="bg-gray-50/60 px-2 py-4 text-center" title={ui("Lost")}>{ui("L")}</th>

                                    {/* Result Details */}
                                    {resultCols.map((col, i) => (
                                        <th key={col} className={`px-2 py-4 text-center text-[10px] text-gray-500 ${i === 0 ? 'border-l border-gray-200' : ''}`} title={ui(`Result {0}`, [col])}>{col}</th>
                                    ))}

                                    <th className="border-l border-gray-200 px-4 py-4 text-center text-lg font-semibold text-blue-600" title={ui("Points")}>{ui("POINTS")}</th>

                                    <th className="border-l border-gray-200 px-2 py-4 text-center" title={ui("Sets Won")}>{ui("SW")}</th>
                                    <th className="px-2 py-4 text-center" title={ui("Sets Lost")}>{ui("SL")}</th>
                                    <th className="px-2 py-4 text-center text-xs" title={ui("Set Ratio")}>{ui("Ratio")}</th>

                                    <th className="border-l border-gray-200 px-2 py-4 text-center" title={ui("Points Won")}>{ui("PW")}</th>
                                    <th className="px-2 py-4 text-center" title={ui("Points Lost")}>{ui("PL")}</th>
                                    <th className="px-2 py-4 text-center text-xs" title={ui("Point Ratio")}>{ui("Ratio")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {standings.map((team, index) => (
                                    <tr key={team.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-4 py-4 text-center font-bold">
                                            <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-md border text-sm font-semibold ${index === 0 ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                                index === 1 ? 'border-gray-200 bg-gray-50 text-gray-700' :
                                                    index === 2 ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-700'
                                                }`}>
                                                {index + 1}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div
                                                className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
                                                onClick={() => setViewingHistoryTeam(team)}
                                                title={ui("Click to view match history")}
                                            >
                                                <div className="w-10 h-10 rounded-md bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200 transition flex items-center justify-center">
                                                    {team.logo_url ? <img src={team.logo_url} alt={displayNames.teamName(team)} className="h-full w-full object-contain p-1" /> : <Trophy size={18} className="text-gray-300" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-base font-semibold text-slate-950 group-hover:text-blue-600 group-hover:underline underline-offset-2 decoration-indigo-500/30">{displayNames.teamName(team)}</div>
                                                    {team.code && <div className="text-xs text-slate-400 font-mono">{team.code}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="bg-gray-50/50 px-2 py-4 text-center font-medium text-gray-700">{team.played}</td>
                                        <td className="bg-gray-50/50 px-2 py-4 text-center font-bold text-green-600">{team.won}</td>
                                        <td className="bg-gray-50/50 px-2 py-4 text-center text-red-500">{team.lost}</td>

                                        {/* Result Details */}
                                        {resultCols.map((col, i) => (
                                            <td key={col} className={`px-2 py-4 text-center text-xs text-gray-500 ${i === 0 ? 'border-l border-gray-200' : ''}`}>{team.results[col] || 0}</td>
                                        ))}

                                        <td className="border-l border-gray-200 px-4 py-4 text-center text-lg font-semibold text-gray-900">{team.points}</td>

                                        <td className="border-l border-gray-200 px-2 py-4 text-center text-gray-700">{team.sets_won}</td>
                                        <td className="px-2 py-4 text-center">{team.sets_lost}</td>
                                        <td className="px-2 py-4 text-center font-mono text-xs text-gray-500">{team.setRatio}</td>

                                        <td className="border-l border-gray-200 px-2 py-4 text-center text-gray-700">{team.points_won}</td>
                                        <td className="px-2 py-4 text-center">{team.points_lost}</td>
                                        <td className="px-2 py-4 text-center font-mono text-xs text-gray-500">{team.pointRatio}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Match History Modal */}
            {viewingHistoryTeam && (
                <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm duration-200 fade-in">
                    <div className="official-panel relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white text-gray-900 shadow-2xl">
                        <div className="official-panel-header flex shrink-0 items-center justify-between px-6 py-4">
                            <div>
                                <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900"><Calendar size={18} className="text-blue-600" />{' '}{ui("Match History")}</h3>
                                <p className="mt-1 text-sm font-medium text-gray-500">{displayNames.teamName(viewingHistoryTeam)}</p>
                            </div>
                            <GuardedButton onClick={() => setViewingHistoryTeam(null)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-700"><X size={20} /></GuardedButton>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0">
                            {(() => {
                                // กรองแมตช์ของทีมนี้
                                const teamMatches = allMatches.filter(m =>
                                    (String(m.home_team_id) === String(viewingHistoryTeam.id) || String(m.away_team_id) === String(viewingHistoryTeam.id)) &&
                                    String(m.status || '').toLowerCase() === 'completed'
                                ).sort((a, b) => {
                                    const dateA = a.match_date || a.start_date || a.start_time || '';
                                    const dateB = b.match_date || b.start_date || b.start_time || '';
                                    return new Date(dateB) - new Date(dateA);
                                });

                                if (teamMatches.length === 0) return <div className="p-12 text-center text-sm font-medium text-slate-500">{ui("No completed matches found for this team.")}</div>;

                                return (
                                    <table className="w-full border-collapse text-left">
                                        <thead className="official-table-head sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">{ui("Date / Round")}</th>
                                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">{ui("Opponent")}</th>
                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">{ui("Result")}</th>
                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">{ui("Score")}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {teamMatches.map(m => {
                                                const isHome = String(m.home_team_id) === String(viewingHistoryTeam.id);
                                                const opponentName = isHome ? (displayNames.matchTeamName(m, 'away') || 'Unknown') : (displayNames.matchTeamName(m, 'home') || 'Unknown');
                                                const myScore = isHome ? m.home_set_score : m.away_set_score;
                                                const oppScore = isHome ? m.away_set_score : m.home_set_score;
                                                const isWin = myScore > oppScore;

                                                return (
                                                    <tr key={m.id} className="hover:bg-gray-50 transition">
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm font-bold text-gray-900">{getMatchDisplayDate(m)}</div>
                                                            <div className="text-xs text-gray-500">{m.round_name}</div>
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-gray-800">{opponentName}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`rounded-md border px-2.5 py-1 text-xs font-bold ${isWin ? 'border-green-200 bg-green-100 text-green-700' : 'border-red-200 bg-red-100 text-red-700'}`}>
                                                                {isWin ? ui('WIN') : ui('LOSS')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="font-mono text-lg font-semibold text-gray-900">{myScore} - {oppScore}</div>
                                                            <div className="mt-1 font-mono text-xs text-gray-400">
                                                                {(() => {
                                                                    try {
                                                                        const sets = typeof m.set_scores === 'string' ? JSON.parse(m.set_scores) : m.set_scores;
                                                                        return Array.isArray(sets) ? sets.join(', ') : sets;
                                                                    } catch { return m.set_scores; }
                                                                })()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </div>
                        <div className="flex justify-end border-t border-gray-100 bg-gray-50 p-6">
                            <GuardedButton onClick={() => setViewingHistoryTeam(null)} className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900">{ui("Close")}</GuardedButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
