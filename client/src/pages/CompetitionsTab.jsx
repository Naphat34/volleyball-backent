import React, { useEffect, useState } from 'react';
import client, { api } from '../api';
import { Trophy, Calendar, MapPin, Edit2, Trash2, PlusCircle, X,  Users, Shield, Download } from 'lucide-react';
import { Toast, Input, Button, EmptyState } from './AdminShared';
import Swal from 'sweetalert2';

export default function CompetitionsTab() {
    const [competitions, setCompetitions] = useState([]);
    const [compForm, setCompForm] = useState({
        name: '', start_date: '', end_date: '', location: '', stadium_id: '',
        sport: 'Volleyball', gender: '', age_group: '', status: 'open', max_players: 14
    });
    const [editingCompId, setEditingCompId] = useState(null);
    const [stadiums, setStadiums] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);
    const [viewingTeamsComp, setViewingTeamsComp] = useState(null);
    const [teamsInComp, setTeamsInComp] = useState([]);
    const [showModal, setShowModal] = useState(false);

    // ✅ จัดกลุ่ม Competitions ตามชื่อ
    const groupedCompetitions = competitions.reduce((acc, current) => {
        const name = current.title || current.name;
        if (!acc[name]) {
            acc[name] = [];
        }
        acc[name].push(current);
        return acc;
    }, {});

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
        if (!compForm.name || !compForm.gender) {
            return Toast.fire({ icon: 'warning', title: 'Please fill in Name and Gender' });
        }

        try {
            const payload = {
                ...compForm,
                title: compForm.name,
                age_group_id: compForm.age_group,
                stadium_id: compForm.stadium_id
            };

            if (editingCompId) {
                await api.updateCompetition(editingCompId, payload);
                Toast.fire({ icon: 'success', title: 'Competition updated' });
            } else {
                await api.createCompetition(payload);
                Toast.fire({ icon: 'success', title: 'Competition created' });
            }

            setCompForm({
                name: '', start_date: '', end_date: '', location: '', stadium_id: '',
                sport: 'Volleyball', gender: '', age_group: '', status: 'open', max_players: 14
            });
            setEditingCompId(null);
            setShowModal(false);
            fetchCompetitions();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.response?.data?.error || 'Failed to save' });
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
            gender: c.gender || '',
            age_group: c.age_group_id || '',
            status: c.status || 'open',
            max_players: c.max_players || 14
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
        const newStatus = comp.status === 'open' ? 'closed' : 'open';
        try {
            setCompetitions(prev => prev.map(c => c.id === comp.id ? { ...c, status: newStatus } : c));
            await api.updateCompetitionStatus(comp.id, newStatus);
            Toast.fire({ icon: 'success', title: `Status changed to ${newStatus}` });
        } catch {
            Toast.fire({ icon: 'error', title: 'Failed to update status' });
            fetchCompetitions();
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 shadow-sm">
                        <Trophy className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Competitions Management
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">Manage and organize tournament categories</p>
                    </div>
                </div>
                <div>
                    <button
                        onClick={() => {
                            setCompForm({
                                name: '', start_date: '', end_date: '', location: '', stadium_id: '',
                                sport: 'Volleyball', gender: '', age_group: '', status: 'open', max_players: 14
                            });
                            setEditingCompId(null);
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition shadow-md active:scale-95 text-sm"
                    >
                        <PlusCircle size={18} /> New Competition
                    </button>
                </div>
            </div>

            {/* List Section */}
            <div className="w-full">
                <div className="space-y-6">
                    {Object.keys(groupedCompetitions).length === 0 ? (
                        <EmptyState text="No competitions created." />
                    ) : (
                        Object.entries(groupedCompetitions).map(([compName, items]) => (
                            <div key={compName} className="rounded-lg border transition-all shadow-sm bg-white border-gray-200">
                                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-md bg-white border border-gray-200 text-blue-600 shadow-sm">
                                            <Trophy size={18} />
                                        </div>
                                        <h4 className="text-lg font-semibold text-gray-800">{compName}</h4>
                                    </div>
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 shadow-sm">{items.length} Categories</span>
                                </div>

                                <div className="p-4 space-y-3">
                                    {items.map((c) => (
                                        <div key={c.id} className="group relative flex flex-col md:flex-row justify-between items-center p-4 rounded-md border transition-all bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm">
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${c.status === 'open' ? 'bg-emerald-500' : 'bg-gray-300'}`} />

                                            <div className="flex-1 pl-3 w-full">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-base font-semibold text-gray-800">
                                                        {c.gender} <span className="mx-1 text-gray-400 font-normal">•</span> {c.age_group_name || 'General'}
                                                    </span>
                                                    <button onClick={() => handleToggleStatus(c)}>
                                                        <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium transition-colors ${c.status === 'open' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                                            {c.status === 'open' ? 'Open' : 'Closed'}
                                                        </span>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                                                    <span className="flex items-center gap-1.5 font-medium text-blue-600"><Shield size={14} /> {c.sport}</span>
                                                    <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(c.start_date).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1.5"><MapPin size={14} /> {c.stadium_name || c.location}</span>
                                                    <span className="flex items-center gap-1.5"><Users size={14} /> {c.team_count || 0} Teams</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100 w-full md:w-auto justify-end">
                                                <button onClick={() => handleViewTeams(c)} className="px-3 py-1.5 rounded-md text-sm font-medium transition text-blue-600 border border-transparent hover:border-blue-100 hover:bg-blue-50">View Teams</button>
                                                <div className="hidden md:block w-px h-5 bg-gray-200 mx-1" />
                                                <button onClick={() => handleEditComp(c)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteComp(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal Form Section */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b flex items-center justify-between border-gray-200 bg-white">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <Trophy size={20} className="text-blue-600" />
                                {editingCompId ? 'Edit Competition' : 'New Competition'}
                            </h2>
                            <button onClick={() => {
                                setShowModal(false);
                                setEditingCompId(null);
                                setCompForm({ name: '', start_date: '', end_date: '', location: '', stadium_id: '', sport: 'Volleyball', gender: '', age_group: '', status: 'open', max_sets: 5, max_players: 14 });
                            }} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                                <X size={18} className="text-gray-500 hover:text-red-600" />
                            </button>
                        </div>
                        <form onSubmit={handleCompSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                            <Input label="Name" value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} required />
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
                                <Input label="Sport" placeholder="Volleyball" value={compForm.sport} onChange={e => setCompForm({ ...compForm, sport: e.target.value })} />
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700">Age Group</label>
                                    <select value={compForm.age_group} onChange={e => setCompForm({ ...compForm, age_group: e.target.value })} className="w-full p-2.5 rounded-md border text-sm outline-none bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                                        <option value="">-- Age Group --</option>
                                        {ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                                    </select>
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
                                <Input label="Max Players" type="number" value={compForm.max_players} onChange={e => setCompForm({ ...compForm, max_players: parseInt(e.target.value) })} />
                            </div>
                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => {
                                    setShowModal(false);
                                    setEditingCompId(null);
                                    setCompForm({ name: '', start_date: '', end_date: '', location: '', stadium_id: '', sport: 'Volleyball', gender: '', age_group: '', status: 'open', max_players: 14 });
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
                    <div className="bg-white max-h-[90vh] w-full max-w-4xl rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b flex items-center justify-between border-gray-200 bg-white">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-md bg-blue-50 border border-blue-100 text-blue-600">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">{viewingTeamsComp.title || viewingTeamsComp.name}</h3>
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

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
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