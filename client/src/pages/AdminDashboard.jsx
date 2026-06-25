import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, MapPin, Flag, UserCog,
    UserCheck, LogOut, Users, Trophy, Swords, Shield,
    Star, BarChart2, PlayCircle, Menu, X, User, Bell
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useLanguage } from '../context/LanguageContext';

// Import Tabs
import CompetitionsTab from './CompetitionsTab';
import HomeTab from './HomeTab';
import MatchManagementTab from './MatchManagementTab';
import PlayerViewTab from './PlayerViewTab';
import ClubsTab from './ClubsTab';
import AccountsTab from './AccountsTab';
import PendingUsersTab from './PendingUsersTab';
import EScoreTab from './EScoreTab';
import StadiumsTab from './StadiumsTab';
import TeamRankingTab from './TeamRankingTab';
import LiveScorerTab from './LiveScorerTab';
import OfficialsTab from './OfficialsTab';
import MatchesManager from './MatchesManager';


const PlaceholderTab = ({ title }) => {
    const { language } = useLanguage();
    return (
        <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">{title}</h2>
            <p className="text-gray-500">
                {language === 'THA' ? 'หน้านี้กำลังอยู่ระหว่างการพัฒนา...' : 'This page is under development...'}
            </p>
        </div>
    );
};

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();
    const [activeTab, setActiveTab] = useState(() => {
        return sessionStorage.getItem('adminActiveTab') || 'home';
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // สำหรับ iPad/Mobile
    const [isCollapsed, setIsCollapsed] = useState(false); // สำหรับย่อแถบเมนูใน Desktop
    const [user] = useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [pendingUsersCount, setPendingUsersCount] = useState(0);

    const fetchPendingUsersCount = useCallback(async () => {
        try {
            const res = await api.getPendingUsers();
            if (res.data) setPendingUsersCount(res.data.length);
        } catch (error) {
            console.error("Error fetching pending users count", error);
        }
    }, []);

    useEffect(() => {
        const updateCount = async () => {
            await fetchPendingUsersCount();
        };
        updateCount();
    }, [fetchPendingUsersCount, activeTab]);

    useEffect(() => {
        sessionStorage.setItem('adminActiveTab', activeTab);
    }, [activeTab]);

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: t('admin.logoutConfirmTitle'),
            text: t('admin.logoutConfirmText'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#d33',
            confirmButtonText: t('admin.logoutConfirmBtn'),
            cancelButtonText: t('common.cancel')
        });

        if (result.isConfirmed) {
            try {
                await api.logout();
                localStorage.clear();
                sessionStorage.clear();
                navigate('/login');
            } catch (error) {
                console.error("Logout failed", error);
                localStorage.clear();
                sessionStorage.clear();
                navigate('/login');
            }
        }
    };

    const toggleSidebar = () => {
        if (window.innerWidth >= 1024) {
            setIsCollapsed(prev => !prev);
        } else {
            setIsSidebarOpen(prev => !prev);
        }
    };

    const getTabName = (tab) => {
        const mapping = {
            home: 'home',
            competitions: 'competitions',
            clubs: 'teams',
            stadium: 'stadium',
            team_ranking: 'teamRanking',
            players: 'players',
            coaches: 'coaches',
            officials: 'officials',
            accounts: 'accounts',
            pending_users: 'pendingUsers',
            matches: 'matches',
            escore: 'vis',
            live_scorer: 'liveScorer'
        };
        const key = mapping[tab] || tab;
        return t(`admin.${key}`);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">

            {/* Overlay สำหรับมือถือ/iPad เมื่อเปิด Sidebar */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ================= Sidebar (Left Menu) ================= */}
            <aside className={`
                fixed inset-y-0 left-0 z-40 bg-white shadow-sm transition-all duration-300 transform flex flex-col overflow-x-hidden
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 lg:static lg:inset-0
                ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
                w-64
            `}>
                <div className={`h-16 flex items-center justify-between px-6 border-b border-gray-100 ${isCollapsed ? 'lg:px-4 lg:justify-center' : ''}`}>
                    {!isCollapsed ? (
                        <h1 className="text-xl font-bold tracking-wider text-blue-600 truncate">
                            {t('admin.title')}
                        </h1>
                    ) : (
                        <h1 className="text-xl font-black text-blue-600 lg:block hidden">
                            VM
                        </h1>
                    )}
                    {isCollapsed && (
                        <h1 className="text-xl font-bold tracking-wider text-blue-600 lg:hidden">
                            {t('admin.title')}
                        </h1>
                    )}
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-gray-500 hover:text-gray-700 cursor-pointer">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 space-y-8">
                    {/* Group 1: Main */}
                    <div className="px-4 space-y-1">
                        <SectionHeader label={t('admin.mainMenu')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'home'} onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }} icon={<LayoutDashboard size={20} />} label={t('admin.home')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'competitions'} onClick={() => { setActiveTab('competitions'); setIsSidebarOpen(false); }} icon={<Trophy size={20} />} label={t('admin.competitions')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'clubs'} onClick={() => { setActiveTab('clubs'); setIsSidebarOpen(false); }} icon={<Shield size={20} />} label={t('admin.teams')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'stadium'} onClick={() => { setActiveTab('stadium'); setIsSidebarOpen(false); }} icon={<MapPin size={20} />} label={t('admin.stadium')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'team_ranking'} onClick={() => { setActiveTab('team_ranking'); setIsSidebarOpen(false); }} icon={<BarChart2 size={20} />} label={t('admin.teamRanking')} isCollapsed={isCollapsed} />
                    </div>

                    {/* Group 2: People */}
                    <div className="px-4 space-y-1">
                        <SectionHeader label={t('admin.people')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'players'} onClick={() => { setActiveTab('players'); setIsSidebarOpen(false); }} icon={<Users size={20} />} label={t('admin.players')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'coaches'} onClick={() => { setActiveTab('coaches'); setIsSidebarOpen(false); }} icon={<UserCog size={20} />} label={t('admin.coaches')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'officials'} onClick={() => { setActiveTab('officials'); setIsSidebarOpen(false); }} icon={<Flag size={20} />} label={t('admin.officials')} isCollapsed={isCollapsed} />
                    </div>

                    {/* Group 3: Game Operations */}
                    <div className="px-4 space-y-1">
                        <SectionHeader label={t('admin.operations')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'matches'} onClick={() => { setActiveTab('matches'); setIsSidebarOpen(false); }} icon={<Swords size={20} />} label={t('admin.matches')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'escore'} onClick={() => { setActiveTab('escore'); setIsSidebarOpen(false); }} icon={<Star size={20} />} label={t('admin.vis')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'live_scorer'} onClick={() => { setActiveTab('live_scorer'); setIsSidebarOpen(false); }} icon={<PlayCircle size={20} />} label={t('admin.liveScorer')} isCollapsed={isCollapsed} />
                    </div>

                    {/* Group 4: System */}
                    <div className="px-4 space-y-1">
                        <SectionHeader label={t('admin.system')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'accounts'} onClick={() => { setActiveTab('accounts'); setIsSidebarOpen(false); }} icon={<UserCheck size={20} />} label={t('admin.accounts')} isCollapsed={isCollapsed} />
                        <MenuButton active={activeTab === 'pending_users'} onClick={() => { setActiveTab('pending_users'); setIsSidebarOpen(false); }} icon={<User size={20} />} label={t('admin.pendingUsers')} badge={pendingUsersCount} isCollapsed={isCollapsed} />
                    </div>
                </nav>

                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <button 
                        onClick={handleLogout} 
                        title={isCollapsed ? t('nav.logout') : undefined}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm transition-all shadow-sm cursor-pointer ${isCollapsed ? 'px-0' : ''}`}
                    >
                        <LogOut size={18} className="shrink-0" />
                        <span className={`transition-all duration-200 ${isCollapsed ? 'lg:hidden w-0 opacity-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                            {t('nav.logout')}
                        </span>
                    </button>
                </div>
            </aside>

            {/* ================= Main Content Area ================= */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Navbar ด้านบน */}
                <header className="h-16 bg-white flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={toggleSidebar} 
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="hidden md:block text-sm font-semibold text-gray-500 uppercase tracking-wider">
                            {t('admin.dashboard')} / <span className="text-gray-900">{getTabName(activeTab)}</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-3 lg:gap-6">
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

                        <button className="p-2 text-gray-400 hover:text-blue-600 transition relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>

                        <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>

                        {/* ชื่อผู้ใช้งาน */}
                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold text-gray-900 leading-none">
                                    {user?.username || 'Admin User'}
                                </p>
                                <p className="text-xs font-medium text-gray-500 mt-1">
                                    {language === 'THA' ? 'ผู้ดูแลระบบ' : 'Administrator'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md border-2 border-blue-100">
                                <User size={20} />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <div className="w-full">
                        {/* Render เนื้อหาตาม Tab */}
                        {activeTab === 'home' && <HomeTab />}
                        {activeTab === 'competitions' && <CompetitionsTab />}
                        {activeTab === 'clubs' && <ClubsTab />}
                        {activeTab === 'stadium' && <StadiumsTab />}
                        {activeTab === 'team_ranking' && <TeamRankingTab />}

                        {activeTab === 'players' && <PlayerViewTab />}
                        {activeTab === 'coaches' && <PlaceholderTab title="Coaches Management" />}
                        {activeTab === 'officials' && <OfficialsTab />}

                        {activeTab === 'accounts' && <AccountsTab />}
                        {activeTab === 'pending_users' && <PendingUsersTab />}
                        {activeTab === 'matches' && <MatchesManager />}
                        {activeTab === 'escore' && <EScoreTab />}
                        {activeTab === 'live_scorer' && <LiveScorerTab />}
                    </div>
                </main>
            </div>
        </div>
    );
}

// Helper: Sidebar Section Header
function SectionHeader({ label, isCollapsed }) {
    if (isCollapsed) {
        return (
            <>
                <div className="border-b border-gray-100 my-4 lg:block hidden" />
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 lg:hidden">{label}</p>
            </>
        );
    }
    return <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{label}</p>;
}

// Helper: Sidebar Menu Button
function MenuButton({ active, onClick, icon, label, badge, isCollapsed }) {
    return (
        <button
            onClick={onClick}
            title={isCollapsed ? label : undefined}
            className={`
                w-full flex items-center justify-between px-3 py-2.5 my-0.5 rounded-md text-sm font-medium transition-all duration-200 relative cursor-pointer
                ${isCollapsed ? 'lg:justify-center' : 'justify-between'}
                ${active
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
            `}
        >
            <div className="flex items-center gap-3 min-w-0">
                <span className={active ? 'text-blue-600 shrink-0' : 'text-gray-400 group-hover:text-gray-500 shrink-0'}>{icon}</span>
                <span className={`transition-all duration-200 truncate ${isCollapsed ? 'lg:hidden w-0 opacity-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                    {label}
                </span>
            </div>
            {!isCollapsed && badge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium min-w-[20px] text-center shrink-0 ${active ? 'bg-blue-100 text-blue-700' : 'bg-red-50 text-red-600'}`}>
                    {badge}
                </span>
            )}
            {isCollapsed && badge > 0 && (
                <>
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white lg:block hidden"></span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium min-w-[20px] text-center lg:hidden ${active ? 'bg-blue-100 text-blue-700' : 'bg-red-50 text-red-600'}`}>
                        {badge}
                    </span>
                </>
            )}
        </button>
    );
}