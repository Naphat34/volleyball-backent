import WorkspaceSearch from '../components/WorkspaceSearch';
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, MapPin, Flag, UserCog,
    UserCheck, LogOut, Users, Trophy, Swords, Shield,
    Star, BarChart2, Menu, X, User, Bell,
    PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useLanguage } from '../context/LanguageContext';
import { getStoredUser } from '../authStorage';

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
import OfficialsTab from './OfficialsTab';


const PlaceholderTab = ({ title }) => {
    const { language } = useLanguage();

    return (
        <div className="official-panel rounded-xl p-6">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">
                {language === 'THA' ? 'หน้านี้กำลังอยู่ระหว่างการพัฒนา...' : 'This page is under development...'}
            </p>
        </div>
    );
};



export default function AdminDashboard() {
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();
    const [activeTab, setActiveTab] = useState(() => {
        const storedTab = sessionStorage.getItem('adminActiveTab');
        return storedTab === 'live_scorer' ? 'home' : (storedTab || 'home');
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
    const [workspaceSearch, setWorkspaceSearch] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [user] = useState(() => getStoredUser());
    const [pendingUsersCount, setPendingUsersCount] = useState(0);

    useEffect(() => {
        const media = window.matchMedia('(min-width: 1024px)');
        const onChange = event => setIsDesktop(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const fetchPendingUsersCount = useCallback(async () => {
        try {
            const res = await api.getPendingUsers();
            if (res.data) setPendingUsersCount(res.data.length);
        } catch (error) {
            console.error('Error fetching pending users count', error);
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
            confirmButtonColor: '#2563eb',
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
                console.error('Logout failed', error);
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

    useEffect(() => {
        if (!isSidebarOpen) return;
        const onKey = event => { if (event.key === 'Escape') setIsSidebarOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isSidebarOpen]);

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
            escore: 'vis'
        };
        const key = mapping[tab] || tab;
        return t(`admin.${key}`);
    };

    const changeTab = (tab, search = '') => {
        setWorkspaceSearch(search);
        setActiveTab(tab);
        setIsSidebarOpen(false);
    };

    const sidebarSections = [
        {
            label: t('admin.mainMenu'),
            items: [
                { key: 'home', icon: <LayoutDashboard size={19} />, label: t('admin.home') },
                { key: 'competitions', icon: <Trophy size={19} />, label: t('admin.competitions') },
                { key: 'clubs', icon: <Shield size={19} />, label: t('admin.teams') },
                { key: 'stadium', icon: <MapPin size={19} />, label: t('admin.stadium') },
                { key: 'team_ranking', icon: <BarChart2 size={19} />, label: t('admin.teamRanking') },
            ],
        },
        {
            label: t('admin.people'),
            items: [
                { key: 'players', icon: <Users size={19} />, label: t('admin.players') },
                { key: 'coaches', icon: <UserCog size={19} />, label: t('admin.coaches') },
                { key: 'officials', icon: <Flag size={19} />, label: t('admin.officials') },
            ],
        },
        {
            label: t('admin.operations'),
            items: [
                { key: 'matches', icon: <Swords size={19} />, label: t('admin.matches') },
                { key: 'escore', icon: <Star size={19} />, label: t('admin.vis') },
            ],
        },
        {
            label: t('admin.system'),
            items: [
                { key: 'accounts', icon: <UserCheck size={19} />, label: t('admin.accounts') },
                { key: 'pending_users', icon: <User size={19} />, label: t('admin.pendingUsers'), badge: pendingUsersCount },
            ],
        },
    ];

    return (
        <div className="workspace-shell app-page flex overflow-hidden font-sans">
            {isSidebarOpen && (
                <div
                className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside inert={!isDesktop && !isSidebarOpen} aria-hidden={!isDesktop && !isSidebarOpen} className={`
                fixed inset-y-0 left-0 z-40 flex flex-col overflow-x-hidden border-r border-slate-200/80 bg-white transition-all duration-300 transform
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 lg:static lg:inset-0
                ${isCollapsed ? 'lg:w-[84px]' : 'lg:w-72'}
                w-72
            `}>
                <div className={`h-[76px] flex items-center justify-between px-5 border-b border-slate-200/70 bg-white/95 ${isCollapsed ? 'lg:px-4 lg:justify-center' : ''}`}>
                    {!isCollapsed ? (
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]">
                                <Trophy size={21} />
                            </div>
                            <div className="min-w-0">
                            <h1 className="truncate text-base font-semibold tracking-tight text-slate-950">
                                {t('admin.title')}
                            </h1>
                            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                                {language === 'THA' ? 'ระบบจัดการการแข่งขัน' : 'Competition control panel'}
                            </p>
                            </div>
                        </div>
                    ) : (
                        <div className="hidden h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)] lg:flex">
                            <Trophy size={21} />
                        </div>
                    )}
                    {isCollapsed && (
                        <h1 className="text-base font-semibold tracking-tight text-slate-950 lg:hidden">
                            {t('admin.title')}
                        </h1>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                        aria-label="Close sidebar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-5">
                    <div className="space-y-6">
                        {sidebarSections.map((section) => (
                            <div key={section.label} className="space-y-1">
                                <SectionHeader label={section.label} isCollapsed={isCollapsed} />
                                {section.items.map((item) => (
                                    <MenuButton
                                        key={item.key}
                                        active={activeTab === item.key}
                                        onClick={() => changeTab(item.key)}
                                        icon={item.icon}
                                        label={item.label}
                                        badge={item.badge}
                                        isCollapsed={isCollapsed}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </nav>

                <div className="border-t border-slate-200/80 bg-white/75 p-4">
                    <button
                        onClick={handleLogout}
                        title={isCollapsed ? t('nav.logout') : undefined}
                        className={`w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 cursor-pointer ${isCollapsed ? 'px-0' : ''}`}
                    >
                        <LogOut size={18} className="shrink-0" />
                        <span className={`transition-all duration-200 ${isCollapsed ? 'lg:hidden w-0 opacity-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                            {t('nav.logout')}
                        </span>
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 bg-transparent">
                <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white px-4 lg:px-7">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={toggleSidebar}
                            className="rounded-xl border border-blue-100 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                            aria-label="Toggle sidebar"
                        >
                            <span className="lg:hidden"><Menu size={22} /></span>
                            <span className="hidden lg:block">
                                {isCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
                            </span>
                        </button>
                        <div className="min-w-0">
                            <p className="hidden text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">
                                {t('admin.dashboard')}
                            </p>
                            <h2 className="truncate text-xl font-bold tracking-tight text-slate-950">
                                {getTabName(activeTab)}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4">
                        <WorkspaceSearch onSelect={(tab, label) => changeTab(tab, label)} />
                        <div className="hidden items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm md:flex">
                            <Shield size={15} className="text-blue-500" />
                            Admin Panel
                        </div>

                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
                            <button
                                onClick={() => setLanguage('THA')}
                                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                    language === 'THA'
                                        ? 'bg-white text-slate-950 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                TH
                            </button>
                            <button
                                onClick={() => setLanguage('ENG')}
                                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                    language === 'ENG'
                                        ? 'bg-white text-slate-950 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                EN
                            </button>
                        </div>

                        <button onClick={() => changeTab('pending_users')} className="relative rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700" aria-label={language === 'THA' ? 'ดูรายการรออนุมัติ' : 'View pending approvals'}>
                            <Bell size={20} />
                            {pendingUsersCount > 0 && (
                                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-rose-500"></span>
                            )}
                        </button>

                        <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                        <div className="flex items-center gap-3 pl-1">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold text-slate-900 leading-none">
                                    {user?.username || 'Admin User'}
                                </p>
                                <p className="text-xs font-medium text-slate-500 mt-1">
                                    {language === 'THA' ? 'ผู้ดูแลระบบ' : 'Administrator'}
                                </p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm ring-4 ring-slate-100">
                                <User size={18} />
                            </div>
                        </div>
                    </div>
                </header>

                <main id="main-content" className="workspace-content flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-transparent">
                    <div className="mx-auto w-full max-w-[1600px]">
                        {activeTab === 'home' && <HomeTab onNavigate={changeTab} pendingUsersCount={pendingUsersCount} />}
                        {activeTab === 'competitions' && <CompetitionsTab />}
                        {activeTab === 'clubs' && <ClubsTab initialSearch={workspaceSearch} />}
                        {activeTab === 'stadium' && <StadiumsTab />}
                        {activeTab === 'team_ranking' && <TeamRankingTab />}

                        {activeTab === 'players' && <PlayerViewTab />}
                        {activeTab === 'coaches' && <PlaceholderTab title="Coaches Management" />}
                        {activeTab === 'officials' && <OfficialsTab />}

                        {activeTab === 'accounts' && <AccountsTab />}
                        {activeTab === 'pending_users' && <PendingUsersTab />}
                        {activeTab === 'matches' && <MatchManagementTab />}
                        {activeTab === 'escore' && <EScoreTab />}
                    </div>
                </main>
            </div>
        </div>
    );
}

function SectionHeader({ label, isCollapsed }) {
    if (isCollapsed) {
        return (
            <>
                <div className="my-4 hidden border-b border-slate-200/80 lg:block" />
                <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 lg:hidden">{label}</p>
            </>
        );
    }

    return <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>;
}

function MenuButton({ active, onClick, icon, label, badge, isCollapsed }) {
    return (
        <button
            onClick={onClick}
            title={isCollapsed ? label : undefined}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`
                group min-h-11 w-full flex items-center justify-between px-3 py-2.5 my-0.5 rounded-xl text-sm font-semibold transition-all duration-200 relative cursor-pointer
                ${isCollapsed ? 'lg:justify-center' : 'justify-between'}
                ${active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }
            `}
        >
            <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-opacity ${active ? 'bg-blue-500 opacity-100' : 'opacity-0'}`} />
            <div className="flex items-center gap-3 min-w-0">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    active
                        ? 'bg-white/10 text-white ring-1 ring-white/10'
                        : 'bg-white text-slate-400 ring-1 ring-blue-100 group-hover:text-blue-600 group-hover:ring-blue-200'
                }`}>{icon}</span>
                <span className={`transition-all duration-200 truncate ${isCollapsed ? 'lg:hidden w-0 opacity-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                    {label}
                </span>
            </div>
            {!isCollapsed && badge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[20px] text-center shrink-0 ${active ? 'bg-white/15 text-white' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'}`}>
                    {badge}
                </span>
            )}
            {isCollapsed && badge > 0 && (
                <>
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white lg:block hidden"></span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold min-w-[20px] text-center lg:hidden ${active ? 'bg-white/15 text-white' : 'bg-rose-50 text-rose-600'}`}>
                        {badge}
                    </span>
                </>
            )}
        </button>
    );
}
