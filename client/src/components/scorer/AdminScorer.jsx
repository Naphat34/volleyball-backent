import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, User, Trophy, ChevronLeft, Swords, Calendar, MapPin, PlayCircle, X, CheckCircle, FileText } from 'lucide-react';
import { api } from '../../api';
import axios from 'axios';
import Swal from 'sweetalert2';
import MatchList from '../MatchList';

import databaseIcon from '../../assets/img/database.png';
import trophyIcon from '../../assets/img/trophy.png';
import Logo from '../../assets/img/logo.png';

const AdminScorer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'menu';
  const compId = searchParams.get('compId');

  const [competitions, setCompetitions] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadInitialData = async () => {
      if (view === 'champions') {
        setIsLoading(true);
        try {
          const res = await api.getOpenCompetitions();
          setCompetitions(res.data || []);
        } catch (error) {
          console.error("Error fetching competitions:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (view === 'matches' && compId) {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('token');
          const compsRes = await api.getOpenCompetitions();
          const allComps = compsRes.data || [];
          setCompetitions(allComps);

          const selected = allComps.find(c => String(c.id) === String(compId));
          if (selected) {
            setSelectedCompetition(selected);
            const compTitle = selected.competition_title || selected.title;
            const matchingComps = allComps.filter(
              (c) => (c.competition_title || c.title) === compTitle
            );

            const matchPromises = matchingComps.map((c) =>
              axios.get(`http://localhost:3000/api/competitions/${c.id}/matches?t=${Date.now()}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
            );

            const responses = await Promise.all(matchPromises);
            const allMatches = responses.flatMap((res) => res.data || []);

            allMatches.sort((a, b) => {
              const numA = parseInt(a.match_number, 10);
              const numB = parseInt(b.match_number, 10);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return (a.match_number || '').localeCompare(b.match_number || '');
            });

            setMatches(allMatches);
          } else {
            setSelectedCompetition(null);
          }
        } catch (error) {
          console.error("Error fetching matches:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadInitialData();
  }, [view, compId]);

  // ดึงข้อมูลผู้ใช้จาก localStorage
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch {
    user = null;
  }
  const username = user?.username || user?.name || "Guest";

  // ฟังก์ชัน logout
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const handleShowChampions = () => {
    setSearchParams({ view: 'champions' });
  };

  const handleShowMatches = (comp) => {
    setSearchParams({ view: 'matches', compId: comp.id });
  };

  // กรองรายการที่สถานะเป็น OPEN ล่วงหน้า, รองรับตัวพิมพ์เล็ก/ใหญ่ และกรองรายการซ้ำ
  const openCompetitions = [];
  const seenTitles = new Set();
  competitions.forEach((c) => {
    if (c.status?.toUpperCase() === 'OPEN') {
      const titleKey = (c.competition_title || c.title || '').trim();
      if (!seenTitles.has(titleKey)) {
        seenTitles.add(titleKey);
        openCompetitions.push(c);
      }
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navbar - Light Theme & Removed Middle Menu */}
      <nav className="bg-white border-b border-gray-200 w-full shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <div>
                <img src={Logo} alt="Logo" className="w-15 h-15" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight uppercase">Volleyball</span>
              <span className="text-xl font-bold text-gray-900 tracking-tight uppercase">Scorer Console</span>
            </div>

            {/* Right Section: User Info + Logout */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="flex items-center gap-2 text-gray-600 font-medium bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                  <User size={16} />
                </div>
                <span className="text-sm">{username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-500 hover:text-red-600 font-bold text-sm transition-colors group"
              >
                <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" /> 
                Logout
              </button>
            </div>

            {/* Mobile Toggle */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {isOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden bg-white border-t border-gray-50 px-4 pt-2 pb-6 space-y-3 shadow-inner">
            <div className="flex items-center gap-3 px-2 py-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md">
                <User size={20} />
              </div>
              <div className="flex flex-col">
                 <span className="text-gray-900 font-bold leading-none">{username}</span>
                 <span className="text-xs text-gray-500 mt-1 uppercase font-semibold">Match Scorer</span>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center justify-center gap-2 py-3 text-red-600 font-bold bg-red-50 hover:bg-red-100 rounded-xl transition-colors mt-2"
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className={`flex-1 p-4 lg:p-10 pb-24 ${view === 'menu' ? 'flex items-center justify-center' : ''}`}>
        {view === 'menu' ? (
          <div className="max-w-3xl w-full grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Champion Grid */}
            <div 
              onClick={handleShowChampions}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 flex flex-col items-center justify-center text-center transition-all hover:shadow-xl hover:-translate-y-1.5 cursor-pointer group"
            >
              <div className="bg-amber-50 p-8 rounded-[2rem] mb-6 group-hover:bg-amber-100 transition-all duration-500 group-hover:rotate-6">
                 <img src={trophyIcon} alt="Trophy Icon" className="w-20 h-20" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter">CHAMPION</h2>
              <p className="text-slate-400 font-bold text-lg leading-relaxed">
                จัดการข้อมูลการแข่งขัน <br/> ผลการแข่งขัน
              </p>
            </div>

            {/* Match Data Grid */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 flex flex-col items-center justify-center text-center transition-all hover:shadow-xl hover:-translate-y-1.5 cursor-pointer group">
              <div className="bg-blue-50 p-8 rounded-[2rem] mb-6 group-hover:bg-blue-100 transition-all duration-500 group-hover:-rotate-6">
                 <img src={databaseIcon} alt="Database Icon" className="w-20 h-20" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter">MATCH DATA</h2>
              <p className="text-slate-400 font-bold text-lg leading-relaxed">
                ข้อมูลการแข่งขัน <br/> และจัดการผลการแข่งทั้งหมด
              </p>
            </div>
          </div>
        ) : view === 'champions' ? (
          <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSearchParams({ view: 'menu' })} 
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-all font-bold text-sm border border-slate-200 shadow-sm"
                >
                  <ChevronLeft size={18} /> ย้อนกลับ
                </button>
              </div>
            </div>
            
            {isLoading ? (
              <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">กำลังโหลดข้อมูล...</div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-gray-100">
                        <th className="px-8 py-5 text-xl font-black text-slate-800 uppercase">รายการแข่งขัน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {openCompetitions.length > 0 ? (
                        openCompetitions.map(comp => (
                          <tr 
                            key={comp.id} 
                            onClick={() => handleShowMatches(comp)}
                            className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                          >
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center group-hover:border-amber-200 transition-colors">
                                  {comp.logo ? (
                            <img 
                              src={comp.logo.startsWith('http') ? comp.logo : `http://localhost:3000/uploads/${comp.logo}`} 
                              alt={comp.competition_title} 
                              className="w-full h-full object-cover p-1"
                              onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=No+Image'; }}
                            />
                          ) : (
                            <Trophy className="text-slate-300" size={24} />
                          )}
                        </div>
                                <div>
                                  <p className="font-bold text-slate-800 text-lg leading-tight">{comp.competition_title || comp.title}</p>
                                  <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-tighter">{comp.location || 'ไม่ได้ระบุสถานที่'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">ไม่พบรายการแข่งขันที่มีสถานะ "เปิด"</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : view === 'matches' ? (
          <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSearchParams({ view: 'champions' })} 
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-all font-bold text-sm border border-slate-200 shadow-sm"
                >
                  <ChevronLeft size={18} /> ย้อนกลับ
                </button>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
                  {selectedCompetition?.competition_title || selectedCompetition?.title}
                </h2>
              </div>
            </div>
            
            {isLoading ? (
              <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">กำลังโหลดแมตช์...</div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <MatchList 
                  matches={matches} 
                  isAdmin={true} 
                  onClick={(m) => window.open(`/match/${m.id}`, '_blank')}
                  onScore={(m) => navigate(`/match/${m.id}`)}
                />
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm w-full fixed bottom-0 left-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        <p className="text-gray-500 font-medium">
          © {new Date().getFullYear()} Volley Manager. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default AdminScorer;
