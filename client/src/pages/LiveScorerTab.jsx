import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { Swords, Calendar, MapPin, PlayCircle, Trophy, X, Save, User, CheckCircle, Flag, FileText, Monitor } from 'lucide-react';
import { EmptyState } from './AdminShared';

export default function LiveScorerTab({ darkMode }) {
    const [competitions, setCompetitions] = useState([]);
    const [matches, setMatches] = useState([]);

    // Grouping State
    const [uniqueBaseNames, setUniqueBaseNames] = useState([]);
    const [selectedBaseName, setSelectedBaseName] = useState('');
    const [filterGender, setFilterGender] = useState('');
    const [availableGenders, setAvailableGenders] = useState([]);

    // Officials
    const [referees, setReferees] = useState([]);
    const [scorers, setScorers] = useState([]);
    const [lineJudges, setLineJudges] = useState([]);

    // --- Modal State ---
    const [showModal, setShowModal] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);

    const [formData, setFormData] = useState({});

    const navigate = useNavigate();

    const fetchCompetitions = React.useCallback(async () => {
        try {
            const res = await api.getAllCompetitions();
            setCompetitions(res.data);
            
            const bases = new Set();
            res.data.forEach(c => {
                const rawTitle = c.title || c.name || '';
                if (rawTitle) {
                    const base = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    bases.add(base);
                }
            });
            const sortedBases = Array.from(bases).sort();
            setUniqueBaseNames(sortedBases);

            if (sortedBases.length > 0) {
                setSelectedBaseName(prev => prev || sortedBases[0]);
            }
        } catch (err) {
            console.error("Fetch competitions error:", err);
        }
    }, []);

    const fetchMatches = React.useCallback(async () => {
        if (!selectedBaseName) return;

        try {
            let targetComps = [];
            if (filterGender === 'All') {
                targetComps = competitions.filter(c => {
                    const rawTitle = c.title || c.name || '';
                    const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    return cBase === selectedBaseName;
                });
            } else {
                const targetComp = competitions.find(c => {
                    const rawTitle = c.title || c.name || '';
                    const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    return cBase === selectedBaseName && c.gender === filterGender;
                });
                if (targetComp) targetComps = [targetComp];
            }

            if (targetComps.length === 0) return;

            const promises = targetComps.map(c => api.getMatchesByCompetition(c.id));
            const results = await Promise.all(promises);
            
            let allMatches = [];
            results.forEach((res, index) => {
                const comp = targetComps[index];
                if (res.data) {
                    const compMatches = res.data.map(m => ({
                        ...m,
                        gender: m.gender || comp.gender,
                        competition_category: comp.age_group_id,
                        competition_id: comp.id
                    }));
                    allMatches = [...allMatches, ...compMatches];
                }
            });

            allMatches.sort((a, b) => (parseInt(a.match_number) || 0) - (parseInt(b.match_number) || 0));
            setMatches(allMatches);
        } catch (err) {
            console.error("Fetch matches error:", err);
        }
    }, [selectedBaseName, filterGender, competitions]);

    const getAgeGroupName = (id) => {
    // ปรับตัวเลขและข้อความให้ตรงกับตาราง Age Groups ใน Database ของคุณ
    const ageGroups = {
        1: "Senior",
        2: "Junior",
        3: "Youth"
    };
    
    // ถ้าไม่มีในรายการให้แสดงคำว่า 'ไม่ระบุรุ่น' หรือจะให้แสดง ID ก็ได้
    return ageGroups[id] || "ไม่ระบุรุ่น"; 
};

    const fetchMasterData = React.useCallback(async () => {
        try {
            const [refs, scrs, ljs] = await Promise.all([
                api.getAllReferees(),
                api.getAllScorers(),
                api.getAllLineJudges()
            ]);
            setReferees(refs.data || []);
            setScorers(scrs.data || []);
            setLineJudges(ljs.data || []);
        } catch {
            console.warn("Could not fetch officials data.");
        }
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchCompetitions();
            fetchMasterData();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchCompetitions, fetchMasterData]);

    useEffect(() => {
        if (selectedBaseName && competitions.length > 0) {
            const relatedComps = competitions.filter(c => {
                const rawTitle = c.title || c.name || '';
                const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                return cBase === selectedBaseName;
            });

            const genders = [...new Set(relatedComps.map(c => c.gender))].filter(Boolean).sort();
            const allGenders = ['All', ...genders];

            const timeout = setTimeout(() => {
                setAvailableGenders(allGenders);
                if (!filterGender || (filterGender !== 'All' && !genders.includes(filterGender))) {
                    setFilterGender('All');
                }
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [selectedBaseName, competitions, filterGender]);

    useEffect(() => {
        if (selectedBaseName && filterGender && competitions.length > 0) {
            const timeout = setTimeout(() => {
                fetchMatches();
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [selectedBaseName, filterGender, fetchMatches, competitions.length]);

    const handleOpenConsoleClick = (match) => {
        const comp = competitions.find(c => c.id === match.competition_id) || {};

        const initialData = {
            title: comp.title || 'Unknown Competition',
            city: match.city || '',
            stadium: match.location || '',
            countryCode: match.country || 'THA',
            phase: match.round_name || match.round || 'Preliminary',
            pool: match.pool_name || '-',
            matchNumber: match.match_number || '-',
            division: comp.gender || '-',
            category: (() => {
                const catStr = String(match.category || '');
                if (catStr && isNaN(catStr)) return catStr;
                return getAgeGroupName(parseInt(catStr) || comp.age_group_id);
            })(),
            dateTime: match.match_date 
                ? `${new Date(match.match_date).toLocaleDateString('en-GB')} ${match.start_time?.substring(0,5) || ''}`
                : (match.start_time 
                    ? (match.start_time.includes('T') ? new Date(match.start_time).toLocaleString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'}) : match.start_time.substring(0, 5)) 
                    : '-'),
            teamHome: match.home_team || match.home_team_name,
            teamAway: match.away_team || match.away_team_name,
            teamHomeId: match.home_team_id,
            teamAwayId: match.away_team_id,

            referee1: match.referee_1_id || '',
            referee2: match.referee_2_id || '',
            rrName: match.rr_name || '',
            rrCountry: match.rr_country || '',
            rrCode: match.rr_code || '',
            rcName: match.rc_name || '',
            rcCountry: match.rc_country || '',
            rcCode: match.rc_code || '',

            scorer: match.scorer_id || '',
            scorerName: match.scorer_name || (match.scorer_firstname ? `${match.scorer_firstname} ${match.scorer_lastname}`.trim() : ''),
            scorerCountry: match.scorer_country || '',
            assistantScorerName: match.assistant_scorer_name || '',
            assistantScorerCountry: match.assistant_scorer_country || '',
            assistantScorerCode: match.assistant_scorer_code || '',

            lineJudge1: match.line_judge_1_id || '',
            lineJudge2: match.line_judge_2_id || '',
            lineJudge3: match.line_judge_3_id || '',
            lineJudge4: match.line_judge_4_id || '',

            tdName: match.td_name || '',
            tdCountry: match.td_country || '', 
            tdCode: match.td_code || '',
            rdName: match.rd_name || '',
            rdCountry: match.rd_country || '',
            rdCode: match.rd_code || '',
            hasChallenge: match.has_challenge === true || match.has_challenge === 'true',
        };

        setSelectedMatch(match);
        setFormData(initialData);
        setShowModal(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEnterScorer = async () => {
        try {
            const payload = {
                referee_1_id: formData.referee1 || null,
                referee_2_id: formData.referee2 || null,
                scorer_id: formData.scorer || null,
                scorer_name: formData.scorerName || null,
                scorer_country: formData.scorerCountry || null,
                line_judge_1_id: formData.lineJudge1 || null,
                line_judge_2_id: formData.lineJudge2,
                line_judge_3_id: formData.lineJudge3,
                line_judge_4_id: formData.lineJudge4,
                rr_name: formData.rrName,
                rr_country: formData.rrCountry,
                rr_code: formData.rrCode,
                rc_name: formData.rcName,
                rc_country: formData.rcCountry,
                rc_code: formData.rcCode,
                assistant_scorer_name: formData.assistantScorerName,
                assistant_scorer_country: formData.assistantScorerCountry,
                assistant_scorer_code: formData.assistantScorerCode,
                td_name: formData.tdName,
                td_country: formData.tdCountry,
                td_code: formData.tdCode,
                rd_name: formData.rdName,
                rd_country: formData.rdCountry,
                rd_code: formData.rdCode,

                // General match details edited in the modal
                match_number: formData.matchNumber,
                pool_name: formData.pool,
                round_name: formData.phase,
                city: formData.city,
                location: formData.stadium,
                country: formData.countryCode,
                has_challenge: formData.hasChallenge
            };

            await api.updateMatchOfficials(selectedMatch.id, payload);
            navigate(`/scorer/${selectedMatch.id}`, { state: { matchData: formData } });
            setShowModal(false);
        } catch (error) {
            console.error("Failed to save match officials:", error);
            alert("Failed to save officials data. Please try again.");
        }
    };

    return (
        <div className={`min-h-screen p-6 transition-colors duration-200 font-['Anuphan'] ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 shadow-sm">
                        <Swords className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            Live Scorer Console
                        </h1>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-end">
                    <div className="w-full md:w-72">
                        <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Competition</label>
                        <select 
                            className={`w-full h-12 px-4 rounded-md border shadow-sm focus:ring-2 focus:ring-blue-500 font-medium transition-all ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                            value={selectedBaseName}
                            onChange={(e) => setSelectedBaseName(e.target.value)}
                        >
                            {uniqueBaseNames.length === 0 && <option value="">Loading...</option>}
                            {uniqueBaseNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full md:w-auto">
                        <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Gender</label>
                        <div className="flex bg-gray-50 border border-gray-200 dark:bg-gray-700 rounded-lg p-1 h-12 shadow-sm items-center">
                            {availableGenders.map(g => (
                                <button 
                                    key={g} 
                                    onClick={() => setFilterGender(g)} 
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterGender === g ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-indigo-400 shadow-sm border border-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Match List */}
            <div className={`p-8 rounded-[0.5rem] shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Trophy size={24} className="text-yellow-500" /> Select Match to Score
                </h3>

                <div className="grid grid-cols-1 gap-4">
                    {matches.length === 0 ? (
                        <EmptyState text="No matches found in this competition." darkMode={darkMode} />
                    ) : (
                        matches.map(m => {
                            const isCompleted = m.status === 'completed';
                            return (
                                <div key={m.id} className={`group p-2 rounded-[0.5rem] border flex flex-col md:flex-row justify-between items-center gap-6 transition-all hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 ${darkMode ? 'bg-gray-700/30 border-gray-600 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-blue-50/30'}`}>
                                    <div className="flex-1 w-full">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-sm font-bold px-3 py-1 rounded-lg bg-blue-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">#{m.match_number || '-'}</span>
                                            <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                                                m.gender === 'Female' 
                                                ? 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300' 
                                                : m.gender === 'Male' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                            }`}>{m.gender}</span>
                                            <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {isCompleted ? 'Finished' : 'Scheduled'}
                                            </span>
                                        </div>
                                        <div className="text-xl font-bold flex items-center gap-4 mb-2">
                                            <span className={m.home_set_score > m.away_set_score ? 'text-green-600' : ''}>{m.home_team}</span>
                                            <span className="text-gray-400 text-base font-medium italic">VS</span>
                                            <span className={m.away_set_score > m.home_set_score ? 'text-green-600' : ''}>{m.away_team}</span>
                                        </div>
                                        <div className="text-base text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-6">
                                            <span className="flex items-center gap-2"><Calendar size={18} className="text-blue-600" /> 
                                                {m.match_date ? new Date(m.match_date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year:'numeric'}) : (m.start_time && m.start_time.includes('T') ? new Date(m.start_time).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year:'numeric'}) : 'TBD')}
                                                {' '}
                                                {m.start_time ? (m.start_time.includes('T') ? new Date(m.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : m.start_time.substring(0, 5)) : ''}
                                            </span>
                                            <span className="flex items-center gap-2"><MapPin size={18} className="text-rose-500" /> {m.city ? `${m.location || ''} ${m.city}`.trim() : (m.location || '-')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        <Link
                                            to={`/match/${m.id}/referee`}
                                            target="_blank"
                                            className="flex-1 md:flex-none h-10 w-10 rounded-lg font-medium flex items-center justify-center transition-all bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                            title="Open Referee View"
                                        >
                                            <Monitor size={20} />
                                        </Link>
                                        <button
                                            onClick={() => handleOpenConsoleClick(m)}
                                            className={`flex-1 md:flex-none px-6 h-10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${isCompleted ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                        >
                                            <PlayCircle size={18} /> {isCompleted ? 'View Data' : 'Open Console'}
                                        </button>
                                        {isCompleted && (
                                            <Link
                                                to={`/scoresheet/${m.id}`}
                                                target="_blank"
                                                className="flex-1 md:flex-none px-5 h-10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 transition-all border border-emerald-100 dark:border-emerald-800"
                                                title="Print Official Score Sheet"
                                            >
                                                <FileText size={16} /> Official Score Sheet
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- MODERN MATCH DATA MODAL --- */}
            {showModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 font-sans max-h-screen overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col my-4">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm flex justify-between items-center rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                                    <Swords className="text-blue-600" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">Match Officials & Setup</h3>
                                    <p className="text-sm text-gray-500">{formData.title}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-md text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body Content */}
                        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-8">
                            
                            {/* General Match Info */}
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-600 mb-4 border-b border-gray-100 pb-2">
                                    <FileText size={16} /> General Match Info
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <InputGroup label="Category" val={formData.category} readOnly />
                                    <InputGroup label="Gender" val={formData.division} readOnly />
                                    <InputGroup label="Match No" name="matchNumber" val={formData.matchNumber} onChange={handleFormChange} />
                                    <InputGroup label="Phase" name="phase" val={formData.phase} onChange={handleFormChange} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                                    <InputGroup label="Date" val={formData.dateTime?.split(' ')[0]} readOnly icon={<Calendar size={16} />} />
                                    <InputGroup label="Time" val={formData.dateTime?.split(' ')[1]} readOnly />
                                    <InputGroup label="Home Team" val={formData.teamHome} readOnly />
                                    <InputGroup label="Away Team" val={formData.teamAway} readOnly />
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rose-600 mb-4 border-b border-gray-100 pb-2">
                                    <MapPin size={16} /> Location
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <InputGroup label="Country" name="countryCode" val={formData.countryCode} onChange={handleFormChange} />
                                    <InputGroup label="City" name="city" val={formData.city} onChange={handleFormChange} />
                                    <InputGroup label="Stadium / Hall" name="stadium" val={formData.stadium} onChange={handleFormChange} />
                                    <div className="flex flex-col gap-2 justify-end pb-3">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                name="hasChallenge"
                                                checked={formData.hasChallenge || false}
                                                onChange={e => setFormData(prev => ({ ...prev, hasChallenge: e.target.checked }))}
                                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Video Challenge</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Officials */}
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-600 mb-4 border-b border-gray-100 pb-2">
                                    <User size={16} /> Match Officials
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-4">
                                        <SelectGroup label="1st Referee" name="referee1" val={formData.referee1} onChange={handleFormChange} options={referees} />
                                        <SelectGroup label="2nd Referee" name="referee2" val={formData.referee2} onChange={handleFormChange} options={referees} />
                                        <InputGroup label="Challenge Operator" name="tdName" val={formData.tdName} onChange={handleFormChange} />
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <InputGroup label="Scorer Name" name="scorerName" val={formData.scorerName} onChange={handleFormChange} />
                                        <InputGroup label="Scorer Country Code" name="scorerCountry" val={formData.scorerCountry} onChange={handleFormChange} />
                                        <InputGroup label="Assistant Scorer Name" name="assistantScorerName" val={formData.assistantScorerName} onChange={handleFormChange} />
                                        <InputGroup label="Assistant Scorer Country Code" name="assistantScorerCountry" val={formData.assistantScorerCountry} onChange={handleFormChange} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                                    <div className="flex flex-col gap-4">
                                        <SelectGroup label="Line Judge 1" name="lineJudge1" val={formData.lineJudge1} onChange={handleFormChange} options={lineJudges} />
                                        <SelectGroup label="Line Judge 2" name="lineJudge2" val={formData.lineJudge2} onChange={handleFormChange} options={lineJudges} />
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <SelectGroup label="Line Judge 3" name="lineJudge3" val={formData.lineJudge3} onChange={handleFormChange} options={lineJudges} />
                                        <SelectGroup label="Line Judge 4" name="lineJudge4" val={formData.lineJudge4} onChange={handleFormChange} options={lineJudges} />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer Controls */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all font-medium text-sm">
                                Cancel
                            </button>
                            <button onClick={handleEnterScorer} className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-2">
                                <CheckCircle size={18} />
                                Launch Console
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Component for Inputs
const InputGroup = ({ label, name, val, onChange, readOnly = false, icon }) => (
    <div className="flex flex-col gap-2">
        <label className={`text-sm font-semibold uppercase tracking-wide ${readOnly ? 'text-slate-400' : 'text-slate-600'}`}>{label}</label>
        <div className="relative">
            {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
            <input
                type="text"
                name={name}
                value={val || ''}
                onChange={onChange}
                readOnly={readOnly}
                className={`w-full rounded-md border px-4 py-3 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all
                    ${readOnly
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400'
                    }
                    ${icon ? 'pl-10' : ''}
                `}
            />
        </div>
    </div>
);

const SelectGroup = ({ label, name, val, onChange, options = [], icon }) => (
    <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold uppercase tracking-wide text-slate-600">{label}</label>
        <div className="relative">
            {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">{icon}</div>}
            <select
                name={name}
                value={val || ''}
                onChange={onChange}
                className={`w-full rounded-md border px-4 py-3 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none
                    bg-white text-slate-900 border-slate-300 hover:border-slate-400
                    ${icon ? 'pl-10' : ''}
                `}
            >
                <option value="" className="text-slate-400">-- Select --</option>
                {options.map(opt => (
                    <option key={opt.id} value={opt.id} className="text-slate-900">
                        {opt.firstname} {opt.lastname} ({opt.country || '-'})
                    </option>
                ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
    </div>
);