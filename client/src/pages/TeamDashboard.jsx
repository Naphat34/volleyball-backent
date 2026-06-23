import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    Users,
    Trophy,
    UserPlus,
    Calendar,
    Shield,
    Briefcase,
    Activity,
    Edit2,
    PlayCircle,
    Trash2,
    MapPin,
    User,
    X,
    Star,
    Search,
    Download,
    LogOut,
    BarChart2,
    Swords,
    Printer
} from 'lucide-react';

import { formatThaiDate, formatThaiDateTime, calculateAge } from '../utils';
import O2FormLoader from '../utils/O2FormLoader';
import { useLanguage } from '../context/LanguageContext';

// Toast Configuration
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

export default function TeamDashboard() {
    const { language, setLanguage, t } = useLanguage();

    const formatDate = (date) => {
        if (!date) return 'TBD';
        if (language === 'THA') {
            return formatThaiDate(date);
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'TBD';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatDateTime = (date) => {
        if (!date) return 'TBD';
        if (language === 'THA') {
            return formatThaiDateTime(date);
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'TBD';
        const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${datePart} ${hours}:${minutes}`;
    };

    const translateRole = (role) => {
        if (language !== 'THA') return role;
        const rolesMap = {
            'Team Manager': 'ผู้จัดการทีม',
            'Head Coach': 'ผู้ฝึกสอนหลัก',
            'Assistant Coach': 'ผู้ช่วยผู้ฝึกสอน 1',
            'Assistant Coach 2': 'ผู้ช่วยผู้ฝึกสอน 2',
            'Doctor': 'แพทย์ประจำทีม',
            'Therapist/Trainer': 'นักกายภาพ/เทรนเนอร์'
        };
        return rolesMap[role] || role;
    };

    const [activeTab, setActiveTab] = useState(() => {
        return sessionStorage.getItem('teamActiveTab') || 'roster';
    });
    const [players, setPlayers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [playerStats, setPlayerStats] = useState([]);

    const togglePlayerMatchSelection = async (player) => {
        const newIsPlaying = !player.is_playing;
        
        // Optimistic UI update
        setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, is_playing: newIsPlaying } : p));
        
        try {
            await api.updatePlayer(player.id, { is_playing: newIsPlaying });
        } catch {
            // Revert on error
            setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, is_playing: player.is_playing } : p));
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
                icon: 'error', title: 'Failed to update status'
            });
        }
    };
    const [statsGenderFilter, setStatsGenderFilter] = useState('All');
    const [rosterGenderFilter, setRosterGenderFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    const [openCompetitions, setOpenCompetitions] = useState([]);
    const [myCompetitions, setMyCompetitions] = useState([]);
    const [myMatches, setMyMatches] = useState([]);
    const [scheduleFilterId, setScheduleFilterId] = useState('all'); // State สำหรับกรอง Match Schedule

    const [teamInfo, setTeamInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditingTeam, setIsEditingTeam] = useState(false);
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [teamForm, setTeamForm] = useState({ name: '', code: '', logo_url: '' });

    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [editingStaffId, setEditingStaffId] = useState(null);
    const [viewingStatsPlayer, setViewingStatsPlayer] = useState(null);
    const [statsData, setStatsData] = useState(null);

    const [playerForm, setPlayerForm] = useState({
        number: '',
        first_name: '',
        last_name: '',
        nickname: '',
        position: 'OH',
        height_cm: '',
        weight: '',
        birth_date: '',
        nationality: '',
        photo: '',
        gender: 'Male',
        is_captain: false,
        is_libero1: false,
        is_libero2: false
    });

    const [staffForm, setStaffForm] = useState({ first_name: '', last_name: '', role: 'Head Coach', gender: 'Male' });

    const navigate = useNavigate();

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

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'roster') {
                const res = await api.getMyPlayers();
                setPlayers(res.data);
            } else if (activeTab === 'staff') {
                const res = await api.getMyStaff();
                setStaff(res.data);
            } else if (activeTab === 'competitions') {
                const [resOpen, resMy] = await Promise.all([
                    api.getOpenCompetitions(),
                    api.getMyCompetitions()
                ]);
                // กรองรายการที่สมัครไปแล้วออกจากรายการที่เปิดรับสมัคร
                const myCompIds = resMy.data.map(c => c.id);
                setOpenCompetitions(resOpen.data.filter(c => c.status === 'open' && !myCompIds.includes(c.id)));
                setMyCompetitions(resMy.data);
            } else if (activeTab === 'stats') {
                const res = await api.getMyPlayersStats();
                setPlayerStats(res.data);
            } else if (activeTab === 'schedule') {
                // ดึงทั้ง Match และ Competitions ของทีมเราเอง
                const [resComps, resMatches] = await Promise.all([
                    api.getMyCompetitions(),
                    api.getMyMatches()
                ]);
                setMyMatches(resMatches.data || []);
                setMyCompetitions(resComps.data);
            } else if (activeTab === 'print') {
                const [resPlayers, resStaff, resMy, resTeam] = await Promise.all([
                    api.getMyPlayers(),
                    api.getMyStaff(),
                    api.getMyCompetitions(),
                    api.getMyTeam()
                ]);
                setPlayers(resPlayers.data);
                setStaff(resStaff.data);
                setMyCompetitions(resMy.data);
                setTeamInfo(resTeam.data);
            }
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab, navigate]);

    useEffect(() => {
        fetchData();
    }, [activeTab, fetchData]);

    useEffect(() => {
        sessionStorage.setItem('teamActiveTab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const [resTeam, resMy] = await Promise.all([
                    api.getMyTeam(),
                    api.getMyCompetitions()
                ]);

                const info = resTeam.data;
                const myComps = resMy.data;

                const savedTab = sessionStorage.getItem('teamActiveTab');
                if (savedTab) {
                    setActiveTab(savedTab);
                } else {
                    if (myComps.length === 0) {
                        setActiveTab('competitions');
                    } else {
                        setActiveTab('roster');
                    }
                }

                try {
                    const resStaff = await api.getMyStaff();
                    const headCoach = resStaff.data.find(s => s.role === 'Head Coach') || resStaff.data[0];
                    if (headCoach) {
                        info.coach = `${headCoach.first_name} ${headCoach.last_name}`;
                    }
                } catch {
                    // No staff found
                }

                setTeamInfo(info);
                setMyCompetitions(myComps);
                setIsCreatingTeam(false);
            } catch (err) {
                if (err.response?.status === 400) {
                    setTeamInfo(null);
                    setIsCreatingTeam(true);
                } else {
                    console.error("Error fetching team info:", err);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handlePlayerSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPlayerId) {
                await api.updatePlayer(editingPlayerId, playerForm);
                Toast.fire({ icon: 'success', title: language === 'THA' ? 'อัปเดตข้อมูลผู้เล่นเรียบร้อยแล้ว' : 'Player updated successfully' });
            } else {
                await api.addPlayer(playerForm);
                Toast.fire({ icon: 'success', title: language === 'THA' ? 'เพิ่มผู้เล่นเรียบร้อยแล้ว' : 'Player added successfully' });
            }
            resetPlayerForm();
            fetchData();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'บันทึกข้อมูลผู้เล่นล้มเหลว' : 'Failed to save player') });
        }
    };

    const resetPlayerForm = () => {
        setEditingPlayerId(null);
        setPlayerForm({
            number: '', first_name: '', last_name: '', nickname: '',
            position: 'OH', height_cm: '', weight: '',
            birth_date: '', nationality: '', photo: '',
            gender: 'Male', is_captain: false,
            is_libero1: false, is_libero2: false
        });
    };

    const handleEditPlayer = (p) => {
        setEditingPlayerId(p.id);
        setPlayerForm({
            number: p.number ?? '', first_name: p.first_name ?? '', last_name: p.last_name ?? '',
            nickname: p.nickname ?? '', position: p.position ?? 'OH', height_cm: p.height_cm ?? '',
            weight: p.weight ?? '', birth_date: p.birth_date ? p.birth_date.split('T')[0] : '',
            nationality: p.nationality ?? '', photo: p.photo ?? '', gender: p.gender ?? 'Male',
            is_captain: p.is_captain ?? false,
            is_libero1: p.is_libero1 ?? false,
            is_libero2: p.is_libero2 ?? false
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleStaffSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStaffId) {
                await api.updateStaff(editingStaffId, staffForm);
                Toast.fire({ icon: 'success', title: language === 'THA' ? 'อัปเดตข้อมูลเจ้าหน้าที่เรียบร้อยแล้ว' : 'Staff updated successfully' });
            } else {
                await api.addStaff(staffForm);
                Toast.fire({ icon: 'success', title: language === 'THA' ? 'เพิ่มเจ้าหน้าที่เรียบร้อยแล้ว' : 'Staff added successfully' });
            }
            resetStaffForm();
            fetchData();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'บันทึกข้อมูลเจ้าหน้าที่ล้มเหลว' : 'Failed to save staff') });
        }
    };

    const resetStaffForm = () => {
        setEditingStaffId(null);
        setStaffForm({ first_name: '', last_name: '', role: 'Head Coach', gender: 'Male' });
    };

    const handleEditStaff = (s) => {
        setEditingStaffId(s.id);
        setStaffForm({
            first_name: s.first_name || '', last_name: s.last_name || '',
            role: s.role || 'Head Coach', gender: s.gender || 'Male'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteStaff = async (id) => {
        const result = await Swal.fire({
            title: t('team.removeStaffTitle'),
            text: t('team.removeStaffText'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: t('team.removeStaffConfirm'),
            cancelButtonText: t('common.cancel')
        });
        if (!result.isConfirmed) return;

        try {
            await api.deleteStaff(id);
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'ลบข้อมูลเจ้าหน้าที่เรียบร้อยแล้ว' : 'Staff removed successfully' });
            fetchData();
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'ลบข้อมูลเจ้าหน้าที่ล้มเหลว' : 'Failed to remove staff') });
        }
    };

    const handleJoinCompetition = async (id) => {
        try {
            const comp = openCompetitions.find(c => c.id === id);
            if (comp && comp.max_players && players.length > comp.max_players) {
                Swal.fire(t('common.error'), language === 'THA' ? `ไม่สามารถเข้าร่วมได้ เนื่องจากจำนวนผู้เล่นในทีม (${players.length}) เกินขีดจำกัดที่กำหนดไว้คือ ${comp.max_players} คน` : `Cannot join. Your team roster (${players.length}) exceeds the limit of ${comp.max_players} players.`, 'error');
                return;
            }
            await api.joinCompetition(id);
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'เข้าร่วมรายการแข่งขันเรียบร้อยแล้ว!' : 'Joined competition!' });
            fetchData();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'ไม่สามารถเข้าร่วมได้' : 'Failed to join') });
        }
    };

    const handleLeaveCompetition = async (id) => {
        const result = await Swal.fire({
            title: t('team.leaveCompTitle'),
            text: t('team.leaveCompText'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: t('team.leaveCompConfirm'),
            cancelButtonText: t('common.cancel')
        });

        if (result.isConfirmed) {
            try {
                await api.leaveCompetition(id);
                Toast.fire({ icon: 'success', title: language === 'THA' ? 'ถอนตัวจากรายการแข่งขันเรียบร้อยแล้ว' : 'Left competition successfully' });
                fetchData();
            } catch (err) {
                Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'ไม่สามารถถอนตัวได้' : 'Failed to leave') });
            }
        }
    };

    const handleViewStats = async (player) => {
        setViewingStatsPlayer(player);
        setStatsData({});
        try {
            const res = await api.getPlayerStats(player.id);
            setStatsData(res.data);
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: language === 'THA' ? 'โหลดข้อมูลสถิติล้มเหลว' : 'Failed to load stats' });
            setViewingStatsPlayer(null);
        }
    };

    const filteredStats = playerStats.filter(p =>
        statsGenderFilter === 'All' || p.gender === statsGenderFilter
    );

    const getStatValue = (p, type) => {
        if (!p) return 0;
        if (type === 'score') return (Number(p.attack_kills) || 0) + (Number(p.block_points) || 0) + (Number(p.serve_aces) || 0);
        if (type === 'block') return Number(p.block_points) || 0;
        if (type === 'serve') return Number(p.serve_aces) || 0;
        if (type === 'dig') return Number(p.digs) || 0;
        return 0;
    };

    const topScorer = [...filteredStats].sort((a, b) => getStatValue(b, 'score') - getStatValue(a, 'score'))[0];
    const topBlocker = [...filteredStats].sort((a, b) => getStatValue(b, 'block') - getStatValue(a, 'block'))[0];
    const topServer = [...filteredStats].sort((a, b) => getStatValue(b, 'serve') - getStatValue(a, 'serve'))[0];
    const topDefender = [...filteredStats].sort((a, b) => getStatValue(b, 'dig') - getStatValue(a, 'dig'))[0];

    const handleDeletePlayer = async (id) => {
        const result = await Swal.fire({
            title: t('team.removePlayerTitle'),
            text: t('team.removePlayerText'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: t('team.removePlayerConfirm'),
            cancelButtonText: t('common.cancel')
        });
        if (!result.isConfirmed) return;

        try {
            await api.deletePlayer(id);
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'ลบผู้เล่นเรียบร้อยแล้ว' : 'Player removed successfully' });
            fetchData();
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'ลบผู้เล่นล้มเหลว' : 'Failed to remove player') });
        }
    };

    const filteredPlayers = players.filter(p =>
        (rosterGenderFilter === 'All' || p.gender === rosterGenderFilter) &&
        (
            p.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.nickname && p.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
            p.number.toString().includes(searchTerm)
        )
    );

    const handleExportCSV = () => {
        if (filteredPlayers.length === 0) {
            Toast.fire({ icon: 'info', title: language === 'THA' ? 'ไม่มีรายชื่อนักกีฬาเพื่อส่งออกข้อมูล' : 'No players to export' });
            return;
        }

        const headers = ["Number,First Name,Last Name,Nickname,Position,Height (cm),Weight (kg),Birth Date,Nationality,Captain"];
        const rows = filteredPlayers.map(p => [
            p.number, `"${p.first_name}"`, `"${p.last_name}"`, `"${p.nickname || ''}"`,
            p.position, p.height_cm || '', p.weight || '',
            p.birth_date ? p.birth_date.split('T')[0] : '', p.nationality || '', p.is_captain ? 'Yes' : 'No'
        ].join(','));

        const csvContent = "\uFEFF" + [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "team_roster.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEditTeamClick = () => {
        if (teamInfo) {
            setTeamForm({
                name: teamInfo.name || '',
                code: teamInfo.code || '',
                logo_url: teamInfo.logo_url || ''
            });
            setIsEditingTeam(true);
        }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        try {
            const res = await api.createMyTeam(teamForm);
            setTeamInfo(res.data);
            setIsCreatingTeam(false);
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'สร้างข้อมูลทีมเรียบร้อยแล้ว' : 'Team created successfully' });
            fetchData();
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'สร้างข้อมูลทีมไม่สำเร็จ' : 'Failed to create team') });
        }
    };

    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        try {
            const res = await api.updateMyTeam(teamForm);
            setTeamInfo(prev => ({ ...prev, ...res.data }));
            setIsEditingTeam(false);
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'อัปเดตข้อมูลทีมเรียบร้อยแล้ว' : 'Team updated successfully' });
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: language === 'THA' ? 'อัปเดตข้อมูลทีมไม่สำเร็จ' : 'Failed to update team' });
        }
    };

    const handleDeleteTeam = async () => {
        const result = await Swal.fire({
            title: language === 'THA' ? 'ลบทีม?' : 'Delete Team?',
            text: language === 'THA' ? 'การดำเนินการนี้จะลบข้อมูลทีมของคุณรวมถึงข้อมูลที่เกี่ยวข้องทั้งหมดอย่างถาวร (ผู้เล่น, เจ้าหน้าที่, แมตช์) และไม่สามารถกู้คืนได้!' : "This will permanently delete your team and all associated data (players, staff, matches). This action cannot be undone!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: language === 'THA' ? 'ใช่, ลบออก!' : 'Yes, delete it!',
            cancelButtonText: t('common.cancel')
        });

        if (result.isConfirmed) {
            try {
                await api.deleteMyTeam();
                setTeamInfo(null);
                setIsCreatingTeam(true);
                setIsEditingTeam(false);
                setPlayers([]);
                setStaff([]);
                Swal.fire(language === 'THA' ? 'ลบแล้ว!' : 'Deleted!', language === 'THA' ? 'ทีมของคุณถูกลบเรียบร้อยแล้ว.' : 'Your team has been deleted.', 'success');
            } catch (err) {
                console.error(err);
                Toast.fire({ icon: 'error', title: language === 'THA' ? 'ลบทีมไม่สำเร็จ' : 'Failed to delete team' });
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">{language === 'THA' ? 'กำลังโหลดแดชบอร์ด...' : 'Loading Dashboard...'}</p>
                </div>
            </div>
        );
    }

    if (isCreatingTeam) {
        return (
            <div className="min-h-screen bg-gray-50 transition-colors duration-300 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-lg shadow-xl border border-gray-100 p-8">
                    <div className="text-center mb-8">
                        <div className="bg-blue-600 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                            <Shield className="text-white w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('team.createTitle')}</h1>
                        <p className="text-gray-500 mt-2">{t('team.createSubtitle')}</p>
                    </div>

                    <form onSubmit={handleCreateTeam} className="space-y-5">
                        <Input
                            label={t('team.name')} placeholder="e.g. Bangkok Volley Club"
                            value={teamForm.name} required onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                        />
                        <Input
                            label={t('team.code')} placeholder="e.g. BVC"
                            value={teamForm.code} required onChange={e => setTeamForm({ ...teamForm, code: e.target.value })}
                        />
                        <Input
                            label={t('team.logoUrl')} placeholder="https://example.com/logo.png"
                            value={teamForm.logo_url} onChange={e => setTeamForm({ ...teamForm, logo_url: e.target.value })}
                        />

                        <div className="pt-4 flex flex-col gap-3">
                            <Button type="submit" label={t('team.createBtn')} icon={<Shield size={20} />} full className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 py-3 text-lg cursor-pointer" />
                            <button type="button" onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500 transition flex items-center justify-center gap-1 cursor-pointer">
                                <LogOut size={16} /> {t('team.signOut')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden transition-colors duration-300">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {teamInfo?.logo_url ? (
                            <img
                                src={teamInfo.logo_url} alt={teamInfo.name}
                                className="w-10 h-10 object-contain rounded-lg bg-white border border-gray-200"
                                onError={(e) => { e.target.style.display = 'none' }}
                            />
                        ) : (
                            <div className="bg-blue-600 p-2 rounded-lg"><Shield className="text-white w-6 h-6" /></div>
                        )}
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{teamInfo?.name || t('team.dashboard')}</h1>
                            {teamInfo?.coach && <p className="text-xs text-gray-500 font-medium">{language === 'THA' ? 'ผู้ฝึกสอน' : 'Coach'}: {teamInfo.coach}</p>}
                            <button onClick={handleEditTeamClick} className="text-xs text-blue-600 hover:text-indigo-800 flex items-center gap-1 mt-1 cursor-pointer">
                                <Edit2 size={12} /> {t('team.editTeam')}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
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
                        <button onClick={handleLogout} className="text-sm font-medium text-gray-500 hover:text-red-600 transition cursor-pointer">
                            {t('team.signOut')}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar - Tabs */}
                <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col">
                    <div className="p-4 md:p-6 flex flex-col flex-1 overflow-y-auto">
                        <nav className="flex flex-row md:flex-col space-x-4 md:space-x-0 md:space-y-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0" aria-label="Tabs">
                            <TabButton active={activeTab === 'competitions'} onClick={() => setActiveTab('competitions')} icon={<Trophy size={18} className="mr-2" />} label={t('team.tabCompetitions')} />
                            <TabButton active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={<Calendar size={18} className="mr-2" />} label={t('team.tabSchedule')} />
                            <TabButton active={activeTab === 'roster'} onClick={() => setActiveTab('roster')} icon={<Users size={18} className="mr-2" />} label={t('team.tabRoster')} />
                            <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart2 size={18} className="mr-2" />} label={t('team.tabStats')} />
                            <TabButton active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<Briefcase size={18} className="mr-2" />} label={t('team.tabStaff')} />
                            <TabButton active={activeTab === 'print'} onClick={() => setActiveTab('print')} icon={<Printer size={18} className="mr-2" />} label={t('team.tabPrint')} />
                        </nav>
                        <div className="mt-auto pt-6 border-t border-gray-100 hidden md:block">
                            <button onClick={handleLogout} className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-200 group cursor-pointer">
                                <LogOut size={20} className="mr-3 text-gray-400 group-hover:text-red-500 transition-colors" />
                                {t('team.signOut')}
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">

                    {/* ========================== ROSTER TAB ========================== */}
                    {activeTab === 'roster' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-md shadow-sm border border-gray-100 sticky top-0 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-50 p-2 rounded-full">
                                                {editingPlayerId ? <Edit2 className="text-orange-600 w-5 h-5" /> : <UserPlus className="text-blue-600 w-5 h-5" />}
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-800">
                                                {editingPlayerId ? t('team.editPlayer') : t('team.addPlayer')}
                                            </h2>
                                        </div>
                                        {editingPlayerId && (
                                            <button onClick={resetPlayerForm} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer">
                                                <X size={14} /> {t('common.cancel')}
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-6">
                                        <form onSubmit={handlePlayerSubmit} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.number')} value={playerForm.number} required onChange={e => setPlayerForm({ ...playerForm, number: e.target.value })} />
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('team.position')}</label>
                                                    <select value={playerForm.position} onChange={e => setPlayerForm({ ...playerForm, position: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm text-gray-900">
                                                        <option value="OH">{language === 'THA' ? 'OH - ตัวตบหัวเสา' : 'OH - Outside Hitter'}</option>
                                                        <option value="OPP">{language === 'THA' ? 'OPP - ตัวตบตรงข้ามหัวเสา' : 'OPP - Opposite'}</option>
                                                        <option value="S">{language === 'THA' ? 'S - ตัวเซต' : 'S - Setter'}</option>
                                                        <option value="MB">{language === 'THA' ? 'MB - ตัวบล็อกกลาง' : 'MB - Middle Blocker'}</option>
                                                        <option value="L">{language === 'THA' ? 'L - ตัวรับอิสระ (ลิเบอโร่)' : 'L - Libero'}</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('team.gender')}</label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="Male" checked={playerForm.gender === 'Male'} onChange={e => setPlayerForm({ ...playerForm, gender: e.target.value })} className="text-blue-600 focus:ring-blue-500" /> <span className="text-sm text-gray-700">{language === 'THA' ? 'ชาย' : 'Male'}</span></label>
                                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="Female" checked={playerForm.gender === 'Female'} onChange={e => setPlayerForm({ ...playerForm, gender: e.target.value })} className="text-blue-600 focus:ring-blue-500" /> <span className="text-sm text-gray-700">{language === 'THA' ? 'หญิง' : 'Female'}</span></label>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.firstName')} value={playerForm.first_name} required onChange={e => setPlayerForm({ ...playerForm, first_name: e.target.value })} />
                                                <Input label={t('team.lastName')} value={playerForm.last_name} required onChange={e => setPlayerForm({ ...playerForm, last_name: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.nickname')} value={playerForm.nickname} onChange={e => setPlayerForm({ ...playerForm, nickname: e.target.value })} />
                                                <Input label={t('team.nationality')} value={playerForm.nationality} placeholder="TH" onChange={e => setPlayerForm({ ...playerForm, nationality: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.height')} type="number" value={playerForm.height_cm} onChange={e => setPlayerForm({ ...playerForm, height_cm: e.target.value })} />
                                                <Input label={t('team.weight')} type="number" value={playerForm.weight} onChange={e => setPlayerForm({ ...playerForm, weight: e.target.value })} />
                                            </div>
                                            <Input label={t('team.dob')} type="date" value={playerForm.birth_date} required onChange={e => setPlayerForm({ ...playerForm, birth_date: e.target.value })} />
                                            <Input label={t('team.photoUrl')} placeholder="https://example.com/image.jpg" value={playerForm.photo} onChange={e => setPlayerForm({ ...playerForm, photo: e.target.value })} />

                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <input type="checkbox" id="is_captain" className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer" checked={playerForm.is_captain} onChange={e => setPlayerForm({ ...playerForm, is_captain: e.target.checked })} />
                                                <label htmlFor="is_captain" className="text-sm font-bold text-gray-700 cursor-pointer flex items-center gap-1">{t('team.captain')}</label>
                                            </div>

                                            {playerForm.position === 'L' && (
                                                <div className="grid grid-cols-2 gap-3 p-3 bg-yellow-50/50 rounded-lg border border-yellow-200">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-5 h-5 text-yellow-600 bg-white border-gray-300 rounded focus:ring-yellow-500 focus:ring-2 cursor-pointer" 
                                                            checked={playerForm.is_libero1} 
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                setPlayerForm({ 
                                                                    ...playerForm, 
                                                                    is_libero1: checked,
                                                                    is_libero2: checked ? false : playerForm.is_libero2
                                                                });
                                                            }} 
                                                        />
                                                        <span className="text-sm font-bold text-gray-700">{t('team.libero1')}</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-5 h-5 text-yellow-600 bg-white border-gray-300 rounded focus:ring-yellow-500 focus:ring-2 cursor-pointer" 
                                                            checked={playerForm.is_libero2} 
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                setPlayerForm({ 
                                                                    ...playerForm, 
                                                                    is_libero2: checked,
                                                                    is_libero1: checked ? false : playerForm.is_libero1
                                                                });
                                                            }} 
                                                        />
                                                        <span className="text-sm font-bold text-gray-700">{t('team.libero2')}</span>
                                                    </label>
                                                </div>
                                            )}

                                            <Button type="submit" label={editingPlayerId ? t('team.updatePlayerBtn') : t('team.addPlayerBtn')} icon={editingPlayerId ? <Edit2 size={18} /> : <UserPlus size={18} />} full className={editingPlayerId ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-200 cursor-pointer" : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-200 cursor-pointer"} />
                                        </form>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-gray-50/50">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={18} className="text-gray-400" /> {t('team.currentRoster')}</h3>
                                            <div className="flex items-center gap-2">
                                                <FilterButton active={rosterGenderFilter === 'All'} onClick={() => setRosterGenderFilter('All')} label={t('common.all')} />
                                                <FilterButton active={rosterGenderFilter === 'Male'} onClick={() => setRosterGenderFilter('Male')} label={language === 'THA' ? 'ทีมชาย' : "Men's Team"} />
                                                <FilterButton active={rosterGenderFilter === 'Female'} onClick={() => setRosterGenderFilter('Female')} label={language === 'THA' ? 'ทีมหญิง' : "Women's Team"} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <div className="relative w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                <input type="text" placeholder={t('team.searchPlayers')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900" />
                                            </div>
                                            <button onClick={handleExportCSV} className="bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 p-2 rounded-lg transition shadow-sm cursor-pointer" title={t('team.exportCsv')}><Download size={20} /></button>
                                        </div>
                                    </div>

                                    {filteredPlayers.length === 0 ? <EmptyState text={searchTerm ? (language === 'THA' ? "ไม่พบข้อมูลผู้เล่นที่ค้นหา" : "No players found matching your search.") : (language === 'THA' ? "ยังไม่มีผู้เล่นในทีม" : "No players added yet.")} /> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50/80 border-b border-gray-200 backdrop-blur-sm sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16 shadow-sm text-center">{t('team.playing')}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16 shadow-sm">{language === 'THA' ? 'เบอร์' : 'No.'}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">{t('team.photo')}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[150px]">{t('team.nameFull')}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('team.position')}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{language === 'THA' ? 'ส่วนสูง' : 'Height'}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{language === 'THA' ? 'น้ำหนัก' : 'Weight'}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{t('team.age')}</th>
                                                        <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{language === 'THA' ? 'ภูมิลำเนา/สัญชาติ' : 'Hometown'}</th>
                                                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {filteredPlayers.map((p) => {
                                                        const age = calculateAge(p.birth_date);
                                                        return (
                                                            <tr key={p.id} className="hover:bg-blue-50/30 transition-all duration-200 group">
                                                                <td className="px-4 py-4 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all"
                                                                        checked={p.is_playing ?? true}
                                                                        onChange={() => togglePlayerMatchSelection(p)}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="w-10 h-10 rounded-md bg-white border-2 border-indigo-50 text-indigo-700 flex items-center justify-center font-semibold text-lg shadow-sm group-hover:border-blue-200 group-hover:scale-110 group-hover:shadow-md transition-all font-mono">{p.number}</div>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden border-2 border-white shadow-sm group-hover:shadow-md transition-all">
                                                                        {p.photo ? <img src={p.photo} alt={p.first_name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} /> : <User size={24} className="text-gray-300 m-auto mt-3" />}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div>
                                                                        <div className="font-bold text-gray-900 flex items-center gap-2 text-base">
                                                                            {p.first_name} {p.last_name}
                                                                            {p.is_captain && <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm flex items-center justify-center tracking-wider" title="Team Captain">CAP</span>}
                                                                            {p.is_libero1 && <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm flex items-center justify-center tracking-wider" title="Libero 1">L1</span>}
                                                                            {p.is_libero2 && <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm flex items-center justify-center tracking-wider" title="Libero 2">L2</span>}
                                                                        </div>
                                                                        {p.nickname && <div className="text-xs text-blue-600 font-semibold mt-0.5">"{p.nickname}"</div>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border shadow-sm ${p.position === 'L' ? 'bg-orange-50 text-orange-700 border-orange-200' : p.position === 'S' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{p.position}</span>
                                                                </td>
                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-700 font-medium font-mono">{p.height_cm ? (language === 'THA' ? `${p.height_cm} ซม.` : `${p.height_cm} cm`) : '-'}</span></td>
                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-700 font-medium font-mono">{p.weight ? (language === 'THA' ? `${p.weight} กก.` : `${p.weight} kg`) : '-'}</span></td>
                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-700 font-bold font-mono">{age || '-'}</span></td>
                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-600 font-medium whitespace-nowrap">{p.nationality || '-'}</span></td>
                                                                <td className="px-4 py-4 text-right">
                                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                                                                        <button onClick={() => handleViewStats(p)} className="text-gray-400 hover:text-blue-600 transition p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 cursor-pointer" title={t('team.tabStats')}><BarChart2 size={16} /></button>
                                                                        <button onClick={() => handleEditPlayer(p)} className="text-gray-400 hover:text-blue-600 transition p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 cursor-pointer" title={t('common.edit')}><Edit2 size={16} /></button>
                                                                        <button onClick={() => handleDeletePlayer(p.id)} className="text-gray-400 hover:text-red-500 transition p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 cursor-pointer" title={t('common.delete')}><Trash2 size={16} /></button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================== STAFF TAB ========================== */}
                    {activeTab === 'staff' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-md shadow-sm border border-gray-100 sticky top-0 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-50 p-2 rounded-full">
                                                {editingStaffId ? <Edit2 className="text-orange-600 w-5 h-5" /> : <Briefcase size={20} className="text-blue-600" />}
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-800">
                                                {editingStaffId ? t('team.editStaff') : t('team.addStaff')}
                                            </h2>
                                        </div>
                                        {editingStaffId && (
                                            <button onClick={resetStaffForm} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer"><X size={14} /> {t('common.cancel')}</button>
                                        )}
                                    </div>
                                    <div className="p-6">
                                        <form onSubmit={handleStaffSubmit} className="space-y-4">
                                            <Input label={t('team.firstName')} value={staffForm.first_name} required onChange={e => setStaffForm({ ...staffForm, first_name: e.target.value })} />
                                            <Input label={t('team.lastName')} value={staffForm.last_name} required onChange={e => setStaffForm({ ...staffForm, last_name: e.target.value })} />
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('team.gender')}</label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="staffGender" value="Male" checked={staffForm.gender === 'Male'} onChange={e => setStaffForm({ ...staffForm, gender: e.target.value })} className="text-blue-600 focus:ring-blue-500" /> <span className="text-sm text-gray-700">{language === 'THA' ? 'ชาย' : 'Male'}</span></label>
                                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="staffGender" value="Female" checked={staffForm.gender === 'Female'} onChange={e => setStaffForm({ ...staffForm, gender: e.target.value })} className="text-blue-600 focus:ring-blue-500" /> <span className="text-sm text-gray-700">{language === 'THA' ? 'หญิง' : 'Female'}</span></label>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('team.role')}</label>
                                                <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm text-gray-900">
                                                    <option value="Team Manager">{language === 'THA' ? 'ผู้จัดการทีม' : 'Team Manager'}</option>
                                                    <option value="Head Coach">{language === 'THA' ? 'ผู้ฝึกสอนหลัก' : 'Head Coach'}</option>
                                                    <option value="Assistant Coach">{language === 'THA' ? 'ผู้ช่วยผู้ฝึกสอน 1' : 'Assistant Coach'}</option>
                                                    <option value="Assistant Coach 2">{language === 'THA' ? 'ผู้ช่วยผู้ฝึกสอน 2' : 'Assistant Coach 2'}</option>
                                                    <option value="Doctor">{language === 'THA' ? 'แพทย์ประจำทีม' : 'Doctor'}</option>
                                                    <option value="Therapist/Trainer">{language === 'THA' ? 'นักกายภาพ/เทรนเนอร์' : 'Therapist/Trainer'}</option>
                                                </select>
                                            </div>
                                            <Button type="submit" label={editingStaffId ? t('team.updateStaffBtn') : t('team.addStaffBtn')} icon={editingStaffId ? <Edit2 size={18} /> : <UserPlus size={18} />} full />
                                        </form>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                        <h3 className="font-bold text-gray-800">{t('team.staffList')}</h3>
                                    </div>
                                    {staff.length === 0 ? <EmptyState text={language === 'THA' ? "ยังไม่มีรายชื่อเจ้าหน้าที่ทีมในระบบ" : "No staff members added yet."} /> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50/80 border-b border-gray-200 text-xs uppercase text-gray-500">
                                                    <tr>
                                                        <th className="px-6 py-4 font-bold tracking-wider">{t('team.role')}</th>
                                                        <th className="px-6 py-4 font-bold tracking-wider">{t('team.nameFull')}</th>
                                                        <th className="px-6 py-4 font-bold tracking-wider">{t('team.gender')}</th>
                                                        <th className="px-6 py-4 text-right font-bold tracking-wider">{t('common.actions')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {staff.map((s) => (
                                                        <tr key={s.id} className="hover:bg-blue-50/30 transition-all duration-200 group">
                                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-50 text-indigo-700 border border-blue-100 rounded text-xs font-bold uppercase whitespace-nowrap">{translateRole(s.role)}</span></td>
                                                            <td className="px-6 py-4 font-bold text-gray-900">{s.first_name} {s.last_name}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">{s.gender ? (s.gender === 'Male' ? (language === 'THA' ? 'ชาย' : 'Male') : (language === 'THA' ? 'หญิง' : 'Female')) : '-'}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                                    <button onClick={() => handleEditStaff(s)} className="text-gray-400 hover:text-blue-600 p-2 rounded-lg transition" title={t('common.edit')}><Edit2 size={16} /></button>
                                                                    <button onClick={() => handleDeleteStaff(s.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg transition" title={t('common.delete')}><Trash2 size={16} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================== PLAYER STATS TAB ========================== */}
                    {activeTab === 'stats' && (
                        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <BarChart2 size={18} className="text-gray-400" /> {t('team.tabStats')}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <FilterButton active={statsGenderFilter === 'All'} onClick={() => setStatsGenderFilter('All')} label={language === 'THA' ? 'ผู้เล่นทั้งหมด' : 'All Players'} />
                                    <FilterButton active={statsGenderFilter === 'Male'} onClick={() => setStatsGenderFilter('Male')} label={language === 'THA' ? 'ผู้เล่นชาย' : 'Male'} />
                                    <FilterButton active={statsGenderFilter === 'Female'} onClick={() => setStatsGenderFilter('Female')} label={language === 'THA' ? 'ผู้เล่นหญิง' : 'Female'} />
                                </div>
                            </div>

                            {filteredStats.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b border-gray-100 bg-gray-50/30">
                                    <TopPlayerCard title={language === 'THA' ? 'ผู้ทำคะแนนสูงสุด' : 'Top Scorer'} icon={<Trophy size={16} className="text-yellow-600" />} player={topScorer} value={getStatValue(topScorer, 'score')} label={language === 'THA' ? 'คะแนน' : 'Points'} color="bg-yellow-50 border-yellow-100" />
                                    <TopPlayerCard title={language === 'THA' ? 'สกัดกั้นยอดเยี่ยม' : 'Best Blocker'} icon={<Shield size={16} className="text-emerald-600" />} player={topBlocker} value={getStatValue(topBlocker, 'block')} label={language === 'THA' ? 'บล็อก' : 'Blocks'} color="bg-emerald-50 border-emerald-100" />
                                    <TopPlayerCard title={language === 'THA' ? 'เสิร์ฟยอดเยี่ยม' : 'Best Server'} icon={<Activity size={16} className="text-blue-600" />} player={topServer} value={getStatValue(topServer, 'serve')} label={language === 'THA' ? 'เอส' : 'Aces'} color="bg-blue-50 border-blue-100" />
                                    <TopPlayerCard title={language === 'THA' ? 'รับบอลยอดเยี่ยม' : 'Best Defender'} icon={<Star size={16} className="text-purple-600" />} player={topDefender} value={getStatValue(topDefender, 'dig')} label={language === 'THA' ? 'รับบอล' : 'Digs'} color="bg-purple-50 border-purple-100" />
                                </div>
                            )}

                            {filteredStats.length === 0 ? <EmptyState text={statsGenderFilter === 'All' ? (language === 'THA' ? 'ไม่มีข้อมูลสถิติผู้เล่น' : 'No player stats available.') : (language === 'THA' ? 'ไม่พบข้อมูลผู้เล่นตามตัวกรองนี้' : 'No players found for this filter.')} /> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50/80 border-b border-gray-200 text-xs uppercase text-gray-500">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 font-bold tracking-wider">{language === 'THA' ? 'ผู้เล่น' : 'Player'}</th>
                                                <th scope="col" className="px-4 py-3 font-bold tracking-wider text-center" title={language === 'THA' ? 'ตบทำแต้ม' : 'Attack Kills'}>{t('guestTeams.kills')}</th>
                                                <th scope="col" className="px-4 py-3 font-bold tracking-wider text-center" title={language === 'THA' ? 'ตบเสีย' : 'Attack Errors'}>{t('guestTeams.errors')}</th>
                                                <th scope="col" className="px-4 py-3 font-bold tracking-wider text-center" title={language === 'THA' ? 'ประสิทธิภาพการตบ' : 'Attack Efficiency'}>{t('guestTeams.eff')} %</th>
                                                <th scope="col" className="px-4 py-3 font-bold tracking-wider text-center" title={language === 'THA' ? 'แต้มจากการบล็อก' : 'Kill Blocks'}>{language === 'THA' ? 'บล็อก' : 'Blocks'}</th>
                                                <th scope="col" className="px-4 py-3 font-bold tracking-wider text-center" title={language === 'THA' ? 'แต้มจากการเสิร์ฟเอส' : 'Service Aces'}>{language === 'THA' ? 'เอส' : 'Aces'}</th>
                                                <th scope="col" className="px-4 py-3 font-bold tracking-wider text-center" title={language === 'THA' ? 'ขุดบอล' : 'Digs'}>{t('guestTeams.digs')}</th>
                                                <th scope="col" className="px-4 py-3 font-bold tracking-wider text-center" title={language === 'THA' ? 'รับบอลแรก' : 'Receptions'}>{t('guestTeams.receptions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredStats.map(p => (
                                                <tr key={p.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                                                                {p.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover" /> : <User size={20} className="text-gray-400 m-auto mt-2.5" />}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-gray-900">{p.number} {p.first_name}</div>
                                                                <div className="text-xs text-gray-500">{p.position}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-mono font-medium text-gray-800">{p.attack_kills}</td>
                                                    <td className="px-4 py-4 text-center font-mono font-medium text-red-500">{p.attack_errors}</td>
                                                    <td className={`px-4 py-4 text-center font-mono font-bold ${parseFloat(p.attack_efficiency) >= 25 ? 'text-green-500' : parseFloat(p.attack_efficiency) > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>{p.attack_efficiency}%</td>
                                                    <td className="px-4 py-4 text-center font-mono font-medium text-gray-800">{p.block_points}</td>
                                                    <td className="px-4 py-4 text-center font-mono font-medium text-gray-800">{p.serve_aces}</td>
                                                    <td className="px-4 py-4 text-center font-mono font-medium text-gray-800">{p.digs}</td>
                                                    <td className="px-4 py-4 text-center font-mono font-medium text-gray-800">{p.receptions}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================== COMPETITIONS TAB ========================== */}
                    {activeTab === 'competitions' && (
                        <div className="space-y-8">
                            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-blue-50/50">
                                    <Trophy className="text-blue-600" size={20} />
                                    <h3 className="font-bold text-gray-800">{language === 'THA' ? 'รายการแข่งขันของฉัน' : 'My Competitions'}</h3>
                                </div>
                                {myCompetitions.length === 0 ? <EmptyState text={language === 'THA' ? 'คุณยังไม่ได้เข้าร่วมรายการแข่งขันใด ๆ' : "You haven't joined any competitions yet."} /> : (
                                    <div className="divide-y divide-gray-100">
                                        {myCompetitions.map(c => (
                                            <div key={c.id} className="p-6 flex flex-col md:flex-row justify-between items-center hover:bg-gray-50 transition">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-lg font-bold text-gray-900">{c.title || c.name}</h4>
                                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 border-green-200 text-xs font-medium rounded">{language === 'THA' ? 'ลงทะเบียนแล้ว' : 'Registered'}</span>
                                                    </div>
                                                    <div className="text-sm text-gray-500 flex items-center gap-4">
                                                        <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(c.start_date)}</span>
                                                        <span className="flex items-center gap-1"><MapPin size={14} /> {c.location}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-4 md:mt-0">
                                                    {/* ✅ เชื่อมปุ่ม View Schedule เพื่อส่งไปหน้าตารางแข่งและแสดงตารางของรายการนี้ */}
                                                    <button
                                                        onClick={() => {
                                                            setScheduleFilterId(c.id.toString());
                                                            setActiveTab('schedule');
                                                        }}
                                                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-md text-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 shadow-sm cursor-pointer"
                                                    >
                                                        {language === 'THA' ? 'ดูตารางแข่งขัน' : 'View Schedule'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleLeaveCompetition(c.id)}
                                                        className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 font-bold rounded-md text-sm hover:bg-red-100 transition-all duration-200 shadow-sm flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <LogOut size={16} /> {language === 'THA' ? 'ถอนตัว' : 'Leave'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Activity className="text-green-500" size={20} /> {language === 'THA' ? 'เปิดรับสมัครเข้าร่วมแข่งขัน' : 'Open for Registration'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {openCompetitions.length === 0 ? (
                                        <div className="col-span-full bg-white p-8 rounded-md border border-dashed border-gray-300 text-center text-gray-400">
                                            {language === 'THA' ? 'ไม่มีรายการแข่งขันที่เปิดรับสมัครในขณะนี้' : 'No competitions open right now.'}
                                        </div>
                                    ) : (
                                        openCompetitions.map(c => (
                                            <div key={c.id} className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition flex flex-col">
                                                <div className="h-2 bg-blue-600"></div>
                                                <div className="p-6 flex-1">
                                                    <h4 className="text-lg font-bold text-gray-900 mb-2">{c.title || c.name}</h4>
                                                    <div className="space-y-2 text-sm text-gray-600 mb-6">
                                                        <div className="flex items-center gap-2"><Calendar size={16} className="text-gray-400" /> {formatDate(c.start_date)}</div>
                                                        <div className="flex items-center gap-2"><MapPin size={16} className="text-gray-400" /> {c.location}</div>
                                                        <div className="flex items-center gap-2"><Shield size={16} className="text-gray-400" /> {c.sport} ({c.gender === 'Male' ? (language === 'THA' ? 'ชาย' : 'Male') : (language === 'THA' ? 'หญิง' : 'Female')})</div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleJoinCompetition(c.id)}
                                                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                                                    >
                                                        {t('team.joinCompBtn')}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================== SCHEDULE TAB ========================== */}
                    {activeTab === 'schedule' && (
                        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-blue-50/50">
                                <div className="flex items-center gap-2">
                                    <Calendar className="text-blue-600" size={20} />
                                    <h3 className="font-bold text-gray-800">{t('team.tabSchedule')}</h3>
                                </div>
                                {/* ✅ เพิ่ม Dropdown สำหรับกรองตารางแข่งขันตามรายการ */}
                                <div className="w-full sm:w-auto">
                                    <select
                                        value={scheduleFilterId}
                                        onChange={(e) => setScheduleFilterId(e.target.value)}
                                        className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-gray-900 shadow-sm"
                                    >
                                        <option value="all">{language === 'THA' ? 'ทุกรายการแข่งขัน (แสดงทั้งหมด)' : 'All Competitions (Show All)'}</option>
                                        {myCompetitions.map(c => (
                                            <option key={c.id} value={c.id.toString()}>
                                                {c.title || c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {myMatches.length === 0 ? <EmptyState text={language === 'THA' ? "ยังไม่มีตารางการแข่งขันในขณะนี้" : "No matches scheduled."} /> : (
                                <div className="divide-y divide-gray-100">
                                    {/* ✅ กรอง Match ที่นำมาแสดงตามที่เลือกใน Dropdown */}
                                    {myMatches
                                        .filter(m => scheduleFilterId === 'all' || m.competition_id?.toString() === scheduleFilterId)
                                        .map(m => {
                                            const displayStatus = m.status === 'completed' 
                                                ? (language === 'THA' ? 'แข่งขันแล้ว' : 'Completed') 
                                                : (m.status === 'live' ? (language === 'THA' ? 'กำลังแข่งขัน' : 'Live') : (language === 'THA' ? 'ยังไม่เริ่ม' : 'Scheduled'));
                                            return (
                                                <div key={m.id} className="p-6 flex flex-col md:flex-row justify-between items-center hover:bg-gray-50 transition">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">{m.competition_name || (language === 'THA' ? 'รายการแข่งขัน' : 'Competition')}</span>
                                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${m.status === 'completed' ? 'bg-green-100 text-green-700' : (m.status === 'live' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-yellow-100 text-yellow-700')}`}>
                                                                {displayStatus}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 mb-1">
                                                            <div className="text-lg font-bold text-gray-900">
                                                                {m.home_team} <span className="text-gray-400 mx-2">vs</span> {m.away_team}
                                                            </div>
                                                        </div>
                                                        <div className="text-sm text-gray-500 flex items-center gap-4">
                                                            <span className="flex items-center gap-1"><Calendar size={14} /> {m.start_time ? formatDateTime(m.start_time) : 'TBD'}</span>
                                                            <span className="flex items-center gap-1"><MapPin size={14} /> {m.location || 'TBD'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-4 md:mt-0">
                                                        {m.status === 'completed' ? (
                                                            <div className="text-2xl font-semibold text-gray-800 bg-gray-100 px-4 py-2 rounded-lg font-mono">
                                                                {m.home_set_score} - {m.away_set_score}
                                                            </div>
                                                        ) : (
                                                            /* ปุ่มสำหรับเข้า Staff Console เฉพาะเมื่อแมตช์ยังไม่จบ */
                                                            <button
                                                                onClick={() => navigate(`/staff/${m.id}`)}
                                                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                                                            >
                                                                <PlayCircle size={18} />
                                                                {language === 'THA' ? 'บอร์ดควบคุมทีม' : 'Staff Bench'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    {/* ✅ แสดงข้อความเมื่อเลือกรายการแล้วไม่พบตารางแข่ง */}
                                    {myMatches.filter(m => scheduleFilterId === 'all' || m.competition_id?.toString() === scheduleFilterId).length === 0 && (
                                        <div className="p-8 text-center text-gray-500">
                                            {language === 'THA' ? 'ไม่พบข้อมูลตารางการแข่งขันสำหรับรายการที่เลือก' : 'No matches found for this selected competition.'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================== Tab Print O-2 ========================== */}
                    {activeTab === 'print' && (
                        <div className="space-y-6 animate-fadeIn">
                            <O2FormLoader
                                teamInfo={teamInfo}
                                players={players}
                                staff={staff}
                                myCompetitions={myCompetitions}
                            />
                        </div>
                    )}

                </main>
            </div>

            {/* Edit Team Modal */}
            {isEditingTeam && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">{t('team.editTeam')}</h3>
                            <button onClick={() => setIsEditingTeam(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUpdateTeam} className="space-y-4">
                                <Input label={t('team.name')} value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} required />
                                <Input label={t('team.code')} value={teamForm.code} onChange={e => setTeamForm({ ...teamForm, code: e.target.value })} required />
                                <Input label={t('team.logoUrl')} value={teamForm.logo_url} onChange={e => setTeamForm({ ...teamForm, logo_url: e.target.value })} placeholder="https://..." />
                                <Button type="submit" label={t('common.save')} full />
                                <div className="pt-6 border-t border-gray-100 mt-6">
                                    <p className="text-xs text-red-500 font-bold uppercase mb-2">{language === 'THA' ? 'พื้นที่อันตราย (Danger Zone)' : 'Danger Zone'}</p>
                                    <button type="button" onClick={handleDeleteTeam} className="w-full py-2 px-4 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                        <Trash2 size={16} /> {language === 'THA' ? 'ลบทีมแข่งขัน' : 'Delete Team'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Player Stats Modal */}
            {viewingStatsPlayer && statsData && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><BarChart2 size={24} className="text-white" /></div>
                                <div>
                                    <h3 className="font-bold text-lg">{viewingStatsPlayer.first_name} {viewingStatsPlayer.last_name}</h3>
                                    <p className="text-xs text-indigo-100 opacity-90">#{viewingStatsPlayer.number} • {viewingStatsPlayer.position}</p>
                                </div>
                            </div>
                            <button onClick={() => { setViewingStatsPlayer(null); setStatsData(null); }} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition"><X size={20} /></button>
                        </div>

                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2 bg-rose-50 p-4 rounded-md border border-rose-100">
                                <h4 className="text-rose-600 font-bold text-sm uppercase mb-3 flex items-center gap-2"><Swords size={16} /> {language === 'THA' ? 'การตบ/บุก' : 'Attack'}</h4>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div><div className="text-2xl font-semibold text-gray-800">{statsData.attack_kills ?? 0}</div><div className="text-xs text-gray-500">{t('guestTeams.kills')}</div></div>
                                    <div><div className="text-2xl font-semibold text-gray-800">{statsData.attack_errors ?? 0}</div><div className="text-xs text-gray-500">{t('guestTeams.errors')}</div></div>
                                    <div><div className={`text-2xl font-semibold ${parseFloat(statsData.attack_efficiency ?? 0) >= 40 ? 'text-emerald-600' : parseFloat(statsData.attack_efficiency ?? 0) >= 25 ? 'text-green-600' : parseFloat(statsData.attack_efficiency ?? 0) >= 10 ? 'text-blue-600' : parseFloat(statsData.attack_efficiency ?? 0) >= 0 ? 'text-gray-800' : 'text-red-500'}`}>{statsData.attack_efficiency ?? 0}%</div><div className="text-xs text-gray-500">{t('guestTeams.eff')}</div></div>
                                </div>
                            </div>

                            <div className="bg-emerald-50 p-4 rounded-md border border-emerald-100">
                                <h4 className="text-emerald-600 font-bold text-sm uppercase mb-3 flex items-center gap-2"><Shield size={16} /> {language === 'THA' ? 'การบล็อก' : 'Block'}</h4>
                                <div className="text-center">
                                    <div className="text-3xl font-semibold text-gray-800">{statsData.block_points ?? 0}</div>
                                    <div className="text-xs text-gray-500">{language === 'THA' ? 'คะแนนบล็อก' : 'Kill Blocks'}</div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                                <h4 className="text-blue-600 font-bold text-sm uppercase mb-3 flex items-center gap-2"><Activity size={16} /> {language === 'THA' ? 'การเสิร์ฟ' : 'Serve'}</h4>
                                <div className="flex justify-around text-center">
                                    <div><div className="text-xl font-semibold text-gray-800">{statsData.serve_aces ?? 0}</div><div className="text-[10px] text-gray-500">{language === 'THA' ? 'เอส' : 'Aces'}</div></div>
                                    <div><div className="text-xl font-semibold text-gray-800">{statsData.serve_errors ?? 0}</div><div className="text-[10px] text-gray-500">{language === 'THA' ? 'เสีย' : 'Err'}</div></div>
                                </div>
                            </div>

                            <div className="col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-md border border-gray-100 flex justify-around items-center">
                                <div className="text-center"><div className="text-2xl font-semibold text-gray-800">{statsData.digs ?? 0}</div><div className="text-xs text-gray-500 uppercase font-bold">{t('guestTeams.digs')}</div></div>
                                <div className="w-px h-8 bg-gray-200"></div>
                                <div className="text-center"><div className="text-2xl font-semibold text-gray-800">{statsData.receptions ?? 0}</div><div className="text-xs text-gray-500 uppercase font-bold">{t('guestTeams.receptions')}</div></div>
                                <div className="w-px h-8 bg-gray-200"></div>
                                <div className="text-center"><div className="text-2xl font-semibold text-gray-800">{statsData.total_actions ?? 0}</div><div className="text-xs text-gray-500 uppercase font-bold">{t('guestTeams.totalActions')}</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Helper Components ---

function FilterButton({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${active
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
        >
            {label}
        </button>
    );
}

function Input({ label, type = "text", value, onChange, required, placeholder }) {
    return (
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
            <input type={type} required={required} value={value} onChange={onChange} placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm bg-white text-gray-900 shadow-sm"
            />
        </div>
    );
}

function TopPlayerCard({ title, icon, player, value, label, color }) {
    if (!player || value === 0) return (
        <div className={`p-4 rounded-md border flex items-center gap-4 ${color} opacity-50`}>
            <div className="p-3 bg-white rounded-full shadow-sm">{icon}</div>
            <div>
                <div className="text-xs font-bold uppercase opacity-70">{title}</div>
                <div className="text-sm font-medium text-gray-500">-</div>
            </div>
        </div>
    );

    return (
        <div className={`p-4 rounded-md border flex items-center gap-4 ${color} transition-transform hover:scale-105 shadow-sm`}>
            <div className="relative">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                    {player.photo ? <img src={player.photo} alt={player.first_name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} /> : <User size={20} className="text-gray-400" />}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-gray-100">{icon}</div>
            </div>
            <div className="min-w-0">
                <div className="text-xs font-medium opacity-70 mb-0.5 tracking-wider">{title}</div>
                <div className="font-bold text-gray-900 leading-tight truncate text-sm">{player.first_name} {player.last_name}</div>
                <div className="text-xs font-medium mt-0.5 text-gray-600"><span className="text-lg font-semibold">{value}</span> {label}</div>
            </div>
        </div>
    );
}

function Button({ type, label, icon, full, className }) {
    return (
        <button type={type} className={`${className || "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-200"} text-white font-bold py-3 px-6 rounded-md shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 ${full ? 'w-full' : ''}`}>
            {icon} {label}
        </button>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`
                group inline-flex items-center py-2.5 px-4 md:px-5 border-b-2 md:border-b-0 md:border-l-[3px] font-medium text-sm transition-all duration-200 whitespace-nowrap
                ${active
                    ? 'border-blue-600 text-blue-700 bg-blue-50/80 mr-0 md:mr-4'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
            `}
        >
            <span className={`flex-shrink-0 transition-colors ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`}>{icon}</span>
            <span>{label}</span>
        </button>
    );
}

function EmptyState({ text }) {
    return (
        <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                <Users className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">{text}</p>
        </div>
    );
}