import React, { useState, useEffect } from 'react';
import {
    X,
    ChevronRight,
    ChevronLeft,
    ChevronsRight,
    RotateCcw,
    AlertCircle,
    Users,
    Info,
    Calendar,
    MapPin,
    User
} from 'lucide-react';
import { api } from '../../../api';

// Helper Component for Inputs
const InputField = ({ label, value, onChange, placeholder }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</label>
        <input
            type="text"
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 outline-none text-sm font-semibold hover:border-slate-350 focus:border-indigo-500 focus:bg-white transition-all"
        />
    </div>
);

// Helper Component for Selects
const SelectField = ({ label, value, onChange, options }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</label>
        <div className="relative">
            <select
                value={value || ''}
                onChange={onChange}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 outline-none text-sm font-semibold hover:border-slate-350 focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
            >
                <option value="" className="text-slate-500">-- เลือกเจ้าหน้าที่ / Select --</option>
                {options.map(opt => (
                    <option key={opt.id} value={opt.id}>
                        {opt.firstname} {opt.lastname} ({opt.country || '-'})
                    </option>
                ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
    </div>
);

const PreMatchSetupModal = ({ isOpen, match, teamHome, teamAway, homeRoster, awayRoster, activeHome = [], activeAway = [], onConfirm, onClose, matchNo, referees, isSettingsOnly = false }) => {
    const [step, setStep] = useState(isSettingsOnly ? 3 : 1); // 1 = Home Roster, 2 = Away Roster, 3 = Match Details & Officials

    // Master list of officials
    const [refereesList, setRefereesList] = useState([]);
    const [scorersList, setScorersList] = useState([]);
    const [lineJudgesList, setLineJudgesList] = useState([]);

    // --- State for Match Rules & Referees ---
    const [rules, setRules] = useState(() => {
        const defaultRules = {
            setsToWin: 3,
            firstReferee: '',
            firstRefereeCountry: '',
            secondReferee: '',
            secondRefereeCountry: '',
            scorer: '',
            scorerCountry: '',
            asstScorer: '',
            asstScorerCountry: '',
            lineJudges: ['', '', '', ''],
            lineJudgesCountry: ['', '', '', ''],
            referee_1_id: '',
            referee_2_id: '',
            scorer_id: '',
            line_judge_1_id: '',
            line_judge_2_id: '',
            line_judge_3_id: '',
            line_judge_4_id: '',
            rr_name: '',
            rr_country: '',
            rr_code: '',
            rc_name: '',
            rc_country: '',
            rc_code: '',
            assistant_scorer_name: '',
            assistant_scorer_country: '',
            assistant_scorer_code: '',
            td_name: '',
            td_country: '',
            td_code: '',
            rd_name: '',
            rd_country: '',
            rd_code: '',
        };
        if (referees) {
            return {
                ...defaultRules,
                ...referees
            };
        }
        return defaultRules;
    });

    const [matchDetails, setMatchDetails] = useState({
        matchNo: matchNo || match?.matchNo || match?.match_number || '',
        round: match?.round || match?.round_name || '',
        pool: match?.pool || match?.pool_name || '',
        matchDate: match?.matchDate || match?.match_date || '',
        startTime: match?.startTime || match?.start_time || '',
        countryCode: match?.countryCode || match?.country || '',
        city: match?.city || '',
        hall: match?.hall || match?.location || match?.stadium_name || '',
        hasChallenge: match?.hasChallenge !== undefined ? match.hasChallenge : (match?.has_challenge !== undefined ? match.has_challenge : false),
    });

    // Fetch master list of officials
    useEffect(() => {
        const fetchOfficials = async () => {
            try {
                const [refs, scrs, ljs] = await Promise.all([
                    api.getAllReferees(),
                    api.getAllScorers(),
                    api.getAllLineJudges()
                ]);
                setRefereesList(refs.data || []);
                setScorersList(scrs.data || []);
                setLineJudgesList(ljs.data || []);
            } catch (err) {
                console.warn("Could not fetch officials inside PreMatchSetupModal", err);
            }
        };
        fetchOfficials();
    }, []);

    const initTeam = (masterRoster, activeRoster) => {
        if (!masterRoster) return [];
        return masterRoster.map(p => {
            const isActive = activeRoster && activeRoster.length > 0 
                ? activeRoster.some(a => String(a.id) === String(p.id) || String(a.player_id) === String(p.id)) 
                : true;

            const activePlayer = activeRoster && activeRoster.find(a => String(a.id) === String(p.id) || String(a.player_id) === String(p.id));

            const isCap = activePlayer 
                ? (activePlayer.isCaptain === true || activePlayer.is_captain === true || activePlayer.role === 'C' || activePlayer.role === 'L1+C' || activePlayer.role === 'L2+C')
                : (p.is_captain === true || p.isCaptain === true || p.role === 'C');

            const isLib = activePlayer
                ? (activePlayer.isLibero === true || activePlayer.role === 'L1' || activePlayer.role === 'L2' || activePlayer.role === 'L1+C' || activePlayer.role === 'L2+C')
                : (p.position === 'L' || p.position === 'L1' || p.position === 'L2' || p.isLibero === true || p.role === 'L1' || p.role === 'L2');

            const isL2 = activePlayer
                ? (activePlayer.role === 'L2' || activePlayer.role === 'L2+C')
                : (p.position === 'L2' || p.role === 'L2');

            let role = activePlayer?.role || p.role || '';
            if (!role) {
                if (isCap && isLib) {
                    role = isL2 ? 'L2+C' : 'L1+C';
                } else if (isCap) {
                    role = 'C';
                } else if (isLib) {
                    role = isL2 ? 'L2' : 'L1';
                }
            }

            return {
                ...p,
                selected: isActive,
                role,
                isLibero: isLib,
                isCaptain: isCap
            };
        });
    };

    const [selHome, setSelHome] = useState(() => initTeam(homeRoster, activeHome));
    const [selAway, setSelAway] = useState(() => initTeam(awayRoster, activeAway));

    // สถานะสำหรับการทำ Highlight
    const [leftActiveId, setLeftActiveId] = useState(null);
    const [rightActiveId, setRightActiveId] = useState(null);

    if (!isOpen) return null;

    // Determine current team data based on step
    const currentTeamData = step === 1 ? selHome : selAway;
    const currentTeamName = step === 1 ? teamHome : teamAway;
    const setFn = step === 1 ? setSelHome : setSelAway;

    const availablePlayers = currentTeamData ? currentTeamData.filter(p => !p.selected) : [];
    const rosterPlayers = currentTeamData ? currentTeamData.filter(p => p.selected) : [];

    const handleAdd = () => {
        if (leftActiveId) {
            setFn(prev => prev.map(p => p.id === leftActiveId ? { ...p, selected: true } : p));
            setLeftActiveId(null);
        }
    };

    const handleAddAll = () => {
        setFn(prev => prev.map(p => ({ ...p, selected: true })));
        setLeftActiveId(null);
    };

    const handleRemove = () => {
        if (rightActiveId) {
            setFn(prev => prev.map(p => p.id === rightActiveId ? { ...p, selected: false, role: '', isLibero: false, isCaptain: false } : p));
            setRightActiveId(null);
        }
    };

    const handleReset = () => {
        setFn(prev => prev.map(p => ({ ...p, selected: false, role: '', isLibero: false, isCaptain: false })));
        setRightActiveId(null);
    };

    const handleRoleChange = (id, newRole) => {
        setFn(prev => prev.map(p => {
            const newIsCap = newRole === 'C' || newRole === 'L1+C' || newRole === 'L2+C';
            const newIsL1 = newRole === 'L1' || newRole === 'L1+C';
            const newIsL2 = newRole === 'L2' || newRole === 'L2+C';

            // Clear duplicate Captain if newRole has a Captain
            if (newIsCap && p.id !== id && (p.role === 'C' || p.role === 'L1+C' || p.role === 'L2+C')) {
                let clearedRole = '';
                if (p.role === 'L1+C') clearedRole = 'L1';
                else if (p.role === 'L2+C') clearedRole = 'L2';
                return { ...p, role: clearedRole, isCaptain: false };
            }

            // Clear duplicate L1 if newRole has L1
            if (newIsL1 && p.id !== id && (p.role === 'L1' || p.role === 'L1+C')) {
                let clearedRole = '';
                if (p.role === 'L1+C') clearedRole = 'C';
                return { ...p, role: clearedRole, isLibero: false };
            }

            // Clear duplicate L2 if newRole has L2
            if (newIsL2 && p.id !== id && (p.role === 'L2' || p.role === 'L2+C')) {
                let clearedRole = '';
                if (p.role === 'L2+C') clearedRole = 'C';
                return { ...p, role: clearedRole, isLibero: false };
            }

            if (p.id === id) {
                const isLib = newIsL1 || newIsL2;
                return { ...p, role: newRole, isLibero: isLib, isCaptain: newIsCap };
            }
            return p;
        }));
    };

    const handleRulesChange = (field, value) => {
        setRules(prev => ({ ...prev, [field]: value }));
    };

    const handleReferee1Change = (id) => {
        const found = refereesList.find(r => String(r.id) === String(id));
        setRules(prev => ({
            ...prev,
            referee_1_id: id,
            firstReferee: found ? `${found.firstname} ${found.lastname}` : '',
            firstRefereeCountry: found ? found.country : ''
        }));
    };

    const handleReferee2Change = (id) => {
        const found = refereesList.find(r => String(r.id) === String(id));
        setRules(prev => ({
            ...prev,
            referee_2_id: id,
            secondReferee: found ? `${found.firstname} ${found.lastname}` : '',
            secondRefereeCountry: found ? found.country : ''
        }));
    };

    const handleScorerChange = (id) => {
        const found = scorersList.find(s => String(s.id) === String(id));
        setRules(prev => ({
            ...prev,
            scorer_id: id,
            scorer: found ? `${found.firstname} ${found.lastname}` : '',
            scorerCountry: found ? found.country : ''
        }));
    };

    const handleLineJudgeChange = (index, id) => {
        const found = lineJudgesList.find(l => String(l.id) === String(id));
        setRules(prev => {
            const nextLjs = [...prev.lineJudges];
            const nextLjsCountry = [...prev.lineJudgesCountry];
            nextLjs[index] = found ? `${found.firstname} ${found.lastname}` : '';
            nextLjsCountry[index] = found ? found.country : '';

            const key = `line_judge_${index + 1}_id`;
            return {
                ...prev,
                [key]: id,
                lineJudges: nextLjs,
                lineJudgesCountry: nextLjsCountry
            };
        });
    };

    const handleNext = () => {
        if (step === 1) {
            setStep(2);
            setLeftActiveId(null);
            setRightActiveId(null);
        } else if (step === 2) {
            const finalHome = selHome.filter(p => p.selected);
            const finalAway = selAway.filter(p => p.selected);

            if (finalHome.length < 6 || finalAway.length < 6) {
                alert("กรุณาเพิ่มนักกีฬาอย่างน้อยทีมละ 6 คนใน Roster");
                return;
            }
            setStep(3);
        } else {
            const finalHome = selHome.filter(p => p.selected);
            const finalAway = selAway.filter(p => p.selected);

            onConfirm({
                setsToWin: rules.setsToWin,
                referees: rules,
                matchDetails: matchDetails,
                confirmedHome: finalHome,
                confirmedAway: finalAway
            });
        }
    };

    const handlePrev = () => {
        if (step > 1) {
            setStep(step - 1);
            setLeftActiveId(null);
            setRightActiveId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] select-none font-sans p-4">
            <div className="bg-white rounded-2xl w-full max-w-[1100px] h-[800px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                <Users size={24} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase leading-none">
                                    Match <span className="text-indigo-600">Setup</span>
                                </h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                    {
                                        match?.competition?.title ||
                                        match?.competitionName ||
                                        match?.competition_title ||
                                        match?.competition_name ||
                                        match?.title ||
                                        'Volleyball Competition'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 ml-12">
                            {match?.gender && (
                                <span className={`text-xs font-black px-1.5 py-0.5 rounded uppercase ${match.gender === 'Female' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                    {match.gender === 'Female' ? 'หญิง / Female' : 'ชาย / Male'}
                                </span>
                            )}
                            {(matchDetails.matchNo || matchNo || match?.match_number || match?.matchNo) && (
                                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                    Match No. {matchDetails.matchNo || matchNo || match?.match_number || match?.matchNo}
                                </span>
                            )}

                            {(matchDetails.round || match?.round) && (
                                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                    {matchDetails.round || match.round} {matchDetails.pool || match?.pool ? `(${matchDetails.pool || match.pool})` : ''}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Step Indicator */}
                        {!isSettingsOnly && (
                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                                <span className={`w-2.5 h-2.5 rounded-full ${step === 1 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-slate-300'}`}></span>
                                <span className={`w-2.5 h-2.5 rounded-full ${step === 2 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-slate-300'}`}></span>
                                <span className={`w-2.5 h-2.5 rounded-full ${step === 3 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-slate-300'}`}></span>
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Step {step} of 3</span>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 p-2 rounded-lg hover:bg-rose-50"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col p-8 overflow-hidden gap-6">
                    {step <= 2 && (
                        <>
                            <div className="flex items-end justify-between px-2">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] ml-1">Currently Managing</span>
                                    <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">{currentTeamName}</h1>
                                </div>

                                {/* Summary Stats */}
                                <div className="flex items-center gap-4 bg-indigo-50/50 px-5 py-3 rounded-2xl border border-indigo-100">
                                    <div className="flex flex-col items-center px-1">
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total</span>
                                        <span className="text-xl font-black text-indigo-600 leading-none">{rosterPlayers.length}</span>
                                    </div>
                                    <div className="w-px h-8 bg-indigo-100"></div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Cap</span>
                                            <span className="text-sm font-black text-indigo-600">
                                                {rosterPlayers.find(p => p.isCaptain)?.number || '-'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-center min-w-[32px]">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Lib</span>
                                            <span className="text-sm font-black text-indigo-600">
                                                {rosterPlayers.filter(p => p.isLibero).map(p => p.number).join(', ') || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                                <div className="bg-rose-500 text-white p-1.5 rounded-lg">
                                    <AlertCircle size={18} />
                                </div>
                                <p className="text-sm font-bold text-rose-700">
                                    Roster Management: เช็กชื่อผู้เล่นที่มาแข่งจริง (ใครไม่มาให้ติ๊กออก)
                                </p>
                            </div>

                            <div className="flex gap-6 mt-2 h-full overflow-hidden">
                                <div className="w-[320px] flex flex-col gap-3">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Players</span>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{availablePlayers.length}</span>
                                    </div>

                                    <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
                                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider z-10">
                                                    <tr>
                                                        <th className="p-3 border-b border-slate-100">Family Name</th>
                                                        <th className="p-3 border-b border-slate-100">Name</th>
                                                        <th className="p-3 border-b border-slate-100 text-center">Nat</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {availablePlayers.map(p => (
                                                        <tr
                                                            key={p.id}
                                                            onClick={() => { setLeftActiveId(p.id); setRightActiveId(null); }}
                                                            onDoubleClick={handleAdd}
                                                            className={`group cursor-pointer transition-all duration-200 ${leftActiveId === p.id ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white text-slate-700 border-b border-slate-50/30'}`}
                                                        >
                                                            <td className="p-3 font-bold uppercase text-[11px] leading-tight">{p.last_name || p.lastname}</td>
                                                            <td className="p-3 text-[11px] leading-tight">{p.first_name || p.firstname}</td>
                                                            <td className="p-3 text-[10px] text-center font-mono font-medium opacity-60">{p.nationality}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-[60px] flex flex-col items-center justify-center gap-4">
                                    <button
                                        onClick={handleAdd}
                                        className="w-12 h-12 bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-2xl shadow-sm hover:shadow-indigo-200 border border-slate-100 transition-all duration-200 flex items-center justify-center group"
                                    >
                                        <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                    <button
                                        onClick={handleAddAll}
                                        className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all duration-200 flex items-center justify-center"
                                    >
                                        <ChevronsRight size={24} />
                                    </button>
                                    <div className="w-6 h-px bg-slate-100 my-2"></div>
                                    <button
                                        onClick={handleRemove}
                                        className="w-12 h-12 bg-white hover:bg-rose-500 text-slate-400 hover:text-white rounded-2xl shadow-sm border border-slate-100 transition-all duration-200 flex items-center justify-center group"
                                    >
                                        <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="w-12 h-12 bg-slate-50 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-2xl transition-all duration-200 flex items-center justify-center"
                                    >
                                        <RotateCcw size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 flex flex-col gap-3">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selected Match Roster</span>
                                        <div className="flex gap-2">
                                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">Roster: {rosterPlayers.length}</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col">
                                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md text-[10px] text-slate-400 font-bold uppercase tracking-wider z-10">
                                                    <tr>
                                                        <th className="p-3 w-12 text-center border-b border-slate-100">#</th>
                                                        <th className="p-3 w-20 border-b border-slate-100">ID</th>
                                                        <th className="p-3 border-b border-slate-100">Family Name</th>
                                                        <th className="p-3 border-b border-slate-100">Name</th>
                                                        <th className="p-3 w-24 text-center border-b border-slate-100">Role</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rosterPlayers.map(p => (
                                                        <tr
                                                            key={p.id}
                                                            onClick={() => { setRightActiveId(p.id); setLeftActiveId(null); }}
                                                            className={`transition-all duration-200 ${rightActiveId === p.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/30'}`}
                                                        >
                                                            <td className="p-3 text-center">
                                                                <span className="inline-block w-7 h-7 bg-slate-900 text-white rounded-lg text-[13px] font-black flex items-center justify-center shadow-lg shadow-slate-200">
                                                                    {p.number}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-[10px] font-mono text-slate-400">{p.id || p.player_id}</td>
                                                            <td className="p-3 font-bold uppercase text-[11px] text-slate-900">{p.last_name || p.lastname}</td>
                                                            <td className="p-3 text-[11px] text-slate-700">{p.first_name || p.firstname}</td>
                                                            <td className="p-3" onClick={e => e.stopPropagation()}>
                                                                <select
                                                                    value={p.role || ''}
                                                                    onChange={(e) => handleRoleChange(p.id, e.target.value)}
                                                                    className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg px-2 py-1 outline-none text-[11px] font-bold appearance-none cursor-pointer hover:bg-indigo-100 transition-colors"
                                                                >
                                                                    <option value="" className="text-slate-400"></option>
                                                                    <option value="C">Captain (C)</option>
                                                                    <option value="L1">Libero (L1)</option>
                                                                    <option value="L2">Libero (L2)</option>
                                                                    <option value="L1+C">Libero (L1) & Captain (C)</option>
                                                                    <option value="L2+C">Libero (L2) & Captain (C)</option>
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6">
                            {/* Section 1: General Match Info & Location */}
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-600 mb-4 border-b border-slate-200/60 pb-2">
                                    <MapPin size={16} /> ข้อมูลการแข่งขันและสถานที่ / Match Info & Location
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <InputField
                                        label="Match No."
                                        value={matchDetails.matchNo}
                                        onChange={e => setMatchDetails(prev => ({ ...prev, matchNo: e.target.value }))}
                                    />
                                    <InputField
                                        label="Phase / Round"
                                        value={matchDetails.round}
                                        onChange={e => setMatchDetails(prev => ({ ...prev, round: e.target.value }))}
                                    />
                                    <InputField
                                        label="Pool"
                                        value={matchDetails.pool}
                                        onChange={e => setMatchDetails(prev => ({ ...prev, pool: e.target.value }))}
                                    />
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sets to Win</label>
                                        <select
                                            value={rules.setsToWin}
                                            onChange={e => handleRulesChange('setsToWin', parseInt(e.target.value, 10))}
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 outline-none text-sm font-semibold hover:border-slate-350 focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                                        >
                                            <option value={3}>3 Sets (Best of 5)</option>
                                            <option value={2}>2 Sets (Best of 3)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                                    <InputField
                                        label="Country"
                                        value={matchDetails.countryCode}
                                        onChange={e => setMatchDetails(prev => ({ ...prev, countryCode: e.target.value }))}
                                    />
                                    <InputField
                                        label="City"
                                        value={matchDetails.city}
                                        onChange={e => setMatchDetails(prev => ({ ...prev, city: e.target.value }))}
                                    />
                                    <InputField
                                        label="Stadium / Hall"
                                        value={matchDetails.hall}
                                        onChange={e => setMatchDetails(prev => ({ ...prev, hall: e.target.value }))}
                                    />
                                    <div className="flex flex-col gap-1.5 justify-end pb-3">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={matchDetails.hasChallenge || false}
                                                onChange={e => setMatchDetails(prev => ({ ...prev, hasChallenge: e.target.checked }))}
                                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700">Video Challenge</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Match Officials */}
                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-600 mb-4 border-b border-slate-200/60 pb-2">
                                    <User size={16} /> ผู้ตัดสินและเจ้าหน้าที่ประจำแมตช์ / Match Officials
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <SelectField label="1st Referee" value={rules.referee_1_id} onChange={e => handleReferee1Change(e.target.value)} options={refereesList} />
                                    <SelectField label="2nd Referee" value={rules.referee_2_id} onChange={e => handleReferee2Change(e.target.value)} options={refereesList} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    <InputField label="Scorer Name" value={rules.scorer} onChange={e => handleRulesChange('scorer', e.target.value)} />
                                    <InputField label="Scorer Country Code" value={rules.scorerCountry} onChange={e => handleRulesChange('scorerCountry', e.target.value)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    <InputField label="Assistant Scorer Name" value={rules.assistant_scorer_name} onChange={e => handleRulesChange('assistant_scorer_name', e.target.value)} />
                                    <InputField label="Assistant Scorer Country Code" value={rules.assistant_scorer_country} onChange={e => handleRulesChange('assistant_scorer_country', e.target.value)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    <SelectField label="Line Judge 1" value={rules.line_judge_1_id} onChange={e => handleLineJudgeChange(0, e.target.value)} options={lineJudgesList} />
                                    <SelectField label="Line Judge 2" value={rules.line_judge_2_id} onChange={e => handleLineJudgeChange(1, e.target.value)} options={lineJudgesList} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    <SelectField label="Line Judge 3" value={rules.line_judge_3_id} onChange={e => handleLineJudgeChange(2, e.target.value)} options={lineJudgesList} />
                                    <SelectField label="Line Judge 4" value={rules.line_judge_4_id} onChange={e => handleLineJudgeChange(3, e.target.value)} options={lineJudgesList} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-4 border-t border-slate-200/60">
                                    <InputField label="Referee Delegate Name" value={rules.rd_name} onChange={e => handleRulesChange('rd_name', e.target.value)} />
                                    <InputField label="Referee Delegate Country" value={rules.rd_country} onChange={e => handleRulesChange('rd_country', e.target.value)} />
                                    <InputField label="Referee Delegate Code" value={rules.rd_code} onChange={e => handleRulesChange('rd_code', e.target.value)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                    <InputField label="Technical Director Name" value={rules.td_name} onChange={e => handleRulesChange('td_name', e.target.value)} />
                                    <InputField label="Technical Director Country" value={rules.td_country} onChange={e => handleRulesChange('td_country', e.target.value)} />
                                    <InputField label="Technical Director Code" value={rules.td_code} onChange={e => handleRulesChange('td_code', e.target.value)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                    <InputField label="Referee Coach Name" value={rules.rc_name} onChange={e => handleRulesChange('rc_name', e.target.value)} />
                                    <InputField label="Referee Coach Country" value={rules.rc_country} onChange={e => handleRulesChange('rc_country', e.target.value)} />
                                    <InputField label="Referee Coach Code" value={rules.rc_code} onChange={e => handleRulesChange('rc_code', e.target.value)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                    <InputField label="Referee Representative Name" value={rules.rr_name} onChange={e => handleRulesChange('rr_name', e.target.value)} />
                                    <InputField label="Referee Representative Country" value={rules.rr_country} onChange={e => handleRulesChange('rr_country', e.target.value)} />
                                    <InputField label="Referee Representative Code" value={rules.rr_code} onChange={e => handleRulesChange('rr_code', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <Info size={14} className="text-indigo-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Quick Instructions</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight max-w-[400px]">
                            {step <= 2 
                                ? "Double-click a name to add quickly. Libero roles are limited to 2 players per team."
                                : "ตรวจสอบและแก้ไขข้อมูลรายการแข่งขันรวมถึงรายชื่อผู้ตัดสินประจำแมตช์การแข่งขันให้เรียบร้อยก่อนกดยืนยัน"
                            }
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 border border-transparent hover:bg-white hover:border-slate-200 transition-all duration-200 font-bold text-sm"
                        >
                            Cancel
                        </button>

                        <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                            {!isSettingsOnly && (
                                <button
                                    onClick={handlePrev}
                                    disabled={step === 1}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${step === 1 ? 'text-slate-200 pointer-events-none' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                >
                                    <ChevronLeft size={18} />
                                    <span>Back</span>
                                </button>
                            )}

                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all duration-200 active:scale-95"
                            >
                                <span>{isSettingsOnly ? 'Confirm Setup' : (step === 1 ? 'Go to Away Roster' : step === 2 ? 'Go to Officials' : 'Confirm Setup')}</span>
                                {!isSettingsOnly && <ChevronRight size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PreMatchSetupModal;