import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import { Users, User, Hash, Image as ImageIcon, Trophy, CheckCircle2, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { formatThaiDate } from '../utils';

export default function CreateTeam() {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    coach: '',
    logo_url: ''
  });
  const [competitions, setCompetitions] = useState([]); 
  const [selectedCompId, setSelectedCompId] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ดึงรายการแข่งขันที่สถานะเป็น Open เท่านั้น
  useEffect(() => {
    const fetchOpenCompetitions = async () => {
      try {
        const res = await api.getOpenCompetitions();
        setCompetitions(res.data);
      } catch (err) {
        console.error("Failed to fetch open competitions", err);
      }
    };
    fetchOpenCompetitions();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. สร้างทีม (รองรับทั้ง User และ Admin ที่ login อยู่)
      await api.createMyTeam(formData);
      
      // 2. หากเลือกรายการแข่งขันไว้ ให้เข้าร่วมทันที
      if (selectedCompId) {
        await api.joinCompetition({ competition_id: selectedCompId });
      }
      
      alert("ทีมถูกสร้างและลงทะเบียนเรียบร้อยแล้ว!");
      
      // ตรวจสอบสิทธิ์เพื่อเลือกหน้า Redirect
      const user = JSON.parse(localStorage.getItem('user'));
      if (user?.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/team-dashboard');
      }
      window.location.reload(); 

    } catch (err) {
      alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการสร้างทีม");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 lg:p-10 font-sans">
      <div className="bg-white w-full p-8 lg:p-14 rounded-[2.5rem] shadow-2xl overflow-hidden">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
            <div className="text-left">
                <h1 className="text-4xl lg:text-5xl font-semibold text-gray-900 tracking-tight">
                    New <span className="text-blue-600">Club</span> Registration
                </h1>
                <p className="text-gray-400 mt-3 text-lg font-medium italic">ลงทะเบียนสโมสรใหม่และเข้าร่วมการแข่งขัน</p>
            </div>
            <div className="bg-blue-50 p-5 rounded-[2rem] hidden md:block">
                <Users className="w-12 h-12 text-blue-600" />
            </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* คอลัมน์ซ้าย: ข้อมูลทีม */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">1</div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-900">Club Profile</h3>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Team Name</label>
                    <input 
                        type="text" name="name" placeholder="ชื่อทีมสโมสร" required
                        className="w-full px-6 py-4 bg-gray-50 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-gray-800 shadow-sm shadow-gray-100"
                        onChange={handleChange}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Code</label>
                        <input 
                            type="text" name="code" placeholder="เช่น THA" maxLength={10} required
                            className="w-full px-6 py-4 bg-gray-50 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-mono font-semibold uppercase text-blue-600 shadow-sm shadow-gray-100"
                            onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                            value={formData.code}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Coach</label>
                        <input 
                            type="text" name="coach" placeholder="ชื่อผู้ฝึกสอน"
                            className="w-full px-6 py-4 bg-gray-50 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-gray-800 shadow-sm shadow-gray-100"
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Logo URL</label>
                    <input 
                        type="url" name="logo_url" placeholder="https://image-link.com/logo.png"
                        className="w-full px-6 py-4 bg-gray-50 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all shadow-sm shadow-gray-100"
                        onChange={handleChange}
                    />
                </div>
            </div>
          </div>

          {/* คอลัมน์ขวา: เลือกการแข่งขัน */}
          <div className="space-y-8">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">2</div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-900">Select Competition</h3>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-[2rem] space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {competitions.length === 0 ? (
                    <div className="text-center py-10 opacity-40">
                        <Trophy size={48} className="mx-auto mb-4" />
                        <p className="font-bold">ไม่มีรายการที่เปิดรับสมัคร</p>
                    </div>
                ) : (
                    competitions.map((comp) => (
                        <div 
                            key={comp.id}
                            onClick={() => setSelectedCompId(selectedCompId === comp.id ? null : comp.id)}
                            className={`group relative flex items-center gap-4 p-5 rounded-3xl cursor-pointer transition-all duration-300 ${
                                selectedCompId === comp.id 
                                ? 'bg-blue-600 text-white shadow-xl shadow-indigo-200 scale-[1.03]' 
                                : 'bg-white hover:bg-blue-50'
                            }`}
                        >
                            <div className={`p-3 rounded-lg transition-colors ${selectedCompId === comp.id ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
                                <Trophy size={22} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-semibold text-sm ${selectedCompId === comp.id ? 'text-white' : 'text-gray-900'}`}>{comp.title}</p>
                                <div className={`flex gap-3 text-[10px] mt-1 font-bold ${selectedCompId === comp.id ? 'text-indigo-100' : 'text-gray-400'}`}>
                                    <span className="flex items-center gap-1"><MapPin size={12} /> {comp.location}</span>
                                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatThaiDate(comp.start_date)}</span>
                                </div>
                            </div>
                            {selectedCompId === comp.id && <CheckCircle2 className="text-white" size={24} />}
                        </div>
                    ))
                )}
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-blue-600 text-white font-semibold text-xl rounded-3xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
                {loading ? 'Processing...' : (
                    <>
                        Complete Registration <ChevronRight size={24} />
                    </>
                )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}