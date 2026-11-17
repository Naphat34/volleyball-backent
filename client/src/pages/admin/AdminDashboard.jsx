import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, MapPin, Flag, Swords, UserCheck, Users, Trophy, Shield, Star, BarChart2, User, ListChecks, FileText, KeyRound } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { getStoredUser } from '../../auth/authStorage';
import { useVisTheme } from '../../components/vis/visThemeContext';
import AdminWorkspaceShell from '../../components/admin/AdminWorkspaceShell';
import GlobalSearch from '../../components/layout/GlobalSearch';
import CompetitionsTab from '../../components/admin/CompetitionsTab';
import HomeTab from '../../components/admin/HomeTab';
import AdminControlCenter from '../../components/admin/AdminControlCenter';
import AdminReportCenter from '../../components/admin/AdminReportCenter';
import './AdminConsole.css';
import MatchManagementTab from '../../components/admin/MatchManagementTab';
import PlayerViewTab from '../../components/admin/PlayerViewTab';
import ClubsTab from '../../components/admin/ClubsTab';
import AccountsTab from '../../components/admin/AccountsTab';
import PendingUsersTab from '../../components/admin/PendingUsersTab';
import EScoreTab from '../../components/admin/EScoreTab';
import StadiumsTab from '../../components/admin/StadiumsTab';
import TeamRankingTab from '../../components/admin/TeamRankingTab';
import OfficialsTab from '../../components/admin/OfficialsTab';
import CompetitionWorkflowTab from '../../components/admin/CompetitionWorkflowTab';



export default function AdminDashboard() {
    const [params,setParams] = useSearchParams();
    const { language,t } = useLanguage(), { theme: adminTheme } = useVisTheme();
    const user=getStoredUser(),organizer=user?.role==='organizer';
    const allowed=organizer?['competitions','matches','workflow']:['home','action_center','competition_overview','competitions','clubs','stadium','team_ranking','players','officials','accounts','pending_users','matches','escore','reports','workflow'];
    const requested=params.get('view'), activeTab=allowed.includes(requested)?requested:organizer?'competitions':'home';
    const [clubSearch,setGlobalSearch]=useState(''),[adminContext,setAdminContext]=useState(null),[pendingUsersCount,setPendingUsersCount]=useState(0);
    const fetchPendingUsersCount=useCallback(async()=>{
        if(organizer)return;
        try{const response=await api.getPendingUsers();setPendingUsersCount(response.data?.length||0);}catch{setPendingUsersCount(0);}
    },[organizer]);
    useEffect(()=>{void fetchPendingUsersCount();},[fetchPendingUsersCount,activeTab]);
    const changeTab=(tab,search='')=>{
        if(!allowed.includes(tab))return;
        setGlobalSearch(typeof search==='string'?search:'');setAdminContext(typeof search==='object'?search:null);
        setParams(tab==='home'?{}:{view:tab});
    };
    const tr = (thai, english) => language === 'THA' ? thai : english;
    const sidebarSections = [
        { label: tr('ภาพรวม', 'Overview'), items: [
            { key: 'home', icon: <LayoutDashboard size={19} />, label: tr('ศูนย์บริหารการแข่งขัน', 'Control center') },
            { key: 'action_center', icon: <ListChecks size={19} />, label: tr('งานที่ต้องดำเนินการ', 'Action center') }
        ]},
        { label: tr('การแข่งขัน', 'Competition'), items: [
            { key: 'competitions', icon: <Trophy size={19} />, label: t('admin.competitions') },
            { key: 'matches', icon: <Swords size={19} />, label: tr('ตารางและผลการแข่งขัน', 'Fixtures & results') },
            { key: 'workflow', icon: <Swords size={19} />, label: tr('รอบ สาย และทีมเข้ารอบ', 'Pools & advancement') },
            { key: 'competition_overview', icon: <LayoutDashboard size={19} />, label: tr('รายละเอียดรายการ', 'Competition details') },
            { key: 'stadium', icon: <MapPin size={19} />, label: t('admin.stadium') },
            { key: 'team_ranking', icon: <BarChart2 size={19} />, label: t('admin.teamRanking') }
        ]},
        { label: tr('ทีมและบุคลากร', 'Teams & people'), items: [
            { key: 'clubs', icon: <Shield size={19} />, label: t('admin.teams') },
            { key: 'players', icon: <Users size={19} />, label: t('admin.players') },
            { key: 'officials', icon: <Flag size={19} />, label: t('admin.officials') }
        ]},
        { label: tr('การบันทึก', 'Match operations'), items: [
            { key: 'escore', icon: <Star size={19} />, label: tr('ศูนย์ข้อมูล VIMS', 'VIMS statistics') }
        ]},
        { label: tr('รายงาน', 'Reports'), items: [
            { key: 'reports', icon: <FileText size={19} />, label: tr('รายงานและเอกสาร', 'Reports & documents') }
        ]},
        { label: tr('ดูแลระบบ', 'Administration'), items: [
            { key: 'accounts', icon: <UserCheck size={19} />, label: t('admin.accounts') },
            { key: 'pending_users', icon: <User size={19} />, label: t('admin.pendingUsers'), badge: pendingUsersCount }
        ]}
    ];

    if(!organizer)sidebarSections.push({label:tr('สิทธิ์และการตรวจรับ','Access & review'),items:[{key:'access',icon:<KeyRound size={19}/>,label:tr('ผู้ใช้และสิทธิ์รายการ','Access center'),href:'/access-center'}]});
    const visibleSections=organizer?sidebarSections.map(section=>({...section,items:section.items.filter(item=>allowed.includes(item.key))})).filter(section=>section.items.length):sidebarSections;
    const currentPage=visibleSections.flatMap(section=>section.items).find(item=>item.key===activeTab);
    return <AdminWorkspaceShell user={user} sections={visibleSections} activeKey={activeTab} onSelect={tab=>changeTab(tab)}
        title={activeTab==='home'?tr('ภาพรวมระบบการแข่งขัน','Competition overview'):currentPage?.label}
        subtitle={tr('ติดตามการแข่งขัน ความพร้อม และงานที่ต้องดำเนินการ','Monitor competitions, readiness and pending work')}
        headerActions={<GlobalSearch onSelect={(tab,label)=>changeTab(tab,label)}/>}>
        {activeTab==='home'&&<AdminControlCenter embedded theme={adminTheme} onNavigate={changeTab}/>}
        {activeTab==='action_center'&&<AdminControlCenter theme={adminTheme} onNavigate={changeTab} actionsOnly/>}
        {activeTab==='competition_overview'&&<HomeTab/>}
        {activeTab==='reports'&&<AdminReportCenter onNavigate={changeTab}/>}
        {activeTab==='competitions'&&<CompetitionsTab/>}
        {activeTab==='clubs'&&<ClubsTab initialSearch={clubSearch}/>}
        {activeTab==='stadium'&&<StadiumsTab/>}
        {activeTab==='team_ranking'&&<TeamRankingTab/>}
        {activeTab==='players'&&<PlayerViewTab/>}
        {activeTab==='officials'&&<OfficialsTab/>}
        {activeTab==='accounts'&&<AccountsTab/>}
        {activeTab==='pending_users'&&<PendingUsersTab/>}
        {activeTab==='matches'&&<MatchManagementTab initialCompetitionId={params.get('competitionId')||adminContext?.competitionId} initialMatchId={adminContext?.matchId}/>}
        {activeTab==='workflow'&&<CompetitionWorkflowTab/>}
        {activeTab==='escore'&&<EScoreTab theme={adminTheme}/>}
    </AdminWorkspaceShell>;
}
