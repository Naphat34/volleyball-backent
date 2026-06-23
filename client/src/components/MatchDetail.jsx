import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, LogOut, User, Edit3, Shield } from "lucide-react";
import { api } from "../api";
import { formatThaiDate, formatThaiTime } from "../utils";

import whistleIcon from "../assets/img/whistle.png";
import Logo from '../assets/img/logo.png';

const MatchDetail = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // ดึงข้อมูลผู้ใช้จาก localStorage
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch {
    user = null;
  }
  const username = user?.username || user?.name || "Guest";

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  useEffect(() => {
    const fetchMatchDetail = async () => {
      try {
        const res = await api.getMatchRosterData(matchId);
        setData(res.data);
      } catch (err) {
        console.error("Error fetching match detail:", err);
        setError("ไม่สามารถโหลดข้อมูลแมตช์ได้");
      } finally {
        setLoading(false);
      }
    };
    fetchMatchDetail();
  }, [matchId]);

  if (loading) return <div className="p-10 text-center font-sans text-gray-500">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="p-10 text-center font-sans text-red-500">{error}</div>;
  if (!data || !data.match) return <div className="p-10 text-center font-sans text-gray-500">ไม่พบข้อมูลแมตช์</div>;

  const { match, home, away } = data;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navbar */}
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

      {/* Main Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 flex flex-col gap-6">
        {/* Header with Back Button 
        <div className="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl transition-all font-bold text-sm border border-gray-200 shadow-sm"
          >
            <ChevronLeft size={18} /> ย้อนกลับ
          </button>
        </div>
          */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-center text-2xl font-bold text-gray-800 mb-2">{match.competition_title || match.competition_name || "รายการแข่งขัน"}</h2>
          <div className="flex items-center justify-center gap-8 my-8 flex-wrap">
            <div className="flex items-center justify-end gap-4 text-right flex-1 min-w-[200px]">
              <span className="text-2xl font-bold text-gray-800">{match.home_team_name}</span>
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-100 shadow-sm flex-shrink-0">
                {match.home_logo_url ? (
                  <img src={match.home_logo_url} alt={match.home_team_name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Shield className="text-gray-300 w-8 h-8" />
                )}
              </div>
            </div>
            <div className="bg-gray-100 px-6 py-2 rounded-2xl text-3xl font-black tracking-widest text-gray-800">
              {match.home_set_score || 0} - {match.away_set_score || 0}
            </div>
            <div className="flex items-center justify-start gap-4 text-left flex-1 min-w-[200px]">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-100 shadow-sm flex-shrink-0">
                {match.away_logo_url ? (
                  <img src={match.away_logo_url} alt={match.away_team_name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Shield className="text-gray-300 w-8 h-8" />
                )}
              </div>
              <span className="text-2xl font-bold text-gray-800">{match.away_team_name}</span>
            </div>
          </div>

          <div className="flex justify-center items-center gap-4 text-gray-500 text-sm mb-10 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-700">คู่ที่:</span>
              {match.match_number || "-"}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-700">วันที่:</span>
              {match.start_date || match.match_date
                ? formatThaiDate(match.start_date || match.match_date, { day: 'numeric', month: 'long' })
                : "TBD"}
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-700">เวลา:</span>
              {match.start_time
                ? (match.start_time.includes('T') ? formatThaiTime(match.start_time) : match.start_time.substring(0, 5))
                : "TBD"}
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-700">สนาม:</span>
              {match.stadium_name || match.location || "-"}
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-700">รอบ:</span>
              {match.round_name || "-"}
            </div>
          </div>

          {/* Action Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            {/* Score Control Panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="text-orange-600 font-bold text-lg">Score Control</h3>
              </div>
              <div className="p-8 flex flex-col items-center justify-center flex-1 gap-8">
                <div className="bg-orange-50 p-6 rounded-[2rem]">
                   <Edit3 size={80} className="text-orange-500" />
                </div>
                <button
                  onClick={() => navigate(`/scorer/${matchId}`)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-95 text-sm"
                >
                  Go to Scorer Console
                </button>
              </div>
            </div>

            {/* Referee View Panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="text-blue-600 font-bold text-lg">Referee view</h3>
              </div>
              <div className="p-8 flex flex-col items-center justify-center flex-1 gap-8">
                <div>
                  <img src={whistleIcon} alt="Whistle Icon" className="w-40 h-40" />
                </div>
                <button
                  onClick={() => window.open(`/match/${matchId}/referee`, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all active:scale-95 text-sm"
                >
                  Open in a browser tab
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rosters Section (Players Only) */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-8 border-l-4 border-black-600 pl-4">รายชื่อนักกีฬา (Match Rosters)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Home Players */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-black-600">
                <h4 className="text-lg font-bold">{match.home_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-50 text-black-700">
                    <tr>
                      <th className="text-center py-3 px-4 w-16">รูปภาพ</th>
                      <th className="text-center py-3 px-4 w-16">No.</th>
                      <th className="text-left py-3 px-4">ชื่อ - นามสกุล</th>
                      
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {home.players && home.players.length > 0 ? home.players.map(player => (
                      <tr key={player.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <div className="w-10 h-10 mx-auto bg-gray-50 rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center">
                            {player.photo ? (
                              <img src={player.photo} alt={player.first_name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={18} className="text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 font-bold text-gray-900">{player.number}</td>
                        <td className="py-3 px-4 text-gray-700">
                          {player.first_name} {player.last_name}
                          {player.is_captain && <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md font-bold">(C)</span>}
                          {player.is_libero && <span className="ml-1 text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-md font-bold">(L)</span>}
                        </td>
                        
                      </tr>
                    )) : <tr><td colSpan="3" className="py-8 text-center text-gray-400 italic">ไม่มีข้อมูลนักกีฬา</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Away Players */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-black-600">
                <h4 className="text-lg font-bold">{match.away_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-50 text-black-700">
                    <tr>
                      <th className="text-center py-3 px-4 w-16">รูปภาพ</th>
                      <th className="text-center py-3 px-4 w-16">No.</th>
                      <th className="text-left py-3 px-4">ชื่อ - นามสกุล</th>
                      
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {away.players && away.players.length > 0 ? away.players.map(player => (
                      <tr key={player.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <div className="w-10 h-10 mx-auto bg-gray-50 rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center">
                            {player.photo ? (
                              <img src={player.photo} alt={player.first_name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={18} className="text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 font-bold text-gray-900">{player.number}</td>
                        <td className="py-3 px-4 text-gray-700">
                          {player.first_name} {player.last_name}
                          {player.is_captain && <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md font-bold">(C)</span>}
                          {player.is_libero && <span className="ml-1 text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-md font-bold">(L)</span>}
                        </td>
                      
                      </tr>
                    )) : <tr><td colSpan="3" className="py-8 text-center text-gray-400 italic">ไม่มีข้อมูลนักกีฬา</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Section (Separated) */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-8 border-l-4 border-black-500 pl-4">เจ้าหน้าที่ทีม (Team Staff)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Home Staff */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-black-600">
                <h4 className="text-lg font-bold">{match.home_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left py-2.5 px-4 w-32 font-semibold">ตำแหน่ง</th>
                      <th className="text-left py-2.5 px-4 font-semibold">ชื่อ - นามสกุล</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {home.staff && home.staff.length > 0 ? home.staff.map((s, idx) => (
                      <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-4 text-gray-500">{s.role}</td>
                        <td className="py-2.5 px-4 text-gray-800 font-medium">{s.first_name} {s.last_name}</td>
                      </tr>
                    )) : <tr><td colSpan="2" className="py-6 text-center text-gray-400 italic">ไม่มีข้อมูลสตาฟ</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Away Staff */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-black-600">
                <h4 className="text-lg font-bold">{match.away_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left py-2.5 px-4 w-32 font-semibold">ตำแหน่ง</th>
                      <th className="text-left py-2.5 px-4 font-semibold">ชื่อ - นามสกุล</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {away.staff && away.staff.length > 0 ? away.staff.map((s, idx) => (
                      <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-4 text-gray-500">{s.role}</td>
                        <td className="py-2.5 px-4 text-gray-800 font-medium">{s.first_name} {s.last_name}</td>
                      </tr>
                    )) : <tr><td colSpan="2" className="py-6 text-center text-gray-400 italic">ไม่มีข้อมูลสตาฟ</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm w-full fixed bottom-0 left-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] text-gray-500 font-medium">
        <div className="max-w-7xl mx-auto px-4">
          &copy; {new Date().getFullYear()} Volleyball Scorer Console. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default MatchDetail;