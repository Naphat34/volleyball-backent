import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, LogIn, CalendarDays, Clock, MapPin, Menu, X } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { formatThaiDate } from '../../utils';

export default function LandingPage() {
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const res = await api.getPublicMatches();
                setMatches(res.data);
            } catch (error) {
                console.error("Error fetching matches:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMatches();
    }, []);

    const TeamLogo = ({ name, logoUrl }) => {
        if (logoUrl) {
            return (
                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
                    <img src={logoUrl} alt={name || "Team"} className="w-full h-full object-cover" />
                </div>
            );
        }
        const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "??";
        return (
            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-500 shadow-sm">
                {initials}
            </div>
        );
    };

    // Group matches by date
    const groupedMatches = matches.reduce((acc, match) => {
        const key = match.match_date || "Unknown Date";
        if (!acc[key]) {
            acc[key] = {
                dateString: match.match_date,
                stadium: match.stadium_name || "",
                matches: []
            };
        }
        acc[key].matches.push(match);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-[#f8f9fa] text-gray-800 font-sans pb-16">

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
                                <button onClick={() => navigate('/')} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition cursor-pointer">{t('nav.home')}</button>
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
                                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none"
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
                        <button onClick={() => { navigate('/'); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-650 hover:bg-gray-55">{t('nav.home')}</button>
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
                            <button
                                onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
                            >
                                <LogIn size={18} /> {t('nav.login')}
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* --- Match Schedule Section --- */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 ">
                <div className="flex items-center justify-center md:justify-start gap-2 text-[#14366A] font-semibold text-xl">
                    <CalendarDays size={24} />
                    <span>{t('landing.schedule')}</span>
                </div>
            </div>
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4 mb-20">
                {loading ? (
                    <div className="text-center py-20 text-gray-500 font-medium">{t('landing.loading')}</div>
                ) : Object.keys(groupedMatches).length === 0 ? (
                    <div className="text-center py-20 text-gray-500 font-medium">{t('landing.noMatches')}</div>
                ) : (
                    Object.values(groupedMatches).map((group, index) => {
                        const dateFormatted = group.dateString 
                            ? formatThaiDate(group.dateString) 
                            : t('landing.unknownDate');

                        return (
                            <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 mb-8">
                                {/* Header */}
                                <div className="bg-[#14366A] text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-inner">
                                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left text-sm md:text-base font-medium">
                                        <span className="font-bold text-lg md:text-xl">{t('landing.matchSchedule')}</span>
                                        {group.stadium && (
                                            <>
                                                <span className="hidden md:inline text-white/50">|</span>
                                                <span className="text-blue-50 uppercase tracking-tight text-xs md:text-sm flex items-center gap-1">
                                                    <MapPin size={14} /> {group.stadium}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="mt-4 md:mt-0 bg-white text-[#14366A] px-4 py-1.5 rounded text-sm font-bold shadow-sm whitespace-nowrap">
                                        {dateFormatted}
                                    </div>
                                </div>

                                {/* Day Bar */}
                                <div className="bg-[#eaf3fc] border-b border-gray-200 px-6 py-3 flex items-center justify-center md:justify-start gap-2 text-[#14366A] font-semibold text-sm">
                                    <CalendarDays size={18} />
                                    <span>{dateFormatted}</span>
                                </div>

                                {/* Matches Container */}
                                <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 bg-white">
                                    {group.matches.map((match, mIndex) => {
                                        // Determine color based on gender
                                        const genderText = (match.match_gender || '').toLowerCase();
                                        let themeColor = "#14366A"; // Default / Men (น้ำเงินเข้ม)
                                        if (genderText.includes('women') || genderText.includes('หญิง') || genderText.includes('female')) {
                                            themeColor = "#ec4899"; // Women (สีชมพู)
                                        }

                                        return (
                                            <div key={match.id} className="bg-white border border-gray-200 rounded-lg relative shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[160px] overflow-hidden">
                                                {/* Left strip */}
                                                <div className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ backgroundColor: themeColor }}></div>
                                                
                                                {/* Match Info Header */}
                                                <div className="flex justify-between items-center bg-gray-50 px-4 py-3 pl-5 border-b border-gray-100">
                                                    <span className="font-bold text-sm" style={{ color: themeColor }}>#{match.match_number || mIndex + 1}</span>
                                                    <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold">
                                                        <Clock size={13} className="text-gray-400" /> {match.start_time}
                                                    </div>
                                                    <button 
                                                        onClick={() => navigate(`/match-centre/${match.id}`)}
                                                        className="border text-[11px] font-semibold px-3 py-1 rounded-full transition bg-white hover:bg-gray-500 hover:text-white shadow-sm" 
                                                        style={{ borderColor: themeColor, color: themeColor }}
                                                    >
                                                        Match Centre
                                                    </button>
                                                </div>
                                                
                                                {/* Teams and Score Content */}
                                                <div className="flex justify-between items-center flex-1 gap-2 p-4 pt-6 pl-5 pb-8">
                                                    {/* Team A */}
                                                    <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-3 flex-1 w-[35%] text-center sm:text-right">
                                                        <div className="text-[11px] sm:text-[13px] font-semibold text-gray-800 leading-tight order-2 sm:order-1 sm:mt-0 mt-1">
                                                            {match.team_a_name || "TBD"}
                                                        </div>
                                                        <div className="order-1 sm:order-2">
                                                            <TeamLogo name={match.team_a_name} logoUrl={match.team_a_logo} />
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Score */}
                                                    <div className="flex flex-col items-center justify-center w-[30%] px-1 relative shrink-0 -mt-2">
                                                        <div className="text-2xl sm:text-[28px] font-bold tracking-widest text-[#1e293b] whitespace-nowrap">
                                                            {match.team_a_score ?? '-'} <span className="text-gray-400 mx-1">-</span> {match.team_b_score ?? '-'}
                                                        </div>
                                                        <div className="absolute -bottom-6 flex flex-col items-center">
                                                            <span className={`text-[9px] font-bold px-2 py-[3px] rounded tracking-wider shadow-sm uppercase ${
                                                                match.status === 'COMPLETED' ? 'bg-[#cdedd1] text-[#2db540]' 
                                                                : match.status === 'LIVE' ? 'bg-red-100 text-red-600'
                                                                : 'bg-gray-100 text-gray-500'
                                                            }`}>
                                                                {match.status || 'SCHEDULED'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Team B */}
                                                    <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 flex-1 w-[35%] text-center sm:text-left">
                                                        <div className="order-1">
                                                            <TeamLogo name={match.team_b_name} logoUrl={match.team_b_logo} />
                                                        </div>
                                                        <div className="text-[11px] sm:text-[13px] font-semibold text-gray-800 leading-tight order-2 sm:mt-0 mt-1">
                                                            {match.team_b_name || "TBD"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- Footer --- */}
            <footer className="bg-gray-900 text-gray-400 py-6 text-center text-sm w-full fixed bottom-0 z-40">
                <p>&copy; {new Date().getFullYear()} Volleyball Tournament System. All rights reserved.</p>
            </footer>

        </div>
    );
}