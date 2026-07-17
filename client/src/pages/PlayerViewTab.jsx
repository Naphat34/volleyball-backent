import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { Users, Shield, User, Eye, X, CheckCircle, Briefcase } from 'lucide-react';
import { Toast, EmptyState, DetailItem, Input, Button } from './AdminShared';
import Swal from 'sweetalert2';
import { formatThaiDate } from '../utils';

export default function PlayerViewTab() {
    const [competitions, setCompetitions] = useState([]);
    const [registeredTeams, setRegisteredTeams] = useState([]);
    const [teamPlayers, setTeamPlayers] = useState([]);
    const [teamStaff, setTeamStaff] = useState([]);

    // New states for filtering
    const [uniqueBaseNames, setUniqueBaseNames] = useState([]);
    const [selectedBaseName, setSelectedBaseName] = useState('');
    const [filterGender, setFilterGender] = useState('All');
    const [filterAgeGroup, setFilterAgeGroup] = useState('All');
    const [availableGenders, setAvailableGenders] = useState([]);

    const [selectedTeamKey, setSelectedTeamKey] = useState('');
    const [viewingPlayer, setViewingPlayer] = useState(null);

    const getCompetitionBaseName = useCallback((competition) => {
        const rawTitle = competition?.title || competition?.name || '';
        return rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
    }, []);

    const getCompetitionAgeGroupId = useCallback((competition) => (
        competition?.age_group_id !== undefined && competition?.age_group_id !== null
            ? String(competition.age_group_id)
            : ''
    ), []);

    const getTeamSelectionKey = useCallback((team) => (
        `${team.id}__${team.team_entry_id || team.competition_id || team.entry_age_group_id || team.entry_gender || 'team'}`
    ), []);

    const getTeamOptionLabel = useCallback((team) => {
        const ageGroup = team?.age_group_name || 'General';
        const gender = team?.entry_gender || team?.competition_gender || team?.gender || '';
        return `${team.name} (${team.code || '-'}) - ${ageGroup}${gender ? ` / ${gender}` : ''}`;
    }, []);

    const selectedTeam = useMemo(
        () => registeredTeams.find(team => getTeamSelectionKey(team) === selectedTeamKey) || null,
        [getTeamSelectionKey, registeredTeams, selectedTeamKey]
    );

    const availableAgeGroups = useMemo(() => {
        const groups = new Map();
        competitions.forEach((competition) => {
            if (getCompetitionBaseName(competition) !== selectedBaseName) return;
            if (filterGender !== 'All' && competition.gender !== filterGender) return;
            const id = getCompetitionAgeGroupId(competition);
            if (!id) return;
            groups.set(id, {
                id,
                name: competition.age_group_name || competition.age_group || `Age Group ${id}`,
            });
        });
        return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    }, [competitions, filterGender, getCompetitionAgeGroupId, getCompetitionBaseName, selectedBaseName]);



    // Initial Load
    useEffect(() => {
        const fetchComp = async () => {
            try {
                const res = await api.getAllCompetitions();
                setCompetitions(res.data.filter(c => c.status?.toLowerCase() === 'open'));

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
        };
        fetchComp();
    }, []);

    // Update available genders when base name changes
    useEffect(() => {
        if (selectedBaseName && competitions.length > 0) {
            const relatedComps = competitions.filter(c => {
                const rawTitle = c.title || c.name || '';
                const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                return cBase === selectedBaseName;
            });

            const allGenders = relatedComps.flatMap(c => c.gender ? c.gender.split(',') : []);
            const uniqueGenders = [...new Set(allGenders)].filter(Boolean).sort();

            const timeout = setTimeout(() => {
                setAvailableGenders(uniqueGenders);

                if (uniqueGenders.length > 0 && !uniqueGenders.includes(filterGender) && filterGender !== 'All') {
                    setFilterGender('All');
                }
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [selectedBaseName, competitions, filterGender]);

    useEffect(() => {
        if (filterAgeGroup === 'All') return;
        const validAgeGroupIds = new Set(availableAgeGroups.map(ag => String(ag.id)));
        if (!validAgeGroupIds.has(String(filterAgeGroup))) {
            setFilterAgeGroup('All');
        }
    }, [availableAgeGroups, filterAgeGroup]);

    // Load Teams when Competition or Gender filter changes
    useEffect(() => {
        const fetchTeams = async () => {
            if (!selectedBaseName) return;

            setRegisteredTeams([]);
            setSelectedTeamKey('');

            try {
                const targetComps = competitions.filter(c => {
                    if (getCompetitionBaseName(c) !== selectedBaseName) return false;
                    if (filterGender === 'All') return true;
                    return c.gender === filterGender;
                }).filter(c => {
                    if (filterAgeGroup === 'All') return true;
                    return getCompetitionAgeGroupId(c) === String(filterAgeGroup);
                });

                if (targetComps.length === 0) return;

                const teamPromises = targetComps.map(c => api.getTeamsByCompetition(c.id));
                const teamResults = await Promise.all(teamPromises);

                const allTeams = new Map();
                teamResults.forEach(res => {
                    if (res.data) {
                        res.data.forEach(team => {
                            const key = getTeamSelectionKey(team);
                            if (!allTeams.has(key)) {
                                allTeams.set(key, team);
                            }
                        });
                    }
                });

                setRegisteredTeams(Array.from(allTeams.values()));

            } catch (err) {
                console.error("Error fetching teams:", err);
            }
        };

        const timeout = setTimeout(() => {
            fetchTeams();
        }, 0);
        return () => clearTimeout(timeout);
    }, [selectedBaseName, filterGender, filterAgeGroup, competitions, getCompetitionAgeGroupId, getCompetitionBaseName, getTeamSelectionKey]);

    const fetchTeamData = useCallback(async (teamId) => {
        try {
            const [resPlayers, resStaff] = await Promise.all([
                api.getPlayersByTeam(teamId),
                api.getStaffByTeam(teamId)
            ]);
            setTeamPlayers(resPlayers.data);
            setTeamStaff(resStaff.data);
        } catch (err) {
            console.error("Fetch Team Data Error:", err);
            Toast.fire({ icon: 'error', title: 'Could not load team data' });
        }
    }, []);

    // Load Players when Team Changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (selectedTeam?.id) {
                fetchTeamData(selectedTeam.id);
            } else {
                setTeamPlayers([]);
                setTeamStaff([]);
            }
        }, 0);
        return () => clearTimeout(timeout);
    }, [selectedTeam, fetchTeamData]);



    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="p-6 rounded-xl shadow-sm border bg-white border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Competition Dropdown */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Competition</label>
                        <select
                            value={selectedBaseName}
                            onChange={(e) => setSelectedBaseName(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 hover:border-blue-400 outline-none bg-white border-gray-200 text-sm font-medium text-gray-700 transition-all shadow-sm"
                        >
                            <option value="">-- Choose Competition --</option>
                            {uniqueBaseNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>

                    {/* Gender Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gender</label>
                        <div className="flex bg-gray-50 border border-gray-200 shadow-sm rounded-lg p-1 h-[42px] items-center">
                            <button
                                onClick={() => setFilterGender('All')}
                                className={`px-4 py-1 text-sm font-medium rounded-md transition-all w-full ${filterGender === 'All' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                            >
                                All
                            </button>
                            {availableGenders.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setFilterGender(g)}
                                    className={`px-4 py-1 text-sm font-medium rounded-md transition-all w-full ${filterGender === g ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Age Group</label>
                        <select
                            value={filterAgeGroup}
                            onChange={(e) => setFilterAgeGroup(e.target.value)}
                            disabled={!selectedBaseName || availableAgeGroups.length === 0}
                            className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 hover:border-blue-400 outline-none bg-white border-gray-200 text-sm font-medium text-gray-700 transition-all shadow-sm"
                        >
                            <option value="All">All</option>
                            {availableAgeGroups.map(ag => (
                                <option key={ag.id} value={ag.id}>{ag.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Team Dropdown */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Team</label>
                        <select
                            value={selectedTeamKey}
                            onChange={(e) => setSelectedTeamKey(e.target.value)}
                            disabled={!selectedBaseName || registeredTeams.length === 0}
                            className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 hover:border-blue-400 outline-none bg-white border-gray-200 text-sm font-medium text-gray-700 transition-all shadow-sm"
                        >
                            <option value="">-- Choose Team --</option>
                            {registeredTeams.map(t => (
                                <option key={getTeamSelectionKey(t)} value={getTeamSelectionKey(t)}>
                                    {getTeamOptionLabel(t)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Player List */}
            <div className="rounded-xl shadow-sm border overflow-hidden mb-6 bg-white border-gray-200">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/80 backdrop-blur-sm border-gray-100">
                    <h3 className="font-semibold text-gray-900 tracking-tight flex items-center gap-2"><Users size={18} className="text-gray-400" /> Player List</h3>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-indigo-700 border border-blue-100">{teamPlayers.length} Players</span>
                </div>

                {!selectedTeam ? (
                    <EmptyState text="Please select a team to view roster." />
                ) : teamPlayers.length === 0 ? (
                    <EmptyState text="No players found in this team." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/80 backdrop-blur-sm text-gray-500">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider">No.</th>
                                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider">Position</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {teamPlayers.map(p => (
                                    <tr key={p.id} className="transition hover:bg-gray-50">
                                        <td className="px-6 py-4 font-mono font-medium text-gray-900 text-lg">{p.number}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                                                    {p.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-400" />}
                                                </div>
                                                <div className="font-medium text-gray-900">
                                                    {p.first_name} {p.last_name}
                                                    {p.is_captain && <span className="ml-2 text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full font-bold" title="Captain">C</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-100">{p.position}</span></td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setViewingPlayer(p)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                {/* <button onClick={() => handleEditPlayer(p)} className="p-2 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-lg transition" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeletePlayer(p.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition" title="Delete">
                                                    <Trash2 size={16} />
                                                </button> */}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Staff List */}
            {selectedTeam && (
                <div className="rounded-xl shadow-sm border overflow-hidden bg-white border-gray-200">
                    <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/80 backdrop-blur-sm border-gray-100">
                        <h3 className="font-semibold text-gray-900 tracking-tight flex items-center gap-2"><Briefcase size={18} className="text-gray-400" /> Staff List</h3>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-indigo-700 border border-blue-100">{teamStaff.length} Staff</span>
                    </div>

                    {teamStaff.length === 0 ? (
                        <EmptyState text="No staff members found in this team." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/80 backdrop-blur-sm text-gray-500">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider">Role</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {teamStaff.map(s => (
                                        <tr key={s.id} className="transition hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{s.first_name} {s.last_name}</td>
                                            <td className="px-6 py-4"><span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-100">{s.role}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal: View Player */}
            {viewingPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-white text-gray-900">

                        {/* Header Background with Profile Image */}
                        <div className="relative h-32 bg-gray-100 border-b border-gray-200">
                            <button
                                onClick={() => setViewingPlayer(null)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 hover:bg-gray-200 p-2 rounded-full transition z-10"
                            >
                                <X size={20} />
                            </button>
                            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
                                <div className="w-32 h-32 rounded-full border-4 shadow-xl overflow-hidden flex items-center justify-center border-white bg-gray-50">
                                    {viewingPlayer.photo ? (
                                        <img src={viewingPlayer.photo} alt="Player" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={64} className="text-gray-400" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="pt-20 pb-8 px-8 flex flex-col items-center">

                            {/* Name & Team */}
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-semibold tracking-tight mb-1">
                                    {viewingPlayer.first_name} {viewingPlayer.last_name}
                                </h2>
                                <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500">
                                    <Shield size={14} className="text-blue-600" />
                                    <span>{selectedTeam.name || 'Unknown Team'}</span>
                                </div>
                            </div>

                            {/* Badges (Captain / Position) */}
                            <div className="flex gap-3 mb-8">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-indigo-700 border border-blue-200 uppercase tracking-wider">
                                    {viewingPlayer.position || 'N/A'}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 font-mono">
                                    #{viewingPlayer.number}
                                </span>
                                {viewingPlayer.is_captain && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1">
                                        <CheckCircle size={12} /> Captain
                                    </span>
                                )}
                            </div>

                            {/* Stats Grid */}
                            <div className="w-full grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border text-center bg-gray-50/50 border-gray-100">
                                    <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Height</div>
                                    <div className="text-xl font-semibold text-gray-900">
                                        {viewingPlayer.height_cm ? `${viewingPlayer.height_cm}` : '-'} <span className="text-sm text-gray-400 font-medium">cm</span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border text-center bg-gray-50/50 border-gray-100">
                                    <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Weight</div>
                                    <div className="text-xl font-semibold text-gray-900">
                                        {viewingPlayer.weight ? `${viewingPlayer.weight}` : '-'} <span className="text-sm text-gray-400 font-medium">kg</span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border text-center col-span-2 bg-gray-50/50 border-gray-100">
                                    <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Date of Birth</div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {viewingPlayer.birth_date ? formatThaiDate(viewingPlayer.birth_date) : '-'}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
