import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, CalendarDays, Clock, MapPin, ArrowLeft, LayoutGrid, LogIn, Menu, X } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function MatchCentrePage() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const fetchMatchDate = async () => {
            try {
                // Fetch all public matches since we don't have a single-match public route yet
                const res = await api.getPublicMatches();
                const foundMatch = res.data.find(m => m.id === parseInt(matchId, 10));
                setMatch(foundMatch);
            } catch (error) {
                console.error("Error fetching match:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMatchDate();
    }, [matchId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] text-gray-800 font-sans flex justify-center items-center">
                <p className="text-gray-500 font-medium">{t('landing.loading')}</p>
            </div>
        );
    }

    if (!match) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] text-gray-800 font-sans flex flex-col justify-center items-center">
                <p className="text-gray-500 font-medium mb-4">{language === 'THA' ? 'ไม่พบข้อมูลการแข่งขัน' : 'Match not found'}</p>
                <button onClick={() => navigate('/matches')} className="px-4 py-2 bg-[#14366A] text-white rounded-md cursor-pointer">
                    {language === 'THA' ? 'กลับไปหน้าตารางการแข่งขัน' : 'Back to Match Schedule'}
                </button>
            </div>
        );
    }

    const TeamLogo = ({ name, logoUrl, size = "md" }) => {
        const sizeClasses = size === "lg" ? "w-16 h-16 text-lg" : size === "sm" ? "w-6 h-6 text-[8px]" : "w-10 h-10 text-xs";
        
        if (logoUrl) {
            return (
                <div className={`${sizeClasses} rounded-full bg-white border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden shadow-sm`}>
                    <img src={logoUrl} alt={name || "Team"} className="w-full h-full object-cover" />
                </div>
            );
        }
        const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "??";
        return (
            <div className={`${sizeClasses} rounded-full bg-white border border-gray-200 shrink-0 flex items-center justify-center font-bold text-gray-500 shadow-sm`}>
                {initials}
            </div>
        );
    };

    // Calculate Sets
    const setScores = match.set_scores || [];
    const maxSets = Math.max(setScores.length, 3); // minimum 3 columns for volleyball
    const setColumns = Array.from({ length: maxSets }, (_, i) => i + 1);

    const totalA = setScores.reduce((sum, s) => sum + (s.team_a || 0), 0);
    const totalB = setScores.reduce((sum, s) => sum + (s.team_b || 0), 0);

    return (
        <div className="min-h-screen bg-[#f1f5f9] text-gray-800 font-sans pb-24 relative">
            
            {/* --- Navbar --- */}
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
                            <span className="font-bold text-xl tracking-tight text-indigo-900">{t('nav.systemName')}</span>
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="hidden md:flex items-center gap-8">
                                <button onClick={() => navigate('/')} className="text-sm font-medium text-gray-700 hover:text-blue-600 transition cursor-pointer">{t('nav.home')}</button>
                                <button onClick={() => navigate('/teams')} className="text-sm font-medium text-gray-700 hover:text-blue-600 transition cursor-pointer">{t('nav.teams')}</button>
                                <button onClick={() => navigate('/matches')} className="text-sm font-medium text-gray-700 hover:text-blue-600 transition cursor-pointer">{t('nav.matches')}</button>
                                <button onClick={() => navigate('/standings')} className="text-sm font-medium text-gray-700 hover:text-blue-600 transition cursor-pointer">{t('nav.standings')}</button>
                                <button onClick={() => navigate('/stats')} className="text-sm font-medium text-gray-700 hover:text-blue-600 transition cursor-pointer">{t('nav.stats')}</button>
                            </div>
                            <div className="hidden md:flex gap-4 items-center">
                                {/* Language Selector */}
                                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setLanguage('THA')}
                                        className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                            language === 'THA'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                    >
                                        TH
                                    </button>
                                    <button
                                        onClick={() => setLanguage('ENG')}
                                        className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                            language === 'ENG'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                    >
                                        EN
                                    </button>
                                </div>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm cursor-pointer"
                                >
                                    <LogIn size={18} /> {t('nav.login')}
                                </button>
                            </div>
                            {/* Hamburger Menu Icon */}
                            <div className="flex items-center md:hidden">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-655 hover:bg-gray-100 focus:outline-none"
                                >
                                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Mobile Menu Dropdown */}
                {isMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 shadow-inner px-4 pt-2 pb-4 space-y-1">
                        <button onClick={() => { navigate('/'); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">{t('nav.home')}</button>
                        <button onClick={() => { navigate('/teams'); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">{t('nav.teams')}</button>
                        <button onClick={() => { navigate('/matches'); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">{t('nav.matches')}</button>
                        <button onClick={() => { navigate('/standings'); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">{t('nav.standings')}</button>
                        <button onClick={() => { navigate('/stats'); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">{t('nav.stats')}</button>
                        
                        {/* Mobile Menu Language Selector */}
                        <div className="flex justify-between items-center px-3 py-2 border-t border-gray-100 mt-2">
                            <span className="text-sm font-medium text-gray-500">Language / ภาษา</span>
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setLanguage('THA')}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                        language === 'THA'
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-500'
                                    }`}
                                >
                                    TH
                                </button>
                                <button
                                    onClick={() => setLanguage('ENG')}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                        language === 'ENG'
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-500'
                                    }`}
                                >
                                    EN
                                </button>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 mt-2">
                            <button onClick={() => { navigate('/login'); setIsMenuOpen(false); }} className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
                                <LogIn size={18} /> {t('nav.login')}
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Top Navigation (Secondary) */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="flex items-center gap-2 text-gray-600 hover:text-[#14366A] font-medium transition cursor-pointer"
                    >
                        <ArrowLeft size={18} /> {language === 'THA' ? 'ย้อนกลับ' : 'Back'}
                    </button>
                    <span className="font-bold text-[#14366A] text-lg">{t('landing.matchCentre')}</span>
                    <div className="w-20"></div> {/* Spacer for balance */}
                </div>
            </div>

            <div className="max-w-[1000px] mx-auto px-4 mt-8 space-y-6">
                
                {/* MATCH HEADER CARD */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Meta Header */}
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 bg-white px-6 py-4 border-b border-gray-50 text-xs sm:text-sm font-semibold text-gray-500">
                        <span className="text-[#14366A] font-bold"># {match.id ? (language === 'THA' ? `แมตช์ที่ ${match.id}` : `Match #${match.id}`) : (language === 'THA' ? "แมตช์" : "Match")}</span>
                        <div className="flex items-center gap-1.5"><CalendarDays size={16} /> {match.match_date}</div>
                        <div className="flex items-center gap-1.5"><Clock size={16} /> {match.start_time}</div>
                        <div className="flex items-center gap-1.5"><MapPin size={16} /> {match.stadium_name || (language === 'THA' ? "รอระบุสนาม" : "TBA")}</div>
                    </div>

                    {/* Main Score Area */}
                    <div className="flex flex-col md:flex-row items-center justify-between px-8 py-10 md:py-12 relative gap-8 md:gap-0">
                        
                        {/* Team A */}
                        <div className="flex flex-col items-center flex-1 z-10">
                            <TeamLogo name={match.team_a_name} logoUrl={match.team_a_logo} size="lg" />
                            <div className="mt-4 text-sm md:text-base font-bold text-gray-800 text-center uppercase tracking-wide">
                                {match.team_a_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                            </div>
                        </div>

                        {/* Center Score */}
                        <div className="flex flex-col items-center justify-center shrink-0 z-10 mx-2 md:mx-8">
                            <div className="text-4xl md:text-6xl font-black text-[#1e293b] tracking-wider font-mono whitespace-nowrap">
                                {match.team_a_score ?? '-'} <span className="text-gray-300 font-sans mx-2">-</span> {match.team_b_score ?? '-'}
                            </div>
                            <div className="mt-4">
                                <span className={`text-[10px] md:text-xs font-bold px-3 py-1 md:py-1.5 rounded-full tracking-wider uppercase shadow-sm ${
                                    match.status === 'COMPLETED' ? 'bg-[#3b9f56] text-white' 
                                    : match.status === 'LIVE' ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-[#e2e8f0] text-gray-600'
                                }`}>
                                    {match.status === 'COMPLETED' ? (language === 'THA' ? 'จบการแข่งขัน' : 'COMPLETED')
                                    : match.status === 'LIVE' ? (language === 'THA' ? 'กำลังแข่ง' : 'LIVE')
                                    : (language === 'THA' ? 'ยังไม่เริ่ม' : 'SCHEDULED')}
                                </span>
                            </div>
                        </div>

                        {/* Team B */}
                        <div className="flex flex-col items-center flex-1 z-10">
                            <TeamLogo name={match.team_b_name} logoUrl={match.team_b_logo} size="lg" />
                            <div className="mt-4 text-sm md:text-base font-bold text-gray-800 text-center uppercase tracking-wide">
                                {match.team_b_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                            </div>
                        </div>
                        
                    </div>
                </div>

                {/* SET SCORES CARD */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
                        <LayoutGrid className="text-orange-500" size={20} />
                        <h2 className="font-bold text-[#1e293b] text-lg">{language === 'THA' ? 'คะแนนแต่ละเซต' : 'Set Scores'}</h2>
                    </div>

                    <div className="p-2 sm:p-6 overflow-x-auto">
                        <table className="w-full min-w-[600px] text-sm md:text-base">
                            <thead>
                                <tr className="text-gray-400 font-semibold border-b border-gray-100 text-xs tracking-wider">
                                    <th className="text-left pb-4 pl-4 font-medium uppercase">{language === 'THA' ? 'ทีม' : 'Team'}</th>
                                    <th className="text-center pb-4 font-medium uppercase w-16">{language === 'THA' ? 'เซต' : 'Set'}</th>
                                    {setColumns.map(num => (
                                        <th key={num} className="text-center pb-4 font-medium uppercase w-16">{language === 'THA' ? `เซต ${num}` : `Set ${num}`}</th>
                                    ))}
                                    <th className="text-center pb-4 font-medium uppercase w-20">{language === 'THA' ? 'รวม' : 'Total'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Team A Row */}
                                <tr className="border-b border-gray-50 hover:bg-gray-50 transition">
                                    <td className="py-4 pl-4 font-bold text-[#1e293b] flex items-center gap-3">
                                        <TeamLogo name={match.team_a_name} logoUrl={match.team_a_logo} size="sm" />
                                        {match.team_a_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                                    </td>
                                    <td className="py-4 text-center font-bold text-green-600">{match.team_a_score ?? 0}</td>
                                    {setColumns.map(num => {
                                        const set = setScores.find(s => s.set_number === num);
                                        const isWinner = set && set.team_a > set.team_b;
                                        return (
                                            <td key={num} className={`py-4 text-center font-bold ${isWinner ? 'text-green-600' : 'text-gray-600'}`}>
                                                {set?.team_a ?? '-'}
                                            </td>
                                        );
                                    })}
                                    <td className="py-4 text-center font-bold text-gray-800">{totalA}</td>
                                </tr>

                                {/* Team B Row */}
                                <tr className="hover:bg-gray-50 transition">
                                    <td className="py-4 pl-4 font-bold text-[#1e293b] flex items-center gap-3">
                                        <TeamLogo name={match.team_b_name} logoUrl={match.team_b_logo} size="sm" />
                                        {match.team_b_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                                    </td>
                                    <td className="py-4 text-center font-bold text-gray-800">{match.team_b_score ?? 0}</td>
                                    {setColumns.map(num => {
                                        const set = setScores.find(s => s.set_number === num);
                                        const isWinner = set && set.team_b > set.team_a;
                                        return (
                                            <td key={num} className={`py-4 text-center font-bold ${isWinner ? 'text-green-600' : 'text-gray-600'}`}>
                                                {set?.team_b ?? '-'}
                                            </td>
                                        );
                                    })}
                                    <td className="py-4 text-center font-bold text-gray-800">{totalB}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* --- Footer --- */}
            <footer className="bg-gray-900 text-gray-400 py-6 text-center text-sm w-full absolute bottom-0 z-40">
                <p>&copy; {new Date().getFullYear()} {language === 'THA' ? 'ระบบจัดการแข่งขันวอลเลย์บอล. สงวนลิขสิทธิ์ทั้งหมด.' : 'Volleyball Tournament System. All rights reserved.'}</p>
            </footer>

        </div>
    );
}
