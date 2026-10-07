import { Feedback } from '../../components/ui/SystemUI';
import { readViewPreference, writeViewPreference } from '../../utils/viewPreferences';
import PublicHeader from '../../components/PublicHeader';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api';
import { Calendar, Clock, MapPin, Trophy, Filter, Activity } from 'lucide-react';
import { formatThaiDate, formatThaiTime } from '../../utils';
import { useLanguage } from '../../context/LanguageContext';
import {
    findCompetitionGroupById,
    getPublicCompetitionVariantLabel,
    groupPublicCompetitions
} from '../../utils/publicCompetitionGrouping';

export default function PublicMatches() {
    const navigate = useNavigate();
    const { language, t } = useLanguage();
    const [competitions, setCompetitions] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [selectedComp, setSelectedComp] = useState('');
    useEffect(() => { if (selectedComp) writeViewPreference('publicCompetition', selectedComp); }, [selectedComp]);
    const [matches, setMatches] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(() => readViewPreference('matchStatus', 'all'));
    useEffect(() => { writeViewPreference('matchStatus', statusFilter); }, [statusFilter]);
    const [loading, setLoading] = useState(false);

    // 1. โหลดรายการแข่งขันใส่ Dropdown
    useEffect(() => {
        const fetchComps = async () => {
            try {
                const res = await client.get('/public/competitions');
                const openComps = res.data.filter(c => c.status?.toLowerCase() === 'open');
                setCompetitions(openComps);
                if (openComps.length > 0) {
                    const remembered = readViewPreference('publicCompetition');
                    setSelectedComp((openComps.find(item => String(item.id) === String(remembered)) || openComps[0]).id); // Default เลือกอันแรก
                }
            } catch (err) {
                console.error("Error fetching competitions:", err);
                setLoadError(true);
            }
        };
        fetchComps();
    }, [reloadKey]);

    // 2. โหลดแมตช์เมื่อเลือกรายการ
    useEffect(() => {
        const fetchMatches = async () => {
            setLoading(true);
            try {
                // ส่ง params competitionId ไป
                const url = selectedComp ? `/public/matches?competitionId=${selectedComp}` : '/public/matches';
                const res = await client.get(url);
                setMatches(res.data);
            } catch (err) {
                console.error("Error fetching matches:", err);
                setLoadError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchMatches();
    }, [selectedComp, reloadKey]);

    // ฟังก์ชันจัดกลุ่มแมตช์ตามวันที่ (Group by Date)
    const groupMatchesByDate = () => {
        const groups = {};
        matches.filter(match => {
            const status = String(match.status || '').toLowerCase();
            const finished = ['finished', 'completed', 'match_finished'].includes(status);
            const live = ['live', 'set_playing', 'in_progress'].includes(status);
            const matchesStatus = statusFilter === 'all' || (statusFilter === 'live' && live) || (statusFilter === 'finished' && finished) || (statusFilter === 'upcoming' && !live && !finished);
            return matchesStatus && [match.team_a_name, match.team_b_name, match.match_number, match.stadium_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase());
        }).forEach(match => {
            // แปลงวันที่เป็น String สวยๆ เช่น "วันพุธที่ 17 มี.ค. 2569" หรือ "Wednesday, 17 Mar 2026"
            const dateStr = formatThaiDate(match.match_date);

            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(match);
        });
        return groups;
    };

    const groupedMatches = groupMatchesByDate();
    const competitionGroups = useMemo(() => groupPublicCompetitions(competitions), [competitions]);
    const selectedCompetitionGroup = findCompetitionGroupById(competitionGroups, selectedComp);
    const normalizeStatus = (status) => String(status || '').toLowerCase();
    const isLive = (status) => ['live', 'set_playing', 'in_progress'].includes(normalizeStatus(status));
    const isFinished = (status) => ['finished', 'completed', 'match_finished'].includes(normalizeStatus(status));

    // Helper: Badge สถานะ
    const getStatusBadge = (status) => {
        switch (status) {
            case 'Finished':
            case 'COMPLETED':
            case 'completed':
            case 'finished':
            case 'MATCH_FINISHED':
                return <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-xl font-bold">{language === 'THA' ? 'จบการแข่งขัน' : 'Finished'}</span>;
            case 'LIVE':
            case 'live':
            case 'SET_PLAYING':
            case 'in_progress':
                return <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-xl font-bold animate-pulse">● {language === 'THA' ? 'กำลังแข่ง' : 'Live'}</span>;
            default:
                return <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-xl font-bold">{language === 'THA' ? 'ยังไม่เริ่ม' : 'Scheduled'}</span>;
        }
    };

    return (
        <div className="app-page min-h-screen pb-20 font-sans text-gray-800">
            {/* Navbar */}
            <PublicHeader />
            {loadError && <div className="mx-auto max-w-[1400px] px-4 py-4"><Feedback error title={language === 'THA' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Unable to load data'} onRetry={() => { setLoadError(false); setReloadKey(key => key + 1); }} retryLabel={language === 'THA' ? 'ลองใหม่' : 'Retry'} /></div>}
            <div id="main-content" tabIndex={-1} />

            {/* Header */}
            <div className="bg-[#122b52] text-white py-12 px-4 shadow-lg">
                <div className="w-full max-w-[1400px] mx-auto text-center px-4">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-4 flex items-center justify-center gap-3">
                        <Calendar size={36} /> {language === 'THA' ? 'ตารางและผลการแข่งขัน' : 'Match Schedule & Results'}
                    </h1>
                    <p className="text-indigo-200 text-lg">{language === 'THA' ? 'ติดตามโปรแกรมการแข่งขันและผลคะแนนสด' : 'Follow match schedules and live score results'}</p>
                </div>
            </div>

            {/* Filter Section */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 text-indigo-700 font-bold whitespace-nowrap">
                        <Trophy size={20} /> {language === 'THA' ? 'เลือกรายการ:' : 'Select Tournament:'}
                    </div>
                    <select
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 font-medium"
                        value={selectedComp ? (selectedCompetitionGroup?.key || '') : '__all__'}
                        onChange={(e) => {
                            if (e.target.value === '__all__') {
                                setSelectedComp('');
                                return;
                            }
                            const group = competitionGroups.find((item) => item.key === e.target.value);
                            setSelectedComp(group?.items[0]?.id || '');
                        }}
                    >
                        <option value="__all__">{language === 'THA' ? 'ทั้งหมด' : 'All competitions'}</option>
                        {competitionGroups.map((group) => (
                            <option key={group.key} value={group.key}>{group.title}</option>
                        ))}
                    </select>
                </div>
                {selectedComp && selectedCompetitionGroup?.items.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {selectedCompetitionGroup.items.map((competition) => (
                            <button
                                key={competition.id}
                                type="button"
                                onClick={() => setSelectedComp(competition.id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                    String(selectedComp) === String(competition.id)
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
                                }`}
                            >
                                {getPublicCompetitionVariantLabel(competition, language)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="mx-auto mt-5 grid max-w-[1400px] gap-3 px-4 sm:grid-cols-[1fr_auto] sm:px-6 lg:px-8">
                <label className="text-sm font-semibold text-slate-600">{language === 'THA' ? 'ค้นหาทีม คู่แข่งขัน หรือสนาม' : 'Search teams, matches or venues'}<input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal" placeholder={language === 'THA' ? 'พิมพ์คำค้นหา…' : 'Search…'} /></label>
                <label className="text-sm font-semibold text-slate-600">{language === 'THA' ? 'สถานะ' : 'Status'}<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal">{[['all', language === 'THA' ? 'ทั้งหมด' : 'All'], ['live', 'LIVE'], ['upcoming', language === 'THA' ? 'ยังไม่เริ่ม' : 'Upcoming'], ['finished', language === 'THA' ? 'จบแล้ว' : 'Finished']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            {/* Content */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                {loading ? (
                    <div className="text-center py-20 text-gray-500 animate-pulse">{t('common.loading')}</div>
                ) : Object.keys(groupedMatches).length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
                        <Activity size={48} className="mx-auto text-gray-300 mb-4"/>
                        <p className="text-gray-500 text-lg">{language === 'THA' ? (searchTerm || statusFilter !== 'all' ? 'ไม่พบคู่แข่งขันตามตัวกรองที่เลือก' : 'ยังไม่มีโปรแกรมการแข่งขันในรายการนี้') : (searchTerm || statusFilter !== 'all' ? 'No matches match these filters.' : 'No matches scheduled in this tournament yet.')}</p>
                    </div>
                ) : (
                    Object.keys(groupedMatches).map((dateKey, index) => (
                        <div key={index} className="mb-10 animate-fade-in-up">
                            {/* Date Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
                                <h3 className="text-xl font-bold text-gray-800">{dateKey}</h3>
                            </div>

                            {/* Match Cards Grid */}
                            <div className="grid grid-cols-1 gap-4">
                                {groupedMatches[dateKey].map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => navigate(`/match/${m.id}`)}
                                        className="bg-white/95 rounded-3xl shadow-sm border border-white overflow-hidden hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                                        {/* Card Header: Time & Stadium */}
                                        <div className="bg-gray-50 px-4 py-2 flex justify-between items-center text-sm text-gray-500 border-b border-gray-100">
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center gap-1 font-medium text-gray-700">
                                                    <Clock size={14} className="text-blue-600"/>
                                                    {language === 'THA' ? `${formatThaiTime(m.start_time)} น.` : m.start_time}
                                                </span>
                                                <span className="hidden sm:flex items-center gap-1">
                                                    <MapPin size={14}/> {m.stadium_name || (language === 'THA' ? 'สนามกีฬากลาง' : 'Central Stadium')}
                                                </span>
                                            </div>
                                            <div>{m.round_name}</div>
                                        </div>

                                        {/* Card Body: Teams & Score */}
                                        <div className="p-5">
                                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                                                {/* Team A */}
                                                <div className="flex-1 flex flex-col items-center md:items-end gap-2 text-center md:text-right w-full">
                                                    <img src={m.team_a_logo || "https://via.placeholder.com/60"} alt="Team A" className="w-16 h-16 object-contain" />
                                                    <div className="font-bold text-lg leading-tight">{m.team_a_name}</div>
                                                </div>

                                                {/* VS / Score */}
                                                <div className="flex flex-col items-center justify-center w-full md:w-auto min-w-[120px]">
                                                    {isFinished(m.status) || isLive(m.status) ? (
                                                        <div className="text-center">
                                                            <div className="text-3xl font-semibold text-gray-900 tracking-widest flex items-center justify-center gap-3">
                                                                <span className={m.team_a_score > m.team_b_score ? "text-blue-600" : "text-gray-400"}>{m.team_a_score}</span>
                                                                <span className="text-gray-300 text-xl">:</span>
                                                                <span className={m.team_b_score > m.team_a_score ? "text-blue-600" : "text-gray-400"}>{m.team_b_score}</span>
                                                            </div>
                                                            <div className="mt-2">{getStatusBadge(m.status)}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-2xl font-semibold text-gray-300">VS</span>
                                                            <div className="mt-2">{getStatusBadge(m.status)}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Team B */}
                                                <div className="flex-1 flex flex-col items-center md:items-start gap-2 text-center md:text-left w-full">
                                                    <img src={m.team_b_logo || "https://via.placeholder.com/60"} alt="Team B" className="w-16 h-16 object-contain" />
                                                    <div className="font-bold text-lg leading-tight">{m.team_b_name}</div>
                                                </div>

                                            </div>

                                            {/* Set Scores (ถ้ามีคะแนน) */}
                                            {(isFinished(m.status) || isLive(m.status)) && m.set_scores && m.set_scores.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center gap-2 text-sm text-gray-500 overflow-x-auto">
                                                    {m.set_scores.map((set, setIndex) => (
                                                        <div key={set.set_number ?? setIndex} className="px-2 py-1 bg-gray-50 rounded border border-gray-200 whitespace-nowrap min-w-[80px] text-center">
                                                            <div className="text-[10px] uppercase text-gray-400">Set {set.set_number ?? setIndex + 1}</div>
                                                            <div className="font-bold text-gray-800 text-base">
                                                                {typeof set === 'string' ? set : `${set.team_a ?? set.home ?? set.home_score ?? '—'} - ${set.team_b ?? set.away ?? set.away_score ?? '—'}`}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

