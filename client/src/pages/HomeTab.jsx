import React, { useEffect, useState, useCallback } from 'react';
import client from '../api';
import { Calendar, MapPin, Clock, Shield, Filter, Trophy, Users, CheckCircle2, LayoutDashboard, ListFilter } from 'lucide-react';
import { EmptyState } from './AdminShared';
import { formatThaiDate, formatThaiTime } from '../utils';
import { useLanguage } from '../context/LanguageContext';

export default function HomeTab() {
    const { language } = useLanguage();

    const formatDate = (date) => {
        if (!date) return 'TBD';
        if (language === 'THA') {
            return formatThaiDate(date);
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'TBD';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

    return (
        <div className="space-y-6 font-sans">
            {/* Header section with Tournament selection */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2.5 text-gray-800">
                            <LayoutDashboard className="text-blue-600 w-7 h-7" /> {language === 'THA' ? 'แดชบอร์ดสรุปข้อมูลการแข่งขัน' : 'Competition Summary Dashboard'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 font-medium">
                            {language === 'THA' ? 'สรุปรายละเอียด สถิติ และสถานะภาพรวมของการแข่งขันแต่ละประเภท' : 'Summary of details, statistics, and overall status for each category.'}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                        {/* Select Tournament */}
                        <div className="w-full sm:w-64">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{language === 'THA' ? 'รายการแข่งขัน' : 'Tournament'}</label>
                            <select
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white text-gray-900 shadow-sm"
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{language === 'THA' ? 'ประเภทการแข่งขัน' : 'Category'}</label>
                            <div className="flex bg-gray-100/80 p-1 rounded-xl">
                                <button
                                    onClick={() => setFilterGender('All')}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${filterGender === 'All' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {language === 'THA' ? 'ทั้งหมด' : 'All'}
                                </button>
                                {availableGenders.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setFilterGender(g)}
                                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${filterGender === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {g === 'Male' ? (language === 'THA' ? 'ชาย' : 'Men') : g === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub tabs navigation */}
                <div className="flex gap-2 mt-6 border-t border-gray-100 pt-4">
                    <button
                        onClick={() => setCurrentSubTab('overview')}
                        className={`px-4 py-2 text-sm font-bold rounded-xl transition cursor-pointer ${currentSubTab === 'overview' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        {language === 'THA' ? 'ภาพรวมระบบ' : 'Overview'}
                    </button>
                    <button
                        onClick={() => setCurrentSubTab('schedule')}
                        className={`px-4 py-2 text-sm font-bold rounded-xl transition cursor-pointer ${currentSubTab === 'schedule' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        {language === 'THA' ? 'ตารางแข่งทั้งหมด' : 'Full Schedule'}
                    </button>
                </div>
            </div>

            {selectedCompetition ? (
                loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600 font-medium">{language === 'THA' ? 'กำลังโหลดข้อมูล...' : 'Loading data...'}</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        
                        {/* Stats Dashboard metrics cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Card 1: Tournament Info */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                                    <Trophy className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{language === 'THA' ? 'รายการแข่งขัน' : 'Tournament'}</p>
                                    <h4 className="text-base font-bold text-gray-800 line-clamp-1">{selectedBaseName}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{filterGender === 'All' ? (language === 'THA' ? 'ทุกประเภท' : 'All Categories') : (language === 'THA' ? `ประเภท ${filterGender === 'Male' ? 'ชาย' : 'หญิง'}` : `Category ${filterGender}`)}</p>
                                </div>
                            </div>

                            {/* Card 2: Total Teams */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{language === 'THA' ? 'ทีมทั้งหมด' : 'Total Teams'}</p>
                                    <h4 className="text-2xl font-black text-gray-800">{teams.length} <span className="text-sm font-semibold text-gray-500">{language === 'THA' ? 'ทีม' : 'Teams'}</span></h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{language === 'THA' ? 'ทีมสโมสรทั้งหมดที่เข้าร่วม' : 'Total participating club teams'}</p>
                                </div>
                            </div>

                            {/* Card 3: Total Matches */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{language === 'THA' ? 'แมตช์ทั้งหมด' : 'Total Matches'}</p>
                                    <h4 className="text-2xl font-black text-gray-800">{matches.length} <span className="text-sm font-semibold text-gray-500">{language === 'THA' ? 'แมตช์' : 'Matches'}</span></h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{language === 'THA' ? 'โปรแกรมแข่งขันทั้งหมด' : 'All scheduled matches'}</p>
                                </div>
                            </div>

                            {/* Card 4: Match Progress */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{language === 'THA' ? 'เสร็จสิ้นแล้ว' : 'Completed'}</p>
                                    <h4 className="text-2xl font-black text-gray-800">
                                        {completedCount} <span className="text-xs font-semibold text-gray-500">/ {matches.length} {language === 'THA' ? 'แมตช์' : 'Matches'}</span>
                                    </h4>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                        <div 
                                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                                            style={{ width: `${matches.length > 0 ? (completedCount / matches.length) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rendering content based on selected SubTab */}
                        {currentSubTab === 'overview' ? (
                            /* SubTab 1: Overview Dashboard Grid */
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                
                                {/* Column 1: Upcoming Matches */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
                                        <Clock className="text-blue-500 w-5 h-5" /> {language === 'THA' ? 'แมตช์ถัดไป' : 'Upcoming Matches'}
                                    </h3>
                                    {upcomingMatches.length > 0 ? (
                                        <div className="space-y-3.5">
                                            {upcomingMatches.map(match => (
                                                <div key={match.id} className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">Match #{match.match_number}</span>
                                                        <span className="text-xs text-gray-400 font-medium">{match.round_name}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between my-2 text-sm">
                                                        <div className="flex-1 font-bold text-gray-700 truncate text-left">
                                                            {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                        </div>
                                                        <span className="text-xs text-gray-400 font-bold px-2 shrink-0">VS</span>
                                                        <div className="flex-1 font-bold text-gray-700 truncate text-right">
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
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
                                        <Trophy className="text-emerald-500 w-5 h-5" /> {language === 'THA' ? 'ผลการแข่งขันล่าสุด' : 'Recent Results'}
                                    </h3>
                                    {recentMatches.length > 0 ? (
                                        <div className="space-y-3.5">
                                            {recentMatches.map(match => (
                                                <div key={match.id} className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">Match #{match.match_number}</span>
                                                        <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded">{language === 'THA' ? 'จบเกม' : 'Completed'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between my-2 text-sm">
                                                        <div className={`flex-1 font-bold truncate text-left ${Number(match.home_set_score) > Number(match.away_set_score) ? 'text-blue-600' : 'text-gray-600'}`}>
                                                            {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                        </div>
                                                        <div className="px-3 py-0.5 bg-gray-800 text-white rounded font-mono font-bold text-xs shrink-0 mx-2">
                                                            {match.home_set_score} - {match.away_set_score}
                                                        </div>
                                                        <div className={`flex-1 font-bold truncate text-right ${Number(match.away_set_score) > Number(match.home_set_score) ? 'text-blue-600' : 'text-gray-600'}`}>
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
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
                                        <Users className="text-indigo-500 w-5 h-5" /> {language === 'THA' ? `ทีมที่เข้าร่วมการแข่งขัน (${teams.length})` : `Participating Teams (${teams.length})`}
                                    </h3>
                                    {teams.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                            {teams.map(team => (
                                                <div key={team.id} className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-2.5 truncate hover:bg-gray-100/60 transition">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shrink-0 shadow-sm">
                                                        {team.logo_url ? (
                                                            <img src={team.logo_url} alt="Logo" className="w-full h-full object-contain p-0.5" />
                                                        ) : (
                                                            <Shield size={16} className="text-gray-300" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-gray-700 truncate leading-tight">{team.name}</p>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{team.code || 'CLUB'}</span>
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
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 mr-2 text-sm text-gray-500 font-semibold">
                                        <ListFilter size={16} className="text-gray-400" />
                                        <span>{language === 'THA' ? 'ตัวกรองสถานะ:' : 'Status Filter:'}</span>
                                    </div>
                                    <button
                                        onClick={() => setFilterStatus('all')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterStatus === 'all' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                                    >
                                        {language === 'THA' ? `แมตช์ทั้งหมด (${matches.length})` : `All Matches (${matches.length})`}
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('completed')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterStatus === 'completed' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                                    >
                                        {language === 'THA' ? `จบการแข่งขัน (${completedCount})` : `Completed (${completedCount})`}
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('scheduled')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterStatus === 'scheduled' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                                    >
                                        {language === 'THA' ? `รอดำเนินการ (${scheduledCount})` : `Scheduled (${scheduledCount})`}
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {filteredMatches.length > 0 ? (
                                        filteredMatches.map((match) => (
                                            <div key={match.id} className="group bg-white p-5 rounded-2xl border border-gray-100 transition-all hover:shadow-md hover:border-gray-200">
                                                <div className="flex flex-col md:flex-row items-center gap-6">
                                                    
                                                    {/* Left Match Details */}
                                                    <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-1.5 min-w-[120px] pb-3 md:pb-0 md:pr-6 border-b md:border-b-0 md:border-r border-gray-100 w-full md:w-auto justify-between md:justify-start">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">Match #{match.match_number}</span>
                                                            <div className="text-sm font-bold text-gray-800 mt-1">{match.round_name}</div>
                                                        </div>
                                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
                                                            match.gender === 'Female'
                                                                ? 'bg-pink-50 text-pink-600 border-pink-100'
                                                                : match.gender === 'Mix' || match.gender === 'Mixed'
                                                                    ? 'bg-purple-50 text-purple-600 border-purple-100'
                                                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                                        }`}>
                                                            {match.gender === 'Male' ? (language === 'THA' ? 'ชาย' : 'Men') : match.gender === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : match.gender}
                                                        </div>
                                                    </div>

                                                    {/* Center Teams Score */}
                                                    <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 w-full">
                                                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center md:justify-end gap-3 w-full">
                                                            <div className={`font-bold text-base md:text-lg leading-tight text-center md:text-right order-2 md:order-1 ${match.status === 'completed' && Number(match.home_set_score) > Number(match.away_set_score) ? 'text-blue-600 font-extrabold' : 'text-gray-700'}`}>
                                                                {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                            </div>
                                                            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-inner order-1 md:order-2 shrink-0">
                                                                {teams.find(t => t.id == match.home_team_id)?.logo_url ? (
                                                                    <img src={teams.find(t => t.id == match.home_team_id).logo_url} alt="Home" className="w-full h-full object-contain p-1" />
                                                                ) : <Shield size={20} className="text-gray-300" />}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-center shrink-0">
                                                            {(match.status === 'completed' || (match.home_set_score || 0) > 0 || (match.away_set_score || 0) > 0) ? (
                                                                <div className="flex flex-col items-center">
                                                                    <div className="px-4 py-1.5 rounded-xl bg-gray-800 text-white font-mono text-lg font-black tracking-widest mb-1 shadow-sm">
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
                                                                        <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-[9px] font-bold border border-green-100 whitespace-nowrap uppercase tracking-wider">
                                                                            {language === 'THA' ? 'จบการแข่งขัน' : 'Completed'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="px-3 py-1 rounded-lg bg-gray-50 border border-gray-100 font-mono text-xs font-bold text-gray-400">VS</div>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 w-full">
                                                            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-inner shrink-0">
                                                                {teams.find(t => t.id == match.away_team_id)?.logo_url ? (
                                                                    <img src={teams.find(t => t.id == match.away_team_id).logo_url} alt="Away" className="w-full h-full object-contain p-1" />
                                                                ) : <Shield size={20} className="text-gray-300" />}
                                                            </div>
                                                            <div className={`font-bold text-base md:text-lg leading-tight text-center md:text-left ${match.status === 'completed' && Number(match.away_set_score) > Number(match.home_set_score) ? 'text-blue-600 font-extrabold' : 'text-gray-700'}`}>
                                                                {teams.find(t => t.id == match.away_team_id)?.name || match.away_team || 'TBD'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Match Location & Date */}
                                                    <div className="flex flex-row md:flex-col gap-3 md:gap-1 text-xs text-gray-500 min-w-[160px] justify-center md:justify-end text-center md:text-right border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-6 w-full md:w-auto">
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5">
                                                            <Calendar size={13} className="text-indigo-400" />
                                                            {match.match_date ? formatDate(match.match_date) : (match.start_time && match.start_time.includes('T') ? formatDate(match.start_time) : (language === 'THA' ? 'ยังไม่กำหนดวันที่' : 'Date TBD'))}
                                                        </div>
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5">
                                                            <Clock size={13} className="text-indigo-400" />
                                                            {match.start_time
                                                                ? formatTime(match.start_time)
                                                                : (language === 'THA' ? 'ยังไม่กำหนดเวลา' : 'Time TBD')
                                                            }
                                                        </div>
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5"><MapPin size={13} className="text-indigo-400" /> {match.location || (language === 'THA' ? 'ยังไม่กำหนดสนาม' : 'Location TBD')}</div>
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
                <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
                    <EmptyState text={language === 'THA' ? "กรุณาเลือกทัวร์นาเมนต์การแข่งขันเพื่อเริ่มต้นแสดงสรุปข้อมูลแดชบอร์ด" : "Please select a tournament to view the dashboard summary"} />
                </div>
            )}
        </div>
    );
}

