import React, { useEffect, useState, useCallback, useMemo } from 'react';
import client, { api } from '../api';
import {
    Swords, PlusCircle, X, Calendar, MapPin, Edit2, Trash2,
    Printer, ListFilter, Save, Clock, Shield, Trophy, FileText,
    Users
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Toast } from './AdminShared';
import { formatThaiDate, formatThaiTime, formatForInput } from '../utils';
import ScoreSheet from './ScoreSheet';

const normalizeRoundName = (value) => {
    if (!value) return '';
    return String(value).includes('เธ') ? 'Classification' : value;
};

export default function MatchManagementTab() {
    // --- State Management ---
    const [competitions, setCompetitions] = useState([]);
    const [matches, setMatches] = useState([]);
    const [modalTeams, setModalTeams] = useState([]);
    const [loadingModalTeams, setLoadingModalTeams] = useState(false);
    const [registeredTeams, setRegisteredTeams] = useState([]); // ทีมที่สมัครในรายการนี้
    const [stadiums, setStadiums] = useState([]); // สนามแข่ง
    const [uniqueBaseNames, setUniqueBaseNames] = useState([]);
    const [selectedBaseName, setSelectedBaseName] = useState('');
    const [filterGender, setFilterGender] = useState('');
    const [filterAgeGroup, setFilterAgeGroup] = useState('All');
    const [availableGenders, setAvailableGenders] = useState([]);
    const [selectedCompId, setSelectedCompId] = useState('');
    const [ageGroups, setAgeGroups] = useState([]);

    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);



    // Form Data
    const initialForm = {
        id: null,
        competition_id: '',
        home_team_id: '',
        away_team_id: '',
        start_time: '',
        location: '', // เก็บชื่อสนาม หรือ ID
        city: '',
        match_date: '',
        category: '',
        age_group_id: '',
        match_number: '',
        round_name: '',
        pool_name: '',
        gender: 'Male', // Default
        max_sets: 3 // Default to best-of-3 (first to 2)
    };
    const [matchForm, setMatchForm] = useState(initialForm);


    // State สำหรับ Modal บันทึกคะแนน
    const [scoringMatch, setScoringMatch] = useState(null);
    const [scoreForm, setScoreForm] = useState({
        home_set_score: 0,
        away_set_score: 0,
        set_scores: [], // e.g., ["25-20", "25-18", "25-22"]
    });

    const getCompetitionBaseName = useCallback((competition) => {
        const rawTitle = competition?.title || competition?.name || '';
        return rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
    }, []);

    const getCompetitionAgeGroupId = useCallback((competition) => (
        competition?.age_group_id !== undefined && competition?.age_group_id !== null
            ? String(competition.age_group_id)
            : ''
    ), []);

    const getRelatedCompetitions = useCallback(() => {
        if (!selectedBaseName) return [];
        return competitions.filter(c => getCompetitionBaseName(c) === selectedBaseName);
    }, [competitions, getCompetitionBaseName, selectedBaseName]);

    const getAgeGroupOptionsForGender = useCallback((gender) => {
        const ageGroupIds = new Set(
            getRelatedCompetitions()
                .filter(c => !gender || c.gender === gender)
                .map(getCompetitionAgeGroupId)
                .filter(Boolean)
        );

        return ageGroups.filter(ag => ageGroupIds.has(String(ag.id)));
    }, [ageGroups, getCompetitionAgeGroupId, getRelatedCompetitions]);

    const findCompetitionForSelection = useCallback((gender, ageGroupId) => {
        if (!gender) return null;
        const relatedComps = getRelatedCompetitions().filter(c => c.gender === gender);
        const requestedAgeGroupId = ageGroupId ? String(ageGroupId) : '';

        if (requestedAgeGroupId) {
            return relatedComps.find(c => getCompetitionAgeGroupId(c) === requestedAgeGroupId) || null;
        }

        if (selectedCompId) {
            const selectedComp = relatedComps.find(c => String(c.id) === String(selectedCompId));
            if (selectedComp) return selectedComp;
        }

        return relatedComps.length === 1 ? relatedComps[0] : null;
    }, [getCompetitionAgeGroupId, getRelatedCompetitions, selectedCompId]);

    const getTeamOptionLabel = useCallback((team) => {
        const ageGroup = team?.age_group_name || 'General';
        const gender = team?.entry_gender || team?.competition_gender || team?.gender || '';
        const status = team?.status ? ` / ${team.status}` : '';
        return `${team.name} (${team.code || '-'}) - ${ageGroup}${gender ? ` / ${gender}` : ''}${status}`;
    }, []);






    // --- API Functions ---
    const fetchCompetitions = useCallback(async () => {
        try {
            const res = await api.getAllCompetitions();
            setCompetitions(res.data.filter(c => c.status?.toLowerCase() === 'open'));

            // Extract unique base names
            const bases = new Set();
            res.data.forEach(c => {
                const rawTitle = c.title || c.name || '';
                if (rawTitle) {
                    const base = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    bases.add(base);
                }
            });
            const sortedBases = Array.from(bases).sort();
            setUniqueBaseNames(sortedBases);

            if (sortedBases.length > 0) {
                setSelectedBaseName(sortedBases[0]);
            }
        } catch (err) {
            console.error("Error fetching competitions:", err);
        }
    }, []);

    // Effect: Update available genders when base name changes
    useEffect(() => {
        if (selectedBaseName && competitions.length > 0) {
            const relatedComps = competitions.filter(c => {
                const rawTitle = c.title || c.name || '';
                const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                return cBase === selectedBaseName;
            });

            const genders = [...new Set(relatedComps.map(c => c.gender))].filter(Boolean).sort();

            const timeout = setTimeout(() => {
                setAvailableGenders(genders);

                // Default select 'All' if current selection is invalid
                if (filterGender !== 'All' && !genders.includes(filterGender)) {
                    setFilterGender('All');
                }
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [selectedBaseName, competitions, filterGender]);

    // Effect: Update selectedCompId based on base name + gender
    useEffect(() => {
        if (selectedBaseName && filterGender) {
            const targetComp = competitions.find(c => {
                const rawTitle = c.title || c.name || '';
                const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                if (cBase !== selectedBaseName || c.gender !== filterGender) return false;
                if (filterAgeGroup !== 'All' && getCompetitionAgeGroupId(c) !== String(filterAgeGroup)) return false;
                return true;
            });

            if (targetComp) {
                setSelectedCompId(targetComp.id);
            } else {
                setSelectedCompId('');
            }
        } else {
            setSelectedCompId('');
        }
    }, [selectedBaseName, filterGender, filterAgeGroup, competitions, getCompetitionAgeGroupId]);

    const fetchStadiums = useCallback(async () => {
        try {
            const res = await api.getStadiums();
            setStadiums(res.data);
        } catch (err) {
            console.error("Error fetching stadiums:", err);
        }
    }, []);

    const fetchAgeGroups = useCallback(async () => {
        try {
            const res = await api.getAllAgeGroups(); // เรียกใช้ API ที่มีอยู่แล้วใน api.js
            setAgeGroups(res.data);
        } catch (err) {
            console.error("Error fetching age groups:", err);
        }
    }, []);

    const fetchMatchData = useCallback(async () => {
        if (!selectedBaseName) return;

        setLoading(true);
        setMatches([]);
        setRegisteredTeams([]);

        try {
            // 1. หา Competition IDs ที่เกี่ยวข้องตาม Filter
            let targetComps = competitions.filter(c => {
                const rawTitle = c.title || c.name || '';
                const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                if (cBase !== selectedBaseName) return false;
                if (filterGender !== 'All' && c.gender !== filterGender) return false;
                if (filterAgeGroup !== 'All' && getCompetitionAgeGroupId(c) !== String(filterAgeGroup)) return false;
                return true;
            });

            if (targetComps.length === 0) {
                setLoading(false);
                return;
            }

            // 2. ดึง Matches และ Teams จากทุก Comp ที่หาได้
            const matchPromises = targetComps.map(c => api.getMatchesByCompetition(c.id));
            const teamPromises = targetComps.map(c => api.getTeamsByCompetition(c.id));

            const [matchResults, teamResults] = await Promise.all([
                Promise.all(matchPromises),
                Promise.all(teamPromises)
            ]);

            // 3. รวมข้อมูล Matches
            let allMatches = [];
            matchResults.forEach(res => { if (res.data) allMatches = [...allMatches, ...res.data]; });
            // เรียงตาม Match Number
            allMatches.sort((a, b) => (parseInt(a.match_number) || 0) - (parseInt(b.match_number) || 0));
            setMatches(allMatches);

            // 4. รวมข้อมูล Teams (ตัดตัวซ้ำ)
            let allTeams = [];
            const teamIds = new Set();
            teamResults.forEach(res => {
                if (res.data) {
                    res.data.forEach(t => {
                        if (!teamIds.has(t.id)) {
                            teamIds.add(t.id);
                            allTeams.push(t);
                        }
                    });
                }
            });
            setRegisteredTeams(allTeams);

        } catch (err) {
            console.error("Fetch matches error:", err);
            Toast.fire({ icon: 'error', title: 'Failed to load matches' });
        } finally {
            setLoading(false);
        }
    }, [selectedBaseName, filterGender, filterAgeGroup, competitions, getCompetitionAgeGroupId]);

    const fetchModalTeams = useCallback(async () => {
        if (!showModal) return;

        const targetComp = findCompetitionForSelection(matchForm.gender, matchForm.age_group_id || matchForm.category);
        if (!targetComp) {
            setModalTeams([]);
            setMatchForm(prev => ({ ...prev, competition_id: '', home_team_id: '', away_team_id: '' }));
            return;
        }

        setLoadingModalTeams(true);
        try {
            const res = await api.getTeamsByCompetition(targetComp.id, 'approved');
            const teams = res.data || [];
            const teamIds = new Set(teams.map(t => String(t.id)));

            setModalTeams(teams);
            setMatchForm(prev => ({
                ...prev,
                competition_id: targetComp.id,
                category: getCompetitionAgeGroupId(targetComp) || prev.category,
                age_group_id: getCompetitionAgeGroupId(targetComp) || prev.age_group_id,
                home_team_id: teamIds.has(String(prev.home_team_id)) ? prev.home_team_id : '',
                away_team_id: teamIds.has(String(prev.away_team_id)) ? prev.away_team_id : ''
            }));
        } catch (err) {
            console.error("Fetch modal teams error:", err);
            setModalTeams([]);
            Toast.fire({ icon: 'error', title: 'Failed to load teams for this competition' });
        } finally {
            setLoadingModalTeams(false);
        }
    }, [findCompetitionForSelection, getCompetitionAgeGroupId, matchForm.age_group_id, matchForm.category, matchForm.gender, showModal]);

    // --- 1. Load Initial Data (Competitions & Stadiums) ---
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchCompetitions();
            fetchStadiums();
            fetchAgeGroups();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchCompetitions, fetchStadiums, fetchAgeGroups]);

    // --- 2. Load Matches & Teams when BaseName or FilterGender Changes ---
    useEffect(() => {
        fetchMatchData();
    }, [fetchMatchData]);

    useEffect(() => {
        fetchModalTeams();
    }, [fetchModalTeams]);

    const pageAgeGroups = useMemo(
        () => getAgeGroupOptionsForGender(filterGender === 'All' ? '' : filterGender),
        [filterGender, getAgeGroupOptionsForGender]
    );

    useEffect(() => {
        if (filterAgeGroup === 'All') return;
        const validAgeGroupIds = new Set(pageAgeGroups.map(ag => String(ag.id)));
        if (!validAgeGroupIds.has(String(filterAgeGroup))) {
            setFilterAgeGroup('All');
        }
    }, [filterAgeGroup, pageAgeGroups]);

    // --- Handlers ---
    const handleOpenCreate = () => {
        if (!selectedBaseName) {
            return Swal.fire('Warning', 'Please select a competition first', 'warning');
        }
        // หาแมตช์ล่าสุดเพื่อ Auto Run Number
        const nextMatchNum = matches.length > 0
            ? Math.max(...matches.map(m => parseInt(m.match_number) || 0)) + 1
            : 1;

        // Default to the selected gender when the page is filtered, otherwise use the first gender in this competition.
        const defaultGender = filterGender && filterGender !== 'All'
            ? filterGender
            : (availableGenders.length > 0 ? availableGenders[0] : 'Male');
        const genderAgeGroups = getAgeGroupOptionsForGender(defaultGender);
        const defaultCategory = filterAgeGroup !== 'All' ? filterAgeGroup : (genderAgeGroups[0]?.id || '');
        const defaultCompetition = findCompetitionForSelection(defaultGender, defaultCategory);

        setModalTeams([]);
        setMatchForm({
            ...initialForm,
            competition_id: defaultCompetition?.id || '',
            category: defaultCategory || getCompetitionAgeGroupId(defaultCompetition),
            age_group_id: defaultCategory || getCompetitionAgeGroupId(defaultCompetition),
            match_number: nextMatchNum,
            gender: defaultGender,
            max_sets: 3
        });
        setIsEditing(false);
        setShowModal(true);
    };

    const handleEditMatch = (match) => {
        let onlyTime = '';
        if (match.start_time) {
            if (/^\d{1,2}:\d{2}/.test(match.start_time)) {
                onlyTime = match.start_time.substring(0, 5);
            } else {
                const localFormatted = formatForInput(match.start_time);
                if (localFormatted.includes('T')) {
                    onlyTime = localFormatted.split('T')[1].substring(0, 5);
                } else {
                    onlyTime = localFormatted.substring(0, 5);
                }
            }
        }

        let onlyDate = '';
        if (match.match_date) {
            onlyDate = String(match.match_date).substring(0, 10);
        } else if (match.start_time && !/^\d{1,2}:\d{2}/.test(match.start_time)) {
            const localFormatted = formatForInput(match.start_time);
            if (localFormatted.includes('T')) {
                onlyDate = localFormatted.split('T')[0];
            }
        }

        const matchCompetition = competitions.find(c => String(c.id) === String(match.competition_id));

        setMatchForm({
            id: match.id,
            competition_id: match.competition_id || '',
            home_team_id: match.home_team_id || '',
            away_team_id: match.away_team_id || '',
            start_time: onlyTime,
            location: match.location || '',
            city: match.city || '',
            match_date: onlyDate,
            category: match.category || getCompetitionAgeGroupId(matchCompetition),
            age_group_id: match.age_group_id || match.category || getCompetitionAgeGroupId(matchCompetition),
            match_number: match.match_number,
            round_name: match.round_name || '',
            pool_name: match.pool_name || '',
            gender: match.gender || matchCompetition?.gender || 'Male',
            max_sets: match.max_sets || 3
        });
        setModalTeams([]);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!matchForm.home_team_id || !matchForm.away_team_id) {
            return Toast.fire({ icon: 'warning', title: 'Please select both teams' });
        }
        const selectedAgeGroupId = matchForm.age_group_id || matchForm.category;

        if (!selectedAgeGroupId) {
            return Toast.fire({ icon: 'warning', title: 'Please select an age group' });
        }
        const selectedRoundName = normalizeRoundName(matchForm.round_name);

        if (!selectedRoundName) {
            return Toast.fire({ icon: 'warning', title: 'Please select a round' });
        }
        if (matchForm.home_team_id === matchForm.away_team_id) {
            return Toast.fire({ icon: 'warning', title: 'Teams must be different' });
        }

        const modalTeamIds = new Set(modalTeams.map(t => String(t.id)));
        if (!modalTeamIds.has(String(matchForm.home_team_id)) || !modalTeamIds.has(String(matchForm.away_team_id))) {
            return Toast.fire({ icon: 'warning', title: 'Please select teams registered in this competition category' });
        }

        // หา Competition ID ที่ถูกต้อง (กรณีเลือก All ต้องหาจาก Gender ในฟอร์ม)
        const foundComp = findCompetitionForSelection(matchForm.gender, selectedAgeGroupId);
        const targetCompId = foundComp?.id || matchForm.competition_id || selectedCompId;
        if (!targetCompId) {
            return Toast.fire({ icon: 'error', title: `No competition found for gender: ${matchForm.gender}` });
        }
        let combinedStartTime = null;
        if (matchForm.match_date && matchForm.start_time) {
            combinedStartTime = `${matchForm.match_date}T${matchForm.start_time}`;
        } else if (matchForm.start_time) {
            combinedStartTime = matchForm.start_time;
        }

        const payload = {
            ...matchForm,
            competition_id: targetCompId,
            age_group_id: selectedAgeGroupId,
            category: selectedAgeGroupId,
            round_name: selectedRoundName,
            start_time: combinedStartTime
        };

        delete payload.max_sets;

        try {
            if (isEditing) {
                await api.updateMatch(matchForm.id, payload);
                Toast.fire({ icon: 'success', title: 'Match updated' });
            } else {
                await api.createMatch(payload);
                Toast.fire({ icon: 'success', title: 'Match created' });
            }
            setShowModal(false);
            fetchMatchData(); // Refresh Data
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: 'Failed to save match' });
        }
    };

    const handleDeleteMatch = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Match?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await api.deleteMatch(id);
                setMatches(prev => prev.filter(m => m.id !== id));
                Toast.fire({ icon: 'success', title: 'Deleted successfully' });
            } catch {
                Toast.fire({ icon: 'error', title: 'Delete failed' });
            }
        }
    };

    const openScoreModal = (match) => {
        const maxSets = match?.max_sets || 5;

        let currentScores = Array.from({ length: maxSets }, () => "");
        if (match.set_scores) {
            // set_scores from DB might be a JSON string
            const parsed = typeof match.set_scores === 'string' ? JSON.parse(match.set_scores) : match.set_scores;
            if (Array.isArray(parsed)) {
                parsed.forEach((val, idx) => {
                    if (idx < maxSets) currentScores[idx] = val;
                });
            }
        }

        setScoreForm({
            home_set_score: match.home_set_score || 0,
            away_set_score: match.away_set_score || 0,
            set_scores: currentScores,
        });
        setScoringMatch(match);
    };






    const handleSaveScore = async () => {
        if (!scoringMatch) return;

        const maxSets = scoringMatch?.max_sets || 5;
        const setsToWin = Math.ceil(maxSets / 2);

        const validSets = scoreForm.set_scores.filter(s => s && s.trim() !== "");

        let homeSetsWon = 0;
        let awaySetsWon = 0;
        validSets.forEach(s => {
            const [h, a] = s.split('-').map(v => parseInt(v, 10));
            if (!isNaN(h) && !isNaN(a)) {
                if (h > a) homeSetsWon++;
                else if (a > h) awaySetsWon++;
            }
        });

        const isCompleted = homeSetsWon >= setsToWin || awaySetsWon >= setsToWin;

        const payload = {
            home_set_score: homeSetsWon,
            away_set_score: awaySetsWon,
            set_scores: JSON.stringify(validSets), // ส่งเฉพาะเซตที่กรอก (แปลงเป็น String เพื่อความชัวร์)
            status: isCompleted ? 'completed' : 'scheduled',
        };

        try {
            await client.put(`/matches/${scoringMatch.id}/result`, payload);
            Toast.fire({ icon: 'success', title: 'Score saved!' });
            setScoringMatch(null);
            fetchMatchData(); // Refresh list
        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.error || 'Failed to save score';
            Toast.fire({ icon: 'error', title: errorMsg });
        }
    };

    const modalAgeGroups = getAgeGroupOptionsForGender(matchForm.gender);
    const modalLabelClass = "block text-xs font-medium text-gray-600";
    const modalInputClass = "w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400";
    const modalSectionClass = "rounded-lg border border-gray-200 bg-white p-4";

    // --- Render ---
    return (
        <div className="p-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-800">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 shadow-sm">
                        <Swords className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Match Management
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">Organize and manage volleyball matches</p>
                    </div>
                </div>

                {/* Competition Selector Group */}
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1 justify-end">
                    <div className="w-full md:w-64">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Competition</label>
                        <select
                            value={selectedBaseName}
                            onChange={(e) => setSelectedBaseName(e.target.value)}
                            className="w-full p-2.5 text-sm font-medium rounded-lg border border-gray-200 transition-all hover:border-blue-400 focus:outline-none focus:border-blue-500 bg-white shadow-sm text-gray-700"
                        >
                            {uniqueBaseNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gender</label>
                        <div className="flex rounded-lg p-1 border border-gray-200 bg-gray-50 shadow-sm">
                            <button
                                onClick={() => setFilterGender('All')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterGender === 'All' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                            >
                                All
                            </button>
                            {availableGenders.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setFilterGender(g)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterGender === g ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full md:w-48">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Age Group</label>
                        <select
                            value={filterAgeGroup}
                            onChange={(e) => setFilterAgeGroup(e.target.value)}
                            className="w-full p-2.5 text-sm font-medium rounded-lg border border-gray-200 transition-all hover:border-blue-400 focus:outline-none focus:border-blue-500 bg-white shadow-sm text-gray-700"
                        >
                            <option value="All">All</option>
                            {pageAgeGroups.map(ag => (
                                <option key={ag.id} value={ag.id}>{ag.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Create Button */}
                <div className="flex items-end">
                    <button
                        onClick={handleOpenCreate}
                        disabled={!selectedBaseName}
                        className={`px-5 py-2.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-all shadow-sm border border-transparent ${selectedBaseName
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                            }`}
                    >
                        <PlusCircle size={18} /> Add Match
                    </button>
                </div>
            </div>

            {/* Match List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-lg">Loading matches...</span>
                </div>
            ) : matches.length === 0 ? (
                <div className="text-center py-16 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-4 left-4 w-16 h-16 bg-blue-600 rounded-full"></div>
                        <div className="absolute bottom-4 right-4 w-12 h-12 bg-purple-500 rounded-full"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-pink-500 rounded-full"></div>
                    </div>
                    <div className="relative z-10">
                        <Trophy className="mx-auto mb-4 text-gray-400" size={64} />
                        <h3 className="text-xl font-bold mb-2">No matches found</h3>
                        <p className="text-gray-500">
                            {selectedBaseName ? "Create your first match to get started!" : "Please select a competition to view matches."}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200">
                                    <th className="px-6 py-4">#</th>
                                    <th className="px-6 py-4">Round / Pool</th>
                                    <th className="px-6 py-4">Teams</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4">Schedule</th>
                                    <th className="px-6 py-4">Venue</th>
                                    <th className="px-6 py-4">Gender</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {matches.map((match) => (
                                    <tr key={match.id} className="group transition-colors hover:bg-blue-50/30">
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-blue-600">
                                                {match.match_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-sm text-gray-900 leading-snug">
                                                {match.round_name}
                                            </div>
                                            {match.pool_name && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] font-bold text-gray-500 uppercase">
                                                        Pool {match.pool_name}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2 min-w-[180px]">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm shrink-0">
                                                        {registeredTeams.find(t => t.id == match.home_team_id)?.logo_url ? (
                                                            <img src={registeredTeams.find(t => t.id == match.home_team_id).logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                                                        ) : <Shield size={12} className="text-gray-300" />}
                                                    </div>
                                                    <span className={`text-[13px] font-bold truncate ${match.home_set_score > match.away_set_score && match.status === 'completed' ? 'text-blue-600' : 'text-gray-700'}`}>
                                                        {registeredTeams.find(t => t.id == match.home_team_id)?.name || match.home_team || 'TBD'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm shrink-0">
                                                        {registeredTeams.find(t => t.id == match.away_team_id)?.logo_url ? (
                                                            <img src={registeredTeams.find(t => t.id == match.away_team_id).logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                                                        ) : <Shield size={12} className="text-gray-300" />}
                                                    </div>
                                                    <span className={`text-[13px] font-bold truncate ${match.away_set_score > match.home_set_score && match.status === 'completed' ? 'text-blue-600' : 'text-gray-700'}`}>
                                                        {registeredTeams.find(t => t.id == match.away_team_id)?.name || match.away_team || 'TBD'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(match.status === 'completed' || match.home_set_score > 0 || match.away_set_score > 0) ? (
                                                <div className="flex flex-col items-center">
                                                    <div className="px-3 py-1 rounded border border-gray-200 font-mono text-base font-semibold tracking-widest shadow-sm bg-white text-gray-800">
                                                        {match.home_set_score} - {match.away_set_score}
                                                    </div>
                                                    {match.set_scores && (
                                                        <div className="text-[10px] text-gray-500 mt-1.5 font-medium whitespace-nowrap">
                                                            {typeof match.set_scores === 'string' ? JSON.parse(match.set_scores).join(', ') : Array.isArray(match.set_scores) ? match.set_scores.join(', ') : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-tighter">vs</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                                    <Calendar size={14} className="text-blue-600" />
                                                    {match.match_date ? formatThaiDate(match.match_date) : (match.start_time && match.start_time.includes('T') ? formatThaiDate(match.start_time) : 'TBD')}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                                                    <Clock size={14} className="text-indigo-400" />
                                                    {match.start_time ? (match.start_time.includes('T') ? formatThaiTime(match.start_time) : match.start_time.substring(0, 5)) : 'TBD'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-medium text-gray-600 max-w-[150px]">
                                                <MapPin size={14} className="text-rose-500 shrink-0" />
                                                <span className="truncate">{match.location || 'TBD'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-start gap-1.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest border-2 ${match.gender === 'Female'
                                                        ? 'bg-pink-50 text-pink-600 border-pink-100'
                                                        : match.gender === 'Mix'
                                                            ? 'bg-purple-50 text-purple-600 border-purple-100'
                                                            : 'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                    {match.gender || 'Male'}
                                                </span>
                                                {match.status === 'completed' && (
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                        Completed
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => handleEditMatch(match)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => openScoreModal(match)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all" title="Score">
                                                    <Trophy size={16} />
                                                </button>
                                                <button onClick={() => window.open('/roster-verification/' + match.id, '_blank')} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Print Roster Verification">
                                                    <Users size={16} />
                                                </button>
                                                <button onClick={() => window.open('/scoresheet/' + match.id, '_blank')} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="View & Print Scoresheet">
                                                    <Printer size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteMatch(match.id)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- Create/Edit Modal --- */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
                    <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                        <div className="px-5 py-4 border-b border-gray-200 bg-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{isEditing ? 'Edit Match' : 'Create New Match'}</h3>
                                    <p className="mt-0.5 text-xs text-gray-500">{selectedBaseName || 'Competition'} / {matchForm.gender || 'Gender'} / {modalAgeGroups.find(ag => String(ag.id) === String(matchForm.age_group_id || matchForm.category))?.name || 'Age group'}</p>
                                </div>
                                <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" aria-label="Close">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-73px)] overflow-y-auto bg-gray-50 p-5 space-y-4">
                            {/* Row 1: Key Info */}
                            <div className={`${modalSectionClass} grid grid-cols-1 md:grid-cols-4 gap-4`}>
                                <div className="space-y-2">
                                    <label className={modalLabelClass}>
                                        Age Group
                                    </label>
                                    <select
                                        value={matchForm.age_group_id || matchForm.category || ''}
                                        onChange={e => setMatchForm({
                                            ...matchForm,
                                            category: e.target.value,
                                            age_group_id: e.target.value,
                                            competition_id: '',
                                            home_team_id: '',
                                            away_team_id: ''
                                        })}
                                        className={modalInputClass}
                                    >
                                        <option value="">-- Select Category --</option>
                                        {modalAgeGroups.map(ag => (
                                            <option key={ag.id} value={ag.id}>{ag.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className={modalLabelClass}>
                                        City
                                    </label>
                                    <input
                                        value={matchForm.city || ''}
                                        onChange={e => setMatchForm({ ...matchForm, city: e.target.value })}
                                        placeholder="City Name"
                                        className={modalInputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={modalLabelClass}>
                                        Match Date
                                    </label>
                                    <input
                                        type="date"
                                        value={matchForm.match_date || ''}
                                        onChange={e => setMatchForm({ ...matchForm, match_date: e.target.value })}
                                        className={modalInputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={modalLabelClass}>
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={matchForm.start_time || ''}
                                        onChange={e => setMatchForm({ ...matchForm, start_time: e.target.value })}
                                        className={modalInputClass}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Match Details */}
                            <div className={`${modalSectionClass} grid grid-cols-1 md:grid-cols-3 gap-4`}>
                                <div className="space-y-2">
                                    <label className={modalLabelClass}>
                                        Stadium
                                    </label>
                                    <select
                                        value={matchForm.location}
                                        onChange={e => setMatchForm({ ...matchForm, location: e.target.value })}
                                        className={modalInputClass}
                                    >
                                        <option value="">-- Select Stadium --</option>
                                        {stadiums.map(s => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className={modalLabelClass}>
                                            Match No.
                                        </label>
                                        <input
                                            type="number"
                                            value={matchForm.match_number}
                                            onChange={e => setMatchForm({ ...matchForm, match_number: e.target.value })}
                                            className={modalInputClass}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={modalLabelClass}>
                                            Gender
                                        </label>
                                        <select
                                            value={matchForm.gender}
                                            onChange={e => setMatchForm({
                                                ...matchForm,
                                                gender: e.target.value,
                                                category: '',
                                                age_group_id: '',
                                                competition_id: '',
                                                home_team_id: '',
                                                away_team_id: ''
                                            })}
                                            className={modalInputClass}
                                        >
                                            {availableGenders.length > 0 ? availableGenders.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            )) : (
                                                <>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Mix">Mix</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className={modalLabelClass}>
                                            Round
                                        </label>
                                        <select
                                            value={matchForm.round_name}
                                            onChange={e => setMatchForm({ ...matchForm, round_name: e.target.value })}
                                            className={modalInputClass}
                                            required
                                        >
                                            
                                            <option value="">-- Select Round --</option>
                                            <option value="จัดอันดับ">จัดอันดับ</option>
                                            <option value="Preliminary">Preliminary</option>
                                            <option value="Round 2">Round 2</option>
                                            <option value="Quarter Final">Quarter Final</option>
                                            <option value="Semi Final">Semi Final</option>
                                            <option value="Final">Final</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={modalLabelClass}>
                                            Pool
                                        </label>
                                        <input
                                            value={matchForm.pool_name}
                                            onChange={e => setMatchForm({ ...matchForm, pool_name: e.target.value })}
                                            placeholder="e.g. A"
                                            className={modalInputClass}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Row 2: Teams */}
                            <div className={modalSectionClass}>
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-semibold text-gray-900">Teams</h4>
                                    <span className="text-xs text-gray-500">{modalTeams.length} registered</span>
                                </div>
                                {!loadingModalTeams && modalTeams.length < 2 && (
                                    <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                        Need at least 2 registered teams in this age group and gender before creating a match.
                                    </p>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className={modalLabelClass}>
                                            Home Team
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center">
                                                {modalTeams.find(t => t.id == matchForm.home_team_id)?.logo_url ? (
                                                    <img src={modalTeams.find(t => t.id == matchForm.home_team_id).logo_url} alt="" className="h-full w-full object-contain p-1" />
                                                ) : <Shield size={18} className="text-gray-400" />}
                                            </div>
                                            <select
                                                value={matchForm.home_team_id}
                                                onChange={e => setMatchForm({ ...matchForm, home_team_id: e.target.value })}
                                                disabled={loadingModalTeams || modalTeams.length === 0}
                                                className={`${modalInputClass} flex-1`}
                                            >
                                                <option value="">
                                                    {loadingModalTeams ? 'Loading teams...' : '-- Select Home Team --'}
                                                </option>
                                                {modalTeams
                                                    .filter(t => String(t.id) !== String(matchForm.away_team_id))
                                                    .map(t => (
                                                    <option key={t.team_entry_id || t.id} value={t.id}>{getTeamOptionLabel(t)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className={modalLabelClass}>
                                            Away Team
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center">
                                                {modalTeams.find(t => t.id == matchForm.away_team_id)?.logo_url ? (
                                                    <img src={modalTeams.find(t => t.id == matchForm.away_team_id).logo_url} alt="" className="h-full w-full object-contain p-1" />
                                                ) : <Shield size={18} className="text-gray-400" />}
                                            </div>
                                            <select
                                                value={matchForm.away_team_id}
                                                onChange={e => setMatchForm({ ...matchForm, away_team_id: e.target.value })}
                                                disabled={loadingModalTeams || modalTeams.length === 0}
                                                className={`${modalInputClass} flex-1`}
                                            >
                                                <option value="">
                                                    {loadingModalTeams ? 'Loading teams...' : '-- Select Away Team --'}
                                                </option>
                                                {modalTeams
                                                    .filter(t => String(t.id) !== String(matchForm.home_team_id))
                                                    .map(t => (
                                                    <option key={t.team_entry_id || t.id} value={t.id}>{getTeamOptionLabel(t)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>



                            {/* Footer Buttons */}
                            <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingModalTeams || modalTeams.length < 2}
                                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                    <Save size={16} />
                                    {isEditing ? 'Update Match' : 'Create Match'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Score Modal --- */}
            {scoringMatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm backdrop-blur-md p-4">
                    <div className="w-full max-w-lg rounded-3xl shadow-2xl border bg-white border-gray-200">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-green-50 border border-green-100">
                                        <Trophy className="text-green-600" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 tracking-tight">Update Match Score</h3>
                                    </div>
                                </div>
                                <button onClick={() => setScoringMatch(null)} className="p-2 hover:bg-gray-200 rounded-md text-gray-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="text-center bg-gray-50 border border-gray-100 p-4 rounded-lg">
                                <p className="text-sm text-blue-600 font-semibold mb-2">Match #{scoringMatch.match_number}</p>
                                <h4 className="font-bold text-lg text-gray-900 flex items-center justify-center gap-2">
                                    <span className="text-blue-600">{registeredTeams.find(t => t.id == scoringMatch.home_team_id)?.name}</span>
                                    <span className="text-gray-400 font-medium">vs</span>
                                    <span className="text-rose-600">{registeredTeams.find(t => t.id == scoringMatch.away_team_id)?.name}</span>
                                </h4>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold uppercase mb-4 text-gray-700">
                                    <Trophy size={16} className="text-green-500" /> Set Scores (Points)
                                </label>
                                <div className={`grid grid-cols-5 gap-3`}>
                                    {scoreForm.set_scores.map((val, idx) => (
                                        <div key={idx} className="text-center">
                                            <input
                                                type="text"
                                                placeholder={`Set ${idx + 1}`}
                                                value={val}
                                                onChange={(e) => {
                                                    const newScores = [...scoreForm.set_scores];
                                                    newScores[idx] = e.target.value;
                                                    setScoreForm({ ...scoreForm, set_scores: newScores });
                                                }}
                                                className="w-full p-3 text-center border-2 rounded-md focus:ring-2 focus:ring-green-500 outline-none transition-all font-mono text-lg bg-white border-gray-300"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Set {idx + 1}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-center mt-4 text-gray-500 bg-gray-50 p-2 rounded-lg">Format: "25-20" (home-away)</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setScoringMatch(null)} className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all font-medium text-sm">
                                    Cancel
                                </button>
                                <button onClick={handleSaveScore} className="px-6 py-2.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all flex items-center gap-2">
                                    <Save size={18} />
                                    Update Score
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
