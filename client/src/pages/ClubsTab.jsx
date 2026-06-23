import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Users, Search, Mail, Phone, Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function ClubsTab() {
  const [teams, setTeams] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTeams = async () => {
    try {
      const res = await api.getAllTeams();
      setTeams(res.data);
    } catch (err) { console.error("Fetch teams failed", err); }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.getAllTeams();
        setTeams(res.data);
      } catch (err) { console.error("Fetch teams failed", err); }
    };
    load();
  }, []);


  // --- List View (Table Mode) ---
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-3.5 text-gray-300" size={18} />
          <input type="text" placeholder="Search teams..." className="w-full pl-12 pr-6 py-3.5 bg-white rounded-lg shadow-sm outline-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
{/* <button onClick={() => setShowForm(true)} className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-lg font-semibold shadow-lg hover:bg-indigo-700 transition active:scale-95">
          <Plus size={20} /> Add New Club
        </button> */}
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-8 py-5 text-[10px] font-semibold uppercase text-gray-400 tracking-widest">Club Info</th>
              <th className="px-6 py-5 text-[10px] font-semibold uppercase text-gray-400 tracking-widest">Manager / Coach</th>
              <th className="px-6 py-5 text-[10px] font-semibold uppercase text-gray-400 tracking-widest text-center">Contact</th>
              <th className="px-8 py-5 text-[10px] font-semibold uppercase text-gray-400 tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {teams.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(team => (
              <tr key={team.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-md bg-gray-50 flex items-center justify-center overflow-hidden">
                        {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-contain p-1.5" alt=""/> : <Users size={20} className="text-gray-300"/>}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 leading-tight">{team.name}</p>
                      <span className="text-[10px] font-bold text-blue-600 uppercase">#{team.code}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-700">{team.manager_name || team.coach || '-'}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Verified: {team.province || 'General'}</p>
                </td>
                <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-1">
                        {team.phone && <div className="p-1.5 bg-gray-50 text-gray-400 rounded-lg group-hover:text-green-500 transition-colors"><Phone size={14}/></div>}
                        {team.email && <div className="p-1.5 bg-gray-50 text-gray-400 rounded-lg group-hover:text-blue-500 transition-colors"><Mail size={14}/></div>}
                    </div>
                </td>
                <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => {
                            Swal.fire({
                                title: 'ลบทีมสโมสร?',
                                text: 'การลบทีมจะลบข้อมูลนักกีฬาและเจ้าหน้าที่ทั้งหมดของทีมนี้ด้วย',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#ef4444',
                                confirmButtonText: 'ยืนยันการลบ'
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    api.deleteTeam(team.id).then(() => { fetchTeams(); Swal.fire('ลบเรียบร้อย!', '', 'success'); })
                                    .catch(err => Swal.fire('ผิดพลาด', err.response?.data?.error || 'ไม่สามารถลบทีมได้', 'error'));
                                }
                            });
                        }} className="p-2.5 text-gray-300 hover:text-red-500 rounded-md transition-all"><Trash2 size={18}/></button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
