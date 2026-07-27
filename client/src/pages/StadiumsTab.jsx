import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { MapPin, Edit2, Trash2, Plus, X, Building, Users } from 'lucide-react';
import Swal from 'sweetalert2';

export default function StadiumsTab() {
    const [stadiums, setStadiums] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const initialForm = {
        name: '', code: '', address: '', google_map_url: '',
        capacity: 0, number_of_courts: 1, status: 'active'
    };
    const [formData, setFormData] = useState(initialForm);

    const fetchStadiums = useCallback(async () => {
        try {
            const res = await api.getStadiums();
            setStadiums(res.data);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchStadiums();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchStadiums]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.updateStadium(formData.id, formData);
                Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, showConfirmButton: false });
            } else {
                await api.createStadium(formData);
                Swal.fire({ icon: 'success', title: 'Created!', timer: 1500, showConfirmButton: false });
            }
            setIsModalOpen(false);
            fetchStadiums();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save', 'error');
        }
    };

    const handleDelete = async (id) => {
        Swal.fire({
            title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.deleteStadium(id);
                    fetchStadiums();
                    Swal.fire('Deleted!', 'Stadium has been deleted.', 'success');
                } catch {
                    Swal.fire('Error', 'Cannot delete (It might be in use)', 'error');
                }
            }
        });
    };

    const openModal = (stadium = null) => {
        if (stadium) {
            setFormData(stadium);
            setIsEditing(true);
        } else {
            setFormData(initialForm);
            setIsEditing(false);
        }
        setIsModalOpen(true);
    };

    return (
        <div className="official-page min-h-screen p-6">
            <div className="official-header rounded-md px-6 py-5 mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Venue Operations</p>
                    <h2 className="text-2xl font-bold tracking-tight">Stadiums Management</h2>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-white/95 text-blue-700 hover:bg-blue-50 rounded-md transition-colors font-semibold shadow-sm"
                >
                    <Plus size={18} /> Add Stadium
                </button>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`}>
                {stadiums.map((stadium) => (
                    <div key={stadium.id} className="official-panel rounded-md overflow-hidden relative group">
                        <div className={`h-2 ${stadium.status === 'active' ? 'official-accent-bar' : 'bg-gradient-to-r from-slate-400 to-slate-600'}`} />
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-gray-800">{stadium.name}</h3>
                                <span className="text-xs font-mono px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                    {stadium.code || 'N/A'}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-start gap-2 text-sm text-gray-500">
                                    <MapPin size={16} className="mt-0.5 shrink-0" />
                                    <span className="line-clamp-2">{stadium.address || 'No address provided'}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <div className="flex items-center gap-1 text-emerald-700"><Users size={16} /> Cap: {stadium.capacity}</div>
                                    <div className="flex items-center gap-1 text-amber-700"><Building size={16} /> Courts: {stadium.number_of_courts}</div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                                <button onClick={() => openModal(stadium)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(stadium.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-lg shadow-2xl overflow-hidden bg-white text-gray-900">
                        <div className="official-panel-header px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold">{isEditing ? 'Edit Stadium' : 'Add New Stadium'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase mb-1 block">Name</label>
                                    <input required className="w-full p-2 rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase mb-1 block">Code</label>
                                    <input className="w-full p-2 rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                        value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. GYM-01" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase mb-1 block">Address</label>
                                <textarea className="w-full p-2 rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" rows="2"
                                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase mb-1 block">Capacity</label>
                                    <input type="number" className="w-full p-2 rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                        value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase mb-1 block">Number of Courts</label>
                                    <input type="number" className="w-full p-2 rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                        value={formData.number_of_courts} onChange={e => setFormData({ ...formData, number_of_courts: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase mb-1 block">Google Map URL</label>
                                <input className="w-full p-2 rounded border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={formData.google_map_url} onChange={e => setFormData({ ...formData, google_map_url: e.target.value })} placeholder="https://maps.google.com/..." />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase mb-1 block">Status</label>
                                <select className="w-full p-2 rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                    <option value="active" className="text-black">Active</option>
                                    <option value="maintenance" className="text-black">Maintenance</option>
                                    <option value="closed" className="text-black">Closed</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="official-primary-button px-4 py-2 rounded-md transition-colors">Save Stadium</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
