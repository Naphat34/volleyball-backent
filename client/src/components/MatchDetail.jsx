import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LogOut, User, Edit3, Shield, Menu, X } from "lucide-react";
import { api } from "../api";
import { cleanCompetitionTitle, formatThaiDate, formatThaiTime } from "../utils";

import whistleIcon from "../assets/img/whistle.png";
import Logo from '../assets/img/logo.png';
import backgroundImage from '../assets/img/bg.png';

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

  const normalizeDisplayText = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value).trim();
    return text === "0" ? "" : text;
  };

  const getPlayerName = (player = {}) => {
    const fullName = normalizeDisplayText(player.name || player.full_name);
    if (fullName) return fullName;

    const firstName = normalizeDisplayText(player.first_name || player.firstname);
    const lastName = normalizeDisplayText(player.last_name || player.lastname);
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
    return displayName || "-";
  };

  const getPlayerNumber = (player = {}) => {
    const number = normalizeDisplayText(player.number || player.jersey_number || player.shirt_number);
    return number || "-";
  };

  const isTruthyFlag = (value) => value === true || value === "true" || Number(value) === 1;

  const isLiberoPlayer = (player = {}) => {
    const role = String(player.role || player.position || "").trim().toUpperCase();
    return (
      isTruthyFlag(player.is_libero) ||
      isTruthyFlag(player.is_libero1) ||
      isTruthyFlag(player.is_libero2) ||
      role === "L" ||
      role === "LIBERO" ||
      role === "L1" ||
      role === "L2"
    );
  };

  const getLiberoBadge = (player = {}) => {
    const role = String(player.role || player.position || "").trim().toUpperCase();
    if (isTruthyFlag(player.is_libero1) || role === "L1") return "L1";
    if (isTruthyFlag(player.is_libero2) || role === "L2") return "L2";
    if (isLiberoPlayer(player)) return "L";
    return "";
  };

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
    <div
      className="min-h-screen flex flex-col font-sans text-slate-800 bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Navbar */}
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
                       <span className="text-xs text-slate-500 mt-1 font-medium">Match Scorer</span>
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

      {/* Main Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 flex flex-col gap-6">
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
        <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-5 sm:p-7">
          <h2 className="text-center text-xl font-bold text-blue-950 mb-2">{cleanCompetitionTitle(match.competition_title || match.competition_name) || "รายการแข่งขัน"}</h2>
          <div className="flex items-center justify-center gap-6 my-7 flex-wrap">
            <div className="flex items-center justify-end gap-4 text-right flex-1 min-w-[200px]">
              <span className="text-xl font-bold text-slate-800">{match.home_team_name}</span>
              <div className="w-14 h-14 bg-blue-50 rounded-md flex items-center justify-center overflow-hidden border border-blue-100 flex-shrink-0">
                {match.home_logo_url ? (
                  <img src={match.home_logo_url} alt={match.home_team_name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Shield className="text-gray-300 w-8 h-8" />
                )}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 px-5 py-2 rounded-md text-2xl font-bold text-blue-950">
              {match.home_set_score || 0} - {match.away_set_score || 0}
            </div>
            <div className="flex items-center justify-start gap-4 text-left flex-1 min-w-[200px]">
              <div className="w-14 h-14 bg-blue-50 rounded-md flex items-center justify-center overflow-hidden border border-blue-100 flex-shrink-0">
                {match.away_logo_url ? (
                  <img src={match.away_logo_url} alt={match.away_team_name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Shield className="text-gray-300 w-8 h-8" />
                )}
              </div>
              <span className="text-xl font-bold text-slate-800">{match.away_team_name}</span>
            </div>
          </div>

          <div className="flex justify-center items-center gap-x-4 gap-y-2 text-slate-500 text-sm mb-8 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">คู่ที่:</span>
              {match.match_number || "-"}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">วันที่:</span>
              {match.start_date || match.match_date
                ? formatThaiDate(match.start_date || match.match_date)
                : "TBD"}
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">เวลา:</span>
              {match.start_time
                ? (match.start_time.includes('T') ? formatThaiTime(match.start_time) : match.start_time.substring(0, 5))
                : "TBD"}
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">สนาม:</span>
              {match.stadium_name || match.location || "-"}
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">รอบ:</span>
              {match.round_name || "-"}
            </div>
          </div>

          {/* Action Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Score Control Panel */}
            <div className="bg-white rounded-lg border border-blue-100 overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-blue-100 bg-blue-50/60">
                <h3 className="text-blue-800 font-semibold">Score Control</h3>
              </div>
              <div className="p-6 flex flex-col items-center justify-center flex-1 gap-5">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                   <Edit3 size={48} className="text-blue-600" />
                </div>
                <button
                  onClick={() => navigate(`/scorer/${matchId}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-md transition-colors text-sm"
                >
                  Go to Scorer Console
                </button>
              </div>
            </div>

            {/* Referee View Panel */}
            <div className="bg-white rounded-lg border border-blue-100 overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-blue-100 bg-blue-50/60">
                <h3 className="text-blue-800 font-semibold">Referee view</h3>
              </div>
              <div className="p-6 flex flex-col items-center justify-center flex-1 gap-5">
                <div>
                  <img src={whistleIcon} alt="Whistle Icon" className="w-20 h-20 object-contain" />
                </div>
                <button
                  onClick={() => window.open(`/match/${matchId}/referee`, '_blank')}
                  className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-semibold py-2.5 px-6 rounded-md transition-colors text-sm"
                >
                  Open in a browser tab
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rosters Section (Players Only) */}
        <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-5 sm:p-7">
          <h3 className="text-lg font-bold text-blue-950 mb-6 border-l-4 border-blue-600 pl-3">รายชื่อนักกีฬา (Match Rosters)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Home Players */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-blue-200">
                <h4 className="font-semibold text-blue-950">{match.home_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-md border border-blue-100">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-blue-50/60 text-slate-600">
                    <tr>
                      <th className="text-center py-3 px-4 w-16">รูปภาพ</th>
                      <th className="text-center py-3 px-4 w-16">No.</th>
                      <th className="text-left py-3 px-4">ชื่อ - นามสกุล</th>
                      
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {home.players && home.players.length > 0 ? home.players.map(player => (
                      <tr key={player.id} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <div className="w-10 h-10 mx-auto bg-slate-50 rounded-md overflow-hidden border border-blue-100 flex items-center justify-center">
                            {player.photo ? (
                              <img src={player.photo} alt={getPlayerName(player)} className="w-full h-full object-cover" />
                            ) : (
                              <User size={18} className="text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 font-bold text-blue-950">{getPlayerNumber(player)}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {getPlayerName(player)}
                          {player.is_captain && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">(C)</span>}
                          {getLiberoBadge(player) && <span className="ml-1 text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-md font-bold">({getLiberoBadge(player)})</span>}
                        </td>
                        
                      </tr>
                    )) : <tr><td colSpan="3" className="py-8 text-center text-gray-400 italic">ไม่มีข้อมูลนักกีฬา</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Away Players */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-blue-200">
                <h4 className="font-semibold text-blue-950">{match.away_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-md border border-blue-100">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-blue-50/60 text-slate-600">
                    <tr>
                      <th className="text-center py-3 px-4 w-16">รูปภาพ</th>
                      <th className="text-center py-3 px-4 w-16">No.</th>
                      <th className="text-left py-3 px-4">ชื่อ - นามสกุล</th>
                      
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {away.players && away.players.length > 0 ? away.players.map(player => (
                      <tr key={player.id} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <div className="w-10 h-10 mx-auto bg-slate-50 rounded-md overflow-hidden border border-blue-100 flex items-center justify-center">
                            {player.photo ? (
                              <img src={player.photo} alt={getPlayerName(player)} className="w-full h-full object-cover" />
                            ) : (
                              <User size={18} className="text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 font-bold text-blue-950">{getPlayerNumber(player)}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {getPlayerName(player)}
                          {player.is_captain && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">(C)</span>}
                          {getLiberoBadge(player) && <span className="ml-1 text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-md font-bold">({getLiberoBadge(player)})</span>}
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
        <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-5 sm:p-7">
          <h3 className="text-lg font-bold text-blue-950 mb-6 border-l-4 border-blue-600 pl-3">เจ้าหน้าที่ทีม (Team Staff)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Home Staff */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-blue-200">
                <h4 className="font-semibold text-blue-950">{match.home_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-md border border-blue-100">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-blue-50/60 text-slate-600">
                    <tr>
                      <th className="text-left py-2.5 px-4 w-32 font-semibold">ตำแหน่ง</th>
                      <th className="text-left py-2.5 px-4 font-semibold">ชื่อ - นามสกุล</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {home.staff && home.staff.length > 0 ? home.staff.map((s, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors">
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
              <div className="flex items-center gap-3 pb-2 border-b border-blue-200">
                <h4 className="font-semibold text-blue-950">{match.away_team_name}</h4>
              </div>
              <div className="overflow-hidden rounded-md border border-blue-100">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-blue-50/60 text-slate-600">
                    <tr>
                      <th className="text-left py-2.5 px-4 w-32 font-semibold">ตำแหน่ง</th>
                      <th className="text-left py-2.5 px-4 font-semibold">ชื่อ - นามสกุล</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {away.staff && away.staff.length > 0 ? away.staff.map((s, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors">
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
      <footer className="bg-white border-t border-blue-100 py-3 text-center text-xs w-full fixed bottom-0 left-0 z-30 text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          &copy; {new Date().getFullYear()} Volleyball Scorer Console. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default MatchDetail;
