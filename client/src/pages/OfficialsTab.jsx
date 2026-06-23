import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { User, Plus, Edit2, Trash2, X, Save, Flag, FileText } from 'lucide-react';

export default function Referees({ darkMode = false }) {
    const [activeTab, setActiveTab] = useState('referee'); // referee, scorer, linejudge
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({ firstname: '', lastname: '', country: '', code: '' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            // เรียก API ตาม Tab ที่เลือก (ต้องมั่นใจว่าใน api.js มีฟังก์ชันเหล่านี้ หรือใช้ axios โดยตรง)
            if (activeTab === 'referee') res = await api.getAllReferees();
            else if (activeTab === 'scorer') res = await api.getAllScorers();
            else if (activeTab === 'linejudge') res = await api.getAllLineJudges();

            setData(res.data || []);
        } catch (err) {
            console.error("Error fetching officials:", err);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchData();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchData]);

    const handleSave = async () => {
        try {
            if (editItem) {
                // Update Logic
                if (activeTab === 'referee') await api.updateReferee(editItem.id, formData);
                else if (activeTab === 'scorer') await api.updateScorer(editItem.id, formData);
                else if (activeTab === 'linejudge') await api.updateLineJudge(editItem.id, formData);
            } else {
                // Create Logic
                if (activeTab === 'referee') await api.createReferee(formData);
                else if (activeTab === 'scorer') await api.createScorer(formData);
                else if (activeTab === 'linejudge') await api.createLineJudge(formData);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error("Error saving official:", err);
            alert('Failed to save data. Please check console.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this official?')) return;
        try {
            if (activeTab === 'referee') await api.deleteReferee(id);
            else if (activeTab === 'scorer') await api.deleteScorer(id);
            else if (activeTab === 'linejudge') await api.deleteLineJudge(id);
            fetchData();
        } catch (err) {
            console.error("Error deleting official:", err);
            alert('Failed to delete.');
        }
    };

    const openModal = (item = null) => {
        setEditItem(item);
        setFormData(item
            ? { firstname: item.firstname, lastname: item.lastname, country: item.country, code: item.code }
            : { firstname: '', lastname: '', country: '', code: '' }
        );
        setShowModal(true);
    };

    const getTabIcon = (tab) => {
        switch (tab) {
            case 'referee': return <User size={18} />;
            case 'scorer': return <FileText size={18} />;
            case 'linejudge': return <Flag size={18} />;
            default: return <User size={18} />;
        }
    };

    return (
        <div className="min-h-screen p-6 transition-colors duration-200 bg-gray-50 text-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <User className="text-blue-600" /> Officials Management
                </h1>
                <button
                    onClick={() => openModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-lg transition-transform active:scale-95"
                >
                    <Plus size={20} /> Add New {activeTab === 'linejudge' ? 'Line Judge' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                {['referee', 'scorer', 'linejudge'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 px-6 font-bold capitalize transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t-lg'
                            }`}
                    >
                        {getTabIcon(tab)}
                        {tab === 'linejudge' ? 'Line Judges' : tab + 's'}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="rounded-md border overflow-hidden shadow-sm bg-white border-gray-200">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Loading...</div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <User size={48} className="mb-2 opacity-20" />
                        <p>No officials found in this category.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className={darkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-50 text-gray-500'}>
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Country</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Code</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                                {data.map(item => (
                                    <tr key={item.id} className={`transition ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                    {item.firstname.charAt(0)}
                                                </div>
                                                <span className="font-medium">{item.firstname} {item.lastname}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                {item.country || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                {item.code || 'No Code'}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openModal(item)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-lg shadow-2xl overflow-hidden transform transition-all bg-white text-gray-900">
                        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                {editItem ? <Edit2 size={18} /> : <Plus size={18} />}
                                {editItem ? 'Edit' : 'Add'} {activeTab === 'linejudge' ? 'Line Judge' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">First Name</label>
                                    <input
                                        value={formData.firstname}
                                        onChange={e => setFormData({ ...formData, firstname: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 border-gray-300 text-gray-900"
                                        placeholder="John"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Last Name</label>
                                    <input
                                        value={formData.lastname}
                                        onChange={e => setFormData({ ...formData, lastname: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 border-gray-300 text-gray-900"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Country / Association</label>
                                <input
                                    value={formData.country}
                                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 border-gray-300 text-gray-900"
                                    placeholder="THA"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Code</label>
                                <input
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 border-gray-300 text-gray-900"
                                    placeholder="THA"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t flex justify-end gap-3 border-gray-100 bg-gray-50">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg font-semibold text-gray-500 hover:bg-gray-200/50 transition">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 rounded-lg font-bold bg-blue-600 text-white hover:bg-indigo-700 shadow-lg active:scale-95 transition flex items-center gap-2">
                                <Save size={18} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
