import { Feedback, Panel, StatusBadge } from '../components/ui/SystemUI';
import { readViewPreference, writeViewPreference } from '../utils/viewPreferences';
import { isMatchFinished, isMatchLive } from '../utils/standings';
import React, { useEffect, useState, useCallback } from 'react';
import client from '../api';
import { Calendar, MapPin, Clock, Shield, Filter, Trophy, Users, CheckCircle2, LayoutDashboard, ListFilter } from 'lucide-react';
import { EmptyState } from './AdminShared';
import { formatThaiDate, formatThaiTime } from '../utils';
import { useLanguage } from '../context/LanguageContext';

export default function HomeTab({ onNavigate, pendingUsersCount = 0 }) {
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
    const [selectedBaseName, setSelectedBaseName] = useState(() => readViewPreference('adminCompetition'));
    const [filterGender, setFilterGender] = useState(() => readViewPreference('adminGender', 'All'));
    const [loadError, setLoadError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    useEffect(() => { writeViewPreference('adminCompetition', selectedBaseName); }, [selectedBaseName]);
    useEffect(() => { writeViewPreference('adminGender', filterGender); }, [filterGender]);
    const [availableGenders, setAvailableGenders] = useState([]);
    const [currentSubTab, setCurrentSubTab] = useState('overview'); // 'overview' or 'schedule'

    const fetchCompetitions = useCallback(async () => {
        setLoadError(false);
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
                const remembered = readViewPreference('adminCompetition');
                setSelectedBaseName(sortedBases.includes(remembered) ? remembered : sortedBases[0]);
            }
        } catch (err) { console.error(err); setLoadError(true); }
    }, []);


    const getCorrectImageUrl = (url) => {
        if (!url) return '';
        return url;
    };

    const fetchMatchData = useCallback(async () => {
        if (!selectedBaseName) return;
        setLoading(true);
        setLoadError(false);
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
            setLoadError(true);
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

    const matchSearch = <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">{language === 'THA' ? 'ค้นหาทีม คู่แข่งขัน หรือสนาม' : 'Search teams, matches or venues'}<input type="search" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setCurrentSubTab('schedule'); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal" placeholder={language === 'THA' ? 'พิมพ์คำค้นหา…' : 'Search…'} /></label>;
    const filteredMatches = matches.filter(m => {
        if (searchTerm && ![m.home_team_name, m.away_team_name, m.team_a_name, m.team_b_name, m.match_number, m.stadium_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase())) return false;
        if (filterStatus === 'all') return true;
        if (filterStatus === 'completed') return isMatchFinished(m.status);
        if (filterStatus === 'scheduled') return !isMatchFinished(m.status);
        return true;
    });

    const completedCount = matches.filter(m => isMatchFinished(m.status)).length;
    const scheduledCount = matches.filter(m => !isMatchFinished(m.status)).length;

    // Filtered lists for the dashboard tab
    const upcomingMatches = matches.filter(m => !isMatchFinished(m.status)).slice(0, 3);
    const recentMatches = matches.filter(m => isMatchFinished(m.status)).slice(-3).reverse();
    const completionRate = matches.length > 0 ? Math.round((completedCount / matches.length) * 100) : 0;
    const panelClass = "ui-panel";
    const cardClass = "ui-panel p-4";
    const selectClass = "w-full rounded-md border border-slate-200 bg-white/95 px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
    const tabClass = "rounded-md px-3 py-2 text-sm font-semibold transition";
    const activeTabClass = "bg-blue-700 text-white shadow-sm shadow-blue-900/20";
    const inactiveTabClass = "text-slate-600 hover:bg-blue-50 hover:text-blue-700";
    const sectionTitleClass = "flex items-center gap-2 border-b border-slate-200/80 pb-3 text-sm font-semibold text-slate-950";
    const metricCards = [
        {
            key: 'tournament',
            icon: Trophy,
            tone: 'from-blue-600 to-sky-500',
            ring: 'bg-blue-50 text-blue-700 border-blue-100',
            label: language === 'THA' ? 'รายการแข่งขัน' : 'Tournament',
            value: selectedBaseName,
            valueClass: 'text-sm line-clamp-1',
            detail: filterGender === 'All'
                ? (language === 'THA' ? 'ทุกประเภท' : 'All Categories')
                : (language === 'THA' ? `ประเภท ${filterGender === 'Male' ? 'ชาย' : 'หญิง'}` : `Category ${filterGender}`)
        },
        {
            key: 'teams',
            icon: Users,
            tone: 'from-emerald-600 to-teal-500',
            ring: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            label: language === 'THA' ? 'ทีมทั้งหมด' : 'Total Teams',
            value: teams.length,
            suffix: language === 'THA' ? 'ทีม' : 'Teams',
            detail: language === 'THA' ? 'ทีมสโมสรทั้งหมดที่เข้าร่วม' : 'Total participating club teams'
        },
        {
            key: 'matches',
            icon: Calendar,
            tone: 'from-violet-600 to-fuchsia-500',
            ring: 'bg-violet-50 text-violet-700 border-violet-100',
            label: language === 'THA' ? 'แมตช์ทั้งหมด' : 'Total Matches',
            value: matches.length,
            suffix: language === 'THA' ? 'แมตช์' : 'Matches',
            detail: language === 'THA' ? 'โปรแกรมแข่งขันทั้งหมด' : 'All scheduled matches'
        },
        {
            key: 'completed',
            icon: CheckCircle2,
            tone: 'from-amber-500 to-orange-500',
            ring: 'bg-amber-50 text-amber-700 border-amber-100',
            label: language === 'THA' ? 'เสร็จสิ้นแล้ว' : 'Completed',
            value: completedCount,
            suffix: `/ ${matches.length} ${language === 'THA' ? 'แมตช์' : 'Matches'}`,
            detail: `${completionRate}% ${language === 'THA' ? 'ของโปรแกรมแข่งขัน' : 'of schedule complete'}`,
            progress: completionRate
        }
    ];

    return (
        <div className="space-y-5 font-sans text-slate-900">
            {loadError && <Feedback error title={language === 'THA' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Unable to load dashboard'} onRetry={async () => { await fetchCompetitions(); await fetchMatchData(); }} />}
            <Panel title={language === 'THA' ? 'งานที่ต้องดูแล' : 'Your next actions'} description={language === 'THA' ? 'ตรวจสอบสิ่งที่ต้องดำเนินการ ก่อนเริ่มการแข่งขัน' : 'Keep competition preparations on track.'} action={<StatusBadge tone="info">{language === 'THA' ? 'ภาพรวม' : 'Overview'}</StatusBadge>}>
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                    {[{ key: 'pending_users', count: pendingUsersCount, label: language === 'THA' ? 'บัญชีรออนุมัติ' : 'Pending accounts' }, { key: 'matches', count: matches.filter(m => !isMatchFinished(m.status) && !m.stadium_id && !m.stadium_name && !m.location).length, label: language === 'THA' ? 'คู่ที่ยังไม่ระบุสนาม' : 'Matches without a venue' }, { key: 'escore', count: matches.filter(m => isMatchLive(m.status)).length, label: language === 'THA' ? 'คู่ที่กำลังแข่งขัน' : 'Live matches' }].map(task => <button key={task.key} onClick={() => onNavigate?.(task.key)} className="flex min-h-24 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"><span className="text-sm font-semibold text-slate-600">{task.label}</span><span className="score-number text-3xl font-bold text-slate-950">{task.count}</span></button>)}
                </div>
            </Panel>
            <div className="max-w-md">{matchSearch}</div>
            {/* Header section with Tournament selection */}
            <div className={`${panelClass} overflow-hidden`}>
                <div className="border-b border-white/60 bg-[#122b52] px-5 py-5 text-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            {language === 'THA' ? 'ศูนย์ควบคุมการแข่งขัน' : 'Competition Control'}
                        </div>
                        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
                            {language === 'THA' ? 'แดชบอร์ดสรุปข้อมูลการแข่งขัน' : 'Competition Summary Dashboard'}
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm text-blue-100">
                            {language === 'THA' ? 'สรุปรายละเอียด สถิติ และสถานะภาพรวมของการแข่งขันแต่ละประเภท' : 'Summary of details, statistics, and overall status for each category.'}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                        {/* Select Tournament */}
                        <div className="w-full sm:w-64">
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-100"><Filter size={13} />{language === 'THA' ? 'รายการแข่งขัน' : 'Tournament'}</label>
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
                            <label className="mb-1.5 block text-xs font-semibold text-blue-100">{language === 'THA' ? 'ประเภทการแข่งขัน' : 'Category'}</label>
                            <div className="flex rounded-md border border-white/20 bg-white/10 p-1 backdrop-blur">
                                <button
                                    onClick={() => setFilterGender('All')}
                                    className={`rounded px-3 py-1.5 text-xs font-semibold transition ${filterGender === 'All' ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-50 hover:bg-white/10'}`}
                                >
                                    {language === 'THA' ? 'ทั้งหมด' : 'All'}
                                </button>
                                {availableGenders.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setFilterGender(g)}
                                        className={`rounded px-3 py-1.5 text-xs font-semibold transition ${filterGender === g ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-50 hover:bg-white/10'}`}
                                    >
                                        {g === 'Male' ? (language === 'THA' ? 'ชาย' : 'Men') : g === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

                {/* Sub tabs navigation */}
                <div className="flex gap-2 px-5 py-4">
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
                            {metricCards.map((metric) => {
                                const Icon = metric.icon;
                                return (
                                    <div key={metric.key} className={`${cardClass} relative overflow-hidden`}>
                                        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${metric.tone}`} />
                                        <div className="flex items-start gap-3">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${metric.ring}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                                                <h4 className={`mt-0.5 font-semibold text-slate-950 ${metric.valueClass || 'text-2xl'}`}>
                                                    {metric.value} {metric.suffix && <span className="text-xs font-medium text-slate-500">{metric.suffix}</span>}
                                                </h4>
                                                <p className="mt-0.5 text-xs text-slate-500">{metric.detail}</p>
                                                {metric.progress !== undefined && (
                                                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                                                        <div
                                                            className={`h-1.5 rounded-full bg-gradient-to-r ${metric.tone} transition-all duration-500`}
                                                            style={{ width: `${metric.progress}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Rendering content based on selected SubTab */}
                        {currentSubTab === 'overview' ? (
                            /* SubTab 1: Overview Dashboard Grid */
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                
                                {/* Column 1: Upcoming Matches */}
                                <div className={`${panelClass} overflow-hidden p-4 space-y-4`}>
                                    <h3 className={sectionTitleClass}>
                                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700"><Clock className="h-4 w-4" /></span> {language === 'THA' ? 'แมตช์ถัดไป' : 'Upcoming Matches'}
                                    </h3>
                                    {upcomingMatches.length > 0 ? (
                                        <div className="space-y-3">
                                            {upcomingMatches.map(match => (
                                                <div key={match.id} className="rounded-md border border-blue-100 bg-blue-50/50 p-3 transition hover:border-blue-200 hover:bg-white">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="rounded border border-blue-100 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Match #{match.match_number}</span>
                                                        <span className="text-xs font-medium text-slate-500">{match.round_name}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between my-2 text-sm">
                                                        <div className="flex-1 font-medium text-gray-800 truncate text-left">
                                                            {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                        </div>
                                                        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-blue-500 shadow-sm shrink-0">VS</span>
                                                        <div className="flex-1 font-medium text-gray-800 truncate text-right">
                                                            {teams.find(t => t.id == match.away_team_id)?.name || match.away_team || 'TBD'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-100/70 text-xs text-slate-500">
                                                        <Calendar size={12} className="text-blue-400" />
                                                        <span>{match.match_date ? formatDate(match.match_date) : (language === 'THA' ? 'ยังไม่กำหนดวันที่' : 'Date TBD')}</span>
                                                        <span className="text-blue-200">|</span>
                                                        <Clock size={12} className="text-blue-400" />
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
                                <div className={`${panelClass} overflow-hidden p-4 space-y-4`}>
                                    <h3 className={sectionTitleClass}>
                                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700"><Trophy className="h-4 w-4" /></span> {language === 'THA' ? 'ผลการแข่งขันล่าสุด' : 'Recent Results'}
                                    </h3>
                                    {recentMatches.length > 0 ? (
                                        <div className="space-y-3">
                                            {recentMatches.map(match => (
                                                <div key={match.id} className="rounded-md border border-amber-100 bg-amber-50/45 p-3 transition hover:border-amber-200 hover:bg-white">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="rounded border border-amber-100 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Match #{match.match_number}</span>
                                                        <span className="rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{language === 'THA' ? 'จบเกม' : 'Completed'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between my-2 text-sm">
                                                        <div className={`flex-1 font-medium truncate text-left ${Number(match.home_set_score) > Number(match.away_set_score) ? 'text-gray-900' : 'text-gray-600'}`}>
                                                            {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                        </div>
                                                        <div className="px-3 py-0.5 bg-slate-950 text-white rounded font-mono font-semibold text-xs shadow-sm shrink-0 mx-2">
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
                                <div className={`${panelClass} overflow-hidden p-4 space-y-4`}>
                                    <h3 className={sectionTitleClass}>
                                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><Users className="h-4 w-4" /></span> {language === 'THA' ? `ทีมที่เข้าร่วมการแข่งขัน (${teams.length})` : `Participating Teams (${teams.length})`}
                                    </h3>
                                    {teams.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                            {teams.map(team => (
                                                <div key={team.id} className="p-2 bg-emerald-50/35 border border-emerald-100 rounded-md flex items-center gap-2.5 truncate hover:bg-white transition">
                                                    <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden border border-emerald-100 shrink-0">
                                                        {team.logo_url ? (
                                                            <img src={getCorrectImageUrl(team.logo_url)} alt="Logo" className="w-full h-full object-contain p-0.5" />
                                                        ) : (
                                                            <Shield size={16} className="text-emerald-300" />
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
                                            <div key={match.id} className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5 transition hover:border-blue-200 hover:shadow-md">
                                                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-5">
                                                    
                                                    {/* Left Match Details */}
                                                    <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-2 min-w-[132px] pb-4 md:pb-0 md:pr-5 border-b md:border-b-0 md:border-r border-slate-200 w-full md:w-auto justify-between md:justify-center">
                                                        <div>
                                                            <span className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Match #{match.match_number}</span>
                                                            <div className="mt-2 text-sm font-semibold text-slate-950">{match.round_name}</div>
                                                        </div>
                                                        <div className={`rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-wide border ${
                                                            match.gender === 'Female'
                                                                ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                                : match.gender === 'Mix' || match.gender === 'Mixed'
                                                                    ? 'bg-violet-50 text-violet-700 border-violet-100'
                                                                    : 'bg-sky-50 text-sky-700 border-sky-100'
                                                        }`}>
                                                            {match.gender === 'Male' ? (language === 'THA' ? 'ชาย' : 'Men') : match.gender === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : match.gender}
                                                        </div>
                                                    </div>

                                                    {/* Center Teams Score */}
                                                    <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 w-full">
                                                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center md:justify-end gap-3 w-full min-w-0">
                                                            <div className={`font-semibold text-base leading-snug text-center md:text-right order-2 md:order-1 min-w-0 ${match.status === 'completed' && Number(match.home_set_score) > Number(match.away_set_score) ? 'text-slate-950' : 'text-slate-700'}`}>
                                                                {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                            </div>
                                                            <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-slate-200 order-1 md:order-2 shrink-0 shadow-sm">
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
                                                                    <div className="mb-1 rounded-lg bg-slate-950 px-4 py-2 text-white font-mono text-base font-bold tracking-wide shadow-sm">
                                                                        {match.home_set_score || 0} - {match.away_set_score || 0}
                                                                    </div>
                                                                    {match.set_scores && (
                                                                        <div className="mb-1 max-w-[150px] break-words text-center font-mono text-[10px] text-slate-400">
                                                                            {(() => {
                                                                                try {
                                                                                    const sets = typeof match.set_scores === 'string' ? JSON.parse(match.set_scores) : (Array.isArray(match.set_scores) ? match.set_scores : null);
                                                                                    return sets ? sets.join(', ') : null;
                                                                                } catch { return match.set_scores; }
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                    {match.status === 'completed' && (
                                                                        <span className="whitespace-nowrap rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                                                                            {language === 'THA' ? 'จบการแข่งขัน' : 'Completed'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-400">VS</div>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 w-full min-w-0">
                                                            <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-slate-200 order-1 shrink-0 shadow-sm">
                                                                {teams.find(t => t.id == match.away_team_id)?.logo_url ? (
                                                                    <img 
                                                                    src={getCorrectImageUrl(teams.find(t => t.id == match.away_team_id).logo_url)} 
                                                                    alt="Away" 
                                                                    className="w-full h-full object-contain p-1" 
                                                                    />
                                                                ) : (
                                                                    <Shield size={20} className="text-gray-300" />
                                                                )}
                                                                </div>
                                                            <div className={`font-semibold text-base leading-snug text-center md:text-left order-2 min-w-0 ${match.status === 'completed' && Number(match.away_set_score) > Number(match.home_set_score) ? 'text-slate-950' : 'text-slate-700'}`}>
                                                                {teams.find(t => t.id == match.away_team_id)?.name || match.away_team || 'TBD'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Match Location & Date */}
                                                    <div className="flex flex-row flex-wrap md:flex-col gap-2 text-xs text-slate-500 min-w-[178px] justify-center md:justify-center text-center md:text-right border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-5 w-full md:w-auto">
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 md:bg-transparent md:px-0 md:py-0">
                                                            <Calendar size={13} className="text-blue-500" />
                                                            {match.match_date ? formatDate(match.match_date) : (match.start_time && match.start_time.includes('T') ? formatDate(match.start_time) : (language === 'THA' ? 'ยังไม่กำหนดวันที่' : 'Date TBD'))}
                                                        </div>
                                                        <div className="flex items-center justify-center md:justify-end gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 md:bg-transparent md:px-0 md:py-0">
                                                            <Clock size={13} className="text-blue-500" />
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
