import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, User, Trophy, ChevronLeft, Swords, Menu, X } from 'lucide-react';
import apiClient, { api } from '../../api';
import Swal from 'sweetalert2';

const getServerUrl = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  return url.replace(/\/api$/, '').replace(/\/$/, '');
};
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
          const compsRes = await api.getOpenCompetitions();
          const allComps = compsRes.data || [];
          setCompetitions(allComps);

          const selected = allComps.find(c => String(c.id) === String(compId));
          if (selected) {
            setSelectedCompetition(selected);
            const selectedRawTitle = selected.competition_title || selected.title || '';
            const selectedCleanTitle = selectedRawTitle.replace(/\s*\(?(Men|Women|Male|Female|ชาย|หญิง)\)?$/i, '').trim();
            const matchingComps = allComps.filter((c) => {
              const cRawTitle = c.competition_title || c.title || '';
              const cCleanTitle = cRawTitle.replace(/\s*\(?(Men|Women|Male|Female|ชาย|หญิง)\)?$/i, '').trim();
              return cCleanTitle === selectedCleanTitle;
            });

            const matchPromises = matchingComps.map((c) =>
              apiClient.get(`/competitions/${c.id}/matches?t=${Date.now()}`)
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

  // กรองรายการที่สถานะเป็น OPEN ล่วงหน้า, รองรับตัวพิมพ์เล็ก/ใหญ่ และกรองรายการซ้ำ โดยไม่แสดงและไม่ซ้ำตามเพศ (Male/Female/ชาย/หญิง)
  const openCompetitions = [];
  const seenTitles = new Set();
  competitions.forEach((c) => {
    if (c.status?.toUpperCase() === 'OPEN') {
      const rawTitle = c.competition_title || c.title || '';
      const cleanTitle = rawTitle.replace(/\s*\(?(Men|Women|Male|Female|ชาย|หญิง)\)?$/i, '').trim();
      if (!seenTitles.has(cleanTitle)) {
        seenTitles.add(cleanTitle);
        openCompetitions.push({
          ...c,
          display_title: cleanTitle
        });
      }
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Navbar - Light Theme & Removed Middle Menu */}
      <nav className="bg-white border-b border-blue-100 w-full sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden">
                <img src={Logo} alt="Logo" className="w-9 h-9 object-contain" />
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold text-blue-950">Volleyball</div>
                <div className="text-xs font-medium text-slate-500">Scorer Console</div>
              </div>
            </div>

            {/* Right Section: User Info + Logout */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 text-slate-700 font-medium bg-blue-50/60 px-3 py-1.5 rounded-md border border-blue-100">
                <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white">
                  <User size={16} />
                </div>
                <span className="text-sm">{username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-blue-700 hover:bg-blue-50 font-semibold text-sm transition-colors"
              >
                <LogOut size={17} />
                Logout
              </button>
            </div>

            {/* Mobile Toggle */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-md text-blue-700 hover:bg-blue-50 transition-colors"
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden bg-white border-t border-blue-50 px-4 py-4 space-y-3">
            <div className="flex items-center gap-3 px-3 py-3 bg-blue-50 rounded-md border border-blue-100">
              <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center text-white">
                <User size={20} />
              </div>
              <div className="flex flex-col">
                 <span className="text-blue-950 font-semibold leading-none">{username}</span>
                 <span className="text-xs text-gray-500 mt-1 uppercase font-semibold">Match Scorer</span>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center justify-center gap-2 py-2.5 text-blue-700 font-semibold bg-white hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className={`flex-1 p-4 sm:p-6 lg:p-8 pb-24 ${view === 'menu' ? 'flex items-center justify-center' : ''}`}>
        {view === 'menu' ? (
          <div className="w-full max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Champion Grid */}
            <div 
              onClick={handleShowChampions}
              className="bg-white rounded-lg border border-blue-100 p-8 flex flex-col items-center justify-center text-center transition-colors hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer group shadow-sm"
            >
              <div className="bg-blue-50 p-5 rounded-lg mb-5 border border-blue-100 group-hover:bg-blue-100 transition-colors">
                 <img src={trophyIcon} alt="Trophy Icon" className="w-16 h-16" />
              </div>
              <h2 className="text-xl font-bold text-blue-950 mb-2">Champion</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                จัดการข้อมูลการแข่งขัน <br/> ผลการแข่งขัน
              </p>
            </div>

            {/* Match Data Grid */}
            <div onClick={handleShowChampions} className="bg-white rounded-lg border border-blue-100 p-8 flex flex-col items-center justify-center text-center transition-colors hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer group shadow-sm">
              <div className="bg-blue-50 p-5 rounded-lg mb-5 border border-blue-100 group-hover:bg-blue-100 transition-colors">
                 <img src={databaseIcon} alt="Database Icon" className="w-16 h-16" />
              </div>
              <h2 className="text-xl font-bold text-blue-950 mb-2">Match Data</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                ข้อมูลการแข่งขัน <br/> และจัดการผลการแข่งทั้งหมด
              </p>
            </div>
            </div>
          </div>
        ) : view === 'champions' ? (
          <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSearchParams({ view: 'menu' })} 
                  className="flex items-center gap-2 px-3 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-md transition-colors font-semibold text-sm border border-blue-200"
                >
                  <ChevronLeft size={18} /> ย้อนกลับ
                </button>
              </div>
            </div>
            
            {isLoading ? (
              <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">กำลังโหลดข้อมูล...</div>
            ) : (
              <div className="bg-white rounded-lg border border-blue-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-blue-50/60 border-b border-blue-100">
                        <th className="px-6 py-4 text-base font-bold text-blue-950">รายการแข่งขัน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {openCompetitions.length > 0 ? (
                        openCompetitions.map(comp => (
                          <tr 
                            key={comp.id} 
                            onClick={() => handleShowMatches(comp)}
                            className="group hover:bg-blue-50/50 transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-md bg-white border border-blue-100 overflow-hidden flex-shrink-0 flex items-center justify-center group-hover:border-blue-300 transition-colors">
                                  {comp.logo ? (
                            <img 
                              src={comp.logo.startsWith('http') ? comp.logo : `${getServerUrl()}/uploads/${comp.logo}`} 
                              alt={comp.display_title || comp.competition_title || comp.title} 
                             className="w-full h-full object-cover p-1"
                              onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=No+Image'; }}
                            />
                          ) : (
                            <Trophy className="text-slate-300" size={24} />
                          )}
                        </div>
                                <div>
                                  <p className="font-semibold text-slate-800 leading-tight">{comp.display_title || comp.competition_title || comp.title}</p>
                                  <p className="text-xs text-slate-500 mt-1">{comp.location || 'ไม่ได้ระบุสถานที่'}</p>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSearchParams({ view: 'champions' })} 
                  className="flex items-center gap-2 px-3 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-md transition-colors font-semibold text-sm border border-blue-200"
                >
                  <ChevronLeft size={18} /> ย้อนกลับ
                </button>
                <h2 className="text-xl font-bold text-blue-950">
                  {(selectedCompetition?.competition_title || selectedCompetition?.title || '').replace(/\s*\(?(Men|Women|Male|Female|ชาย|หญิง)\)?$/i, '').trim()}
                </h2>
              </div>
            </div>
            
            {isLoading ? (
              <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">กำลังโหลดแมตช์...</div>
            ) : (
              <div className="bg-white rounded-lg border border-blue-100 p-4 shadow-sm">
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
      <footer className="bg-white border-t border-blue-100 py-3 text-center text-xs w-full fixed bottom-0 left-0 z-20">
        <p className="text-slate-500">
          Copyright {new Date().getFullYear()} Volley Manager. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default AdminScorer;
