import React, { useEffect, useState } from 'react';
import { api } from '../api'; // ตรวจสอบ path ให้ถูกต้อง
import Swal from 'sweetalert2';
import { 
    PlusCircle, 
    Calendar, 
    MapPin, 
    Trash2, 
    Edit2,
    ToggleLeft,
    ToggleRight,
    Users,
    Shield
} from 'lucide-react';
import { formatThaiDate } from '../utils';

export default function Competitions() {
    const [competitions, setCompetitions] = useState([]);
    // เพิ่ม field status ใน form
    const [form, setForm] = useState({ name: '', details: '', sport: 'Volleyball', gender: 'Mix', start_date: '', end_date: '', location: '', status: 'closed' });
    const [isEditing, setIsEditing] = useState(null);

    useEffect(() => {
        fetchCompetitions();
    }, []);

    const fetchCompetitions = async () => {
        try {
            const res = await api.get('/admin/competitions');
            setCompetitions(res.data);
        } catch (err) {
            console.error("Error fetching competitions:", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // แปลงชื่อ field ให้ตรงกับ Database (title/name)
            // ใน Backend รับ 'title' แต่ใน Form อาจจะใช้ 'name' ต้องดูให้ตรงกัน
            // สมมติ Backend ใช้ 'title'
            const payload = {
                title: form.name, 
                details: form.details,
                sport: form.sport,
                gender: form.gender,
                start_date: form.start_date,
                end_date: form.end_date,
                location: form.location,
                status: form.status
            };

            if (isEditing) {
                await api.updateCompetition(isEditing, payload);
                Swal.fire('Success', "Competition Updated!", 'success');
            } else {
                await api.createCompetition(payload);
                Swal.fire('Success', "Competition Created!", 'success');
            }
            // Reset Form
            setForm({ name: '', details: '', sport: 'Volleyball', gender: 'Mix', start_date: '', end_date: '', location: '', status: 'closed' });
            setIsEditing(null);
            fetchCompetitions();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', "Error saving competition", 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete this competition?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });
        if (!result.isConfirmed) return;
        try {
            await api.deleteCompetition(id);
            fetchCompetitions();
            Swal.fire('Deleted!', 'Competition has been deleted.', 'success');
        } catch  {
            Swal.fire('Error', "Error deleting", 'error');
        }
    };

    // ✅ ฟังก์ชันกดปุ่ม Toggle สถานะ
    const handleToggleStatus = async (comp) => {
        const newStatus = comp.status === 'open' ? 'closed' : 'open';
        try {
            // Optimistic Update: อัปเดตหน้าจอทันทีเพื่อให้ลื่นไหล
            setCompetitions(prev => prev.map(c => c.id === comp.id ? { ...c, status: newStatus } : c));
            
            // เรียก API ไปอัปเดตหลังบ้าน
            await api.updateCompetitionStatus(comp.id, newStatus);
        } catch (err) {
            console.error(err);
            Swal.fire('Error', "Failed to update status", 'error');
            fetchCompetitions(); // โหลดข้อมูลจริงกลับมาถ้า error
        }
    };

    const handleEdit = (comp) => {
        setIsEditing(comp.id);
        setForm({
            name: comp.title || comp.name, // รองรับทั้ง title และ name
            details: comp.details || '',
            sport: comp.sport || 'Volleyball',
            gender: comp.gender || 'Mix',
            start_date: comp.start_date ? comp.start_date.split('T')[0] : '',
            end_date: comp.end_date ? comp.end_date.split('T')[0] : '',
            location: comp.location || '',
            status: comp.status || 'closed'
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        {isEditing ? <Edit2 size={20}/> : <PlusCircle size={20}/>}
                        {isEditing ? 'Edit Competition' : 'Create Competition'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input label="Tournament Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        
                        <div className="grid grid-cols-2 gap-2">
                             <Input label="Sport" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })} />
                             <Input label="Gender" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} />
                        </div>

                        <Input label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                        
                        <div className="grid grid-cols-2 gap-2">
                            <Input label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
                            <Input label="End Date" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
                        </div>

                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                            <select 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                            >
                                <option value="closed">Closed (ปิดรับสมัคร)</option>
                                <option value="open">Open (เปิดรับสมัคร)</option>
                                <option value="upcoming">Upcoming (เร็วๆ นี้)</option>
                            </select>
                        </div>
                        
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-2 mt-4">
                            {isEditing ? 'Update Competition' : 'Create Competition'}
                        </button>

                        {isEditing && (
                            <button type="button" onClick={() => { setIsEditing(null); setForm({ name: '', details: '', sport: 'Volleyball', gender: 'Mix', start_date: '', end_date: '', location: '', status: 'closed' }); }} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 rounded-lg text-sm transition">
                                Cancel
                            </button>
                        )}
                    </form>
                </div>
            </div>

            {/* List Section */}
            <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Shield className="text-indigo-600"/> All Competitions
                    </h3>
                    <div className="space-y-4">
                        {competitions.map(c => (
                            <div key={c.id} className="flex flex-col md:flex-row justify-between items-center p-5 border border-gray-200 rounded-xl hover:shadow-md transition bg-white gap-4 relative overflow-hidden group">
                                {/* Status Indicator Strip */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.status === 'open' ? 'bg-green-500' : 'bg-gray-300'}`}></div>

                                <div className="flex-1 pl-2">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-bold text-gray-900 text-lg">{c.title || c.name}</h3>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                            c.status === 'open' 
                                            ? 'bg-green-100 text-green-700 border-green-200' 
                                            : 'bg-gray-100 text-gray-500 border-gray-200'
                                        }`}>
                                            {c.status === 'open' ? 'Reg. Open' : 'Closed'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                        <span className="flex items-center gap-1"><Calendar size={14} /> {formatThaiDate(c.start_date)}</span>
                                        {c.location && <span className="flex items-center gap-1"><MapPin size={14} /> {c.location}</span>}
                                        <span className="flex items-center gap-1 text-indigo-600 font-medium bg-indigo-50 px-2 rounded-full"><Users size={12} /> {c.team_count || 0} Teams</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* ✅ Toggle Button Switch */}
                                    <div className="flex flex-col items-center gap-1 cursor-pointer group/toggle" onClick={() => handleToggleStatus(c)}>
                                        {c.status === 'open' ? (
                                            <ToggleRight size={36} className="text-green-500 transition-all group-hover/toggle:scale-110 drop-shadow-sm" />
                                        ) : (
                                            <ToggleLeft size={36} className="text-gray-300 transition-all group-hover/toggle:scale-110 hover:text-gray-400" />
                                        )}
                                        <span className={`text-[9px] font-bold uppercase ${c.status === 'open' ? 'text-green-600' : 'text-gray-400'}`}>
                                            {c.status === 'open' ? 'Open' : 'Closed'}
                                        </span>
                                    </div>

                                    <div className="h-10 w-px bg-gray-100 mx-2"></div>

                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(c)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-transparent hover:border-indigo-100" title="Edit">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(c.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition border border-transparent hover:border-red-100" title="Delete">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {competitions.length === 0 && (
                            <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-400">No competitions found.</p>
                                <p className="text-xs text-gray-400 mt-1">Create one to get started.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper Input Component
function Input({ label, type = "text", value, onChange, required }) {
    return (
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
            <input type={type} required={required} value={value} onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
            />
        </div>
    );
}