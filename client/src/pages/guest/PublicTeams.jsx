import { Feedback } from '../../components/ui/SystemUI';
import { readViewPreference, writeViewPreference } from '../../utils/viewPreferences';
import PublicHeader from '../../components/PublicHeader';
import React, { useEffect, useState } from 'react';
import client from '../../api';
import { Users, ArrowLeft, Filter, Trophy, X, BarChart2, Activity, Shield, Swords } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { cleanCompetitionTitle } from '../../utils';
import {
    getPublicAgeGroupLabel,
    getPublicCompetitionVariantLabel
} from '../../utils/publicCompetitionGrouping';

export default function PublicTeams() {

    const { language, t } = useLanguage();
    // --- State ---
    const [groupedComps, setGroupedComps] = useState({}); // เก็บข้อมูลที่จัดกลุ่มแล้ว { "ชื่อรายการ": { Men: id, Women: id } }
    const [compTitles, setCompTitles] = useState([]);     // รายชื่อรายการ (Unique)
    
    const [selectedTitle, setSelectedTitle] = useState(() => readViewPreference('teamCompetition'));
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [teamSearch, setTeamSearch] = useState('');
    const [selectedVariantKey, setSelectedVariantKey] = useState(''); // ชื่อรายการที่เลือก
    const [selectedGender, setSelectedGender] = useState(() => readViewPreference('teamGender', 'All'));
    useEffect(() => { writeViewPreference('teamCompetition', selectedTitle); }, [selectedTitle]);
    useEffect(() => { writeViewPreference('teamGender', selectedGender); }, [selectedGender]); // เพศที่เลือก (Men/Women/All)
    
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [players, setPlayers] = useState([]);
    
    const [viewingPlayer, setViewingPlayer] = useState(null);
    const [playerStats, setPlayerStats] = useState(null);
    
    const [loading, setLoading] = useState(false);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // 1. โหลดรายการแข่งขัน และ จัดกลุ่ม (Grouping)
    useEffect(() => {
        const fetchComps = async () => {
            try {
                const res = await client.get('/public/competitions');
                const rawData = res.data.filter(c => c.status?.toLowerCase() === 'open');

                // Logic การจัดกลุ่มตามชื่อ
                const groups = {};
                
                rawData.forEach(comp => {
                    // ตัดคำต่อท้ายเช่น (Men), (Women), (Male), (Female) ออกเพื่อให้เหลือแค่ชื่อรายการ
                    // Regex นี้จะลบวงเล็บและคำระบุเพศข้างใน
                    const baseTitle = cleanCompetitionTitle(comp.title);
                    const ageGroup = getPublicAgeGroupLabel(comp);
                    const variantKey = ageGroup || '__all__';
                    
                    if (!groups[baseTitle]) {
                        groups[baseTitle] = { variants: {} };
                    }
                    if (!groups[baseTitle].variants[variantKey]) {
                        groups[baseTitle].variants[variantKey] = {
                            label: ageGroup || (language === 'THA' ? 'ทุกรุ่น' : 'All age groups')
                        };
                    }
                    
                    // map gender ของ API ให้เป็น Key มาตรฐาน
                    const genderText = String(comp.gender || '').toLowerCase();
                    let genderKey = 'Men';
                    if (['women', 'woman', 'female', 'f', 'หญิง'].includes(genderText)) genderKey = 'Women';
                    if (['mixed', 'mix', 'ผสม'].includes(genderText)) genderKey = 'Mixed';
                    
                    groups[baseTitle].variants[variantKey][genderKey] = comp.id;
                    groups[baseTitle].variants[variantKey][`${genderKey}Label`] = getPublicCompetitionVariantLabel(comp, language);
                });

                setGroupedComps(groups);
                const titles = Object.keys(groups);
                setCompTitles(titles);

                // Default เลือกรายการแรก
                if (titles.length > 0) {
                    setSelectedTitle(titles[0]);
                    setSelectedVariantKey(Object.keys(groups[titles[0]].variants)[0] || '');
                }

            } catch (err) {
                console.error("Error fetching competitions:", err);
                setLoadError(true);
            }
        };
        fetchComps();
    }, [language, reloadKey]);

    // 2. ตรวจสอบว่า ID ของการแข่งขันคืออะไร (ตาม Title และ Gender ที่เลือก)
    useEffect(() => {
        if (!selectedTitle || !groupedComps[selectedTitle]) return;

        // หา ID จากกลุ่มข้อมูล
        const variants = groupedComps[selectedTitle].variants || {};
        const variantKeys = Object.keys(variants);
        const activeVariantKey = selectedVariantKey && variants[selectedVariantKey] ? selectedVariantKey : variantKeys[0];
        const compIdsMap = variants[activeVariantKey] || {};
        let targetIds = [];

        if (selectedGender === 'All') {
            targetIds = ['Men', 'Women', 'Mixed']
                .map((genderKey) => compIdsMap[genderKey])
                .filter((id) => id !== undefined && id !== null && id !== '');
        } else if (compIdsMap[selectedGender]) {
            targetIds = [compIdsMap[selectedGender]];
        }

        if (targetIds.length > 0) {
            fetchTeams(targetIds);
        } else {
            // ถ้าเลือกเพศนี้แล้วไม่มีรายการ (เช่น รายการนี้มีแค่ทีมหญิง)
            setTeams([]); 
        }
        
        // รีเซ็ตทีมที่เลือกค้างไว้
        setSelectedTeam(null); 

    }, [selectedTitle, selectedVariantKey, selectedGender, groupedComps]);


    // ฟังก์ชันดึงทีม
    const fetchTeams = async (compIds) => {
        setLoading(true);
        try {
            const ids = Array.isArray(compIds) ? compIds : [compIds];
            const promises = ids.map(id => client.get(`/public/competitions/${id}/teams`));
            const results = await Promise.all(promises);
            const allTeams = results.flatMap(res => res.data);
            setTeams(allTeams);
        } catch (err) {
            console.error("Error fetching teams:", err);
                setLoadError(true);
            setTeams([]);
        } finally {
            setLoading(false);
        }
    };

    // 3. โหลดนักกีฬา เมื่อเลือกทีม
    useEffect(() => {
        if (!selectedTeam) return;

        const fetchPlayers = async () => {
            setLoadingPlayers(true);
            try {
                const competitionId = selectedTeam.competition_id || '';
                const query = competitionId ? `?competitionId=${competitionId}` : '';
                const res = await client.get(`/public/teams/${selectedTeam.id}/players${query}`);
                setPlayers(res.data);
            } catch (err) {
                console.error("Error fetching players:", err);
                setLoadError(true);
            } finally {
                setLoadingPlayers(false);
            }
        };
        fetchPlayers();
    }, [selectedTeam, reloadKey]);

    const handleViewPlayerStats = async (player) => {
        setViewingPlayer(player);
        setPlayerStats(null);
        try {
            const res = await client.get(`/public/players/${player.id}/stats`);
            setPlayerStats(res.data);
        } catch (err) {
            console.error("Error fetching player stats:", err);
                setLoadError(true);
        }
    };

    // ฟังก์ชันคำนวณอายุ
    const calculateAge = (birthDate) => {
        if (!birthDate) return '-';
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) {
            age--;
        }
        return age;
    };

    // ตรวจสอบว่ารายการที่เลือก มีเพศไหนให้เลือกบ้าง (เพื่อ Disable ปุ่ม)
    const selectedVariants = selectedTitle && groupedComps[selectedTitle] ? groupedComps[selectedTitle].variants || {} : {};
    const selectedVariantKeys = Object.keys(selectedVariants);
    const selectedVariant = selectedVariants[selectedVariantKey] || selectedVariants[selectedVariantKeys[0]] || {};
    const availableGenders = Object.keys(selectedVariant).filter((key) => ['Men', 'Women', 'Mixed'].includes(key));
    const normalizeText = (value) => {
        if (value === null || value === undefined) return '';
        const text = String(value).trim();
        return text === '0' ? '' : text;
    };
    const getPlayerName = (player) => [normalizeText(player.first_name), normalizeText(player.last_name)].filter(Boolean).join(' ') || '-';
    const getLiberoBadge = (player) => {
        const role = String(player.role || player.position || '').trim().toUpperCase();
        if (Number(player.is_libero1) === 1 || player.is_libero1 === true || role === 'L1') return 'L1';
        if (Number(player.is_libero2) === 1 || player.is_libero2 === true || role === 'L2') return 'L2';
        if (role === 'L' || role === 'LIBERO') return 'L';
        return '';
    };

    return (
        <div className="app-page min-h-screen text-gray-800 pb-20 font-sans">
            {/* Navbar (คงเดิมไว้) */}
            <PublicHeader />
            {loadError && <div className="mx-auto max-w-[1400px] px-4 py-4"><Feedback error title={language === 'THA' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Unable to load data'} onRetry={() => { setLoadError(false); setReloadKey(key => key + 1); }} /></div>}
            <div id="main-content" tabIndex={-1} />

            {/* ✅ LOGIC: ถ้ายังไม่เลือกทีม ให้แสดง Header + Grid */}
            {!selectedTeam ? (
                <>
                    {/* --- Header Section (แสดงเฉพาะตอนเลือกรายการ) --- */}
                    <div className="bg-[#122b52] text-white py-10 px-4 shadow-lg mb-6">
                        <div className="w-full max-w-[1400px] mx-auto">
                            <h1 className="text-3xl font-extrabold flex items-center gap-3 mb-6">
                                <Users className="text-yellow-400" size={32} /> {t('guestTeams.title')}
                            </h1>
                            
                            <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm border border-white/10 shadow-inner">
                                <div className="flex flex-col md:flex-row gap-6 items-end">
                                    {/* 1. Competition Dropdown */}
                                    <div className="flex-1 w-full">
                                        <label className="text-sm font-bold text-indigo-200 mb-2 flex items-center gap-2">
                                            <Trophy size={16}/> {t('guestTeams.selectTournament')}
                                        </label>
                                        <select 
                                            value={selectedTitle}
                                            onChange={(e) => {
                                                const nextTitle = e.target.value;
                                                const nextVariants = groupedComps[nextTitle]?.variants || {};
                                                const nextVariantKey = Object.keys(nextVariants)[0] || '';
                                                setSelectedTitle(nextTitle);
                                                setSelectedVariantKey(nextVariantKey);
                                                setSelectedGender('All');
                                            }}
                                            className="w-full bg-white text-gray-900 border-none rounded-xl py-3 px-4 focus:ring-4 focus:ring-yellow-400/50 shadow-lg font-medium text-lg"
                                        >
                                            {compTitles.length === 0 ? (
                                                <option>{t('common.noData')}</option>
                                            ) : (
                                                compTitles.map((title, index) => (
                                                    <option key={index} value={title}>{title}</option>
                                                ))
                                            )}
                                        </select>
                                        {selectedVariantKeys.length > 1 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {selectedVariantKeys.map((variantKey) => (
                                                    <button
                                                        key={variantKey}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedVariantKey(variantKey);
                                                            setSelectedGender('All');
                                                        }}
                                                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                                            selectedVariantKey === variantKey
                                                                ? 'border-yellow-300 bg-yellow-400 text-indigo-950'
                                                                : 'border-white/20 bg-white/10 text-indigo-100 hover:bg-white/20'
                                                        }`}
                                                    >
                                                        {selectedVariants[variantKey]?.label || variantKey}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Gender Selection */}
                                    <div className="w-full md:w-auto">
                                        <label className="text-sm font-bold text-indigo-200 mb-2 flex items-center gap-2">
                                            <Filter size={16}/> {t('guestTeams.category')}
                                        </label>
                                        <div className="bg-indigo-800 p-1 rounded-xl flex shadow-inner">
                                            {['All', 'Men', 'Women', 'Mixed'].map((gender) => {
                                                const isActive = selectedGender === gender;
                                                const isDisabled = gender !== 'All' && !availableGenders.includes(gender);
                                                
                                                let label = gender;
                                                if (gender === 'All') label = t('guestTeams.allCategory');
                                                else if (gender === 'Men') label = t('guestTeams.menCategory');
                                                else if (gender === 'Women') label = t('guestTeams.womenCategory');
                                                else if (gender === 'Mixed') label = language === 'THA' ? 'ผสม' : 'Mixed';

                                                return (
                                                    <button
                                                        key={gender}
                                                        onClick={() => !isDisabled && setSelectedGender(gender)}
                                                        disabled={isDisabled}
                                                        className={`
                                                            px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2
                                                            ${isActive 
                                                                ? 'bg-yellow-400 text-indigo-900 shadow-md transform scale-105' 
                                                                : 'text-indigo-300 hover:bg-white/5'
                                                            }
                                                            ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                                                        `}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full max-w-[1400px] mx-auto px-4">
                        {/* --- ส่วนแสดงรายชื่อทีม (Grid) --- */}
                        <label className="mb-5 block max-w-md text-sm font-semibold text-slate-600">{language === 'THA' ? 'ค้นหาทีม' : 'Search teams'}<input type="search" value={teamSearch} onChange={event => setTeamSearch(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal" placeholder={language === 'THA' ? 'ชื่อทีม…' : 'Team name…'} /></label>
                        {loading ? (
                            <div className="text-center py-20 flex flex-col items-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-900 mb-4"></div>
                                <p className="text-gray-500 font-medium">{t('guestTeams.loading')}</p>
                            </div>
                        ) : teams.filter(team => String(team.name || '').toLocaleLowerCase().includes(teamSearch.toLocaleLowerCase())).length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                                <Users size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500 text-lg">
                                    {teamSearch ? (language === 'THA' ? 'ไม่พบทีมตามคำค้นหา' : 'No teams match your search.') : t('guestTeams.noTeams')}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
                                {teams.filter(team => String(team.name || '').toLocaleLowerCase().includes(teamSearch.toLocaleLowerCase())).map((team) => (
                                    <button 
                                        key={team.team_entry_id || `${team.id}-${team.competition_id}`} 
                                        onClick={() => setSelectedTeam(team)}
                                        className="bg-white/95 rounded-2xl shadow-sm hover:shadow-2xl hover:-translate-y-1 cursor-pointer transition-all duration-300 border border-white overflow-hidden group flex flex-col h-full text-left"
                                    >
                                        <div className={`h-2 w-full transition-colors ${selectedGender === 'Men' ? 'bg-blue-500' : selectedGender === 'Women' ? 'bg-pink-500' : 'bg-gradient-to-r from-blue-500 to-pink-500'}`}></div>
                                        <div className="p-6 flex flex-col items-center text-center flex-1">
                                            <div className="w-24 h-24 mb-4 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-md group-hover:scale-110 transition-transform">
                                                {team.logo_url ? (
                                                    <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Users size={40} className="text-gray-300" />
                                                )}
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-800 group-hover:text-indigo-700 mb-1 leading-tight">
                                                {team.name}
                                            </h3>
                                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-xl font-mono mb-2">
                                                {team.code || '-'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">{t('guestTeams.totalPlayers').replace('{count}', team.player_count ?? 0)}</span>
                                        </div>
                                        <div className="py-3 bg-gray-50 border-t border-gray-100 text-center text-sm font-bold text-blue-600 group-hover:bg-blue-50 transition-colors">
                                            {t('guestTeams.viewPlayers')}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* --- ส่วนแสดงรายละเอียดทีม & นักกีฬา (เมื่อกดเลือกทีมแล้ว) --- */
                <div className="w-full max-w-[1400px] mx-auto px-4 mt-8 animate-fade-in-up">
                    <button 
                        onClick={() => setSelectedTeam(null)}
                        className="mb-6 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-blue-600 font-bold hover:bg-blue-50 hover:pr-6 transition-all"
                    >
                        <ArrowLeft size={20} /> {t('guestTeams.backToTeams')}
                    </button>

                    {/* Team Header */}
                    <div className="bg-white/95 rounded-3xl shadow-xl border border-white p-8 mb-8 relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full -mr-16 -mt-16 blur-3xl opacity-20 ${selectedGender === 'Men' ? 'bg-blue-500' : selectedGender === 'Women' ? 'bg-pink-500' : 'bg-indigo-500'}`}></div>
                        
                        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                            <div className="w-32 h-32 md:w-48 md:h-48 bg-white rounded-full border-4 border-indigo-50 shadow-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {selectedTeam.logo_url ? (
                                    <img src={selectedTeam.logo_url} alt={selectedTeam.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Users size={64} className="text-gray-300" />
                                )}
                            </div>
                            <div className="text-center md:text-left flex-1">
                                <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-3 tracking-tight">{selectedTeam.name}</h2>
                                <div className="flex flex-wrap gap-3 justify-center md:justify-start items-center text-gray-600">
                                    <span className="bg-blue-50 text-indigo-800 px-3 py-1 rounded-lg text-sm font-bold border border-blue-200">
                                        CODE: {selectedTeam.code}
                                    </span>
                                    {/* ส่วนชื่อโค้ชที่เราเพิ่มไป */}
                                    <span className="flex items-center gap-2 text-lg ml-4">
                                        {t('register.coach')}: <span className="font-bold text-gray-900">{selectedTeam.coach || '-'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Player Table (คงเดิม) */}
                    <div className="bg-white/95 rounded-3xl shadow-xl border border-white overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-200 flex items-center gap-3">
                            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
                                <Users size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800 text-xl">{t('guestTeams.teamRoster')}</h3>
                            <span className="ml-auto bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">
                                {t('guestTeams.totalPlayers').replace('{count}', players.length)}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4 text-center w-24">{t('guestTeams.photo')}</th>
                                        <th className="px-6 py-4 text-center w-20">{t('guestTeams.number')}</th>
                                        <th className="px-6 py-4">{t('guestTeams.name')}</th>
                                        <th className="px-6 py-4">{t('guestTeams.position')}</th>
                                        <th className="px-6 py-4 text-center">{t('guestTeams.height')}</th>
                                        <th className="px-6 py-4 text-center">{t('guestTeams.weight')}</th>
                                        <th className="px-6 py-4 text-center">{t('guestTeams.age')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loadingPlayers ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                                                {t('guestTeams.loadingPlayers')}
                                            </td>
                                        </tr>
                                    ) : players.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center text-gray-400 flex flex-col items-center">
                                                <Users size={32} className="mb-2 opacity-50"/>
                                                {t('guestTeams.noPlayers')}
                                            </td>
                                        </tr>
                                    ) : (
                                        players.map((p) => (
                                            <tr key={p.id} onClick={() => handleViewPlayerStats(p)} className="hover:bg-blue-50/40 transition duration-200 group cursor-pointer">
                                                <td className="px-6 py-3 text-center">
                                                    <div className="w-12 h-12 mx-auto bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow-sm group-hover:border-blue-200 transition">
                                                        {p.photo ? (
                                                            <img src={p.photo} alt={getPlayerName(p)} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Users size={20} className="w-full h-full p-2.5 text-gray-400" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className="text-xl font-semibold text-indigo-900 bg-blue-50 w-10 h-10 flex items-center justify-center rounded-lg mx-auto">
                                                        {normalizeText(p.number) || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="font-bold text-gray-800 flex flex-wrap items-center gap-2">
                                                        {getPlayerName(p)}
                                                        {Number(p.is_captain) === 1 || p.is_captain === true ? <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">C</span> : null}
                                                        {getLiberoBadge(p) ? <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">{getLiberoBadge(p)}</span> : null}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-600 border border-gray-200">
                                                        {p.position || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-center text-gray-600 font-medium">
                                                    {p.height_cm ? p.height_cm : '-'}
                                                </td>
                                                <td className="px-6 py-3 text-center text-gray-600 font-medium">
                                                    {p.weight ? p.weight : '-'}
                                                </td>
                                                <td className="px-6 py-3 text-center text-gray-600">
                                                    {p.birth_date ? (
                                                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                                            {calculateAge(p.birth_date)}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Player Stats Modal */}
            {viewingPlayer && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                    <BarChart2 size={24} className="text-white"/>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{viewingPlayer.first_name} {viewingPlayer.last_name}</h3>
                                    <p className="text-xs text-indigo-100 opacity-90">#{viewingPlayer.number} • {viewingPlayer.position}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingPlayer(null)} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition">
                                <X size={20}/>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            {!playerStats ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* Attack */}
                                    <div className="col-span-2 bg-rose-50 p-4 rounded-xl border border-rose-100">
                                        <h4 className="text-rose-600 font-bold text-sm uppercase mb-3 flex items-center gap-2">
                                            <Swords size={16}/> {t('guestTeams.attack')}
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div><div className="text-2xl font-semibold text-gray-800">{playerStats.attack_kills ?? 0}</div><div className="text-xs text-gray-500">{t('guestTeams.kills')}</div></div>
                                            <div><div className="text-2xl font-semibold text-gray-800">{playerStats.attack_errors ?? 0}</div><div className="text-xs text-gray-500">{t('guestTeams.errors')}</div></div>
                                            <div><div className={`text-2xl font-semibold ${parseFloat(playerStats.attack_efficiency ?? 0) >= 25 ? 'text-green-600' : 'text-gray-800'}`}>{playerStats.attack_efficiency ?? 0}%</div><div className="text-xs text-gray-500">{t('guestTeams.eff')}</div></div>
                                        </div>
                                    </div>
                                    {/* Block */}
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <h4 className="text-emerald-600 font-bold text-sm uppercase mb-3 flex items-center gap-2">
                                            <Shield size={16}/> {t('guestTeams.block')}
                                        </h4>
                                        <div className="text-center">
                                            <div className="text-3xl font-semibold text-gray-800">{playerStats.block_points ?? 0}</div>
                                            <div className="text-xs text-gray-500">{t('guestTeams.block')}</div>
                                        </div>
                                    </div>
                                    {/* Serve */}
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <h4 className="text-blue-600 font-bold text-sm uppercase mb-3 flex items-center gap-2">
                                            <Activity size={16}/> {t('guestTeams.serve')}
                                        </h4>
                                        <div className="flex justify-around text-center">
                                            <div><div className="text-xl font-semibold text-gray-800">{playerStats.serve_aces ?? 0}</div><div className="text-[10px] text-gray-500">{language === 'THA' ? 'เอซ' : 'Aces'}</div></div>
                                            <div><div className="text-xl font-semibold text-gray-800">{playerStats.serve_errors ?? 0}</div><div className="text-[10px] text-gray-500">{language === 'THA' ? 'เสีย' : 'Err'}</div></div>
                                        </div>
                                    </div>
                                    {/* Defense */}
                                    <div className="col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-around items-center">
                                        <div className="text-center">
                                            <div className="text-2xl font-semibold text-gray-800">{playerStats.digs ?? 0}</div>
                                            <div className="text-xs text-gray-500 uppercase font-bold">{t('guestTeams.digs')}</div>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200"></div>
                                        <div className="text-center">
                                            <div className="text-2xl font-semibold text-gray-800">{playerStats.receptions ?? 0}</div>
                                            <div className="text-xs text-gray-500 uppercase font-bold">{t('guestTeams.receptions')}</div>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200"></div>
                                        <div className="text-center">
                                            <div className="text-2xl font-semibold text-gray-800">{playerStats.total_actions ?? 0}</div>
                                            <div className="text-xs text-gray-500 uppercase font-bold">{t('guestTeams.totalActions')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
