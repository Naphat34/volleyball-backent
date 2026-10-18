import { Panel } from '../components/ui/SystemUI';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    Users,
    Trophy,
    UserPlus,
    Plus,
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
    Clock,
    Search,
    Download,
    LogOut,
    BarChart2,
    Swords,
    Printer,
    Upload,
    Palette,
    Home,
    Building2
} from 'lucide-react';

import { cleanCompetitionTitle, formatThaiDate, calculateAge } from '../utils';
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

const genderOrder = { Male: 1, Female: 2, Mixed: 3, Mix: 3 };
const ageGroupOrder = ['U12', 'U14', 'U16', 'U18', 'Open'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const PRIMARY_BLUE = '#2563eb';
const DEFAULT_UNIFORM_COLORS = {
    main_color: '#1f2937',
    second_color: '#ffffff',
    third_color: '#d1d5db',
    libero_main_color: '#facc15',
    libero_second_color: '#111827',
    libero_third_color: '#ffffff'
};


const normalizeCompetitionTitle = (competition) => {
    return cleanCompetitionTitle(competition?.competition_title || competition?.title || competition?.name || 'Untitled Competition');
};

const getScheduleCompetitionName = (item = {}) => (
    normalizeCompetitionTitle({
        title: item.competition_name || item.title || item.name
    })
);

const getGenderLabel = (gender) => {
    const normalized = String(gender || 'Mixed').trim();
    if (/^(male|men|m)$/i.test(normalized)) return 'Male';
    if (/^(female|women|f)$/i.test(normalized)) return 'Female';
    if (/^(mix|mixed)$/i.test(normalized)) return 'Mixed';
    return normalized || 'Mixed';
};
const getTeamGender = (gender) => {
    const normalized = getGenderLabel(gender);
    return normalized === 'Male' || normalized === 'Female' ? normalized : null;
};

const getAgeGroupLabel = (competition) => (
    competition?.age_group_name ||
    competition?.entry_age_group_name ||
    competition?.age_group ||
    competition?.category_name ||
    'General'
);

const getAgeGroupId = (competition) => (
    competition?.entry_age_group_id !== undefined && competition?.entry_age_group_id !== null
        ? String(competition.entry_age_group_id)
        : competition?.assigned_age_group_id !== undefined && competition?.assigned_age_group_id !== null
        ? String(competition.assigned_age_group_id)
        : competition?.age_group_id !== undefined && competition?.age_group_id !== null
        ? String(competition.age_group_id)
        : ''
);

const getCompetitionAgeGroupKey = (competition) => (
    getAgeGroupId(competition) ||
    String(getAgeGroupLabel(competition) || 'General')
);

const groupCompetitionsByTitle = (competitions) => Object.values((competitions || []).reduce((acc, competition) => {
    const title = normalizeCompetitionTitle(competition);
    const key = title.toLowerCase();
    if (!acc[key]) {
        acc[key] = {
            key,
            title,
            start_date: competition.start_date,
            end_date: competition.end_date,
            location: competition.location,
            sport: competition.sport || 'Volleyball',
            categories: []
        };
    }

    acc[key].categories.push(competition);
    return acc;
}, {})).map((group) => ({
    ...group,
    categories: [...group.categories].sort((a, b) => {
        const ageCompare = getAgeGroupLabel(a).localeCompare(getAgeGroupLabel(b));
        if (ageCompare !== 0) return ageCompare;
        const genderA = getGenderLabel(a.gender);
        const genderB = getGenderLabel(b.gender);
        return (genderOrder[genderA] || 99) - (genderOrder[genderB] || 99)
            || genderA.localeCompare(genderB);
    })
})).sort((a, b) => a.title.localeCompare(b.title));

const readImageFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
        reject(new Error('No file selected'));
        return;
    }
    if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'));
        return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
        reject(new Error('Image file must be 2MB or smaller'));
        return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
});

const buildTeamFormFromInfo = (team = {}) => ({
    name: team.name || '',
    code: team.code || '',
    gender: getTeamGender(team.gender || team.category) || '',
    logo_url: team.logo_url || '',
    coach: team.coach || '',
    manager_name: team.manager_name || '',
    phone: team.phone || '',
    email: team.email || '',
    province: team.province || '',
    district: team.district || '',
    office_phone: team.office_phone || '',
    mobile_phone: team.mobile_phone || team.phone || '',
    fax: team.fax || '',
    line_id: team.line_id || '',
    address_number: team.address_number || '',
    building: team.building || '',
    moo: team.moo || '',
    soi: team.soi || '',
    road: team.road || '',
    address_province: team.address_province || '',
    address_district: team.address_district || '',
    subdistrict: team.subdistrict || '',
    postal_code: team.postal_code || '',
    main_color: team.main_color || DEFAULT_UNIFORM_COLORS.main_color,
    second_color: team.second_color || DEFAULT_UNIFORM_COLORS.second_color,
    third_color: team.third_color || DEFAULT_UNIFORM_COLORS.third_color,
    libero_main_color: team.libero_main_color || DEFAULT_UNIFORM_COLORS.libero_main_color,
    libero_second_color: team.libero_second_color || DEFAULT_UNIFORM_COLORS.libero_second_color,
    libero_third_color: team.libero_third_color || DEFAULT_UNIFORM_COLORS.libero_third_color
});

export default function TeamDashboard() {
    const { language, setLanguage, t } = useLanguage();

    const formatDate = (date) => {
        return formatThaiDate(date);
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

        const confirmation = await Swal.fire({
            title: language === 'THA' ? 'ยืนยันการเปลี่ยนสถานะผู้เล่น?' : 'Confirm player status change?',
            text: language === 'THA'
                ? `ต้องการ${newIsPlaying ? 'เลือก' : 'นำออก'}ผู้เล่นคนนี้จากรายชื่อแข่งขันใช่หรือไม่?`
                : `Do you want to ${newIsPlaying ? 'select' : 'remove'} this player for the match roster?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: PRIMARY_BLUE,
            cancelButtonColor: '#6b7280',
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel')
        });
        if (!confirmation.isConfirmed) return;

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
    const [rosterViewLoading, setRosterViewLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [ageGroups, setAgeGroups] = useState([]);
    const [openCompetitions, setOpenCompetitions] = useState([]);
    const [myCompetitions, setMyCompetitions] = useState([]);
    const [myMatches, setMyMatches] = useState([]);
    const [competitionGroupFilter, setCompetitionGroupFilter] = useState('all');
    const [joinSelections, setJoinSelections] = useState({});
    const [joinGenderSelections, setJoinGenderSelections] = useState({});
    const [entryRosterModal, setEntryRosterModal] = useState(null);
    const [entryRosterPlayers, setEntryRosterPlayers] = useState([]);
    const [entryRosterSelectedIds, setEntryRosterSelectedIds] = useState([]);
    const [entryRosterLoading, setEntryRosterLoading] = useState(false);

    const [teamInfo, setTeamInfo] = useState(null);
    const [teamLogoLoadFailed, setTeamLogoLoadFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isEditingTeam, setIsEditingTeam] = useState(false);
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [teamForm, setTeamForm] = useState({
        name: '',
        code: '',
        logo_url: '',
        coach: '',
        manager_name: '',
        phone: '',
        email: '',
        province: '',
        gender: 'Male',
        ...DEFAULT_UNIFORM_COLORS
    });
    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
    const [playerDocuments, setPlayerDocuments] = useState({ identity_document_url: '', student_certificate_url: '', guardian_consent_url: '' });
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
        hometown: '',
        photo: '',
        gender: 'Male',
        is_captain: false,
        is_libero1: false,
        is_libero2: false
    });

    const [staffForm, setStaffForm] = useState({ first_name: '', last_name: '', role: 'Head Coach', gender: 'Male' });

    const navigate = useNavigate();

    useEffect(() => {
        setTeamLogoLoadFailed(false);
    }, [teamInfo?.logo_url]);

    const cleanPersonText = (value, { allowNumeric = false } = {}) => {
        if (value === null || value === undefined) return '';
        const text = String(value).trim();
        if (!text || text === '0') return '';
        if (!allowNumeric && /^\d+$/.test(text)) return '';
        return text;
    };

    const getPlayerDisplayName = (player = {}) => {
        const firstName = cleanPersonText(player.first_name);
        const lastName = cleanPersonText(player.last_name);
        return [firstName, lastName].filter(Boolean).join(' ');
    };

    const getPlayerNickname = (player = {}) => cleanPersonText(player.nickname);

    const isTruthyFlag = (value) => (
        value === true
        || value === 1
        || value === '1'
        || String(value).toLowerCase() === 'true'
    );

    const getLiberoBadge = (player = {}) => {
        if (isTruthyFlag(player.is_libero1)) return 'L1';
        if (isTruthyFlag(player.is_libero2)) return 'L2';
        return '';
    };

    const getRosterPlayerNumber = (player = {}) => (
        player.entry_number ?? player.number ?? ''
    );

    const getEntryRosterScopeLabel = () => {
        if (!entryRosterModal) return language === 'THA' ? 'รุ่นนี้' : 'this roster';
        const competitionName = normalizeCompetitionTitle(entryRosterModal.competition);
        const ageGroup = entryRosterModal.entry?.age_group_name || 'General';
        const gender = entryRosterModal.entry?.competition_gender || entryRosterModal.entry?.gender || '';
        return [competitionName, ageGroup, gender].filter(Boolean).join(' / ');
    };

    const getLockedRosterLabel = (player = {}) => {
        const ageGroup = player.locked_age_group_name || 'General';
        const gender = player.locked_competition_gender || '';
        return [ageGroup, gender].filter(Boolean).join(' / ');
    };

    const loadRosterView = useCallback(async () => {
        setRosterViewLoading(true);
        try {
            const res = await api.getMyPlayers();
            const uniquePlayers = [...new Map((res.data || []).map(player => [String(player.id), player])).values()];
            setPlayers(uniquePlayers);
        } catch (err) {
            console.error(err);
            Toast.fire({
                icon: 'error',
                title: err.response?.data?.error || (language === 'THA' ? 'โหลดรายชื่อนักกีฬาไม่สำเร็จ' : 'Failed to load roster players')
            });
        } finally {
            setRosterViewLoading(false);
        }
    }, [language]);

    const cleanPositiveNumberText = (value) => {
        if (value === null || value === undefined || value === '') return '';
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) return '';
        return String(value).trim();
    };

    const formatMeasure = (value, unit) => {
        const cleaned = cleanPositiveNumberText(value);
        return cleaned ? `${cleaned} ${unit}` : '-';
    };

    const buildPlayerPayload = () => ({
        ...playerForm,
        ...playerDocuments,
        school_affiliation: playerForm.school_affiliation || teamInfo?.name || '',
        first_name: cleanPersonText(playerForm.first_name),
        last_name: cleanPersonText(playerForm.last_name),
        nickname: cleanPersonText(playerForm.nickname),
        height_cm: cleanPositiveNumberText(playerForm.height_cm),
        weight: cleanPositiveNumberText(playerForm.weight),
        nationality: cleanPersonText(playerForm.nationality, { allowNumeric: true })
    });

    const handleImageFileChange = async (event, category, onLoaded) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await readImageFileAsDataUrl(file);
            const res = await api.uploadImage(dataUrl, category);
            await onLoaded(res.data.url);
        } catch (error) {
            Toast.fire({
                icon: 'error',
                title: error.response?.data?.error || error.message || (
                    language === 'THA' ? 'อัปโหลดรูปภาพไม่สำเร็จ' : 'Image upload failed'
                )
            });
        } finally {
            event.target.value = '';
        }
    };

    const groupedOpenCompetitions = useMemo(
        () => groupCompetitionsByTitle(openCompetitions),
        [openCompetitions]
    );

    const selectedOpenGender = useMemo(() => {
        const selectedIds = Object.values(joinSelections).flat();
        const genders = new Set(selectedIds.map((id) => {
            const competition = openCompetitions.find((item) => String(item.id) === String(id));
            return competition ? getGenderLabel(competition.gender) : null;
        }).filter((gender) => gender === 'Male' || gender === 'Female'));
        return genders.size === 1 ? [...genders][0] : null;
    }, [joinSelections, openCompetitions]);

    const groupedMyCompetitions = useMemo(
        () => groupCompetitionsByTitle(myCompetitions),
        [myCompetitions]
    );

    const competitionGroupOptions = useMemo(() => {
        const optionsByKey = new Map();
        [...groupedMyCompetitions, ...groupedOpenCompetitions].forEach((group) => {
            if (!optionsByKey.has(group.key)) {
                optionsByKey.set(group.key, {
                    key: group.key,
                    title: group.title,
                    start_date: group.start_date,
                    end_date: group.end_date,
                    location: group.location
                });
            }
        });

        return [...optionsByKey.values()]
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [groupedMyCompetitions, groupedOpenCompetitions]);

    const filteredMyCompetitionGroups = useMemo(() => (
        competitionGroupFilter === 'all'
            ? groupedMyCompetitions
            : groupedMyCompetitions.filter(group => group.key === competitionGroupFilter)
    ), [competitionGroupFilter, groupedMyCompetitions]);

    const filteredOpenCompetitionGroups = useMemo(() => {
        const lockedGender = getTeamGender(teamInfo?.gender || teamInfo?.category) || selectedOpenGender;
        const genderFilteredGroups = groupedOpenCompetitions
            .map(group => ({
                ...group,
                categories: group.categories.filter(category => {
                    const gender = getGenderLabel(category.gender);
                    return (gender === 'Male' || gender === 'Female') && (!lockedGender || gender === lockedGender);
                })
            }))
            .filter(group => group.categories.length > 0);
        return competitionGroupFilter === 'all'
            ? genderFilteredGroups
            : genderFilteredGroups.filter(group => group.key === competitionGroupFilter);
    }, [competitionGroupFilter, groupedOpenCompetitions, teamInfo?.gender, teamInfo?.category, selectedOpenGender]);

    const selectedCompetitionGroup = useMemo(() => (
        competitionGroupOptions.find(group => group.key === competitionGroupFilter) || null
    ), [competitionGroupFilter, competitionGroupOptions]);

    const ageGroupNameMap = useMemo(() => (
        new Map((ageGroups || []).map((ag) => [String(ag.id), ag.name]))
    ), [ageGroups]);

    const resolveAgeGroupName = useCallback((competition) => {
        const mapped = ageGroupNameMap.get(getAgeGroupId(competition));
        const direct = getAgeGroupLabel(competition);
        if (mapped) return mapped;
        if (direct && direct !== 'General' && !/^\d+$/.test(String(direct))) return direct;
        return direct || 'General';
    }, [ageGroupNameMap]);

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
            if (activeTab === 'overview') {
                const [resTeam, resPlayers, resStaff, resCompetitions, resMatches] = await Promise.all([
                    api.getMyTeam(),
                    api.getMyPlayers(),
                    api.getMyStaff(),
                    api.getMyCompetitions(),
                    api.getMyMatches()
                ]);
                setTeamInfo(resTeam.data);
                setTeamForm(buildTeamFormFromInfo(resTeam.data));
                setPlayers(resPlayers.data || []);
                setStaff(resStaff.data || []);
                setMyCompetitions(resCompetitions.data || []);
                setMyMatches(resMatches.data || []);
            } else if (activeTab === 'team_info') {
                const resTeam = await api.getMyTeam();
                setTeamInfo(resTeam.data);
                setTeamForm(buildTeamFormFromInfo(resTeam.data));
            } else if (activeTab === 'roster') {
                const resMy = await api.getMyCompetitions();
                setMyCompetitions(resMy.data || []);
                await loadRosterView();
            } else if (activeTab === 'staff') {
                const [resStaff, resMy] = await Promise.all([
                    api.getMyStaff(),
                    api.getMyCompetitions()
                ]);
                setStaff(resStaff.data);
                setMyCompetitions(resMy.data || []);
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
                setTeamForm(buildTeamFormFromInfo(resTeam.data));
            } else if (activeTab === 'uniform') {
                const resTeam = await api.getMyTeam();
                setTeamInfo(resTeam.data);
                setTeamForm(buildTeamFormFromInfo(resTeam.data));
            }
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab, navigate, loadRosterView]);

    useEffect(() => {
        fetchData();
    }, [activeTab, fetchData]);

    useEffect(() => {
        sessionStorage.setItem('teamActiveTab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        const fetchAgeGroups = async () => {
            try {
                const res = await api.getAllAgeGroups();
                setAgeGroups(res.data || []);
            } catch (err) {
                console.error('Failed to fetch age groups', err);
            }
        };

        fetchAgeGroups();
    }, []);

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
                    if (headCoach && !info.coach) {
                        info.coach = `${headCoach.first_name} ${headCoach.last_name}`;
                    }
                } catch {
                    // No staff found
                }

                setTeamInfo(info);
                setTeamForm(buildTeamFormFromInfo(info));
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
        const playerPayload = buildPlayerPayload();

        const confirmation = await Swal.fire({
            title: language === 'THA'
                ? (editingPlayerId ? 'ยืนยันการแก้ไขข้อมูลผู้เล่น?' : 'ยืนยันการเพิ่มผู้เล่น?')
                : (editingPlayerId ? 'Confirm player update?' : 'Confirm adding player?'),
            text: language === 'THA'
                ? 'ระบบจะบันทึกข้อมูลผู้เล่นหลังจากยืนยัน'
                : 'The player information will be saved after confirmation.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: PRIMARY_BLUE,
            cancelButtonColor: '#6b7280',
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel')
        });
        if (!confirmation.isConfirmed) return;

        try {
            if (editingPlayerId) {
                await api.updatePlayer(editingPlayerId, playerPayload);
                Toast.fire({ icon: 'success', title: language === 'THA' ? 'อัปเดตข้อมูลผู้เล่นเรียบร้อยแล้ว' : 'Player updated successfully' });
            } else {
                await api.addPlayer(playerPayload);
                Toast.fire({ icon: 'success', title: language === 'THA' ? 'เพิ่มผู้เล่นเรียบร้อยแล้ว' : 'Player added successfully' });
            }
            resetPlayerForm();
            setIsPlayerModalOpen(false);
            fetchData();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'บันทึกข้อมูลผู้เล่นล้มเหลว' : 'Failed to save player') });
        }
    };

    const resetPlayerForm = () => {
        setEditingPlayerId(null);
        setIsPlayerModalOpen(false);
        setPlayerForm({
            number: '', first_name: '', last_name: '', nickname: '',
            position: 'OH', height_cm: '', weight: '',
            birth_date: '', nationality: '', hometown: '', photo: '',
            gender: 'Male', is_captain: false,
            is_libero1: false, is_libero2: false
        });
    };

    const handleEditPlayer = (p) => {
        setIsPlayerModalOpen(true);
        setEditingPlayerId(p.id);
        setPlayerDocuments({ identity_document_url: p.identity_document_url || '', student_certificate_url: p.student_certificate_url || '', guardian_consent_url: p.guardian_consent_url || '' });
        setPlayerForm({
            number: p.number ?? '', first_name: cleanPersonText(p.first_name), last_name: cleanPersonText(p.last_name),
            nickname: cleanPersonText(p.nickname), position: p.position ?? 'OH', height_cm: cleanPositiveNumberText(p.height_cm),
            weight: cleanPositiveNumberText(p.weight), birth_date: p.birth_date ? p.birth_date.split('T')[0] : '',
            nationality: p.nationality ?? '', photo: p.photo ?? '', gender: getTeamGender(teamInfo?.gender || teamInfo?.category) || p.gender || 'Male',
            title: p.title || '', middle_name: p.middle_name || '', jersey_name: p.jersey_name || '', national_id: p.national_id || '', fivb_id: p.fivb_id || '', hometown: p.hometown || '', school_affiliation: p.school_affiliation || teamInfo?.name || '', grade_level: p.grade_level || '', contact_phone: p.contact_phone || '',
            is_captain: isTruthyFlag(p.is_captain),
            is_libero1: isTruthyFlag(p.is_libero1),
            is_libero2: isTruthyFlag(p.is_libero2)
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleStaffSubmit = async (e) => {
        e.preventDefault();

        const confirmation = await Swal.fire({
            title: language === 'THA'
                ? (editingStaffId ? 'ยืนยันการแก้ไขข้อมูลเจ้าหน้าที่?' : 'ยืนยันการเพิ่มเจ้าหน้าที่?')
                : (editingStaffId ? 'Confirm staff update?' : 'Confirm adding staff?'),
            text: language === 'THA'
                ? 'ระบบจะบันทึกข้อมูลเจ้าหน้าที่หลังจากยืนยัน'
                : 'The staff information will be saved after confirmation.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: PRIMARY_BLUE,
            cancelButtonColor: '#6b7280',
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel')
        });
        if (!confirmation.isConfirmed) return;

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

    const handleJoinCompetition = async (competitionIds) => {
        try {
            const ids = Array.isArray(competitionIds)
                ? [...new Set(competitionIds.map(id => Number.parseInt(id, 10)).filter(Boolean))]
                : [Number.parseInt(competitionIds, 10)].filter(Boolean);

            if (ids.length === 0) {
                Toast.fire({ icon: 'warning', title: language === 'THA' ? 'กรุณาเลือกรุ่นแข่งขันอย่างน้อย 1 รายการ' : 'Please select at least one competition category' });
                return;
            }

            const comps = openCompetitions.filter(c => ids.includes(c.id));
            if (comps.length === 0) {
                Toast.fire({ icon: 'warning', title: language === 'THA' ? 'ไม่พบรายการที่เลือก' : 'Selected categories were not found' });
                return;
            }

            const selectedGenders = new Set(comps.map((competition) => getGenderLabel(competition.gender)));
            const existingGender = getTeamGender(teamInfo?.gender || teamInfo?.category);
            if (selectedGenders.size !== 1 || (existingGender && !selectedGenders.has(existingGender))) {
                Toast.fire({ icon: 'warning', title: language === 'THA' ? 'บัญชีนี้เลือกสมัครได้เพียงทีมชายหรือทีมหญิงประเภทเดียว' : 'A team can register for one gender only.' });
                return;
            }

            const confirmation = await Swal.fire({
                title: language === 'THA' ? 'ยืนยันการสมัครแข่งขัน?' : 'Confirm competition registration?',
                text: language === 'THA'
                    ? `ระบบจะสมัครทีมเข้าร่วม ${comps.length} รุ่น/ประเภทที่เลือก`
                    : `The team will be registered for ${comps.length} selected category or categories.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: PRIMARY_BLUE,
                cancelButtonColor: '#6b7280',
                confirmButtonText: t('common.confirm'),
                cancelButtonText: t('common.cancel')
            });
            if (!confirmation.isConfirmed) return;

            for (const compId of ids) {
                await api.joinCompetition(compId);
            }
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'เข้าร่วมรายการแข่งขันเรียบร้อยแล้ว!' : 'Joined competition!' });
            setJoinSelections({});
            setJoinGenderSelections({});
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

    const openEntryRosterModal = async (competition) => {
        const entryId = competition.team_entry_id;
        if (!entryId) {
            Toast.fire({ icon: 'error', title: language === 'THA' ? 'ไม่พบข้อมูลทีมสมัครของรายการนี้' : 'Missing team entry for this competition' });
            return;
        }

        setEntryRosterLoading(true);
        try {
            const res = await api.getMyTeamEntryPlayers(entryId);
            setEntryRosterModal({ competition, entry: res.data.entry });
            setEntryRosterPlayers(res.data.players || []);
            setEntryRosterSelectedIds((res.data.selectedPlayerIds || []).map(id => Number(id)).filter(Number.isFinite));
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'โหลดรายชื่อนักกีฬาไม่สำเร็จ' : 'Failed to load roster') });
        } finally {
            setEntryRosterLoading(false);
        }
    };

    const toggleEntryRosterPlayer = (player) => {
        if (!player.gender_eligible) return;
        if (player.roster_locked) return;
        const playerId = Number(player.id);
        if (!Number.isFinite(playerId)) return;

        setEntryRosterSelectedIds(prev => {
            if (prev.includes(playerId)) {
                return prev.filter(id => id !== playerId);
            }
            return [...prev, playerId];
        });
    };

    const saveEntryRoster = async () => {
        if (!entryRosterModal?.entry?.id) return;

        const validSelectedIds = entryRosterSelectedIds.filter((id) => {
            const player = entryRosterPlayers.find(item => Number(item.id) === Number(id));
            return player && player.gender_eligible && !player.roster_locked;
        });
        if (validSelectedIds.length !== entryRosterSelectedIds.length) {
            setEntryRosterSelectedIds(validSelectedIds);
        }

        const selectedPlayers = entryRosterPlayers.filter(player => validSelectedIds.includes(Number(player.id)));
        const numberCounts = selectedPlayers.reduce((acc, player) => {
            const number = String(getRosterPlayerNumber(player) || '').trim();
            if (!number) return acc;
            acc[number] = (acc[number] || 0) + 1;
            return acc;
        }, {});
        const duplicateNumbers = Object.entries(numberCounts)
            .filter(([, count]) => count > 1)
            .map(([number]) => number);

        if (duplicateNumbers.length > 0) {
            const rosterScope = getEntryRosterScopeLabel();
            Toast.fire({
                icon: 'error',
                title: language === 'THA'
                    ? `หมายเลขเสื้อซ้ำใน ${rosterScope}: ${duplicateNumbers.join(', ')}`
                    : `Duplicate jersey numbers in ${rosterScope}: ${duplicateNumbers.join(', ')}`
            });
            return;
        }

        const confirmation = await Swal.fire({
            title: language === 'THA' ? 'ยืนยันการบันทึกรายชื่อ?' : 'Confirm roster update?',
            text: language === 'THA'
                ? `ระบบจะบันทึกนักกีฬาที่เลือก ${validSelectedIds.length} คนใน ${getEntryRosterScopeLabel()}`
                : `${validSelectedIds.length} selected player(s) will be saved for ${getEntryRosterScopeLabel()}.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: PRIMARY_BLUE,
            cancelButtonColor: '#6b7280',
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel')
        });
        if (!confirmation.isConfirmed) return;

        setEntryRosterLoading(true);
        try {
            await api.updateMyTeamEntryPlayers(entryRosterModal.entry.id, validSelectedIds);
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'บันทึกรายชื่อรุ่นนี้แล้ว' : 'Roster saved' });
            setEntryRosterModal(null);
            fetchData();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'บันทึกไม่สำเร็จ' : 'Failed to save roster') });
        } finally {
            setEntryRosterLoading(false);
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

    const normalizedSearchTerm = (searchTerm || '').toString().toLowerCase();

    const rosterCompetitionNames = useMemo(() => [...new Set(
        (myCompetitions || [])
            .filter(entry => entry.team_entry_id)
            .map(entry => normalizeCompetitionTitle(entry))
            .filter(Boolean)
    )], [myCompetitions]);

    const filteredPlayers = players.filter(p => {
        const firstName = cleanPersonText(p?.first_name).toLowerCase();
        const lastName = cleanPersonText(p?.last_name).toLowerCase();
        const nickname = cleanPersonText(p?.nickname).toLowerCase();
        const numberText = (p?.number ?? '').toString();

        return firstName.includes(normalizedSearchTerm) ||
            lastName.includes(normalizedSearchTerm) ||
            nickname.includes(normalizedSearchTerm) ||
            numberText.includes(normalizedSearchTerm);
    });

    const rosterEmptyText = searchTerm
        ? (language === 'THA' ? "ไม่พบข้อมูลผู้เล่นที่ค้นหา" : "No players found matching your search.")
        : (language === 'THA' ? "ยังไม่มีผู้เล่นในทีม" : "No players added yet.");

    const entryRosterDuplicateNumbers = useMemo(() => {
        const counts = new Map();
        entryRosterPlayers
            .filter(player => entryRosterSelectedIds.includes(player.id))
            .forEach(player => {
                const number = String((player.entry_number ?? player.number) || '').trim();
                if (!number) return;
                counts.set(number, (counts.get(number) || 0) + 1);
            });

        return new Set([...counts.entries()]
            .filter(([, count]) => count > 1)
            .map(([number]) => number));
    }, [entryRosterPlayers, entryRosterSelectedIds]);

    const openScheduleCompetitions = useMemo(() => (
        myCompetitions.filter(competition => String(competition.status || '').toLowerCase() === 'open')
    ), [myCompetitions]);

    const openScheduleCompetitionIds = useMemo(() => (
        new Set(openScheduleCompetitions.map(competition => String(competition.id)))
    ), [openScheduleCompetitions]);

    const openScheduleCompetitionNames = useMemo(() => (
        [...new Set(openScheduleCompetitions.map(getScheduleCompetitionName).filter(Boolean))]
    ), [openScheduleCompetitions]);

    const filteredScheduleMatches = useMemo(() => (
        myMatches.filter(match => openScheduleCompetitionIds.has(String(match.competition_id)))
    ), [myMatches, openScheduleCompetitionIds]);

    const handleExportCSV = () => {
        if (filteredPlayers.length === 0) {
            Toast.fire({ icon: 'info', title: language === 'THA' ? 'ไม่มีรายชื่อนักกีฬาเพื่อส่งออกข้อมูล' : 'No players to export' });
            return;
        }

        const headers = ["Number,First Name,Last Name,Nickname,Position,Height (cm),Weight (kg),Birth Date,Nationality,Captain"];
        const rows = filteredPlayers.map(p => [
            p.number, `"${cleanPersonText(p.first_name)}"`, `"${cleanPersonText(p.last_name)}"`, `"${cleanPersonText(p.nickname)}"`,
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
            setTeamForm(buildTeamFormFromInfo(teamInfo));
            setIsEditingTeam(true);
        }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();

        const confirmation = await Swal.fire({
            title: language === 'THA' ? 'ยืนยันการสร้างทีม?' : 'Confirm team creation?',
            text: language === 'THA'
                ? 'ระบบจะสร้างทีมและบันทึกข้อมูลหลังจากยืนยัน'
                : 'The team and its information will be created after confirmation.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: PRIMARY_BLUE,
            cancelButtonColor: '#6b7280',
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel')
        });
        if (!confirmation.isConfirmed) return;

        try {
            const res = await api.createMyTeam(teamForm);
            setTeamInfo(res.data);
            setTeamForm(buildTeamFormFromInfo(res.data));
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

        const confirmation = await Swal.fire({
            title: language === 'THA' ? 'ยืนยันการอัปเดตข้อมูลทีม?' : 'Confirm team update?',
            text: language === 'THA'
                ? 'ข้อมูลทีมและโลโก้จะถูกอัปเดตหลังจากยืนยัน'
                : 'The team information and logo will be updated after confirmation.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: PRIMARY_BLUE,
            cancelButtonColor: '#6b7280',
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel')
        });

        if (!confirmation.isConfirmed) return;

        try {
            const res = await api.updateMyTeam(teamForm);
            setTeamInfo(res.data);
            setTeamForm(buildTeamFormFromInfo(res.data));
            setIsEditingTeam(false);
            Toast.fire({ icon: 'success', title: language === 'THA' ? 'อัปเดตข้อมูลทีมเรียบร้อยแล้ว' : 'Team updated successfully' });
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: err.response?.data?.error || (language === 'THA' ? 'อัปเดตข้อมูลทีมไม่สำเร็จ' : 'Failed to update team') });
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
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-700"></div>
                    <p className="text-sm text-gray-500">{language === 'THA' ? 'กำลังโหลดแดชบอร์ด...' : 'Loading Dashboard...'}</p>
                </div>
            </div>
        );
    }

    if (isCreatingTeam) {
        return (
            <div className="official-page min-h-screen flex flex-col items-center justify-center p-4">
                <div className="official-panel max-w-md w-full rounded-lg p-8">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center mx-auto mb-4">
                            <Shield className="text-gray-600 w-6 h-6" />
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900">{t('team.createTitle')}</h1>
                        <p className="text-gray-500 mt-2">{t('team.createSubtitle')}</p>
                    </div>

                    <form onSubmit={handleCreateTeam} className="space-y-5">
                        <Input
                            label={t('team.name')} placeholder="e.g. Bangkok Volley Club"
                            value={teamForm.name} required onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                        />
                                                <div>
                                                    <label className="mb-1 block text-xs font-medium text-gray-500">{language === 'THA' ? 'ประเภททีม' : 'Team type'}</label>
                                                    <select value={teamForm.gender} onChange={e => setTeamForm({ ...teamForm, gender: e.target.value })} required className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                                        <option value="">{language === 'THA' ? 'เลือกประเภททีม' : 'Select team type'}</option>
                                                        <option value="Male">{language === 'THA' ? 'ชาย' : 'Men'}</option>
                                                        <option value="Female">{language === 'THA' ? 'หญิง' : 'Women'}</option>
                                                    </select>
                                                </div>
                        <Input
                            label={t('team.code')} placeholder="e.g. BVC"
                            value={teamForm.code} required onChange={e => setTeamForm({ ...teamForm, code: e.target.value })}
                        />
                        <Input
                            label={language === 'THA' ? 'ผู้ฝึกสอน' : 'Coach'}
                            value={teamForm.coach}
                            onChange={e => setTeamForm({ ...teamForm, coach: e.target.value })}
                        />
                        <Input
                            label={language === 'THA' ? 'ผู้จัดการทีม' : 'Team Manager'}
                            value={teamForm.manager_name}
                            onChange={e => setTeamForm({ ...teamForm, manager_name: e.target.value })}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                                label={language === 'THA' ? 'โทรศัพท์' : 'Phone'}
                                value={teamForm.phone}
                                onChange={e => setTeamForm({ ...teamForm, phone: e.target.value })}
                            />
                            <Input
                                label={language === 'THA' ? 'อีเมล' : 'Email'}
                                type="email"
                                value={teamForm.email}
                                onChange={e => setTeamForm({ ...teamForm, email: e.target.value })}
                            />
                        </div>
                        <Input
                            label={language === 'THA' ? 'จังหวัด' : 'Province'}
                            value={teamForm.province}
                            onChange={e => setTeamForm({ ...teamForm, province: e.target.value })}
                        />
                        <ImageUploadField
                            label={t('team.logoUrl')}
                            value={teamForm.logo_url}
                            previewAlt={teamForm.name || 'Team logo'}
                            onFileSelect={(event) => handleImageFileChange(event, 'team_logo', (imageUrl) => setTeamForm(prev => ({ ...prev, logo_url: imageUrl })))}
                            onClear={() => setTeamForm(prev => ({ ...prev, logo_url: '' }))}
                        />

                        <div className="pt-4 flex flex-col gap-3">
                            <Button type="submit" label={t('team.createBtn')} icon={<Shield size={18} />} full />
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
        <div className="official-page workspace-shell flex flex-col overflow-hidden">
            {/* Header */}
            <header className="official-header sticky top-0 z-10">
                <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {teamInfo?.logo_url && !teamLogoLoadFailed ? (
                            <img
                                key={teamInfo.logo_url}
                                src={teamInfo.logo_url} alt={teamInfo.name}
                                className="w-10 h-10 object-contain rounded-lg bg-white border border-white/60"
                                onError={() => setTeamLogoLoadFailed(true)}
                            />
                        ) : (
                            <div className="p-2 rounded-lg border border-white/30 bg-white/15"><Shield className="text-white w-5 h-5" /></div>
                        )}
                        <div>
                            <h1 className="text-lg font-semibold text-white tracking-tight">{teamInfo?.name || t('team.dashboard')}</h1>
                            {teamInfo?.coach && <p className="text-xs text-blue-100 font-medium">{language === 'THA' ? 'ผู้ฝึกสอน' : 'Coach'}: {teamInfo.coach}</p>}
                            {/*!teamInfo?.is_profile_locked && <button onClick={handleEditTeamClick} className="text-xs text-blue-100 hover:text-white flex items-center gap-1 mt-1 cursor-pointer">
                                <Edit2 size={12} /> {t('team.editTeam')}
                            </button>*/}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Language Selector */}
                        <div className="flex items-center gap-1 bg-white/12 border border-white/25 p-1 rounded-md">
                            <button
                                onClick={() => setLanguage('THA')}
                                className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                                    language === 'THA'
                                        ? 'bg-white text-blue-700 shadow-sm'
                                        : 'text-blue-100 hover:text-white'
                                }`}
                            >
                                TH
                            </button>
                            <button
                                onClick={() => setLanguage('ENG')}
                                className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                                    language === 'ENG'
                                        ? 'bg-white text-blue-700 shadow-sm'
                                        : 'text-blue-100 hover:text-white'
                                }`}
                            >
                                EN
                            </button>
                        </div>
                        <button onClick={handleLogout} className="text-sm font-medium text-blue-100 hover:text-white transition cursor-pointer">
                            {t('team.signOut')}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar - Tabs */}
                <aside className="w-full md:w-64 bg-white/95 border-b md:border-b-0 md:border-r border-blue-100 flex flex-col shadow-sm">
                    <div className="p-3 md:p-4 flex flex-col flex-1 overflow-y-auto">
                        <nav className="flex flex-row md:flex-col space-x-4 md:space-x-0 md:space-y-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0" aria-label="Tabs">
                            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Home size={18} className="mr-2" />} label={language === 'THA' ? 'ภาพรวมทีม' : 'Team Overview'} />
                            <TabButton active={activeTab === 'team_info'} onClick={() => setActiveTab('team_info')} icon={<Building2 size={18} className="mr-2" />} label={language === 'THA' ? 'ข้อมูลทีม' : 'Team Information'} />
                            <TabButton active={activeTab === 'competitions'} onClick={() => setActiveTab('competitions')} icon={<Trophy size={18} className="mr-2" />} label={t('team.tabCompetitions')} />
                            <TabButton active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={<Calendar size={18} className="mr-2" />} label={t('team.tabSchedule')} />
                            <TabButton active={activeTab === 'roster'} onClick={() => setActiveTab('roster')} icon={<Users size={18} className="mr-2" />} label={t('team.tabRoster')} />
                            <TabButton active={activeTab === 'uniform'} onClick={() => setActiveTab('uniform')} icon={<Palette size={18} className="mr-2" />} label={language === 'THA' ? 'ชุดการแข่งขัน' : 'Uniform'} />
                            <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart2 size={18} className="mr-2" />} label={t('team.tabStats')} />
                            <TabButton active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<Briefcase size={18} className="mr-2" />} label={t('team.tabStaff')} />
                            <TabButton active={activeTab === 'print'} onClick={() => setActiveTab('print')} icon={<Printer size={18} className="mr-2" />} label={t('team.tabPrint')} />
                        </nav>
                        <div className="mt-auto pt-4 border-t border-gray-200 hidden md:block">
                            <button onClick={handleLogout} className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition group cursor-pointer">
                                <LogOut size={18} className="mr-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
                                {t('team.signOut')}
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main id="main-content" className="workspace-content flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">

                    {activeTab === 'overview' && <>
                    <Panel className="mb-6" title={language === 'THA' ? 'ภาพรวมทีม' : 'Team Overview'} description={language === 'THA' ? 'สรุปข้อมูลทีมและทางลัดไปยังเมนูที่ใช้งานบ่อย' : 'A quick summary of your team and shortcuts to common tasks.'}>
                        <nav aria-label={language === 'THA' ? 'ขั้นตอนเตรียมทีม' : 'Team preparation'} className="grid grid-cols-2 gap-2 p-4 lg:grid-cols-4">
                            {[['roster', language === 'THA' ? 'รายชื่อนักกีฬา' : 'Roster'], ['competitions', language === 'THA' ? 'สมัครการแข่งขัน' : 'Competition entries'], ['schedule', language === 'THA' ? 'ตารางแข่งขัน' : 'Schedule'], ['print', language === 'THA' ? 'ตรวจและพิมพ์เอกสาร' : 'Review documents']].map(([key, label], index) => <button type="button" key={key} onClick={() => setActiveTab(key)} aria-current={activeTab === key ? 'step' : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition ${activeTab === key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-xs">{index + 1}</span>{label}</button>)}
                        </nav>
                    </Panel>
                    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            { label: language === 'THA' ? 'นักกีฬา' : 'Players', value: players.length, icon: <Users size={19} /> },
                            { label: language === 'THA' ? 'รายการที่เข้าร่วม' : 'Competitions', value: groupedMyCompetitions.length, icon: <Trophy size={19} /> },
                            { label: language === 'THA' ? 'เจ้าหน้าที่ทีม' : 'Team Staff', value: staff.length, icon: <Briefcase size={19} /> },
                            { label: language === 'THA' ? 'แมตช์ของทีม' : 'Team Matches', value: myMatches.length, icon: <Calendar size={19} /> }
                        ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between text-sm font-medium text-slate-500"><span>{item.label}</span><span className="text-blue-600">{item.icon}</span></div>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
                        </div>)}
                    </div>
                    </>}
                    {activeTab === 'team_info' && <section className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">{language === 'THA' ? 'ข้อมูลทีม' : 'Team Information'}</h2>
                                <p className="mt-1 text-sm text-slate-500">{language === 'THA' ? 'ข้อมูลตามที่ลงทะเบียนไว้ในระบบ' : 'Team details as registered in the system.'}</p>
                            </div>
                            <button type="button" onClick={handleEditTeamClick} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"><Edit2 size={16} />{t('team.editTeam')}</button>
                        </div>
                        <div className="space-y-6 p-5 sm:p-6">
                            {[
                                { title: language === 'THA' ? '1. ข้อมูลทีม' : '1. Team information', fields: [
                                    [language === 'THA' ? 'โรงเรียน/สังกัด' : 'School / Organization', teamInfo?.name],
                                    [language === 'THA' ? 'จังหวัด' : 'Province', teamInfo?.province],
                                    [language === 'THA' ? 'อำเภอ' : 'District', teamInfo?.district],
                                    [language === 'THA' ? 'ประเภททีม' : 'Team type', getTeamGender(teamInfo?.gender || teamInfo?.category) === 'Male' ? (language === 'THA' ? 'ชาย' : 'Men') : getTeamGender(teamInfo?.gender || teamInfo?.category) === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : '-']
                                ]},
                                { title: language === 'THA' ? '2. ผู้จัดการทีม/ผู้ประสานงาน' : '2. Team manager / Contact person', fields: [
                                    [language === 'THA' ? 'ชื่อ-สกุล' : 'Full name', teamInfo?.manager_name],
                                    [language === 'THA' ? 'อีเมล์' : 'Email', teamInfo?.email],
                                    [language === 'THA' ? 'โทรศัพท์' : 'Office phone', teamInfo?.office_phone],
                                    [language === 'THA' ? 'เบอร์มือถือ' : 'Mobile phone', teamInfo?.mobile_phone || teamInfo?.phone],
                                    [language === 'THA' ? 'โทรสาร' : 'Fax', teamInfo?.fax],
                                    ['Line ID', teamInfo?.line_id]
                                ]},
                                { title: language === 'THA' ? '3. ที่อยู่สำหรับติดต่อ' : '3. Contact address', fields: [
                                    [language === 'THA' ? 'เลขที่/ห้อง' : 'Number / Room', teamInfo?.address_number],
                                    [language === 'THA' ? 'หมู่บ้าน/อาคาร' : 'Village / Building', teamInfo?.building],
                                    [language === 'THA' ? 'หมู่ที่' : 'Moo', teamInfo?.moo],
                                    [language === 'THA' ? 'ซอย/ตรอก' : 'Soi / Alley', teamInfo?.soi],
                                    [language === 'THA' ? 'ถนน' : 'Road', teamInfo?.road],
                                    [language === 'THA' ? 'จังหวัด' : 'Province', teamInfo?.address_province],
                                    [language === 'THA' ? 'เขต/อำเภอ' : 'District', teamInfo?.address_district],
                                    [language === 'THA' ? 'แขวง/ตำบล' : 'Subdistrict', teamInfo?.subdistrict],
                                    [language === 'THA' ? 'รหัสไปรษณีย์' : 'Postal code', teamInfo?.postal_code]
                                ]}
                            ].map(section => <div key={section.title}>
                                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-700">{section.title}</h3>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {section.fields.map(([label, value]) => <div key={label} className="min-h-[68px] rounded-lg border border-slate-100 bg-slate-50 p-3">
                                        <p className="text-xs font-medium text-slate-500">{label}</p>
                                        <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || '-'}</p>
                                    </div>)}
                                </div>
                            </div>)}
                        </div>
                    </section>}
                    {/* ========================== ROSTER TAB ========================== */}
                    {activeTab === 'roster' && (
                        <div className="space-y-4">
                            <div className={isPlayerModalOpen ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-3 sm:p-6' : 'hidden'} onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPlayerModalOpen(false); }}>
                                <div className="official-panel mx-auto max-w-3xl rounded-xl overflow-hidden shadow-2xl">
                                    <div className="official-panel-header px-5 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="official-icon-box p-2 rounded-md">
                                                {editingPlayerId ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                                            </div>
                                            <h2 className="text-base font-semibold text-gray-900">
                                                {editingPlayerId ? t('team.editPlayer') : t('team.addPlayer')}
                                            </h2>
                                        </div>
                                        <button onClick={() => { setIsPlayerModalOpen(false); setEditingPlayerId(null); }} className="text-xs text-gray-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer">
                                                <X size={14} /> {t('common.cancel')}
                                        </button>
                                    </div>
                                    <div className="p-5">
                                        <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
                                            {language === 'THA'
                                                ? 'หน้านี้เป็นคลังรายชื่อนักกีฬาของทีม เลขเสื้อสามารถซ้ำข้ามรุ่นได้ แต่ห้ามซ้ำภายในรายชื่อแข่งขันของรุ่นเดียวกัน'
                                                : 'This form adds players to the team roster pool. Jersey numbers may be reused across categories, but cannot duplicate within the same competition roster.'}
                                        </div>
                                        <form onSubmit={handlePlayerSubmit} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.number')} type="number" value={playerForm.number} required onChange={e => setPlayerForm({ ...playerForm, number: e.target.value })} />
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('team.position')}</label>
                                                    <select value={playerForm.position} onChange={e => setPlayerForm({ ...playerForm, position: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-100 focus:border-gray-500 outline-none bg-white text-sm text-gray-900">
                                                        <option value="OH">{language === 'THA' ? 'OH - ตัวตบหัวเสา' : 'OH - Outside Hitter'}</option>
                                                        <option value="OPP">{language === 'THA' ? 'OPP - ตัวตบตรงข้ามหัวเสา' : 'OPP - Opposite'}</option>
                                                        <option value="S">{language === 'THA' ? 'S - ตัวเซต' : 'S - Setter'}</option>
                                                        <option value="MB">{language === 'THA' ? 'MB - ตัวบล็อกกลาง' : 'MB - Middle Blocker'}</option>
                                                        <option value="L">{language === 'THA' ? 'L - ตัวรับอิสระ (ลิเบอโร่)' : 'L - Libero'}</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('team.gender')}</label>
                                                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                                                    {getTeamGender(teamInfo?.gender || teamInfo?.category) === 'Female' ? (language === 'THA' ? 'หญิง' : 'Women') : (language === 'THA' ? 'ชาย' : 'Men')}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.firstName')} value={playerForm.first_name} onChange={e => setPlayerForm({ ...playerForm, first_name: e.target.value })} />
                                                <Input label={t('team.lastName')} value={playerForm.last_name} onChange={e => setPlayerForm({ ...playerForm, last_name: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label="คำนำหน้า" value={playerForm.title || ''} onChange={e => setPlayerForm({ ...playerForm, title: e.target.value })} />
                                                <Input label="ชื่อกลาง" value={playerForm.middle_name || ''} onChange={e => setPlayerForm({ ...playerForm, middle_name: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.nickname')} value={playerForm.nickname} onChange={e => setPlayerForm({ ...playerForm, nickname: e.target.value })} />
                                                <Input label="ชื่อย่อบนเสื้อ" value={playerForm.jersey_name || ''} onChange={e => setPlayerForm({ ...playerForm, jersey_name: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label="เลขประจำตัวประชาชน (13 หลัก)" value={playerForm.national_id || ''} maxLength={13} onChange={e => setPlayerForm({ ...playerForm, national_id: e.target.value.replace(/\D/g, '').slice(0, 13) })} />
                                                <Input label="FIVB ID" value={playerForm.fivb_id || ''} onChange={e => setPlayerForm({ ...playerForm, fivb_id: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label="ภูมิลำเนา" value={playerForm.hometown || ''} onChange={e => setPlayerForm({ ...playerForm, hometown: e.target.value })} />
                                                <Input label="โรงเรียน/สังกัด" value={playerForm.school_affiliation || teamInfo?.name || ''} onChange={e => setPlayerForm({ ...playerForm, school_affiliation: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label="ระดับชั้น" value={playerForm.grade_level || ''} onChange={e => setPlayerForm({ ...playerForm, grade_level: e.target.value })} />
                                                <Input label="โทรศัพท์ติดต่อ" value={playerForm.contact_phone || ''} onChange={e => setPlayerForm({ ...playerForm, contact_phone: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input label={t('team.height')} type="number" value={playerForm.height_cm} onChange={e => setPlayerForm({ ...playerForm, height_cm: e.target.value })} />
                                                <Input label={t('team.weight')} type="number" value={playerForm.weight} onChange={e => setPlayerForm({ ...playerForm, weight: e.target.value })} />
                                            </div>
                                            <Input label={t('team.dob')} type="date" value={playerForm.birth_date} onChange={e => setPlayerForm({ ...playerForm, birth_date: e.target.value })} />
                                            <ImageUploadField
                                                label={t('team.photoUrl')}
                                                value={playerForm.photo}
                                                previewAlt={`${playerForm.first_name} ${playerForm.last_name}`.trim() || 'Player photo'}
                                                onFileSelect={(event) => handleImageFileChange(event, 'player_photo', (dataUrl) => setPlayerForm({ ...playerForm, photo: dataUrl }))}
                                                onClear={() => setPlayerForm({ ...playerForm, photo: '' })}
                                            />
                                            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                                                <h3 className="text-sm font-semibold text-slate-800">เอกสารยืนยันคุณสมบัติ</h3>
                                                {[["identity_document_url", "สำเนาบัตรประชาชน/สูติบัตร"], ["student_certificate_url", "หนังสือรับรองการเป็นนักเรียนจากโรงเรียน"], ["guardian_consent_url", "หนังสือยินยอมจากผู้ปกครอง"]].map(([key, label]) => <label key={key} className="block text-xs font-medium text-slate-600">{label}<input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full text-xs" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { Toast.fire({ icon: 'error', title: 'ไฟล์ต้องมีขนาดไม่เกิน 5MB' }); return; } const reader = new FileReader(); reader.onload = async () => { try { const { data } = await api.uploadPlayerDocument(reader.result, key); setPlayerDocuments(prev => ({ ...prev, [key]: data.url })); } catch (error) { Toast.fire({ icon: 'error', title: error.response?.data?.error || 'อัปโหลดเอกสารไม่สำเร็จ' }); } }; reader.readAsDataURL(file); }} />{playerDocuments[key] && <span className="mt-1 block text-emerald-700">อัปโหลดแล้ว</span>}</label>)}
                                            </div>

                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                                                <input type="checkbox" id="is_captain" className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 cursor-pointer" checked={playerForm.is_captain} onChange={e => setPlayerForm({ ...playerForm, is_captain: e.target.checked })} />
                                                <label htmlFor="is_captain" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1">{t('team.captain')}</label>
                                            </div>

                                            {playerForm.position === 'L' && (
                                                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-md border border-gray-200">
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

                                            <Button type="submit" label={editingPlayerId ? t('team.updatePlayerBtn') : t('team.addPlayerBtn')} icon={editingPlayerId ? <Edit2 size={18} /> : <UserPlus size={18} />} full />
                                        </form>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full">
                                <div className="mb-4 flex flex-col gap-4 rounded-md border border-blue-950/20 bg-[#142b50] px-5 py-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">Team Roster</p>
                                        <h2 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
                                            {language === 'THA' ? 'จัดการนักกีฬา' : 'Players Management'}
                                        </h2>
                                    </div>
                                    <button type="button" disabled={!getTeamGender(teamInfo?.gender || teamInfo?.category)}
                                        onClick={() => { setEditingPlayerId(null); setPlayerForm(prev => ({ ...prev, gender: getTeamGender(teamInfo?.gender || teamInfo?.category) || 'Male' }));
                                        setPlayerDocuments({ identity_document_url: '', student_certificate_url: '', guardian_consent_url: '' }); setIsPlayerModalOpen(true); }}
                                        title={!getTeamGender(teamInfo?.gender || teamInfo?.category) ? (language === 'THA' ? 'กรุณากำหนดประเภททีมก่อนเพิ่มนักกีฬา' : 'Set team type before adding players') : undefined}
                                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#142b50] disabled:cursor-not-allowed disabled:opacity-55">
                                        <Plus size={18} strokeWidth={2.25} />
                                        Add Player
                                    </button>
                                </div>
                                {!getTeamGender(teamInfo?.gender || teamInfo?.category) && <p className="text-right text-xs text-amber-700">{language === 'THA' ? 'กรุณาแก้ไขข้อมูลทีมและเลือกประเภทชายหรือหญิงก่อนเพิ่มนักกีฬา' : 'Edit team information and choose Men or Women before adding players.'}</p>}
                                <div className="official-panel rounded-md overflow-hidden">
                                    <div className="official-panel-header px-5 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users size={18} className="text-blue-600" /> {t('team.currentRoster')}</h3>
                                            <span className="inline-flex w-fit items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                {getTeamGender(teamInfo?.gender || teamInfo?.category) === 'Female'
                                                    ? (language === 'THA' ? 'ทีมหญิง' : "Women's Team")
                                                    : (language === 'THA' ? 'ทีมชาย' : "Men's Team")}
                                            </span>
                                            {rosterCompetitionNames.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                    <span className="font-semibold text-gray-500">{language === 'THA' ? 'รายการแข่งขัน:' : 'Competitions:'}</span>
                                                    {rosterCompetitionNames.map(name => (
                                                        <span key={name} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">{name}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <div className="relative w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                <input type="text" placeholder={t('team.searchPlayers')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-500 bg-white text-gray-900" />
                                            </div>
                                            <button onClick={handleExportCSV} className="bg-white border border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-md transition cursor-pointer" title={t('team.exportCsv')}><Download size={18} /></button>
                                        </div>
                                    </div>

                                    {rosterViewLoading ? (
                                        <div className="p-10 text-center text-sm font-semibold text-slate-500">
                                            {language === 'THA' ? 'กำลังโหลดรายชื่อนักกีฬา...' : 'Loading roster players...'}
                                        </div>
                                    ) : filteredPlayers.length === 0 ? <EmptyState text={rosterEmptyText} /> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="official-table-head border-b border-gray-200 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-4 text-xs font-medium text-gray-500 w-16 text-center">{t('team.playing')}</th>
                                                        <th className="px-4 py-4 text-xs font-medium text-gray-500 w-16">{language === 'THA' ? 'เบอร์' : 'No.'}</th>
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
                                                        const isCaptain = isTruthyFlag(p.is_captain);
                                                        const liberoBadge = getLiberoBadge(p);
                                                        return (
                                                            <tr key={p.id} className="hover:bg-gray-50 transition group">
                                                                <td className="px-4 py-4 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 cursor-pointer transition"
                                                                        checked={p.is_playing ?? true}
                                                                        onChange={() => togglePlayerMatchSelection(p)}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="w-10 h-10 rounded-md bg-gray-50 border border-gray-200 text-gray-800 flex items-center justify-center font-semibold text-lg transition font-mono">{p.number}</div>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="w-10 h-10 rounded-md bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200 transition">
                                                                        {p.photo ? <img src={p.photo} alt={getPlayerDisplayName(p)} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} /> : <User size={24} className="text-gray-300 m-auto mt-3" />}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div>
                                                                        <div className="font-semibold text-slate-950 flex items-center gap-2 text-base">
                                                                            {getPlayerDisplayName(p) && <span>{getPlayerDisplayName(p)}</span>}
                                                                            {isCaptain ? <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 tracking-wide" title="Team Captain">CAP</span> : null}
                                                                            {liberoBadge ? <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 tracking-wide" title={`Libero ${liberoBadge}`}>{liberoBadge}</span> : null}
                                                                        </div>
                                                                        {getPlayerNickname(p) && <div className="text-xs text-slate-400 font-medium mt-0.5">"{getPlayerNickname(p)}"</div>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">{p.position}</span>
                                                                </td>

                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-700 font-medium font-mono">{formatMeasure(p.height_cm, language === 'THA' ? 'ซม.' : 'cm')}</span></td>
                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-700 font-medium font-mono">{formatMeasure(p.weight, language === 'THA' ? 'กก.' : 'kg')}</span></td>
                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-700 font-bold font-mono">{age || '-'}</span></td>
                                                                <td className="px-4 py-4 text-center"><span className="text-sm text-gray-600 font-medium whitespace-nowrap">{[p.hometown, p.nationality].filter(value => String(value || '').trim()).join(' / ') || '-'}</span></td>
                                                                <td className="px-4 py-4 text-right">
                                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                                                                        <button onClick={() => handleViewStats(p)} className="text-gray-400 hover:text-blue-600 transition p-2 rounded-md hover:bg-blue-50 border border-transparent hover:border-blue-100 cursor-pointer" title={t('team.tabStats')}><BarChart2 size={16} /></button>
                                                                        <button onClick={() => handleEditPlayer(p)} className="text-gray-400 hover:text-blue-600 transition p-2 rounded-md hover:bg-blue-50 border border-transparent hover:border-blue-100 cursor-pointer" title={t('common.edit')}><Edit2 size={16} /></button>
                                                                        <button onClick={() => handleDeletePlayer(p.id)} className="text-gray-400 hover:text-red-600 transition p-2 rounded-md hover:bg-red-50 border border-transparent hover:border-red-100 cursor-pointer" title={t('common.delete')}><Trash2 size={16} /></button>
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
                    {activeTab === 'uniform' && (
                        <UniformTab
                            language={language}
                            teamForm={teamForm}
                            setTeamForm={setTeamForm}
                            onSubmit={handleUpdateTeam}
                        />
                    )}

                    {activeTab === 'staff' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <div className="official-panel rounded-md sticky top-0 overflow-hidden">
                                    <div className="official-panel-header px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="official-icon-box p-2 rounded-md">
                                                {editingStaffId ? <Edit2 className="w-5 h-5" /> : <Briefcase size={20} />}
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-800">
                                                {editingStaffId ? t('team.editStaff') : t('team.addStaff')}
                                            </h2>
                                        </div>
                                        {editingStaffId && (
                                            <button onClick={resetStaffForm} className="text-xs text-gray-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer"><X size={14} /> {t('common.cancel')}</button>
                                        )}
                                    </div>
                                    <div className="p-6">
                                        <form onSubmit={handleStaffSubmit} className="space-y-4">
                                            <Input label={t('team.firstName')} value={staffForm.first_name} required onChange={e => setStaffForm({ ...staffForm, first_name: e.target.value })} />
                                            <Input label={t('team.lastName')} value={staffForm.last_name} required onChange={e => setStaffForm({ ...staffForm, last_name: e.target.value })} />
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('team.gender')}</label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="staffGender" value="Male" checked={staffForm.gender === 'Male'} onChange={e => setStaffForm({ ...staffForm, gender: e.target.value })} className="text-gray-900 focus:ring-gray-500" /> <span className="text-sm text-gray-700">{language === 'THA' ? 'ชาย' : 'Male'}</span></label>
                                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="staffGender" value="Female" checked={staffForm.gender === 'Female'} onChange={e => setStaffForm({ ...staffForm, gender: e.target.value })} className="text-gray-900 focus:ring-gray-500" /> <span className="text-sm text-gray-700">{language === 'THA' ? 'หญิง' : 'Female'}</span></label>
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
                                <div className="official-panel rounded-md overflow-hidden">
                                    <div className="official-panel-header px-6 py-4">
                                        <h3 className="font-bold text-gray-800">{t('team.staffList')}</h3>
                                    </div>
                                    {staff.length === 0 ? <EmptyState text={language === 'THA' ? "ยังไม่มีรายชื่อเจ้าหน้าที่ทีมในระบบ" : "No staff members added yet."} /> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="official-table-head border-b border-gray-200 text-xs uppercase">
                                                    <tr>
                                                        <th className="px-6 py-4 font-bold tracking-wider">{t('team.role')}</th>
                                                        <th className="px-6 py-4 font-bold tracking-wider">{t('team.nameFull')}</th>
                                                        <th className="px-6 py-4 font-bold tracking-wider">{t('team.gender')}</th>
                                                        <th className="px-6 py-4 text-right font-bold tracking-wider">{t('common.actions')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {staff.map((s) => (
                                                        <tr key={s.id} className="hover:bg-gray-50 transition group">
                                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-white text-gray-600 border border-gray-200 rounded text-xs font-medium whitespace-nowrap">{translateRole(s.role)}</span></td>
                                                            <td className="px-6 py-4 font-bold text-gray-900">{s.first_name} {s.last_name}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">{s.gender ? (s.gender === 'Male' ? (language === 'THA' ? 'ชาย' : 'Male') : (language === 'THA' ? 'หญิง' : 'Female')) : '-'}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-2 opacity-100 transition-all duration-200">
                                                                    <button onClick={() => handleEditStaff(s)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-md transition" title={t('common.edit')}><Edit2 size={16} /></button>
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
                            <div className="rounded-md border border-gray-200 bg-white p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">
                                            {language === 'THA' ? 'เลือกรายการแข่งขัน' : 'Select Competition'}
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {language === 'THA'
                                                ? 'เลือกหนึ่งรายการเพื่อดูข้อมูลการสมัคร รุ่น/เพศ และรายการที่เปิดรับสมัคร'
                                                : 'Choose a competition to view joined categories and open registration details.'}
                                        </p>
                                    </div>
                                    <div className="w-full lg:w-96">
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            {language === 'THA' ? 'รายการแข่งขัน' : 'Competition'}
                                        </label>
                                        <select
                                            value={competitionGroupFilter}
                                            onChange={(event) => setCompetitionGroupFilter(event.target.value)}
                                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        >
                                            <option value="all">{language === 'THA' ? 'ทั้งหมด' : 'All competitions'}</option>
                                            {competitionGroupOptions.map(group => (
                                                <option key={group.key} value={group.key}>
                                                    {group.title} - {group.sport}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {selectedCompetitionGroup && (
                                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600 md:grid-cols-3">
                                        <div className="flex items-center gap-2">
                                            <Shield size={16} className="text-blue-500" />
                                            <span className="font-medium text-gray-900">{selectedCompetitionGroup.sport}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} className="text-gray-400" />
                                            <span>{formatDate(selectedCompetitionGroup.start_date)} - {formatDate(selectedCompetitionGroup.end_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-gray-400" />
                                            <span>{selectedCompetitionGroup.location || '-'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2 bg-white">
                                    <Trophy className="text-gray-500" size={20} />
                                    <h3 className="font-semibold text-gray-900">{language === 'THA' ? 'รายการแข่งขันของฉัน' : 'My Competitions'}</h3>
                                </div>
                                {filteredMyCompetitionGroups.length === 0 ? <EmptyState text={language === 'THA' ? 'คุณยังไม่ได้เข้าร่วมรายการแข่งขันใด ๆ' : "You haven't joined any competitions yet."} /> : (
                                    <div className="divide-y divide-gray-100">
                                        {filteredMyCompetitionGroups.map(group => (
                                            <div key={group.key} className="p-6 space-y-4 hover:bg-gray-50 transition">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-base font-semibold text-gray-900">{group.title}</h4>
                                                        <span className="px-2 py-0.5 border text-xs font-semibold rounded bg-blue-50 text-blue-700 border-blue-200">{group.sport}</span>
                                                        <span className="px-2 py-0.5 bg-white text-gray-600 border border-gray-200 text-xs font-medium rounded">{group.categories.length} Categories</span>
                                                    </div>
                                                    <div className="text-sm text-gray-500 flex flex-wrap items-center gap-4">
                                                        <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(group.start_date)} - {formatDate(group.end_date)}</span>
                                                        <span className="flex items-center gap-1"><MapPin size={14} /> {group.location}</span>
                                                        <span className="flex items-center gap-1"><Shield size={14} /> {group.sport}</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    {group.categories.map(c => (
                                                        <div key={c.team_entry_id || c.id} className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <div className="font-medium text-gray-900">{getAgeGroupLabel(c)} / {getGenderLabel(c.gender)}</div>
                                                                <div className="mt-1 text-xs text-gray-500">Registration: {c.registration_status || 'pending'}</div>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <button
                                                                    onClick={() => openEntryRosterModal(c)}
                                                                    className="px-4 py-2 bg-blue-600 border border-blue-600 text-white font-medium rounded-md text-sm hover:bg-blue-700 transition cursor-pointer flex items-center gap-2"
                                                                >
                                                                    <Users size={16} /> Roster
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveTab('schedule');
                                                                    }}
                                                                    className="px-4 py-2 bg-white border border-blue-200 text-blue-700 font-medium rounded-md text-sm hover:bg-blue-50 transition cursor-pointer"
                                                                >
                                                                    View Schedule
                                                                </button>
                                                                <button
                                                                    onClick={() => handleLeaveCompetition(c.id)}
                                                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 font-medium rounded-md text-sm hover:bg-red-50 transition flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <LogOut size={16} /> Leave
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Activity className="text-gray-500" size={20} /> {language === 'THA' ? 'เปิดรับสมัครเข้าร่วมแข่งขัน' : 'Open for Registration'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredOpenCompetitionGroups.length === 0 ? (
                                        <div className="col-span-full bg-white p-8 rounded-md border border-dashed border-gray-300 text-center text-gray-400">
                                            No competitions open right now.
                                        </div>
                                    ) : (
                                        filteredOpenCompetitionGroups.map(group => {
                                            const selectedCategoryIds = joinSelections[group.key] || [];
                                            const selectedGenders = joinGenderSelections[group.key] || [];
                                            const availableGenders = [...new Set(group.categories.map(c => getGenderLabel(c.gender)).filter(gender => gender === 'Male' || gender === 'Female'))].sort((a, b) => (genderOrder[a] || 99) - (genderOrder[b] || 99) || a.localeCompare(b));
                                            const visibleGenders = selectedGenders.length > 0 ? selectedGenders : [];

                                            return (
                                                <div key={group.key} className="bg-white rounded-md border border-gray-200 overflow-hidden hover:bg-gray-50 transition flex flex-col">
                                                    <div className="p-6 flex-1">
                                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                                            <h4 className="text-base font-semibold text-gray-900">{group.title}</h4>
                                                            <span className="px-2 py-0.5 border text-xs font-semibold rounded bg-blue-50 text-blue-700 border-blue-200">{group.sport}</span>
                                                        </div>
                                                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                                                            <div className="flex items-center gap-2"><Calendar size={16} className="text-gray-400" /> {formatDate(group.start_date)} - {formatDate(group.end_date)}</div>
                                                            <div className="flex items-center gap-2"><MapPin size={16} className="text-gray-400" /> {group.location}</div>
                                                            <div className="flex items-center gap-2"><Shield size={16} className="text-gray-400" /> {group.sport}</div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div className="rounded-md border border-gray-200 bg-white p-3">
                                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                                    <div className="text-sm font-semibold text-gray-900">1. Gender</div>
                                                                    <span className="text-xs text-gray-500">{language === 'THA' ? 'เลือกได้ประเภทเดียวต่อทีม' : 'One gender type per team'}</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {availableGenders.filter((gender) => {
                                                                        const lockedGender = getTeamGender(teamInfo?.gender || teamInfo?.category);
                                                                        return !lockedGender && !selectedOpenGender ? true : gender === (lockedGender || selectedOpenGender);
                                                                    }).map((gender) => {
                                                                        const isSelected = selectedGenders.includes(gender);
                                                                        return (
                                                                            <button
                                                                                key={gender}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setJoinGenderSelections(prev => {
                                                                                        const current = prev[group.key] || [];
                                                                                        const nextGenders = current.includes(gender)
                                                                                            ? current.filter(item => item !== gender)
                                                                                            : [...current, gender];

                                                                                        setJoinSelections(prevSelections => {
                                                                                            const allowedGenders = new Set(nextGenders);
                                                                                            const currentSelected = prevSelections[group.key] || [];
                                                                                            const filteredIds = currentSelected.filter(id => {
                                                                                                const comp = group.categories.find(item => item.id === id);
                                                                                                return comp ? allowedGenders.has(getGenderLabel(comp.gender)) : false;
                                                                                            });
                                                                                            return { ...prevSelections, [group.key]: filteredIds };
                                                                                        });

                                                                                        return { ...prev, [group.key]: nextGenders };
                                                                                    });
                                                                                }}
                                                                                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                                                                                    isSelected
                                                                                        ? 'border-blue-600 bg-blue-600 text-white'
                                                                                        : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
                                                                                }`}
                                                                            >
                                                                                {gender}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            {visibleGenders.length === 0 ? (
                                                                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                                                                    Select a gender to see age groups.
                                                                </div>
                                                            ) : (
                                                                visibleGenders.map((gender) => {
                                                                    const genderItems = group.categories.filter(c => getGenderLabel(c.gender) === gender);
                                                                    const ageBuckets = genderItems.reduce((acc, competition) => {
                                                                        const ageKey = getCompetitionAgeGroupKey(competition);
                                                                        const ageName = resolveAgeGroupName(competition);
                                                                        if (!acc[ageKey]) acc[ageKey] = { label: ageName, items: [] };
                                                                        acc[ageKey].items.push(competition);
                                                                        return acc;
                                                                    }, {});
                                                                    const orderedAgeBuckets = Object.entries(ageBuckets).sort(([, a], [, b]) => {
                                                                        const orderA = ageGroupOrder.indexOf(a.label);
                                                                        const orderB = ageGroupOrder.indexOf(b.label);
                                                                        const safeA = orderA === -1 ? 99 : orderA;
                                                                        const safeB = orderB === -1 ? 99 : orderB;
                                                                        return safeA - safeB || a.label.localeCompare(b.label);
                                                                    });

                                                                    return (
                                                                        <div key={gender} className="rounded-md border border-gray-200 bg-white p-3">
                                                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                                                <div className="text-sm font-semibold text-gray-900">2. {gender}</div>
                                                                                <span className="text-xs text-gray-500">{genderItems.length} categories</span>
                                                                            </div>

                                                                            <div className="space-y-2">
                                                                                {orderedAgeBuckets.map(([ageKey, bucket]) => {
                                                                                    const items = bucket.items || [];
                                                                                    return (
                                                                                        <div key={ageKey} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                                                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                                                                <div className="text-sm font-semibold text-gray-900">3. {bucket.label}</div>
                                                                                                <span className="text-xs text-gray-500">{items.length} options</span>
                                                                                            </div>
                                                                                            <div className="space-y-2">
                                                                                                {items.map(c => {
                                                                                                    const isChecked = selectedCategoryIds.includes(c.id);
                                                                                                    return (
                                                                                                        <label key={c.id} className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 cursor-pointer hover:bg-gray-100">
                                                                                                            <input
                                                                                                                type="checkbox"
                                                                                                                checked={isChecked}
                                                                                                                onChange={() => {
                                                                                                                    setJoinSelections(prev => {
                                                                                                                        const current = prev[group.key] || [];
                                                                                                                        const nextIds = current.includes(c.id)
                                                                                                                            ? current.filter(id => id !== c.id)
                                                                                                                            : [...current, c.id];
                                                                                                                        return { ...prev, [group.key]: nextIds };
                                                                                                                    });
                                                                                                                }}
                                                                                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                                                                                            />
                                                                                                            <div className="min-w-0 flex-1">
                                                                                                                <div className="text-sm font-medium text-gray-900">
                                                                                                                    {bucket.label} / {gender}
                                                                                                                </div>
                                                                                                                <div className="text-xs text-gray-500">
                                                                                                                    Max {c.max_players || '-'} players
                                                                                                                </div>
                                                                                                            </div>
                                                                                                            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                                                                                Open
                                                                                                            </span>
                                                                                                        </label>
                                                                                                    );
                                                                                                })}
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

                                                        <div className="mt-4 flex items-center justify-between gap-3">
                                                            <div className="text-xs text-gray-500">
                                                                Selected {selectedCategoryIds.length} category{selectedCategoryIds.length === 1 ? '' : 'ies'}
                                                            </div>
                                                            <button
                                                                onClick={() => handleJoinCompetition(selectedCategoryIds)}
                                                                disabled={selectedCategoryIds.length === 0}
                                                                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 disabled:cursor-not-allowed text-white font-medium rounded-md transition flex items-center justify-center gap-2 cursor-pointer"
                                                            >
                                                                {t('team.joinCompBtn')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================== SCHEDULE TAB ========================== */}
                    {activeTab === 'schedule' && (
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
                            <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm">
                                        <Calendar size={19} />
                                    </span>
                                    <div>
                                        <h3 className="font-semibold text-slate-950">{t('team.tabSchedule')}</h3>
                                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                                            {language === 'THA' ? 'รายการแข่งขัน วันที่ เวลา และสนามแข่งขันของทีม' : 'Team match list, date, time, and venue'}
                                        </p>
                                    </div>
                                </div>
                                {/* ✅ เพิ่ม Dropdown สำหรับกรองตารางแข่งขันตามรายการ */}
                                <div className="sm:ml-auto sm:max-w-[55%] sm:text-right">
                                    <p className="mt-1 text-sm font-semibold text-slate-800">
                                        {openScheduleCompetitionNames.length
                                            ? openScheduleCompetitionNames.join(' · ')
                                            : (language === 'THA' ? 'ไม่มีรายการที่เปิดอยู่' : 'No open competitions')}
                                    </p>
                                </div>
                            </div>
                            {myMatches.length === 0 ? <EmptyState text={language === 'THA' ? "ยังไม่มีตารางการแข่งขันในขณะนี้" : "No matches scheduled."} /> : (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {/* ✅ กรอง Match ที่นำมาแสดงตามที่เลือกใน Dropdown */}
                                    {filteredScheduleMatches
                                        .map(m => {
                                            const displayStatus = m.status === 'completed'
                                                ? (language === 'THA' ? 'แข่งขันแล้ว' : 'Completed')
                                                : (m.status === 'live' ? (language === 'THA' ? 'กำลังแข่งขัน' : 'Live') : (language === 'THA' ? 'ยังไม่เริ่ม' : 'Scheduled'));
                                            return (
                                                <div key={m.id} className="group flex flex-col gap-5 px-6 py-5 transition hover:bg-slate-50/80 md:flex-row md:items-center md:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-3 flex flex-wrap items-center gap-2">
                                                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                                                {cleanCompetitionTitle(m.competition_name) || (language === 'THA' ? 'รายการแข่งขัน' : 'Competition')}
                                                            </span>
                                                            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                                                m.status === 'completed'
                                                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                                                    : m.status === 'live'
                                                                        ? 'border-blue-100 bg-blue-50 text-blue-700'
                                                                        : 'border-slate-200 bg-white text-slate-600'
                                                            }`}>
                                                                {displayStatus}
                                                            </span>
                                                        </div>
                                                        <div className="mb-3 flex min-w-0 items-center gap-3">
                                                            <div className="min-w-0 text-base font-semibold leading-snug text-slate-950">
                                                                <span className="break-words">{m.home_team}</span>
                                                                <span className="mx-2 text-xs font-bold uppercase tracking-wider text-slate-400">vs</span>
                                                                <span className="break-words">{m.away_team}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5">
                                                                <Calendar size={14} className="text-slate-400" />
                                                                {m.match_date ? formatDate(m.match_date) : (language === 'THA' ? 'ยังไม่กำหนดวันที่' : 'Date TBD')}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5">
                                                                <Clock size={14} className="text-slate-400" />
                                                                {m.start_time
                                                                    ? `${String(m.start_time).substring(0, 5)}${language === 'THA' ? ' น.' : ''}`
                                                                    : (language === 'THA' ? 'ยังไม่กำหนดเวลา' : 'Time TBD')}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5"><MapPin size={14} className="text-slate-400" /> {m.location || 'TBD'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-3 md:justify-end">
                                                        {m.status === 'completed' ? (
                                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xl font-semibold text-slate-800 shadow-sm">
                                                                {m.home_set_score} - {m.away_set_score}
                                                            </div>
                                                        ) : (
                                                            /* ปุ่มสำหรับเข้า Staff Console เฉพาะเมื่อแมตช์ยังไม่จบ */
                                                            <button
                                                                onClick={() => navigate(`/staff/${m.id}`)}
                                                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
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
                                    {filteredScheduleMatches.length === 0 && (
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
                    <div className="bg-white rounded-md border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fade-in-up flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">{t('team.editTeam')}</h3>
                            <button onClick={() => setIsEditingTeam(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <form onSubmit={handleUpdateTeam} className="space-y-6">
                                <section className="space-y-3">
                                    <h4 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">{language === 'THA' ? '1. ข้อมูลทีม' : '1. Team information'}</h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Input label={language === 'THA' ? 'โรงเรียน/สังกัด' : 'School / Organization'} value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} required />
                                        <Input label={language === 'THA' ? 'รหัสทีม' : 'Team code'} value={teamForm.code} onChange={e => setTeamForm({ ...teamForm, code: e.target.value })} required />
                                        <Input label={language === 'THA' ? 'จังหวัด' : 'Province'} value={teamForm.province} onChange={e => setTeamForm({ ...teamForm, province: e.target.value })} />
                                        <Input label={language === 'THA' ? 'อำเภอ' : 'District'} value={teamForm.district} onChange={e => setTeamForm({ ...teamForm, district: e.target.value })} />
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-gray-500">{language === 'THA' ? 'ประเภททีม' : 'Team type'}</label>
                                            <select value={teamForm.gender} onChange={e => setTeamForm({ ...teamForm, gender: e.target.value })} required className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                                <option value="">{language === 'THA' ? 'เลือกประเภททีม' : 'Select team type'}</option>
                                                <option value="Male">{language === 'THA' ? 'ชาย' : 'Men'}</option>
                                                <option value="Female">{language === 'THA' ? 'หญิง' : 'Women'}</option>
                                            </select>
                                        </div>
                                        <Input label={language === 'THA' ? 'ผู้ฝึกสอน' : 'Coach'} value={teamForm.coach} onChange={e => setTeamForm({ ...teamForm, coach: e.target.value })} />
                                    </div>
                                </section>
                                <section className="space-y-3">
                                    <h4 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">{language === 'THA' ? '2. ผู้จัดการทีม/ผู้ประสานงาน' : '2. Team manager / Contact person'}</h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Input label={language === 'THA' ? 'ชื่อ-สกุล' : 'Full name'} value={teamForm.manager_name} onChange={e => setTeamForm({ ...teamForm, manager_name: e.target.value })} />
                                        <Input label={language === 'THA' ? 'อีเมล์' : 'Email'} type="email" value={teamForm.email} onChange={e => setTeamForm({ ...teamForm, email: e.target.value })} />
                                        <Input label={language === 'THA' ? 'โทรศัพท์' : 'Office phone'} value={teamForm.office_phone} onChange={e => setTeamForm({ ...teamForm, office_phone: e.target.value })} />
                                        <Input label={language === 'THA' ? 'เบอร์มือถือ' : 'Mobile phone'} value={teamForm.mobile_phone} onChange={e => setTeamForm({ ...teamForm, mobile_phone: e.target.value, phone: e.target.value })} />
                                        <Input label={language === 'THA' ? 'โทรสาร' : 'Fax'} value={teamForm.fax} onChange={e => setTeamForm({ ...teamForm, fax: e.target.value })} />
                                        <Input label="Line ID" value={teamForm.line_id} onChange={e => setTeamForm({ ...teamForm, line_id: e.target.value })} />
                                    </div>
                                </section>
                                <section className="space-y-3">
                                    <h4 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">{language === 'THA' ? '3. ที่อยู่สำหรับติดต่อ' : '3. Contact address'}</h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Input label={language === 'THA' ? 'เลขที่/ห้อง' : 'Number / Room'} value={teamForm.address_number} onChange={e => setTeamForm({ ...teamForm, address_number: e.target.value })} />
                                        <Input label={language === 'THA' ? 'หมู่บ้าน/อาคาร' : 'Village / Building'} value={teamForm.building} onChange={e => setTeamForm({ ...teamForm, building: e.target.value })} />
                                        <Input label={language === 'THA' ? 'หมู่ที่' : 'Moo'} value={teamForm.moo} onChange={e => setTeamForm({ ...teamForm, moo: e.target.value })} />
                                        <Input label={language === 'THA' ? 'ซอย/ตรอก' : 'Soi / Alley'} value={teamForm.soi} onChange={e => setTeamForm({ ...teamForm, soi: e.target.value })} />
                                        <Input label={language === 'THA' ? 'ถนน' : 'Road'} value={teamForm.road} onChange={e => setTeamForm({ ...teamForm, road: e.target.value })} />
                                        <Input label={language === 'THA' ? 'จังหวัด' : 'Province'} value={teamForm.address_province} onChange={e => setTeamForm({ ...teamForm, address_province: e.target.value })} />
                                        <Input label={language === 'THA' ? 'เขต/อำเภอ' : 'District'} value={teamForm.address_district} onChange={e => setTeamForm({ ...teamForm, address_district: e.target.value })} />
                                        <Input label={language === 'THA' ? 'แขวง/ตำบล' : 'Subdistrict'} value={teamForm.subdistrict} onChange={e => setTeamForm({ ...teamForm, subdistrict: e.target.value })} />
                                        <Input label={language === 'THA' ? 'รหัสไปรษณีย์' : 'Postal code'} value={teamForm.postal_code} onChange={e => setTeamForm({ ...teamForm, postal_code: e.target.value })} />
                                    </div>
                                </section>
                                <ImageUploadField
                                    label={t('team.logoUrl')}
                                    value={teamForm.logo_url}
                                    previewAlt={teamForm.name || 'Team logo'}
                                    onFileSelect={(event) => handleImageFileChange(event, 'team_logo', (imageUrl) => setTeamForm(prev => ({ ...prev, logo_url: imageUrl })))}
                                    onClear={() => setTeamForm(prev => ({ ...prev, logo_url: '' }))}
                                />
                                <Button type="submit" label={t('common.save')} full />
                                <div className="border-t border-gray-100 pt-5">
                                    <p className="mb-2 text-xs font-bold uppercase text-red-500">{language === 'THA' ? 'พื้นที่อันตราย (Danger Zone)' : 'Danger Zone'}</p>
                                    <button type="button" onClick={handleDeleteTeam} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50">
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
                    <div className="bg-white rounded-md border border-gray-200 w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 border border-gray-200 p-2 rounded-md"><BarChart2 size={20} className="text-gray-500" /></div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{viewingStatsPlayer.first_name} {viewingStatsPlayer.last_name}</h3>
                                    <p className="text-xs text-gray-500">#{viewingStatsPlayer.number} • {viewingStatsPlayer.position}</p>
                                </div>
                            </div>
                            <button onClick={() => { setViewingStatsPlayer(null); setStatsData(null); }} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-md transition"><X size={20} /></button>
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

                            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                                <h4 className="text-gray-600 font-medium text-sm mb-3 flex items-center gap-2"><Activity size={16} /> {language === 'THA' ? 'การเสิร์ฟ' : 'Serve'}</h4>
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

            {entryRosterModal && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-md border border-gray-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Users size={20} className="text-gray-500" />
                                    {language === 'THA' ? 'จัดรายชื่อนักกีฬา' : 'Manage Roster'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">{normalizeCompetitionTitle(entryRosterModal.competition)}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {entryRosterModal.entry.age_group_name || 'General'} / {entryRosterModal.entry.competition_gender}
                                </p>
                            </div>
                            <button onClick={() => setEntryRosterModal(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">
                                {language === 'THA' ? 'เลือกแล้ว' : 'Selected'}: {entryRosterSelectedIds.length}
                                {entryRosterModal.entry.max_players ? ` / ${entryRosterModal.entry.max_players}` : ''}
                            </span>
                            <span className="text-gray-500">
                                {language === 'THA' ? 'เลือกได้เฉพาะเพศตรงรุ่น และนักกีฬาที่ยังไม่ลงรุ่นอื่น' : 'Only matching gender and unassigned players can be selected'}
                            </span>
                        </div>

                        <div className="px-6 py-3 border-b border-gray-100 bg-blue-50 text-xs leading-relaxed text-blue-800">
                            {language === 'THA'
                                ? `กำลังจัดรายชื่อสำหรับ ${getEntryRosterScopeLabel()} นักกีฬา 1 คนลงได้เพียง 1 รุ่น และเลขเสื้อห้ามซ้ำเฉพาะรายชื่อของรุ่น/รายการนี้`
                                : `Editing roster for ${getEntryRosterScopeLabel()}. Each player can be assigned to one category only; jersey number duplicates are checked within this roster.`}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {entryRosterPlayers.length === 0 ? (
                                <EmptyState text={language === 'THA' ? 'ยังไม่มีนักกีฬาในทีมนี้' : 'No players found for this team.'} />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {entryRosterPlayers.map(player => {
                                        const selected = entryRosterSelectedIds.includes(Number(player.id));
                                        const locked = Boolean(player.roster_locked);
                                        const disabled = !player.gender_eligible || locked;
                                        const rosterNumber = String(getRosterPlayerNumber(player) || '').trim();
                                        const hasDuplicateNumber = selected && rosterNumber && entryRosterDuplicateNumbers.has(rosterNumber);
                                        const lockedRosterLabel = getLockedRosterLabel(player);
                                        return (
                                            <button
                                                key={player.id}
                                                type="button"
                                                onClick={() => toggleEntryRosterPlayer(player)}
                                                disabled={disabled || entryRosterLoading}
                                                className={`text-left p-4 rounded-md border transition flex items-center justify-between gap-4 ${
                                                    hasDuplicateNumber
                                                        ? 'border-red-300 bg-red-50'
                                                        : selected
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : disabled
                                                            ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-bold text-gray-900 truncate">
                                                        #{rosterNumber || '-'} {player.first_name} {player.last_name}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                        <span>{player.gender || '-'} / {player.position || '-'} / {player.birth_date ? `${calculateAge(player.birth_date)} yrs` : '-'}</span>
                                                        {hasDuplicateNumber && (
                                                            <span className="rounded border border-red-200 bg-white px-1.5 py-0.5 font-semibold text-red-600">
                                                                {language === 'THA' ? 'เลขซ้ำในรุ่นนี้' : 'Duplicate in roster'}
                                                            </span>
                                                        )}
                                                        {locked && (
                                                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
                                                                {language === 'THA'
                                                                    ? `ลงแล้ว: ${lockedRosterLabel || 'รุ่นอื่น'}`
                                                                    : `Assigned: ${lockedRosterLabel || 'another category'}`}
                                                            </span>
                                                        )}
                                                        {!player.gender_eligible && (
                                                            <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-semibold text-gray-500">
                                                                {language === 'THA' ? 'เพศไม่ตรงรุ่น' : 'Gender mismatch'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                                                    selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                                                }`}>
                                                    {selected ? '✓' : ''}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setEntryRosterModal(null)}
                                className="px-4 py-2 border rounded-md text-sm font-medium text-blue-700 bg-white border-blue-200 hover:bg-blue-50"
                            >
                                {language === 'THA' ? 'ยกเลิก' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={saveEntryRoster}
                                disabled={entryRosterLoading}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium"
                            >
                                {language === 'THA' ? 'บันทึกรายชื่อ' : 'Save Roster'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// --- Helper Components ---

function UniformTab({ language, teamForm, setTeamForm, onSubmit }) {
    const uniformFields = [
        { key: 'main_color', step: '1.1', label: language === 'THA' ? 'สีหลัก' : 'Main color' },
        { key: 'second_color', step: '1.2', label: language === 'THA' ? 'สีรอง' : 'Second color' },
        { key: 'third_color', step: '1.3', label: language === 'THA' ? 'สีที่สาม' : 'Third color' },
    ];
    const liberoFields = [
        { key: 'libero_main_color', step: '2.1', label: language === 'THA' ? 'สีหลัก' : 'Main color' },
        { key: 'libero_second_color', step: '2.2', label: language === 'THA' ? 'สีรอง' : 'Second color' },
        { key: 'libero_third_color', step: '2.3', label: language === 'THA' ? 'สีที่สาม' : 'Third color' },
    ];

    const updateColor = (key, value) => {
        setTeamForm(prev => ({ ...prev, [key]: value }));
    };

    const resetColors = () => {
        setTeamForm(prev => ({
            ...prev,
            ...DEFAULT_UNIFORM_COLORS
        }));
    };

    return (
        <div className="space-y-5 animate-fadeIn">
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                            <Palette className="text-gray-500 w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">{language === 'THA' ? 'ชุดการแข่งขัน' : 'Uniform'}</h2>
                            <p className="text-xs text-gray-500">
                                {language === 'THA'
                                    ? 'กำหนดสีเสื้อนักกีฬาและสีเสื้อ Libero สำหรับเอกสารทีม'
                                    : 'Set player and Libero uniform colors for team documents.'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={resetColors}
                        className="px-3 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        {language === 'THA' ? 'รีเซ็ตสี' : 'Reset colors'}
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
                    <div className="space-y-5">
                        <UniformColorSection
                            title={language === 'THA' ? '1. ชุดนักกีฬา' : '1. Uniform'}
                            subtitle={language === 'THA' ? 'สีเสื้อหลักของนักกีฬา' : 'Player uniform colors'}
                            fields={uniformFields}
                            teamForm={teamForm}
                            language={language}
                            onChange={updateColor}
                        />
                        <UniformColorSection
                            title={language === 'THA' ? '2. ชุด Libero' : '2. Libero Uniform'}
                            subtitle={language === 'THA' ? 'สีเสื้อสำหรับ Libero' : 'Libero uniform colors'}
                            fields={liberoFields}
                            teamForm={teamForm}
                            language={language}
                            onChange={updateColor}
                        />
                    </div>

                    <div className="space-y-4">
                        <UniformPreview
                            title={language === 'THA' ? 'ตัวอย่างชุดนักกีฬา' : 'Player Uniform Preview'}
                            number="12"
                            mainColor={teamForm.main_color}
                            secondColor={teamForm.second_color}
                            thirdColor={teamForm.third_color}
                        />
                        <UniformPreview
                            title={language === 'THA' ? 'ตัวอย่างชุด Libero' : 'Libero Uniform Preview'}
                            number="L1"
                            mainColor={teamForm.libero_main_color}
                            secondColor={teamForm.libero_second_color}
                            thirdColor={teamForm.libero_third_color}
                        />
                        <Button type="submit" label={language === 'THA' ? 'บันทึกชุดการแข่งขัน' : 'Save Uniform Colors'} full />
                    </div>
                </form>
            </div>
        </div>
    );
}

function UniformColorSection({ title, subtitle, fields, teamForm, language, onChange }) {
    return (
        <section className="rounded-md border border-gray-200 bg-gray-50/60 p-4">
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {fields.map(field => (
                    <UniformColorInput
                        key={field.key}
                        label={`${field.step} ${field.label}`}
                        value={teamForm[field.key]}
                        placeholder={language === 'THA' ? 'เช่น blue หรือ #1f2937' : 'e.g. blue or #1f2937'}
                        onChange={(value) => onChange(field.key, value)}
                    />
                ))}
            </div>
        </section>
    );
}

function UniformColorInput({ label, value, placeholder, onChange }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <input
                type="text"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                aria-label={label}
            />
        </div>
    );
}

function UniformPreview({ title, number, mainColor, secondColor, thirdColor }) {
    return (
        <div className="rounded-md border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
            <div
                className="relative h-40 rounded-md border border-gray-200 overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: mainColor || '#f3f4f6' }}
            >
                <div
                    className="absolute inset-x-0 top-0 h-8"
                    style={{ backgroundColor: secondColor || '#ffffff' }}
                />
                <div
                    className="absolute bottom-0 right-0 h-24 w-24 rotate-45 translate-x-10 translate-y-10"
                    style={{ backgroundColor: thirdColor || '#d1d5db' }}
                />
                <div
                    className="relative z-10 h-20 w-20 rounded-md border-2 flex items-center justify-center text-2xl font-black shadow-sm"
                    style={{
                        borderColor: secondColor || '#ffffff',
                        color: secondColor || '#ffffff',
                        backgroundColor: 'rgba(255,255,255,0.08)'
                    }}
                >
                    {number}
                </div>
            </div>
        </div>
    );
}

function FilterButton({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-blue-700 border border-blue-100 hover:bg-blue-50'
                }`}
        >
            {label}
        </button>
    );
}

function Input({ label, type = "text", value, onChange, required, placeholder }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <input type={type} required={required} value={value} onChange={onChange} placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-100 focus:border-gray-500 outline-none transition text-sm bg-white text-gray-900"
            />
        </div>
    );
}

function ImageUploadField({ label, value, onFileSelect, onClear, previewAlt }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {value ? (
                        <img src={value} alt={previewAlt} className="w-full h-full object-cover" />
                    ) : (
                        <User size={22} className="text-gray-300" />
                    )}
                </div>
                <div className="flex flex-1 items-center gap-2 min-w-0">
                    <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition">
                        <Upload size={16} />
                        <span>Browse</span>
                        <input type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
                    </label>
                    {value && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                            aria-label="Remove image"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <span className="text-xs text-gray-400 truncate">JPG, PNG, WebP up to 2MB</span>
                </div>
            </div>
        </div>
    );
}

function TopPlayerCard({ title, icon, player, value, label }) {
    if (!player || value === 0) return (
        <div className="p-4 rounded-md border border-gray-200 bg-gray-50 flex items-center gap-4 opacity-70">
            <div className="p-2 bg-white rounded-md border border-gray-200">{icon}</div>
            <div>
                <div className="text-xs font-medium text-gray-500">{title}</div>
                <div className="text-sm font-medium text-gray-500">-</div>
            </div>
        </div>
    );

    return (
        <div className="p-4 rounded-md border border-gray-200 bg-white flex items-center gap-4 transition-colors hover:bg-gray-50">
            <div className="relative">
                <div className="w-11 h-11 rounded-md bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-200">
                    {player.photo ? <img src={player.photo} alt={player.first_name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} /> : <User size={20} className="text-gray-400" />}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded border border-gray-200 p-0.5">{icon}</div>
            </div>
            <div className="min-w-0">
                <div className="text-xs font-medium text-gray-500 mb-0.5">{title}</div>
                <div className="font-semibold text-gray-900 leading-tight truncate text-sm">{player.first_name} {player.last_name}</div>
                <div className="text-xs font-medium mt-0.5 text-gray-600"><span className="text-lg font-semibold">{value}</span> {label}</div>
            </div>
        </div>
    );
}

function Button({ type, label, icon, full, className }) {
    return (
        <button type={type} className={`${className || "official-primary-button"} text-white font-medium py-2.5 px-4 rounded-md transition flex items-center justify-center gap-2 ${full ? 'w-full' : ''}`}>
            {icon} {label}
        </button>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`
                group inline-flex items-center py-2.5 px-3 md:px-4 rounded-md font-medium text-sm transition whitespace-nowrap
                ${active
                    ? 'text-white bg-blue-600 shadow-sm'
                    : 'border-transparent text-gray-600 hover:text-blue-700 hover:bg-blue-50'}
            `}
        >
            <span className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`}>{icon}</span>
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
