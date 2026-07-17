import React, { useEffect, useState, useCallback } from 'react';
import client from '../api';
import { Calendar, MapPin, Clock, Shield, Filter, Trophy, Users, CheckCircle2, LayoutDashboard, ListFilter } from 'lucide-react';
import { EmptyState } from './AdminShared';
import { formatThaiDate, formatThaiTime } from '../utils';
import { useLanguage } from '../context/LanguageContext';

export default function HomeTab() {
    const { language } = useLanguage();

    const formatDate = (date) => {
        return formatThaiDate(date);
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return 'TBD';
        if (language === 'THA') {
            return formatThaiTime(timeStr);
        }
        if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
            return timeStr.substring(0, 5);
        }
        const d = new Date(timeStr);
        if (isNaN(d.getTime())) return 'TBD';
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const [competitions, setCompetitions] = useState([]);
    const [selectedCompetition, setSelectedCompetition] = useState(null);
    const [matches, setMatches] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');
    const [uniqueBaseNames, setUniqueBaseNames] = useState([]);
    const [selectedBaseName, setSelectedBaseName] = useState('');
    const [filterGender, setFilterGender] = useState('All');
    const [availableGenders, setAvailableGenders] = useState([]);
    const [currentSubTab, setCurrentSubTab] = useState('overview'); // 'overview' or 'schedule'

    const fetchCompetitions = useCallback(async () => {
        try {
            const res = await client.get('/admin/competitions');
            const openComps = res.data.filter(c => c.status?.toLowerCase() === 'open');
            setCompetitions(openComps);

            // Extract unique base names
            const bases = new Set();
            openComps.forEach(c => {
                const rawTitle = c.title || c.name || '';
                if (rawTitle) {
                    const base = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    bases.add(base);
                }
            });
            const sortedBases = Array.from(bases).sort();
            setUniqueBaseNames(sortedBases);

            if (sortedBases.length > 0) {
                setSelectedBaseName(sortedBases[0]);
            }
        } catch (err) { console.error(err); }
    }, []);


    const getCorrectImageUrl = (url) => {
        if (!url) return '';
        return url.replace('http://localhost:3000', 'https://volleyball-backent-dhtc.onrender.com');
    };

    const fetchMatchData = useCallback(async () => {
        if (!selectedBaseName) return;
        setLoading(true);
        try {
            let targetComps = [];
            if (filterGender === 'All') {
                targetComps = competitions.filter(c => {
                    const rawTitle = c.title || c.name || '';
                    const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    return cBase === selectedBaseName;
                });
            } else {
                const targetComp = competitions.find(c => {
                    const rawTitle = c.title || c.name || '';
                    const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    return cBase === selectedBaseName && c.gender === filterGender;
                });
                if (targetComp) targetComps = [targetComp];
            }

            if (targetComps.length === 0) {
                setMatches([]);
                setTeams([]);
                setSelectedCompetition(null);
                setLoading(false);
                return;
            }

            // Set selected competition (for UI/status checks)
            setSelectedCompetition(targetComps[0]);

            // Fetch from all target comps
            const matchPromises = targetComps.map(c => client.get(`/competitions/${c.id}/matches`));
            const teamPromises = targetComps.map(c => client.get(`/admin/competitions/${c.id}/teams`));

            const [matchRes, teamRes] = await Promise.all([
                Promise.all(matchPromises),
                Promise.all(teamPromises)
            ]);

            let allMatches = [];
            matchRes.forEach(r => { if (r.data) allMatches = [...allMatches, ...r.data]; });
            allMatches.sort((a, b) => (parseInt(a.match_number) || 0) - (parseInt(b.match_number) || 0));
            setMatches(allMatches);

            let allTeams = [];
            const teamIds = new Set();
            teamRes.forEach(r => {
                if (r.data) {
                    r.data.forEach(t => {
                        if (!teamIds.has(t.id)) {
                            teamIds.add(t.id);
                            allTeams.push(t);
                        }
                    });
                }
            });
            setTeams(allTeams);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [selectedBaseName, filterGender, competitions]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchCompetitions();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchCompetitions]);

    // Update available genders when base name changes
    useEffect(() => {
        if (selectedBaseName && competitions.length > 0) {
            const relatedComps = competitions.filter(c => {
                const rawTitle = c.title || c.name || '';
                const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                return cBase === selectedBaseName;
            });

            const genders = [...new Set(relatedComps.map(c => c.gender))].filter(Boolean).sort();

            const timeout = setTimeout(() => {
                setAvailableGenders(genders);

                if (filterGender !== 'All' && !genders.includes(filterGender)) {
                    setFilterGender('All');
                }
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [selectedBaseName, competitions, filterGender]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchMatchData();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchMatchData]);

    const filteredMatches = matches.filter(m => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'completed') return m.status === 'completed';
        if (filterStatus === 'scheduled') return m.status !== 'completed';
        return true;
    });

    const completedCount = matches.filter(m => m.status === 'completed').length;
    const scheduledCount = matches.filter(m => m.status !== 'completed').length;

    // Filtered lists for the dashboard tab
    const upcomingMatches = matches.filter(m => m.status !== 'completed').slice(0, 3);
    const recentMatches = matches.filter(m => m.status === 'completed').slice(-3).reverse();
    const panelClass = "rounded-lg border border-gray-200 bg-white";
    const cardClass = "rounded-lg border border-gray-200 bg-white p-4";
    const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";
    const selectClass = "w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
    const tabClass = "rounded-md px-3 py-2 text-sm font-medium transition";
    const activeTabClass = "bg-blue-600 text-white";
    const inactiveTabClass = "text-blue-700 hover:bg-blue-50";
    const metricIconClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500";
    const sectionTitleClass = "flex items-center gap-2 border-b border-gray-200 pb-3 text-sm font-semibold text-gray-900";

    return (
        <div className="space-y-5 font-sans text-gray-900">
            {/* Header section with Tournament selection */}
            <div className={`${panelClass} p-5`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                            <LayoutDashboard className="h-5 w-5 text-gray-500" /> {language === 'THA' ? 'แดชบอร์ดสรุปข้อมูลการแข่งขัน' : 'Competition Summary Dashboard'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {language === 'THA' ? 'สรุปรายละเอียด สถิติ และสถานะภาพรวมของการแข่งขันแต่ละประเภท' : 'Summary of details, statistics, and overall status for each category.'}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                        {/* Select Tournament */}
                        <div className="w-full sm:w-64">
                            <label className={labelClass}>{language === 'THA' ? 'รายการแข่งขัน' : 'Tournament'}</label>
                            <select
                                className={selectClass}
                                value={selectedBaseName}
                                onChange={(e) => setSelectedBaseName(e.target.value)}
                            >
                                {uniqueBaseNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Select Gender */}
                        <div>
                            <label className={labelClass}>{language === 'THA' ? 'ประเภทการแข่งขัน' : 'Category'}</label>
                            <div className="flex rounded-md border border-gray-200 bg-gray-50 p-1">
                                <button
                                    onClick={() => setFilterGender('All')}
                                    className={`rounded px-3 py-1.5 text-xs font-medium transition ${filterGender === 'All' ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-100'}`}
                                >
                                    {language === 'THA' ? 'ทั้งหมด' : 'All'}
                                </button>
                                {availableGenders.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setFilterGender(g)}
                                        className={`rounded px-3 py-1.5 text-xs font-medium transition ${filterGender === g ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-100'}`}
                                    >
                                        {g === 'Male' ? (language === 'THA' ? 'ชาย' : 'Men') : g === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub tabs navigation */}
                <div className="mt-5 flex gap-2 border-t border-gray-200 pt-4">
                    <button
                        onClick={() => setCurrentSubTab('overview')}
                        className={`${tabClass} ${currentSubTab === 'overview' ? activeTabClass : inactiveTabClass}`}
                    >
                        {language === 'THA' ? 'ภาพรวมระบบ' : 'Overview'}
                    </button>
                    <button
                        onClick={() => setCurrentSubTab('schedule')}
                        className={`${tabClass} ${currentSubTab === 'schedule' ? activeTabClass : inactiveTabClass}`}
                    >
                        {language === 'THA' ? 'ตารางแข่งทั้งหมด' : 'Full Schedule'}
                    </button>
                </div>
            </div>

            {selectedCompetition ? (
                loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-700"></div>
                        <span className="ml-3 text-sm text-gray-600">{language === 'THA' ? 'กำลังโหลดข้อมูล...' : 'Loading data...'}</span>
                    </div>
                ) : (
                    <div className="space-y-5">
                        
                        {/* Stats Dashboard metrics cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Card 1: Tournament Info */}
                            <div className={`${cardClass} flex items-center gap-3`}>
                                <div className={metricIconClass}>
                                    <Trophy className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-500">{language === 'THA' ? 'รายการแข่งขัน' : 'Tournament'}</p>
                                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{selectedBaseName}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{filterGender === 'All' ? (language === 'THA' ? 'ทุกประเภท' : 'All Categories') : (language === 'THA' ? `ประเภท ${filterGender === 'Male' ? 'ชาย' : 'หญิง'}` : `Category ${filterGender}`)}</p>
                                </div>
                            </div>

                            {/* Card 2: Total Teams */}
                            <div className={`${cardClass} flex items-center gap-3`}>
                                <div className={metricIconClass}>
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500">{language === 'THA' ? 'ทีมทั้งหมด' : 'Total Teams'}</p>
                                    <h4 className="text-xl font-semibold text-gray-900">{teams.length} <span className="text-sm font-normal text-gray-500">{language === 'THA' ? 'ทีม' : 'Teams'}</span></h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{language === 'THA' ? 'ทีมสโมสรทั้งหมดที่เข้าร่วม' : 'Total participating club teams'}</p>
                                </div>
                            </div>

                            {/* Card 3: Total Matches */}
                            <div className={`${cardClass} flex items-center gap-3`}>
                                <div className={metricIconClass}>
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500">{language === 'THA' ? 'แมตช์ทั้งหมด' : 'Total Matches'}</p>
                                    <h4 className="text-xl font-semibold text-gray-900">{matches.length} <span className="text-sm font-normal text-gray-500">{language === 'THA' ? 'แมตช์' : 'Matches'}</span></h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{language === 'THA' ? 'โปรแกรมแข่งขันทั้งหมด' : 'All scheduled matches'}</p>
                                </div>
                            </div>

                            {/* Card 4: Match Progress */}
                            <div className={`${cardClass} flex items-center gap-3`}>
                                <div className={metricIconClass}>
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-500">{language === 'THA' ? 'เสร็จสิ้นแล้ว' : 'Completed'}</p>
                                    <h4 className="text-xl font-semibold text-gray-900">
                                        {completedCount} <span className="text-xs font-normal text-gray-500">/ {matches.length} {language === 'THA' ? 'แมตช์' : 'Matches'}</span>
                                    </h4>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                        <div 
                                            className="bg-gray-700 h-1.5 rounded-full transition-all duration-500"
                                            style={{ width: `${matches.length > 0 ? (completedCount / matches.length) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rendering content based on selected SubTab */}
                        {currentSubTab === 'overview' ? (
                            /* SubTab 1: Overview Dashboard Grid */
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                
                                {/* Column 1: Upcoming Matches */}
                                <div className={`${panelClass} p-4 space-y-4`}>
                                    <h3 className={sectionTitleClass}>
                                        <Clock className="h-4 w-4 text-gray-500" /> {language === 'THA' ? 'แมตช์ถัดไป' : 'Upcoming Matches'}
                                    </h3>
                                    {upcomingMatches.length > 0 ? (
                                        <div className="space-y-3">
                                            {upcomingMatches.map(match => (
                                                <div key={match.id} className="rounded-md border border-gray-200 bg-gray-50 p-3 transition hover:bg-white">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">Match #{match.match_number}</span>
                                                        <span className="text-xs text-gray-500">{match.round_name}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between my-2 text-sm">
                                                        <div className="flex-1 font-medium text-gray-800 truncate text-left">
                                                            {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                        </div>
                                                        <span className="text-xs text-gray-400 font-medium px-2 shrink-0">VS</span>
                                                        <div className="flex-1 font-medium text-gray-800 truncate text-right">
                                                            {teams.find(t => t.id == match.away_team_id)?.name || match.away_team || 'TBD'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100/60 text-xs text-gray-500">
                                                        <Calendar size={12} className="text-gray-400" />
                                                        <span>{match.match_date ? formatDate(match.match_date) : (language === 'THA' ? 'ยังไม่กำหนดวันที่' : 'Date TBD')}</span>
                                                        <span className="text-gray-300">|</span>
                                                        <Clock size={12} className="text-gray-400" />
                                                        <span>{match.start_time ? formatTime(match.start_time) : (language === 'THA' ? 'ยังไม่กำหนดเวลา' : 'Time TBD')}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 text-center py-6">{language === 'THA' ? 'ไม่มีแมตช์ที่รอแข่งขัน' : 'No upcoming matches'}</p>
                                    )}
                                </div>

                                {/* Column 2: Recent Results */}
                                <div className={`${panelClass} p-4 space-y-4`}>
                                    <h3 className={sectionTitleClass}>
                                        <Trophy className="h-4 w-4 text-gray-500" /> {language === 'THA' ? 'ผลการแข่งขันล่าสุด' : 'Recent Results'}
                                    </h3>
                                    {recentMatches.length > 0 ? (
                                        <div className="space-y-3">
                                            {recentMatches.map(match => (
                                                <div key={match.id} className="rounded-md border border-gray-200 bg-gray-50 p-3 transition hover:bg-white">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">Match #{match.match_number}</span>
                                                        <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">{language === 'THA' ? 'จบเกม' : 'Completed'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between my-2 text-sm">
                                                        <div className={`flex-1 font-medium truncate text-left ${Number(match.home_set_score) > Number(match.away_set_score) ? 'text-gray-900' : 'text-gray-600'}`}>
                                                            {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                        </div>
                                                        <div className="px-3 py-0.5 bg-gray-900 text-white rounded font-mono font-semibold text-xs shrink-0 mx-2">
                                                            {match.home_set_score} - {match.away_set_score}
                                                        </div>
                                                        <div className={`flex-1 font-medium truncate text-right ${Number(match.away_set_score) > Number(match.home_set_score) ? 'text-gray-900' : 'text-gray-600'}`}>
                                                            {teams.find(t => t.id == match.away_team_id)?.name || match.away_team || 'TBD'}
                                                        </div>
                                                    </div>
                                                    {match.set_scores && (
                                                        <div className="text-[10px] text-gray-400 text-center font-mono mt-1 break-words">
                                                            Set: {(() => {
                                                                try {
                                                                    const sets = typeof match.set_scores === 'string' ? JSON.parse(match.set_scores) : (Array.isArray(match.set_scores) ? match.set_scores : null);
                                                                    return sets ? sets.join(', ') : null;
                                                                } catch { return match.set_scores; }
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 text-center py-6">{language === 'THA' ? 'ยังไม่มีแมตช์ที่บันทึกคะแนนสำเร็จ' : 'No recently completed matches'}</p>
                                    )}
                                </div>

                                {/* Column 3: Participating Teams */}
                                <div className={`${panelClass} p-4 space-y-4`}>
                                    <h3 className={sectionTitleClass}>
                                        <Users className="h-4 w-4 text-gray-500" /> {language === 'THA' ? `ทีมที่เข้าร่วมการแข่งขัน (${teams.length})` : `Participating Teams (${teams.length})`}
                                    </h3>
                                    {teams.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                            {teams.map(team => (
                                                <div key={team.id} className="p-2 bg-gray-50 border border-gray-200 rounded-md flex items-center gap-2.5 truncate hover:bg-white transition">
                                                    <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden border border-gray-200 shrink-0">
                                                        {team.logo_url ? (
                                                            <img src={getCorrectImageUrl(team.image_url)} alt="Logo" className="w-full h-full object-contain p-0.5" />
                                                        ) : (
                                                            <Shield size={16} className="text-gray-300" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-gray-800 truncate leading-tight">{team.name}</p>
                                                        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">{team.code || 'CLUB'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 text-center py-6">{language === 'THA' ? 'ไม่มีรายชื่อสโมสรในประเภทการแข่งขันนี้' : 'No club teams registered in this category'}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* SubTab 2: Full Match Schedule with Filters */
                            <div className="space-y-4">
                                <div className={`${panelClass} flex flex-wrap items-center gap-2 p-4`}>
                                    <div className="mr-2 flex items-center gap-2 text-sm font-medium text-gray-500">
                                        <ListFilter size={16} className="text-gray-400" />
                                        <span>{language === 'THA' ? 'ตัวกรองสถานะ:' : 'Status Filter:'}</span>
                                    </div>
                                    <button
                                        onClick={() => setFilterStatus('all')}
                                        className={`${tabClass} ${filterStatus === 'all' ? activeTabClass : inactiveTabClass}`}
                                    >
                                        {language === 'THA' ? `แมตช์ทั้งหมด (${matches.length})` : `All Matches (${matches.length})`}
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('completed')}
                                        className={`${tabClass} ${filterStatus === 'completed' ? activeTabClass : inactiveTabClass}`}
                                    >
                                        {language === 'THA' ? `จบการแข่งขัน (${completedCount})` : `Completed (${completedCount})`}
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('scheduled')}
                                        className={`${tabClass} ${filterStatus === 'scheduled' ? activeTabClass : inactiveTabClass}`}
                                    >
                                        {language === 'THA' ? `รอดำเนินการ (${scheduledCount})` : `Scheduled (${scheduledCount})`}
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {filteredMatches.length > 0 ? (
                                        filteredMatches.map((match) => (
                                            <div key={match.id} className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:bg-gray-50">
                                                <div className="flex flex-col md:flex-row items-center gap-6">
                                                    
                                                    {/* Left Match Details */}
                                                    <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-1.5 min-w-[120px] pb-3 md:pb-0 md:pr-6 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-auto justify-between md:justify-start">
                                                        <div>
                                                            <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">Match #{match.match_number}</span>
                                                            <div className="text-sm font-semibold text-gray-900 mt-1">{match.round_name}</div>
                                                        </div>
                                                        <div className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wide border ${
                                                            match.gender === 'Female'
                                                                ? 'bg-white text-gray-600 border-gray-200'
                                                                : match.gender === 'Mix' || match.gender === 'Mixed'
                                                                    ? 'bg-white text-gray-600 border-gray-200'
                                                                    : 'bg-white text-gray-600 border-gray-200'
                                                        }`}>
                                                            {match.gender === 'Male' ? (language === 'THA' ? 'ชาย' : 'Men') : match.gender === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : match.gender}
                                                        </div>
                                                    </div>

                                                    {/* Center Teams Score */}
                                                    <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 w-full">
                                                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center md:justify-end gap-3 w-full">
                                                            <div className={`font-medium text-base leading-tight text-center md:text-right order-2 md:order-1 ${match.status === 'completed' && Number(match.home_set_score) > Number(match.away_set_score) ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>
                                                                {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                            </div>
                                                            <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center overflow-hidden border border-gray-200 order-1 md:order-2 shrink-0">
                                                                {teams.find(t => t.id == match.home_team_id)?.logo_url ? (
                                                                    <img 
                                                                    src={getCorrectImageUrl(teams.find(t => t.id == match.home_team_id).logo_url)} 
                                                                    alt="Home" 
                                                                    className="w-full h-full object-contain p-1" 
                                                                    />
                                                                ) : (
                                                                    <Shield size={20} className="text-gray-300" />
                                                                )}
                                                                </div>
                                                        </div>

                                                        <div className="flex flex-col items-center shrink-0">
                                                            {(match.status === 'completed' || (match.home_set_score || 0) > 0 || (match.away_set_score || 0) > 0) ? (
                                                                <div className="flex flex-col items-center">
                                                                    <div className="px-4 py-1.5 rounded-md bg-gray-900 text-white font-mono text-base font-semibold tracking-wide mb-1">
                                                                        {match.home_set_score || 0} - {match.away_set_score || 0}
                                                                    </div>
                                                                    {match.set_scores && (
                                                                        <div className="text-[10px] font-mono text-gray-400 mb-1 max-w-[150px] text-center break-words">
                                                                            {(() => {
                                                                                try {
                                                                                    const sets = typeof match.set_scores === 'string' ? JSON.parse(match.set_scores) : (Array.isArray(match.set_scores) ? match.set_scores : null);
                                                                                    return sets ? sets.join(', ') : null;
                                                                                } catch { return match.set_scores; }
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                    {match.status === 'completed' && (
                                                                        <span className="px-2 py-0.5 rounded border border-gray-200 bg-white text-[9px] font-medium uppercase tracking-wide text-gray-600 whitespace-nowrap">
                                                                            {language === 'THA' ? 'จบการแข่งขัน' : 'Completed'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="px-3 py-1 rounded-md bg-gray-50 border border-gray-200 font-mono text-xs font-medium text-gray-400">VS</div>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 w-full">
                                                            <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center overflow-hidden border border-gray-200 order-1 md:order-2 shrink-0">
                                                                {teams.find(t => t.id == match.home_team_id)?.logo_url ? (
                                                                    <img 
                                                                    src={getCorrectImageUrl(teams.find(t => t.id == match.home_team_id).logo_url)} 
                                                                    alt="Home" 
                                                                    className="w-full h-full object-contain p-1" 
                                                                    />
                                                                ) : (
                                                                    <Shield size={20} className="text-gray-300" />
                                                                )}
                                                                </div>
                                                            <div className={`font-medium text-base leading-tight text-center md:text-left ${match.status === 'completed' && Number(match.away_set_score) > Number(match.home_set_score) ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>
                                                                {teams.find(t => t.id == match.away_team_id)?.name || match.away_team || 'TBD'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Match Location & Date */}
                                                    <div className="flex flex-row md:flex-col gap-3 md:gap-1 text-xs text-gray-500 min-w-[160px] justify-center md:justify-end text-center md:text-right border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-6 w-full md:w-auto">
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5">
                                                            <Calendar size={13} className="text-gray-400" />
                                                            {match.match_date ? formatDate(match.match_date) : (match.start_time && match.start_time.includes('T') ? formatDate(match.start_time) : (language === 'THA' ? 'ยังไม่กำหนดวันที่' : 'Date TBD'))}
                                                        </div>
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5">
                                                            <Clock size={13} className="text-gray-400" />
                                                            {match.start_time
                                                                ? formatTime(match.start_time)
                                                                : (language === 'THA' ? 'ยังไม่กำหนดเวลา' : 'Time TBD')
                                                            }
                                                        </div>
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5"><MapPin size={13} className="text-gray-400" /> {match.location || (language === 'THA' ? 'ยังไม่กำหนดสนาม' : 'Location TBD')}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <EmptyState text={language === 'THA' ? "ไม่พบแมตช์แข่งขันตรงตามเงื่อนไขที่เลือก" : "No matches found matching the selected filters"} />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            ) : (
                <div className={`${panelClass} p-10 text-center`}>
                    <EmptyState text={language === 'THA' ? "กรุณาเลือกทัวร์นาเมนต์การแข่งขันเพื่อเริ่มต้นแสดงสรุปข้อมูลแดชบอร์ด" : "Please select a tournament to view the dashboard summary"} />
                </div>
            )}
        </div>
    );
}
