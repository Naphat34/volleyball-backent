import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api';
import { Trophy, Activity, HandMetal, Shield, Zap, Target, ArrowUp, User, LogIn, Menu, X } from 'lucide-react';
import { cleanCompetitionTitle } from '../../utils';
import { useLanguage } from '../../context/LanguageContext';

export default function PublicStatistics() {
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();
    const [competitions, setCompetitions] = useState([]);
    const [selectedCompId, setSelectedCompId] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    // 1. ดึงรายการแข่งขันทั้งหมดมาใส่ Dropdown
    useEffect(() => {
        const fetchComps = async () => {
            try {
                const res = await client.get('/public/competitions'); // หรือ endpoint ที่ดึงรายการแข่ง
                const openComps = res.data.filter(c => c.status?.toLowerCase() === 'open');
                setCompetitions(openComps);
                // ถ้ามีรายการแข่ง ให้เลือกรายการล่าสุดเป็นค่าเริ่มต้น
                if (openComps.length > 0) {
                    setSelectedCompId(openComps[0].id);
                }
            } catch (err) {
                console.error("Error fetching competitions:", err);
            }
        };
        fetchComps();
    }, []);

    // 2. ดึงข้อมูลสถิติเมื่อมีการเลือกรายการแข่งขัน
    useEffect(() => {
        if (!selectedCompId) return;

        const fetchStats = async () => {
            setLoading(true);
            try {
                // สมมติว่า Backend เตรียม API นี้ไว้ (ดูรูปแบบ JSON ด้านล่าง)
                const res = await client.get(`/public/statistics/${selectedCompId}`);
                setStats(res.data);
            } catch (err) {
                console.error("Error fetching statistics:", err);
                setStats(null); // กรณีไม่มีข้อมูล หรือ Error
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [selectedCompId]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32%),linear-gradient(180deg,#f8fafc,#eef2ff)] text-gray-800 pb-20">
            {/* Navbar */}
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
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
                                <button onClick={() => navigate('/stats')} className="text-sm font-medium text-blue-600 transition cursor-pointer">{t('nav.stats')}</button>
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
                                <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm cursor-pointer">
                                    <LogIn size={18} /> {t('nav.login')}
                                </button>
                            </div>
                            {/* Hamburger Menu Icon */}
                            <div className="flex items-center md:hidden">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-660 hover:bg-gray-100 focus:outline-none"
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
                        <button onClick={() => { navigate('/stats'); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-650 hover:bg-gray-50">{t('nav.stats')}</button>
                        
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

            {/* Header */}
            <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 text-white py-12 px-4 shadow-lg mb-8">
                <div className="w-full mx-auto text-center">
                    <h1 className="text-4xl font-extrabold flex items-center justify-center gap-3 mb-2">
                        <Activity className="text-yellow-400" size={40} /> {language === 'THA' ? 'สถิติการแข่งขัน' : 'Tournament Statistics'}
                    </h1>
                    <p className="text-indigo-200">{language === 'THA' ? 'อันดับผู้เล่นยอดเยี่ยมในแต่ละทักษะ' : 'Top player rankings by skill category'}</p>
                </div>
            </div>

            {/* Filter Section */}
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <label className="font-bold text-gray-700">{language === 'THA' ? 'เลือกรายการแข่งขัน:' : 'Select Competition:'}</label>
                    <select
                        value={selectedCompId}
                        onChange={(e) => setSelectedCompId(e.target.value)}
                        className="w-full md:w-1/2 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 font-medium"
                    >
                        {competitions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {cleanCompetitionTitle(c.title)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content Section */}
            <div className="w-full mx-auto px-4 mt-8">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900 mx-auto"></div>
                        <p className="mt-4 text-gray-500">{t('common.loading')}</p>
                    </div>
                ) : !stats ? (
                    <div className="text-center py-20 bg-white rounded-md shadow-sm">
                        <p className="text-gray-400">{language === 'THA' ? 'ยังไม่มีข้อมูลสถิติสำหรับการแข่งขันนี้' : 'No stats information available for this tournament yet.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        
                        {/* 1. Best Scorers (ทำคะแนนรวมสูงสุด) */}
                        <StatCategoryCard 
                            title="Best Scorers" 
                            icon={<Trophy className="text-yellow-500" />} 
                            data={stats.best_scorers} 
                            valueLabel="Points"
                            colorClass="bg-yellow-50 border-yellow-200"
                        />

                        {/* 2. Best Spikers (ตบทำคะแนน) */}
                        <StatCategoryCard 
                            title="Best Spikers" 
                            icon={<Zap className="text-red-500" />} 
                            data={stats.best_spikers} 
                            valueLabel="Kills"
                            colorClass="bg-red-50 border-red-200"
                        />

                        {/* 3. Best Blockers (บล็อก) */}
                        <StatCategoryCard 
                            title="Best Blockers" 
                            icon={<Shield className="text-green-600" />} 
                            data={stats.best_blockers} 
                            valueLabel="Blocks"
                            colorClass="bg-green-50 border-green-200"
                        />

                        {/* 4. Best Servers (เสิร์ฟเอซ) */}
                        <StatCategoryCard 
                            title="Best Servers" 
                            icon={<Target className="text-blue-500" />} 
                            data={stats.best_servers} 
                            valueLabel="Aces"
                            colorClass="bg-blue-50 border-blue-200"
                        />

                        {/* 5. Best Setters (เซตบอล) */}
                        <StatCategoryCard 
                            title="Best Setters" 
                            icon={<HandMetal className="text-purple-500" />} 
                            data={stats.best_setters} 
                            valueLabel="Assists"
                            colorClass="bg-purple-50 border-purple-200"
                        />

                        {/* 6. Best Diggers (รับตบ) */}
                        <StatCategoryCard 
                            title="Best Diggers" 
                            icon={<ArrowUp className="text-orange-500" />} 
                            data={stats.best_diggers} 
                            valueLabel="Digs"
                            colorClass="bg-orange-50 border-orange-200"
                        />

                    </div>
                )}
            </div>
        </div>
    );
}

// --- Sub-Component: การ์ดแสดงแต่ละหมวดหมู่ ---
function StatCategoryCard({ title, icon, data, valueLabel, colorClass }) {
    if (!data || data.length === 0) return null; // ถ้าไม่มีข้อมูลไม่ต้องแสดง

    const topPlayer = data[0]; // คนที่ 1
    const runnerUps = data.slice(1, 5); // คนที่ 2-5

    return (
        <div className={`rounded-md shadow-md overflow-hidden border ${colorClass} bg-white flex flex-col h-full`}>
            {/* Header */}
            <div className="p-4 flex items-center gap-2 border-b border-gray-100 bg-white/50">
                <div className="p-2 bg-white rounded-full shadow-sm">{icon}</div>
                <h3 className="font-bold text-lg text-gray-800 uppercase tracking-wide">{title}</h3>
            </div>

            {/* Top 1 Player (Highlight) */}
            <div className="p-6 text-center bg-gradient-to-b from-transparent to-white/30 relative">
                <div className="w-24 h-24 mx-auto bg-gray-200 rounded-full border-4 border-white shadow-lg overflow-hidden mb-3 relative">
                     {/* รูปผู้เล่น หรือ Default */}
                    {topPlayer.image_url ? (
                        <img src={topPlayer.image_url} alt={topPlayer.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500">
                            <User size={40} />
                        </div>
                    )}
                    <div className="absolute bottom-0 right-0 bg-yellow-400 text-white text-xs font-bold px-2 py-0.5 rounded-tl-md">#1</div>
                </div>
                <h4 className="text-lg font-bold text-gray-900 truncate">{topPlayer.name}</h4>
                <p className="text-sm text-gray-500 mb-2">{topPlayer.team_name}</p>
                <div className="inline-block px-4 py-1 bg-gray-900 text-white rounded-full text-sm font-bold shadow-sm">
                    {topPlayer.value} <span className="text-gray-400 font-normal text-xs">{valueLabel}</span>
                </div>
            </div>

            {/* List for Rank 2-5 */}
            <div className="flex-1 bg-white p-2">
                {runnerUps.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition border-b last:border-0 border-gray-100">
                        <div className="flex items-center gap-3">
                            <span className="w-6 text-center font-bold text-gray-400 text-sm">#{index + 2}</span>
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                {player.image_url ? (
                                    <img src={player.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={16} className="m-auto mt-2 text-gray-400"/>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-700 leading-tight">{player.name}</span>
                                <span className="text-xs text-gray-400">{player.team_name}</span>
                            </div>
                        </div>
                        <span className="font-bold text-gray-800 text-sm">{player.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
