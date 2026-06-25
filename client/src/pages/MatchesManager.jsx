import React, { useEffect, useState, useCallback } from 'react';
import api, { api as apiHelper } from '../api'; // Path to your api setup
import { Trophy, Calendar, CheckCircle, Edit3, Save, X, PlusCircle, Shield, Settings } from 'lucide-react';
import Swal from 'sweetalert2';
import { Toast, Input, Button, EmptyState } from './AdminShared';
import { formatForInput, formatThaiTime, formatThaiDateTime } from '../utils';
import PreMatchSetupModal from '../components/scorer/modals/PreMatchSetupModal';

export default function MatchesManager({ competitionId, competition, onClose }) {
    const maxSets = 5; // Default fallback

    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingMatch, setEditingMatch] = useState(null); // เก็บแมตช์ที่กำลังกรอกคะแนน

    // --- [เพิ่ม] State สำหรับ Prematch Setup ---
    const [setupMatch, setSetupMatch] = useState(null);
    const [setupHomePlayers, setSetupHomePlayers] = useState([]);
    const [setupAwayPlayers, setSetupAwayPlayers] = useState([]);
    const [setupReferees, setSetupReferees] = useState(null);

    // --- [เพิ่ม] Form State สำหรับสร้างแมตช์ใหม่ ---
    const [teams, setTeams] = useState([]); // ดึงทีมที่ลงแข่งมาใส่ dropdown
    const [isCreating, setIsCreating] = useState(false);
    const [newMatchForm, setNewMatchForm] = useState({
        round_name: 'Round 1',
        match_number: '',
        home_team_id: '',
        away_team_id: '',
        start_time: '',
        location: '',
        gender: competition?.gender || 'Female', // Default
        pool_name: 'A',    // Default
        max_sets: 5
    });

    // Form State สำหรับกรอกคะแนน
    const [scoreForm, setScoreForm] = useState({
        home_set: 0,
        away_set: 0,
        sets_detail: ["", "", "", "", ""] // รองรับ 5 เซต
    });


    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. ดึงแมตช์
            const matchRes = await api.get(`/competitions/${competitionId}/matches`);
            setMatches(matchRes.data);

            // 2. ดึงทีม (เพื่อไว้สร้างแมตช์)
            // ใช้ route ที่เราเพิ่งแก้ /admin/competitions/:id/teams
            const teamRes = await api.get(`/admin/competitions/${competitionId}/teams`);
            setTeams(teamRes.data);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [competitionId]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (competition?.gender) {
            setNewMatchForm(prev => ({ ...prev, gender: competition.gender }));
        }
    }, [competition]);

    const handleGenerateMatches = async () => {
        const result = await Swal.fire({
            title: 'Create Schedule?',
            text: "System will generate Round Robin schedule automatically.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Generate'
        });

        if (result.isConfirmed) {
            try {
                await api.post(`/competitions/${competitionId}/generate-matches`);
                Swal.fire('Success', 'Matches generated!', 'success');
                fetchData();
            } catch (err) {
                Swal.fire('Error', err.response?.data?.error || 'Failed', 'error');
            }
        }
    };

    // --- [เพิ่ม] Handle Save New Match / Update Match ---
    const [editingMatchId, setEditingMatchId] = useState(null); // เก็บ ID เพื่อรู้ว่ากำลัง Edit

    const handleCreateMatch = async (e) => {
        e.preventDefault();
        // ---------------------------------------------------------
        // 1. Validation: ตรวจสอบความถูกต้องเบื้องต้น
        // ---------------------------------------------------------
        
        // 1.1 เช็คว่าเลือก Competition หรือยัง
        if (!competitionId) {
            Swal.fire('Error', 'กรุณาเลือกรายการแข่งขันก่อน (Please select a competition)', 'error');
            return;
        }

        // 1.2 เช็คว่าเลือกทีมซ้ำกันหรือไม่ (ถ้าเลือกครบทั้ง 2 ทีม)
        if (newMatchForm.home_team_id && newMatchForm.away_team_id && newMatchForm.home_team_id === newMatchForm.away_team_id) {
            Swal.fire('Warning', 'ทีมเหย้าและทีมเยือนต้องไม่ใช่ทีมเดียวกัน', 'warning');
            return;
        }

        try {
            // ---------------------------------------------------------
            // 2. Data Preparation: แปลงข้อมูลให้ตรงกับ Database Schema
            // ---------------------------------------------------------
            const payload = {
                // ต้องส่ง competition_id เสมอ และต้องเป็น Int
                competition_id: parseInt(competitionId), 
                
                // แปลง Team ID: ถ้ามีค่า ("15") -> แปลงเป็น Int (15), ถ้าไม่มี ("") -> ส่ง null
                home_team_id: newMatchForm.home_team_id ? parseInt(newMatchForm.home_team_id, 10) : null,
                away_team_id: newMatchForm.away_team_id ? parseInt(newMatchForm.away_team_id, 10) : null,
                
                // แปลง Match Number: เป็น Int หรือ null
                match_number: newMatchForm.match_number ? parseInt(newMatchForm.match_number, 10) : null,
                
                // แปลง Date: ถ้าเป็นค่าว่าง "" ให้ส่ง null (เพื่อไม่ให้ DB Error เรื่อง Timestamp)
                start_time: newMatchForm.start_time || null,
                
                // ข้อมูล String อื่นๆ (ใช้ค่าเดิม หรือถ้าว่างให้ส่ง String เปล่า/Default)
                location: newMatchForm.location || '',
                round_name: newMatchForm.round_name || 'Round 1',
                pool_name: newMatchForm.pool_name || '',
                gender: newMatchForm.gender || competition?.gender || 'Male',

                // ถ้าเป็นการแก้ไข ให้คงสถานะ (Status) เดิมไว้
                ...(editingMatchId && { status: matches.find(m => m.id === editingMatchId)?.status })
            };

            // Debug: ดูค่าจริงๆ ที่จะส่งไปหลังบ้าน (กด F12 -> Console ดูได้เลย)
            console.log("Payload sending to API:", payload); 

            // ---------------------------------------------------------
            // 3. API Interaction: ส่งข้อมูลไป Backend
            // ---------------------------------------------------------
            if (editingMatchId) {
                // --- UPDATE (แก้ไข) ---
                await api.put(`/matches/${editingMatchId}`, payload);
                Swal.fire('Success', 'อัปเดตข้อมูลการแข่งขันเรียบร้อยแล้ว', 'success');
            } else {
                // --- CREATE (สร้างใหม่) ---
                await api.post('/matches', payload);
                Swal.fire('Success', 'สร้างแมตช์การแข่งขันใหม่สำเร็จ', 'success');
            }

            // ---------------------------------------------------------
            // 4. Cleanup: เคลียร์ฟอร์มและโหลดข้อมูลใหม่
            // ---------------------------------------------------------
            // Reset ค่า แต่คงค่า Default ที่ใช้บ่อยไว้ (เช่น เพศ, รอบแข่ง) เพื่อให้กรอกคู่ต่อไปง่ายขึ้น
            setNewMatchForm({ 
                home_team_id: '', 
                away_team_id: '', 
                start_time: '', 
                location: '',
                match_number: '', 
                round_name: 'Round 1', // ตั้งค่าเริ่มต้นให้
                pool_name: '', 
                gender: competition?.gender || 'Male',         // ตั้งค่าเริ่มต้นให้
                max_sets: 5
            });
            
            setEditingMatchId(null); // ออกจากโหมดแก้ไข
            
            // โหลดตารางแข่งใหม่ทันที
            fetchData();

        } catch (error) {
            console.error("Save match error:", error);
            
            // ดึงข้อความ Error จาก Backend มาแสดง (ถ้ามี)
            const errorMsg = error.response?.data?.error || error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
            Swal.fire('Error', errorMsg, 'error');
        }
    };

    const handleEditMatch = (match) => {
        setNewMatchForm({
            round_name: match.round_name || '',
            match_number: match.match_number || '',
            home_team_id: match.home_team_id || '',
            away_team_id: match.away_team_id || '',
            start_time: match.start_time ? formatForInput(match.start_time) : '', // format local input
            location: match.location || '',
            gender: match.gender || competition?.gender || 'Female',
            pool_name: match.pool_name || 'A',
            max_sets: match.max_sets || 5
        });
        setEditingMatchId(match.id);
        setIsCreating(true); // ใช้ Modal เดียวกับ Create
    };

    const openScoreModal = (match) => {
        // แปลง set_scores จาก JSON เป็น Array หรือค่าว่าง
        let currentDetails = ["", "", "", "", ""];
        if (match.set_scores) {
            // สมมติเก็บเป็น ["25-20", "25-15", ...]
            const parsed = typeof match.set_scores === 'string' ? JSON.parse(match.set_scores) : match.set_scores;
            parsed.forEach((val, idx) => { if (idx < 5) currentDetails[idx] = val });
        }

        setScoreForm({
            home_set: match.home_set_score || 0,
            away_set: match.away_set_score || 0,
            sets_detail: currentDetails
        });
        setEditingMatch(match);
    };

    const handleSaveScore = async () => {
        try {
            // Filter เอาเฉพาะเซตที่มีการกรอกคะแนน
            const validSets = scoreForm.sets_detail.filter(s => s.trim() !== "");

            // คำนวณคะแนนเซต (Home vs Away) จากรายละเอียดเซต
            let hScore = 0;
            let aScore = 0;
            validSets.forEach(s => {
                const [h, a] = s.split('-').map(v => parseInt(v.trim()));
                if (!isNaN(h) && !isNaN(a)) {
                    if (h > a) hScore++;
                    if (a > h) aScore++;
                }
            });

            // ตัดสินผลแพ้ชนะ (เช่น Best of 5 ต้องชนะ 3, Best of 3 ต้องชนะ 2)
            const matchMaxSets = editingMatch?.max_sets || maxSets;
            const setsToWin = Math.ceil(matchMaxSets / 2);
            const isCompleted = hScore >= setsToWin || aScore >= setsToWin;

            await api.put(`/matches/${editingMatch.id}/result`, {
                home_set_score: hScore,
                away_set_score: aScore,
                set_scores: validSets,
                status: isCompleted ? 'completed' : 'scheduled'
            });

            setEditingMatch(null);
            fetchData();
            Swal.fire({
                icon: 'success',
                title: 'Saved',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (err) {
            console.error("Save score error:", err);
            Swal.fire('Error', 'Save failed', 'error');
        }
    };

    const handleOpenSetup = async (match) => {
        try {
            Swal.fire({
                title: 'Loading...',
                text: 'กำลังโหลดข้อมูลการตั้งค่าการแข่งขัน / Loading setup details...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // 1. ดึงรายละเอียดแมตช์รวมถึงข้อมูลกรรมการ
            const matchDetailsRes = await apiHelper.getMatchById(match.id);
            const m = matchDetailsRes.data;

            // 2. ดึงรายชื่อนักกีฬาของทั้งสองทีม
            const [homePlayersRes, awayPlayersRes] = await Promise.all([
                m.home_team_id ? apiHelper.getPlayersByTeam(m.home_team_id) : Promise.resolve({ data: [] }),
                m.away_team_id ? apiHelper.getPlayersByTeam(m.away_team_id) : Promise.resolve({ data: [] })
            ]);

            // Helper to map DB player format to components' expected format
            const isPlayerLibero = (p) => {
                if (!p) return false;
                const role = String(p.role || '').toUpperCase();
                const pos = String(p.position || '').toUpperCase();
                return !!(
                    p.isLibero ||
                    p.is_libero ||
                    p.is_libero1 ||
                    p.is_libero2 ||
                    role === 'L1' ||
                    role === 'L2' ||
                    role === 'L1+C' ||
                    role === 'L2+C' ||
                    role === 'L' ||
                    pos === 'L' ||
                    pos === 'L1' ||
                    pos === 'L2'
                );
            };

            const mapPlayerFields = (p) => {
                const isCap = p.is_captain === true || p.isCaptain === true || p.role === 'C' || p.role === 'L1+C' || p.role === 'L2+C';
                const isLib = isPlayerLibero(p);
                let role = p.role || '';
                if (!role) {
                    if (p.is_libero1) role = isCap ? 'L1+C' : 'L1';
                    else if (p.is_libero2) role = isCap ? 'L2+C' : 'L2';
                    else if (isLib) role = isCap ? 'L1+C' : 'L1';
                    else if (isCap) role = 'C';
                }
                return {
                    ...p,
                    isCaptain: isCap,
                    isLibero: isLib,
                    role: role
                };
            };

            const mappedHome = (homePlayersRes.data || []).map(mapPlayerFields);
            const mappedAway = (awayPlayersRes.data || []).map(mapPlayerFields);

            // 3. จัดข้อมูลกรรมการเพื่อส่งให้ Modal
            const fetchedReferees = {
                referee_1_id: m.referee_1_id || '',
                referee_2_id: m.referee_2_id || '',
                scorer_id: m.scorer_id || '',
                line_judge_1_id: m.line_judge_1_id || '',
                line_judge_2_id: m.line_judge_2_id || '',
                line_judge_3_id: m.line_judge_3_id || '',
                line_judge_4_id: m.line_judge_4_id || '',
                firstReferee: m.r1_firstname ? `${m.r1_firstname} ${m.r1_lastname}` : '',
                firstRefereeCountry: m.r1_country || '',
                secondReferee: m.r2_firstname ? `${m.r2_firstname} ${m.r2_lastname}` : '',
                secondRefereeCountry: m.r2_country || '',
                scorer: m.scorer_firstname ? `${m.scorer_firstname} ${m.scorer_lastname}` : m.scorer_name || '',
                scorerCountry: m.scorer_country || '',
                scorerCode: m.scorer_code || '',
                asstScorer: m.assistant_scorer_name || '',
                asstScorerCountry: m.assistant_scorer_country || '',
                lineJudges: [
                    m.lj1_firstname ? `${m.lj1_firstname} ${m.lj1_lastname}` : m.line_judge_1_name || '',
                    m.lj2_firstname ? `${m.lj2_firstname} ${m.lj2_lastname}` : m.line_judge_2_name || '',
                    m.lj3_firstname ? `${m.lj3_firstname} ${m.lj3_lastname}` : m.line_judge_3_name || '',
                    m.lj4_firstname ? `${m.lj4_firstname} ${m.lj4_lastname}` : m.line_judge_4_name || ''
                ],
                lineJudgesCountry: [
                    m.lj1_country || '',
                    m.lj2_country || '',
                    m.lj3_country || '',
                    m.lj4_country || ''
                ],
                rr_name: m.rr_name || '',
                rr_country: m.rr_country || '',
                rr_code: m.rr_code || '',
                rc_name: m.rc_name || '',
                rc_country: m.rc_country || '',
                rc_code: m.rc_code || '',
                assistant_scorer_name: m.assistant_scorer_name || '',
                assistant_scorer_country: m.assistant_scorer_country || '',
                assistant_scorer_code: m.assistant_scorer_code || '',
                td_name: m.td_name || '',
                td_country: m.td_country || '',
                td_code: m.td_code || '',
                rd_name: m.rd_name || '',
                rd_country: m.rd_country || '',
                rd_code: m.rd_code || '',
                setsToWin: m.max_sets ? Math.ceil(m.max_sets / 2) : 3,
            };

            setSetupHomePlayers(mappedHome);
            setSetupAwayPlayers(mappedAway);
            setSetupReferees(fetchedReferees);
            setSetupMatch(m);

            Swal.close();
        } catch (err) {
            console.error("Open Setup Error:", err);
            Swal.fire('Error', 'Failed to load match setup data', 'error');
        }
    };

    const handleSetupConfirm = async (data) => {
        try {
            Swal.fire({
                title: 'Saving...',
                text: 'กำลังบันทึกข้อมูลการตั้งค่า / Saving setup details...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const setsNeeded = parseInt(data.setsToWin, 10);
            const payload = {
                referee_1_id: data.referees.referee_1_id || null,
                referee_2_id: data.referees.referee_2_id || null,
                scorer_id: data.referees.scorer_id || null,
                scorer_name: data.referees.scorer || null,
                scorer_country: data.referees.scorerCountry || null,
                scorer_code: data.referees.scorerCode || null,
                line_judge_1_id: data.referees.line_judge_1_id || null,
                line_judge_2_id: data.referees.line_judge_2_id || null,
                line_judge_3_id: data.referees.line_judge_3_id || null,
                line_judge_4_id: data.referees.line_judge_4_id || null,
                rr_name: data.referees.rr_name || null,
                rr_country: data.referees.rr_country || null,
                rr_code: data.referees.rr_code || null,
                rc_name: data.referees.rc_name || null,
                rc_country: data.referees.rc_country || null,
                rc_code: data.referees.rc_code || null,
                assistant_scorer_name: data.referees.assistant_scorer_name || null,
                assistant_scorer_country: data.referees.assistant_scorer_country || null,
                assistant_scorer_code: data.referees.assistant_scorer_code || null,
                td_name: data.referees.td_name || null,
                td_country: data.referees.td_country || null,
                td_code: data.referees.td_code || null,
                rd_name: data.referees.rd_name || null,
                rd_country: data.referees.rd_country || null,
                rd_code: data.referees.rd_code || null,
                match_number: data.matchDetails?.matchNo || null,
                pool_name: data.matchDetails?.pool || null,
                round_name: data.matchDetails?.round || null,
                city: data.matchDetails?.city || null,
                location: data.matchDetails?.hall || null,
                country: data.matchDetails?.countryCode || null,
                max_sets: setsNeeded ? setsNeeded * 2 - 1 : 5,
                has_challenge: data.matchDetails?.hasChallenge !== undefined ? data.matchDetails.hasChallenge : null
            };

            await apiHelper.updateMatchOfficials(setupMatch.id, payload);

            setSetupMatch(null);
            fetchData();

            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'บันทึกข้อมูลการแข่งขันเรียบร้อยแล้ว / Setup details saved successfully.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6'
            });
        } catch (error) {
            console.error("Failed to update match officials during setup:", error);
            Swal.fire('Error', 'Failed to save match setup details', 'error');
        }
    };

    return (
        <div className="bg-white rounded-md shadow-lg p-6 w-full mx-auto mt-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Trophy className="text-yellow-500" /> Match Schedule
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setEditingMatchId(null);
                            setNewMatchForm({
                                round_name: 'Round 1', match_number: '', home_team_id: '', away_team_id: '',
                                start_time: '', location: '', gender: competition?.gender || 'Female', pool_name: 'A'
                            });
                            setIsCreating(true);
                        }}
                        className="bg-blue-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
                    >
                        <PlusCircle size={16} /> New Match
                    </button>

                    {matches.length === 0 && (
                        <button onClick={handleGenerateMatches} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition">
                            Generate Schedule (Round Robin)
                        </button>
                    )}
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 px-3">
                        Close
                    </button>
                </div>
            </div>

            {loading ? <p>Loading...</p> : (
                <div className="space-y-4">
                    {matches.length === 0 && <div className="text-center py-10 text-gray-400">No matches found.</div>}

                    {matches.map((match) => (
                        <div key={match.id} className="border rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:shadow-md transition bg-gray-50">

                            {/* Round Info */}
                            <div className="text-sm font-semibold text-gray-500 w-24 text-center md:text-left">
                                <div className="text-xs text-gray-400">Match {match.match_number}</div>
                                {match.round_name}
                            </div>

                            {/* Teams & Score */}
                            <div className="flex-1 flex items-center justify-center gap-6">
                                <div className="text-right w-1/3 flex items-center justify-end gap-3">
                                    <div>
                                        <div className="font-bold text-gray-800 text-base md:text-lg leading-tight">
                                            {teams.find(t => t.id == match.home_team_id)?.name || match.home_team || '-'}
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono">{match.home_team_code}</div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border shrink-0">
                                        {teams.find(t => t.id == match.home_team_id)?.logo_url ? <img src={teams.find(t => t.id == match.home_team_id).logo_url} className="w-full h-full object-contain p-0.5"/> : <Shield size={16} className="text-gray-400"/>}
                                    </div>
                                </div>

                                <div className="flex flex-col items-center">
                                    <div className="bg-gray-800 text-white px-4 py-1 rounded-md text-xl font-mono tracking-widest">
                                        {match.home_set_score} - {match.away_set_score}
                                    </div>
                                    {/* Set Details */}
                                    {match.set_scores && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {typeof match.set_scores === 'object' ? match.set_scores.join(', ') : match.set_scores}
                                        </div>
                                    )}
                                    <div className="mt-1 text-xs text-blue-600 font-medium">{match.start_time ? formatThaiDateTime(match.start_time) : 'TBD'}</div>
                                    <div className="text-[10px] text-gray-400">{match.location}</div>
                                </div>

                                <div className="text-left w-1/3 flex items-center justify-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border shrink-0">
                                        {teams.find(t => t.id == match.away_team_id)?.logo_url ? <img src={teams.find(t => t.id == match.away_team_id).logo_url} className="w-full h-full object-contain p-0.5"/> : <Shield size={16} className="text-gray-400"/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 text-base md:text-lg leading-tight">
                                            {teams.find(t => t.id == match.away_team_id)?.name || match.away_team || '-'}
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono">{match.away_team_code}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleEditMatch(match)}
                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition"
                                    title="Edit Details"
                                >
                                    <Edit3 size={18} />
                                </button>
                                <button
                                    onClick={() => openScoreModal(match)}
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition"
                                    title="Update Score"
                                >
                                    <Trophy size={18} />
                                </button>
                                <button
                                    onClick={() => handleOpenSetup(match)}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition"
                                    title="Prematch Setup"
                                >
                                    <Settings size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- Modal สร้าง/แก้ไข แมตช์ (Create/Edit Match) --- */}
            {isCreating && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col transform transition-all scale-100">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                                    <Calendar className="text-white" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight">
                                        {editingMatchId ? 'แก้ไขข้อมูลการแข่งขัน' : 'เพิ่มแมตช์การแข่งขันใหม่'}
                                    </h3>
                                    <p className="text-xs text-blue-100 font-medium">Tournament: {competition?.title || competition?.name}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setIsCreating(false); setEditingMatchId(null); }}
                                className="p-1 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateMatch} className="p-6 space-y-5 overflow-y-auto max-h-[85vh]">
                            {/* Section 1: Match Identification */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Round (รอบแข่ง)</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white border-gray-300 text-gray-900 text-sm shadow-sm"
                                        value={newMatchForm.round_name} 
                                        onChange={e => setNewMatchForm({ ...newMatchForm, round_name: e.target.value })} 
                                        required 
                                        placeholder="e.g. Round 1" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Match No. (แมตช์ที่)</label>
                                    <input 
                                        type="number" 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white border-gray-300 text-gray-900 text-sm shadow-sm"
                                        value={newMatchForm.match_number} 
                                        onChange={e => setNewMatchForm({ ...newMatchForm, match_number: e.target.value })} 
                                        placeholder="e.g. 1" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Pool / Group (สาย)</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white border-gray-300 text-gray-900 text-sm shadow-sm"
                                        value={newMatchForm.pool_name} 
                                        onChange={e => setNewMatchForm({ ...newMatchForm, pool_name: e.target.value })} 
                                        placeholder="e.g. A" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Gender (ประเภททีม)</label>
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm text-gray-900"
                                        value={newMatchForm.gender}
                                        onChange={e => setNewMatchForm({ ...newMatchForm, gender: e.target.value })}
                                        required
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Mixed">Mixed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Max Sets (จำนวนเซตตัดสิน)</label>
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm text-gray-900"
                                        value={newMatchForm.max_sets}
                                        onChange={e => setNewMatchForm({ ...newMatchForm, max_sets: parseInt(e.target.value, 10) })}
                                        required
                                    >
                                        <option value={5}>Best of 5 (ชนะ 3 ใน 5)</option>
                                        <option value={3}>Best of 3 (ชนะ 2 ใน 3)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Section 2: Competitors Selection */}
                            <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 shadow-inner">
                                <div className="text-center font-bold text-xs text-gray-400 mb-3 uppercase tracking-wider">Competitors / คู่แข่งขัน</div>
                                <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                                    {/* Home Team */}
                                    <div className="md:col-span-5 space-y-2">
                                        <label className="block text-xs font-bold uppercase text-gray-600">Home Team (ทีมเหย้า)</label>
                                        <select
                                            className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm border-gray-300 text-gray-900"
                                            value={newMatchForm.home_team_id}
                                            onChange={e => setNewMatchForm({ ...newMatchForm, home_team_id: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select Home Team --</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>[{t.code}] {t.name}</option>)}
                                        </select>
                                        {teams.find(t => t.id.toString() === newMatchForm.home_team_id.toString()) && (() => {
                                            const homeTeam = teams.find(t => t.id.toString() === newMatchForm.home_team_id.toString());
                                            return (
                                                <div className="flex items-center gap-2.5 p-2 bg-blue-50/70 border border-blue-100/80 rounded-lg animate-in fade-in duration-200">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border shrink-0">
                                                        {homeTeam.logo_url ? <img src={homeTeam.logo_url} className="w-full h-full object-contain p-0.5" alt="" /> : <Shield size={14} className="text-gray-400" />}
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="text-xs font-bold text-gray-800 truncate">{homeTeam.name}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono">{homeTeam.code}</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* VS Badge */}
                                    <div className="md:col-span-1 flex justify-center py-2 md:py-0">
                                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xs shadow-md border-2 border-white">
                                            VS
                                        </span>
                                    </div>

                                    {/* Away Team */}
                                    <div className="md:col-span-5 space-y-2">
                                        <label className="block text-xs font-bold uppercase text-gray-600">Away Team (ทีมเยือน)</label>
                                        <select
                                            className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm border-gray-300 text-gray-900"
                                            value={newMatchForm.away_team_id}
                                            onChange={e => setNewMatchForm({ ...newMatchForm, away_team_id: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select Away Team --</option>
                                            {teams
                                                .filter(t => t.id.toString() !== newMatchForm.home_team_id.toString())
                                                .map(t => <option key={t.id} value={t.id}>[{t.code}] {t.name}</option>)
                                            }
                                        </select>
                                        {teams.find(t => t.id.toString() === newMatchForm.away_team_id.toString()) && (() => {
                                            const awayTeam = teams.find(t => t.id.toString() === newMatchForm.away_team_id.toString());
                                            return (
                                                <div className="flex items-center gap-2.5 p-2 bg-blue-50/70 border border-blue-100/80 rounded-lg animate-in fade-in duration-200">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border shrink-0">
                                                        {awayTeam.logo_url ? <img src={awayTeam.logo_url} className="w-full h-full object-contain p-0.5" alt="" /> : <Shield size={14} className="text-gray-400" />}
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="text-xs font-bold text-gray-800 truncate">{awayTeam.name}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono">{awayTeam.code}</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Time and Venue */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Date (วันที่แข่งขัน)</label>
                                    <input 
                                        type="date" 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white border-gray-300 text-gray-900 text-sm shadow-sm"
                                        value={newMatchForm.start_time ? newMatchForm.start_time.split('T')[0] : ''}
                                        onChange={e => {
                                            const timePart = newMatchForm.start_time?.includes('T') ? newMatchForm.start_time.split('T')[1] : '00:00';
                                            setNewMatchForm({...newMatchForm, start_time: `${e.target.value}T${timePart}`});
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Time (เวลาแข่งขัน)</label>
                                    <input 
                                        type="time" 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white border-gray-300 text-gray-900 text-sm shadow-sm"
                                        value={newMatchForm.start_time?.includes('T') ? newMatchForm.start_time.split('T')[1] : ''}
                                        onChange={e => {
                                            const datePart = newMatchForm.start_time?.includes('T') ? newMatchForm.start_time.split('T')[0] : new Date().toISOString().split('T')[0];
                                            setNewMatchForm({...newMatchForm, start_time: `${datePart}T${e.target.value}`});
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Location / Venue (สถานที่แข่งขัน)</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white border-gray-300 text-gray-900 text-sm shadow-sm"
                                        value={newMatchForm.location} 
                                        onChange={e => setNewMatchForm({ ...newMatchForm, location: e.target.value })} 
                                        placeholder="e.g. Court 1, Main Gymnasium" 
                                    />
                                </div>
                            </div>

                            {newMatchForm.start_time && (
                                <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 text-center animate-in fade-in duration-200">
                                    <p className="text-xs text-blue-700 font-bold">
                                        📅 กำหนดการแข่งขัน: {formatThaiDateTime(newMatchForm.start_time)}
                                    </p>
                                </div>
                            )}

                            {/* Modal Actions */}
                            <div className="flex gap-3 justify-end pt-3 border-t mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setEditingMatchId(null);
                                        setNewMatchForm({
                                            round_name: 'Round 1',
                                            match_number: '',
                                            home_team_id: '',
                                            away_team_id: '',
                                            start_time: '',
                                            location: '',
                                            gender: competition?.gender || 'Female',
                                            pool_name: 'A'
                                        });
                                    }}
                                    className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {editingMatchId ? <Edit3 size={15} /> : <PlusCircle size={15} />}
                                    {editingMatchId ? "บันทึกการแก้ไข" : "สร้างแมตช์แข่งขัน"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Modal บันทึกคะแนน (Score) --- */}
            {editingMatch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Update Score</h3>
                            <button onClick={() => setEditingMatch(null)}><X size={20} /></button>
                        </div>

                        <div className="flex justify-center items-center gap-4 mb-6">
                            <div className="text-center">
                                <label className="block text-sm text-gray-500 mb-1">{editingMatch.home_team}</label>
                                <input
                                    type="number"
                                    className="w-16 text-center border rounded p-2 text-xl font-bold"
                                    value={scoreForm.home_set}
                                    onChange={e => setScoreForm({ ...scoreForm, home_set: e.target.value })}
                                />
                            </div>
                            <span className="text-2xl font-bold text-gray-300">-</span>
                            <div className="text-center">
                                <label className="block text-sm text-gray-500 mb-1">{editingMatch.away_team}</label>
                                <input
                                    type="number"
                                    className="w-16 text-center border rounded p-2 text-xl font-bold"
                                    value={scoreForm.away_set}
                                    onChange={e => setScoreForm({ ...scoreForm, away_set: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 mb-6">
                            <label className="block text-sm font-medium text-gray-700">Set Scores (Points)</label>
                            <div className="grid grid-cols-5 gap-2">
                                {scoreForm.sets_detail.map((val, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        placeholder={`S${idx + 1}`}
                                        className="border rounded p-1 text-center text-sm"
                                        value={val}
                                        onChange={(e) => {
                                            const newSets = [...scoreForm.sets_detail];
                                            newSets[idx] = e.target.value;
                                            setScoreForm({ ...scoreForm, sets_detail: newSets });
                                        }}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 text-center">Format e.g. "25-20"</p>
                        </div>

                        <button
                            onClick={handleSaveScore}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <Save size={18} /> Save Result
                        </button>
                    </div>
                </div>
            )}

            {/* --- Modal ตั้งค่าก่อนการแข่งขัน (Prematch Setup) --- */}
            {setupMatch && (
                <PreMatchSetupModal
                    isOpen={true}
                    match={setupMatch}
                    matchNo={setupMatch.matchNo || setupMatch.match_number}
                    teamHome={teams.find(t => t.id == setupMatch.home_team_id)?.name || setupMatch.home_team || ''}
                    teamAway={teams.find(t => t.id == setupMatch.away_team_id)?.name || setupMatch.away_team || ''}
                    homeRoster={setupHomePlayers}
                    awayRoster={setupAwayPlayers}
                    referees={setupReferees}
                    isSettingsOnly={false}
                    onConfirm={handleSetupConfirm}
                    onClose={() => setSetupMatch(null)}
                />
            )}
        </div>
    );
}