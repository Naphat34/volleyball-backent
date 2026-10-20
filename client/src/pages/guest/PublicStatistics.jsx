import { Feedback } from '../../components/ui/SystemUI';
import PublicHeader from '../../components/PublicHeader';
import React, { useEffect, useMemo, useState } from 'react';
import client from '../../api';
import { Trophy, Activity, HandMetal, Shield, Zap, Target, ArrowUp, User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { groupPublicCompetitionCategories } from '../../utils/publicCompetitionGrouping';

const STAT_CATEGORIES = [
    'best_scorers',
    'best_spikers',
    'best_blockers',
    'best_servers',
    'best_setters',
    'best_diggers'
];

const mergeStatistics = (statResponses) => {
    const merged = {};

    STAT_CATEGORIES.forEach((category) => {
        const playerMap = new Map();

        statResponses.forEach((stats) => {
            (stats?.[category] || []).forEach((player) => {
                const key = String(player.player_id || player.id || `${player.name}-${player.team_name}`);
                const existing = playerMap.get(key);
                if (existing) {
                    existing.value += Number(player.value) || 0;
                } else {
                    playerMap.set(key, { ...player, value: Number(player.value) || 0 });
                }
            });
        });

        merged[category] = Array.from(playerMap.values())
            .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
            .slice(0, 10);
    });

    return merged;
};

export default function PublicStatistics() {

    const { language, t } = useLanguage();
    const [competitions, setCompetitions] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('all');
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
                setSelectedCategory('all');
            } catch (err) {
                console.error("Error fetching competitions:", err);
                setLoadError(true);
            }
        };
        fetchComps();
    }, [reloadKey]);

    // 2. ดึงข้อมูลสถิติเมื่อมีการเลือกรายการแข่งขัน
    useEffect(() => {
        if (competitions.length === 0) return;

        const fetchStats = async () => {
            setLoading(true);
            try {
                const selectedGroup = selectedCategory === 'all' ? null : groupPublicCompetitionCategories(competitions, language).find((item) => item.key === selectedCategory);
                const competitionIds = (selectedGroup?.items || competitions)
                    .map((competition) => competition.id)
                    .filter((id) => id !== undefined && id !== null && id !== '');
                const results = await Promise.all(
                    competitionIds.map((id) => client.get(`/public/statistics/${id}`))
                );
                setStats(mergeStatistics(results.map((result) => result.data)));
            } catch (err) {
                console.error("Error fetching statistics:", err);
                setLoadError(true);
                setStats(null); // กรณีไม่มีข้อมูล หรือ Error
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [competitions, selectedCategory, language, reloadKey]);

    const categories = useMemo(() => groupPublicCompetitionCategories(competitions, language), [competitions, language]);

    return (
        <div className="app-page min-h-screen text-gray-800 pb-20">
            {/* Navbar */}
            <PublicHeader />
            {loadError && <div className="mx-auto max-w-[1400px] px-4 py-4"><Feedback error title={language === 'THA' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Unable to load data'} onRetry={() => { setLoadError(false); setReloadKey(key => key + 1); }} retryLabel={language === 'THA' ? 'ลองใหม่' : 'Retry'} /></div>}
            <div id="main-content" tabIndex={-1} />

            {/* Header */}
            <div className="bg-[#122b52] text-white py-12 px-4 shadow-lg mb-8">
                <div className="w-full max-w-[1400px] mx-auto text-center">
                    <h1 className="text-4xl font-extrabold flex items-center justify-center gap-3 mb-2">
                        <Activity className="text-yellow-400" size={40} /> {language === 'THA' ? 'สถิติการแข่งขัน' : 'Tournament Statistics'}
                    </h1>
                    <p className="text-indigo-200">{language === 'THA' ? 'อันดับผู้เล่นยอดเยี่ยมในแต่ละทักษะ' : 'Top player rankings by skill category'}</p>
                </div>
            </div>

            {/* Category filter */}
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <span className="font-bold text-gray-700">{language === 'THA' ? '\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17:' : 'Category:'}</span>
                    <div className="flex w-full flex-wrap gap-2 md:justify-end">
                        <button type="button" onClick={() => setSelectedCategory('all')} className={`rounded-full border px-3 py-2 text-sm font-bold ${selectedCategory === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}>{language === 'THA' ? '\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14' : 'All'}</button>
                        {categories.map((category) => <button key={category.key} type="button" onClick={() => setSelectedCategory(category.key)} className={`rounded-full border px-3 py-2 text-sm font-bold ${selectedCategory === category.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}>{category.label}</button>)}
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="w-full max-w-[1400px] mx-auto px-4 mt-8">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900 mx-auto"></div>
                        <p className="mt-4 text-gray-500">{t('common.loading')}</p>
                    </div>
                ) : !stats ? (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm">
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
        <div className={`rounded-xl shadow-md overflow-hidden border ${colorClass} bg-white flex flex-col h-full`}>
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
