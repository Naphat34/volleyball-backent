import React, { useEffect, useState } from 'react';
import client, { api } from '../api';
import { Trophy, Calendar, MapPin, Edit2, Trash2, PlusCircle, X,  Users, Shield, Download, Upload, Image as ImageIcon, Layers } from 'lucide-react';
import { Toast, Input, Button, EmptyState } from './AdminShared';
import Swal from 'sweetalert2';
import { cleanCompetitionTitle, formatThaiDate } from '../utils';
import MatchesManager from './MatchesManager';

const genderOrder = { Male: 1, Female: 2, Mixed: 3 };
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const SPORT_TYPE_OPTIONS = [
    { value: 'indoor', label: 'Indoor Volleyball', sport: 'Volleyball', max_sets: 3, max_players: 14 }
];
const ATHLETE_SPORT_POLICY_OPTIONS = [
    { value: 'single_sport', label: 'One sport only' }
];
const DEFAULT_COMP_FORM = {
    name: '', start_date: '', end_date: '', location: '', stadium_id: '',
    sport: 'Volleyball', sport_type: 'indoor', gender: '', age_group: '',
    athlete_sport_policy: 'single_sport', status: 'open', max_sets: 3, max_players: 14, logo_url: ''
};

const getSportTypeMeta = (sportType) => (
    SPORT_TYPE_OPTIONS.find(option => option.value === sportType) || SPORT_TYPE_OPTIONS[0]
);

const applySportTypeDefaults = (form, sportType) => {
    const meta = getSportTypeMeta(sportType);
    return {
        ...form,
        sport_type: meta.value,
        sport: meta.sport,
        max_sets: meta.max_sets,
        max_players: meta.max_players
    };
};

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

const normalizeCompetitionTitle = (competition) => {
    const title = competition.title || competition.name || 'Untitled Competition';
    return title.replace(/\s*\((Male|Female|Mixed|Mix|Men|Women)\)\s*$/i, '').trim();
};

const getAgeGroupLabel = (competition) => (
    competition.age_group_name ||
    competition.age_group ||
    competition.category_name ||
    'General'
);

const getGenderLabel = (gender) => {
    const normalized = String(gender || 'Mixed').trim();
    if (/^(male|men|m|ชาย)$/i.test(normalized)) return 'Male';
    if (/^(female|women|f|หญิง)$/i.test(normalized)) return 'Female';
    return normalized || 'Mixed';
};

export default function CompetitionsTab() {
    const [competitions, setCompetitions] = useState([]);
    const [compForm, setCompForm] = useState(DEFAULT_COMP_FORM);
    const [editingCompId, setEditingCompId] = useState(null);
    const [stadiums, setStadiums] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);
    const [viewingTeamsComp, setViewingTeamsComp] = useState(null);
    const [teamsInComp, setTeamsInComp] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [managingMatchesComp, setManagingMatchesComp] = useState(null);
    const [updatingStatusIds, setUpdatingStatusIds] = useState([]);

    const groupedCompetitionSections = Object.values(competitions.reduce((acc, current) => {
        const title = normalizeCompetitionTitle(current);
        const ageGroupLabel = getAgeGroupLabel(current);

        if (!acc[title]) {
            acc[title] = {
                title,
                logo_url: current.logo_url || '',
                competitions: [],
                ageGroups: {}
            };
        }

        if (!acc[title].logo_url && current.logo_url) {
            acc[title].logo_url = current.logo_url;
        }

        if (!acc[title].ageGroups[ageGroupLabel]) {
            acc[title].ageGroups[ageGroupLabel] = [];
        }

        acc[title].competitions.push(current);
        acc[title].ageGroups[ageGroupLabel].push(current);
        return acc;
    }, {})).map((section) => ({
        ...section,
        ageGroups: Object.entries(section.ageGroups)
            .map(([ageGroupLabel, items]) => ({
                ageGroupLabel,
                items: [...items].sort((a, b) => {
                    const genderA = getGenderLabel(a.gender);
                    const genderB = getGenderLabel(b.gender);
                    return (genderOrder[genderA] || 99) - (genderOrder[genderB] || 99)
                        || genderA.localeCompare(genderB);
                })
            }))
            .sort((a, b) => a.ageGroupLabel.localeCompare(b.ageGroupLabel))
    })).sort((a, b) => a.title.localeCompare(b.title));

    const competitionRows = groupedCompetitionSections.flatMap((section) => (
        section.ageGroups.flatMap(({ ageGroupLabel, items }) => (
            items.map((competition) => ({
                sectionTitle: section.title,
                sectionLogoUrl: competition.logo_url || section.logo_url,
                ageGroupLabel,
                competition
            }))
        ))
    ));

    const fetchCompetitions = async () => {
        try {
            const res = await client.get('/admin/competitions');
            setCompetitions(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [compRes, stadiumsRes, ageGroupsRes] = await Promise.all([
                    client.get('/admin/competitions'),
                    api.getStadiums(),
                    api.getAllAgeGroups()
                ]);
                setCompetitions(compRes.data);
                setStadiums(stadiumsRes.data);
                setAgeGroups(ageGroupsRes.data);
            } catch (err) {
                console.error("Fetch initial data failed:", err);
            }
        };
        fetchAll();
    }, []);

    const handleCompSubmit = async (e) => {
        e.preventDefault();
        if (!compForm.name || !compForm.gender || !compForm.age_group) {
            return Toast.fire({ icon: 'warning', title: 'Please fill in Name, Gender, and Age Group' });
        }

        try {
            const selectedAgeGroups = compForm.age_group
                ? String(compForm.age_group).split(',').filter(Boolean)
                : [];
            const payload = {
                ...compForm,
                title: compForm.name,
                age_group_id: editingCompId ? compForm.age_group : selectedAgeGroups[0],
                age_group_ids: selectedAgeGroups,
                stadium_id: compForm.stadium_id
            };

            if (editingCompId) {
                await api.updateCompetition(editingCompId, payload);
                Toast.fire({ icon: 'success', title: 'Competition updated' });
            } else {
                await api.createCompetition(payload);
                Toast.fire({ icon: 'success', title: 'Competition created' });
            }

            setCompForm(DEFAULT_COMP_FORM);
            setEditingCompId(null);
            setShowModal(false);
            fetchCompetitions();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || 'Failed to save' });
        }
    };

    const handleCompetitionLogoFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await readImageFileAsDataUrl(file);
            const res = await api.uploadImage(dataUrl);
            setCompForm(prev => ({ ...prev, logo_url: res.data.url }));
        } catch (error) {
            Toast.fire({ icon: 'error', title: error.response?.data?.error || error.message || 'Image upload failed' });
        } finally {
            event.target.value = '';
        }
    };

    const handleEditComp = (c) => {
        setCompForm({
            name: c.title || c.name,
            start_date: c.start_date ? c.start_date.split('T')[0] : '',
            end_date: c.end_date ? c.end_date.split('T')[0] : '',
            location: c.location || '',
            stadium_id: c.stadium_id || '',
            sport: c.sport || 'Volleyball',
            sport_type: 'indoor',
            athlete_sport_policy: c.athlete_sport_policy || 'single_sport',
            gender: c.gender || '',
            age_group: c.age_group_id || '',
            status: c.status || 'open',
            max_sets: c.max_sets || 3,
            max_players: c.max_players || 14,
            logo_url: c.logo_url || ''
        });
        setEditingCompId(c.id);
        setShowModal(true);
    };

    const handleDeleteComp = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await api.deleteCompetition(id);
                setCompetitions(prev => prev.filter(c => c.id !== id));
                Toast.fire({ icon: 'success', title: 'Deleted successfully' });
            } catch { Toast.fire({ icon: 'error', title: 'Delete failed' }); }
        }
    };

    const handleToggleStatus = async (comp) => {
        const currentStatus = String(comp.status || '').toLowerCase();
        const newStatus = currentStatus === 'open' ? 'closed' : 'open';
        try {
            setUpdatingStatusIds(prev => [...new Set([...prev, comp.id])]);
            setCompetitions(prev => prev.map(c => c.id === comp.id ? { ...c, status: newStatus } : c));
            const res = await api.updateCompetitionStatus(comp.id, newStatus);
            setCompetitions(prev => prev.map(c => c.id === comp.id ? { ...c, ...res.data } : c));
            Toast.fire({ icon: 'success', title: `Status changed to ${newStatus}` });
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || 'Failed to update status' });
            fetchCompetitions();
        } finally {
            setUpdatingStatusIds(prev => prev.filter(id => id !== comp.id));
        }
    };

    const handleViewTeams = async (comp) => {
        try {
            const res = await api.getTeamsByCompetition(comp.id);
            setTeamsInComp(res.data);
            setViewingTeamsComp(comp);
        } catch {
            Toast.fire({ icon: 'error', title: 'Failed to load teams' });
        }
    };

    const handleExportTeamsCSV = () => {
        if (teamsInComp.length === 0) return Toast.fire({ icon: 'info', title: 'No teams to export' });
        const headers = ["Team Name,Code,Coach"];
        const rows = teamsInComp.map(t => [`"${t.name || ''}"`, `"${t.code || ''}"`, `"${t.coach || ''}"`].join(','));
        const csvContent = "\uFEFF" + [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `teams_${viewingTeamsComp.title || 'competition'}.csv`;
        link.click();
    };

    if (managingMatchesComp) {
        return (
            <MatchesManager 
                competitionId={managingMatchesComp.id} 
                competition={managingMatchesComp} 
                onClose={() => setManagingMatchesComp(null)} 
            />
        );
    }

    return (
        <div className="official-page min-h-screen -m-6 p-6 space-y-6 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="official-header rounded-md px-6 py-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Competition Control</p>
                        <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
                            <Trophy size={24} /> Competitions Management
                        </h2>
                    </div>
                    <button
                        onClick={() => {
                            setCompForm(DEFAULT_COMP_FORM);
                            setEditingCompId(null);
                            setShowModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
                    >
                        <PlusCircle size={18} /> New Competition
                    </button>
                </div>
            </div>

            {/* List Section */}
            <div className="official-panel rounded-md overflow-hidden">
                <div className="official-panel-header flex items-center justify-between px-6 py-4">
                    <h3 className="flex items-center gap-2 font-semibold tracking-tight text-gray-900">
                        <Layers size={18} className="text-blue-600" /> Competition List
                    </h3>
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {competitions.length} Categories
                    </span>
                </div>

                <div className="p-6">
                    {competitionRows.length === 0 ? (
                        <EmptyState text="No competitions created." />
                    ) : (
                        <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-[1120px] w-full text-left text-sm">
                                    <thead className="official-table-head border-b border-gray-200 text-xs font-bold uppercase tracking-wide">
                                        <tr>
                                            <th className="px-4 py-3">Competition</th>
                                            <th className="px-4 py-3">Age Group</th>
                                            <th className="px-4 py-3">Gender</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Sport</th>
                                            <th className="px-4 py-3">Teams</th>
                                            <th className="px-4 py-3">Start Date</th>
                                            <th className="px-4 py-3">Stadium</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {competitionRows.map(({ sectionTitle, sectionLogoUrl, ageGroupLabel, competition: c }) => {
                                            const genderLabel = getGenderLabel(c.gender);
                                            const isUpdatingStatus = updatingStatusIds.includes(c.id);
                                            const competitionWithLogoFallback = { ...c, logo_url: c.logo_url || sectionLogoUrl };
                                            return (
                                                <tr key={c.id} className="transition-colors hover:bg-blue-50/40">
                                                    <td className="px-4 py-3">
                                                        <div className="flex min-w-[240px] items-center gap-3">
                                                            <div className="official-icon-box flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                                                                {sectionLogoUrl ? (
                                                                    <img src={sectionLogoUrl} alt={sectionTitle} className="h-full w-full object-contain p-1.5" />
                                                                ) : (
                                                                    <Trophy size={17} />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate font-semibold text-gray-900">{sectionTitle}</p>
                                                                <p className="text-xs text-gray-500">Category ID: {c.id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                                            {ageGroupLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`font-semibold ${genderLabel === 'Male' ? 'text-blue-700' : genderLabel === 'Female' ? 'text-rose-700' : 'text-violet-700'}`}>
                                                            {genderLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatus(c)}
                                                            disabled={isUpdatingStatus}
                                                            className="disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${c.status === 'open' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                                                {isUpdatingStatus ? 'Saving...' : c.status === 'open' ? 'Open' : 'Closed'}
                                                            </span>
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                                            <Shield size={14} className="text-blue-500" />
                                                            {getSportTypeMeta(c.sport_type || 'indoor').label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                                            <Users size={14} className="text-gray-400" />
                                                            {c.team_count || 0} Teams
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                                            <Calendar size={14} className="text-gray-400" />
                                                            {formatThaiDate(c.start_date)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        <span className="inline-flex max-w-[190px] items-center gap-1.5">
                                                            <MapPin size={14} className="shrink-0 text-gray-400" />
                                                            <span className="truncate">{c.stadium_name || c.location || '-'}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => setManagingMatchesComp(c)} className="whitespace-nowrap rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Matches</button>
                                                            <button onClick={() => handleViewTeams(competitionWithLogoFallback)} className="whitespace-nowrap rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">Teams</button>
                                                            <button onClick={() => handleEditComp(competitionWithLogoFallback)} className="rounded-md p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" aria-label="Edit competition"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDeleteComp(c.id)} className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Delete competition"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Form Section */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="official-panel w-full max-w-lg rounded-md overflow-hidden flex flex-col">
                        <div className="official-panel-header px-6 py-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <Trophy size={20} className="text-blue-600" />
                                {editingCompId ? 'Edit Competition' : 'New Competition'}
                            </h2>
                            <button onClick={() => {
                                setShowModal(false);
                                setEditingCompId(null);
                                setCompForm(DEFAULT_COMP_FORM);
                            }} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                                <X size={18} className="text-gray-500 hover:text-red-600" />
                            </button>
                        </div>
                        <form onSubmit={handleCompSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                            <Input label="Name" value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} required />
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700">Competition Logo / Symbol</label>
                                <div className="flex items-center gap-4 rounded-md border border-gray-200 bg-gray-50 p-3">
                                    <div className="h-20 w-20 shrink-0 rounded-md border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                                        {compForm.logo_url ? (
                                            <img src={compForm.logo_url} alt={compForm.name || 'Competition logo'} className="h-full w-full object-contain p-1.5" />
                                        ) : (
                                            <ImageIcon size={24} className="text-gray-300" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <label className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer transition">
                                                <Upload size={16} />
                                                Browse
                                                <input type="file" accept="image/*" className="hidden" onChange={handleCompetitionLogoFileChange} />
                                            </label>
                                            {compForm.logo_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setCompForm(prev => ({ ...prev, logo_url: '' }))}
                                                    className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                                                    aria-label="Remove competition logo"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500">JPG, PNG, WebP or GIF up to 2MB</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Start Date" type="date" value={compForm.start_date} onChange={e => setCompForm({ ...compForm, start_date: e.target.value })} required />
                                <Input label="End Date" type="date" value={compForm.end_date} onChange={e => setCompForm({ ...compForm, end_date: e.target.value })} required />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700">Stadium</label>
                                <select
                                    value={compForm.stadium_id || ''}
                                    onChange={(e) => {
                                        const selected = stadiums.find(s => s.id.toString() === e.target.value);
                                        setCompForm({ ...compForm, stadium_id: e.target.value, location: selected ? selected.name : '' });
                                    }}
                                    className="w-full p-2.5 rounded-md border text-sm outline-none bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    required
                                >
                                    <option value="">-- Select Stadium --</option>
                                    {stadiums.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700">Sport Type</label>
                                    <select
                                        value={compForm.sport_type || 'indoor'}
                                        onChange={e => setCompForm(prev => applySportTypeDefaults(prev, e.target.value))}
                                        className="w-full p-2.5 rounded-md border text-sm outline-none bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    >
                                        {SPORT_TYPE_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700">Athlete Policy</label>
                                    <select
                                        value={compForm.athlete_sport_policy || 'single_sport'}
                                        onChange={e => setCompForm({ ...compForm, athlete_sport_policy: e.target.value })}
                                        className="w-full p-2.5 rounded-md border text-sm outline-none bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    >
                                        {ATHLETE_SPORT_POLICY_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700">Age Groups</label>
                                    {editingCompId ? (
                                        <select required value={compForm.age_group} onChange={e => setCompForm({ ...compForm, age_group: e.target.value })} className="w-full p-2.5 rounded-md border text-sm outline-none bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                                            <option value="">-- Age Group --</option>
                                            {ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                                        </select>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {ageGroups.map((ag) => {
                                                const selectedAgeGroups = compForm.age_group ? compForm.age_group.split(',').filter(Boolean) : [];
                                                const isSelected = selectedAgeGroups.includes(String(ag.id));
                                                return (
                                                    <button
                                                        key={ag.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const nextAgeGroups = isSelected
                                                                ? selectedAgeGroups.filter(id => id !== String(ag.id))
                                                                : [...selectedAgeGroups, String(ag.id)];
                                                            setCompForm({ ...compForm, age_group: nextAgeGroups.join(',') });
                                                        }}
                                                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                                                            isSelected
                                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {ag.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700">Gender Categories</label>
                                <div className="flex gap-2">
                                    {['Male', 'Female', 'Mixed'].map((g) => {
                                        const currentGenders = compForm.gender ? compForm.gender.split(',').filter(x => x) : [];
                                        const isSelected = currentGenders.includes(g);
                                        return (
                                            <button 
                                                key={g} 
                                                type="button" 
                                                onClick={() => {
                                                    if (editingCompId) {
                                                        // Single-select when editing (cannot have multiple genders for an existing category)
                                                        setCompForm({ ...compForm, gender: g });
                                                    } else {
                                                        // Multi-select when creating
                                                        const newGenders = isSelected 
                                                            ? currentGenders.filter(x => x !== g) 
                                                            : [...currentGenders, g];
                                                        setCompForm({ ...compForm, gender: newGenders.join(',') });
                                                    }
                                                }} 
                                                className={`flex-1 py-2 text-sm font-medium rounded-md border transition-all ${
                                                    isSelected 
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                {g}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Match Rule</label>
                                <select
                                    value={compForm.max_sets || 3}
                                    onChange={e => setCompForm({ ...compForm, max_sets: Number(e.target.value) })}
                                    className="w-full p-2.5 rounded-md border text-sm outline-none bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all mb-4"
                                    required
                                >
                                    <option value={3}>Best of 3 - ชนะ 2 ใน 3 เซต</option>
                                    <option value={5}>Best of 5 - ชนะ 3 ใน 5 เซต</option>
                                </select>
                                <Input label="Max Players" type="number" value={compForm.max_players} onChange={e => setCompForm({ ...compForm, max_players: parseInt(e.target.value, 10) || '' })} />
                            </div>
                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => {
                                    setShowModal(false);
                                    setEditingCompId(null);
                                    setCompForm(DEFAULT_COMP_FORM);
                                }} className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white border-gray-300 hover:bg-gray-50 font-semibold shadow-sm transition">
                                    Cancel
                                </button>
                                <Button type="submit" label={editingCompId ? "Update" : "Create"} icon={editingCompId ? <Edit2 size={18} /> : <PlusCircle size={18} />} />
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Teams Modal */}
            {viewingTeamsComp && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="official-panel max-h-[90vh] w-full max-w-4xl rounded-md overflow-hidden flex flex-col">
                        <div className="official-panel-header px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="official-icon-box p-2 rounded-md">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">{cleanCompetitionTitle(viewingTeamsComp.title || viewingTeamsComp.name)}</h3>
                                    <p className="text-sm text-gray-500">{teamsInComp.length} Teams Registered</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={handleExportTeamsCSV} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm">
                                    <Download size={16} /> Export
                                </button>
                                <button onClick={() => setViewingTeamsComp(null)} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/60">
                            {teamsInComp.length === 0 ? (
                                <EmptyState text="No teams have joined this competition category yet." />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {teamsInComp.map(team => (
                                        <div key={team.id} className="p-4 rounded-md border flex items-center justify-between group transition-all bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-md bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-200">
                                                    {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-contain p-1" alt="" /> : <Shield size={20} className="text-gray-400" />}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-800">{team.name}</p>
                                                    <p className="text-sm text-gray-500">Code: {team.code}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={async () => {
                                                        const result = await Swal.fire({
                                                            title: 'Remove from Competition?',
                                                            text: "This will only remove the team from this competition category.",
                                                            icon: 'warning',
                                                            showCancelButton: true,
                                                            confirmButtonColor: '#f97316',
                                                            confirmButtonText: 'Yes, remove them'
                                                        });
                                                        if (result.isConfirmed) {
                                                            try {
                                                                await api.removeTeamFromCompetition(viewingTeamsComp.id, team.id);
                                                                setTeamsInComp(prev => prev.filter(t => t.id !== team.id));
                                                                Toast.fire({ icon: 'success', title: 'Removed from competition' });
                                                                fetchCompetitions(); // Update counts
                                                            } catch {
                                                                Toast.fire({ icon: 'error', title: 'Failed to remove team' });
                                                            }
                                                        }
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
                                                    title="Remove from Competition"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const result = await Swal.fire({
                                                            title: 'ลบทีมสโมสร?',
                                                            text: 'การลบทีมจะลบข้อมูลนักกีฬาและเจ้าหน้าที่ทั้งหมดของทีมนี้ด้วยถาวร',
                                                            icon: 'warning',
                                                            showCancelButton: true,
                                                            confirmButtonColor: '#ef4444',
                                                            confirmButtonText: 'ยืนยันการลบ'
                                                        });
                                                        if (result.isConfirmed) {
                                                            try {
                                                                await api.deleteTeam(team.id);
                                                                setTeamsInComp(prev => prev.filter(t => t.id !== team.id));
                                                                Toast.fire({ icon: 'success', title: 'Team deleted successfully' });
                                                                fetchCompetitions(); // Update counts
                                                            } catch {
                                                                Toast.fire({ icon: 'error', title: 'Delete failed' });
                                                            }
                                                        }
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Delete Team Globally"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
