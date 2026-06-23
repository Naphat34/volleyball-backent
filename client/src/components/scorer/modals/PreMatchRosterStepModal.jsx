import React, { useState } from 'react';
import { 
    X, 
    ChevronRight, 
    ChevronLeft, 
    ChevronsRight, 
    RotateCcw, 
    AlertCircle, 
    Users,
    Info
} from 'lucide-react';

const PreMatchRosterStepModal = ({
    isOpen,
    step,
    match,
    teamName,
    roster,
    setRoster,
    onClose,
    onPrev,
    onNext,
    matchNo
}) => {
    // Highlight states
    const [leftActiveId, setLeftActiveId] = useState(null);
    const [rightActiveId, setRightActiveId] = useState(null);

    if (!isOpen) return null;

    const availablePlayers = roster ? roster.filter(p => !p.selected) : [];
    const rosterPlayers = roster ? roster.filter(p => p.selected) : [];

    const handleAdd = () => {
        if (leftActiveId) {
            setRoster(prev => prev.map(p => p.id === leftActiveId ? { ...p, selected: true } : p));
            setLeftActiveId(null);
        }
    };

    const handleAddAll = () => {
        setRoster(prev => prev.map(p => ({ ...p, selected: true })));
        setLeftActiveId(null);
    };

    const handleRemove = () => {
        if (rightActiveId) {
            setRoster(prev => prev.map(p => p.id === rightActiveId ? { ...p, selected: false, role: '', isLibero: false, isCaptain: false } : p));
            setRightActiveId(null);
        }
    };

    const handleReset = () => {
        setRoster(prev => prev.map(p => ({ ...p, selected: false, role: '', isLibero: false, isCaptain: false })));
        setRightActiveId(null);
    };

    const handleRoleChange = (id, newRole) => {
        setRoster(prev => prev.map(p => {
            if (newRole !== '' && p.id !== id && p.role === newRole) {
                return { ...p, role: '', isLibero: false, isCaptain: false };
            }
            if (p.id === id) {
                const isLib = newRole === 'L1' || newRole === 'L2';
                const isCap = newRole === 'C';
                return { ...p, role: newRole, isLibero: isLib, isCaptain: isCap };
            }
            return p;
        }));
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
                                    Match <span className="text-indigo-600">Rosters</span>
                                </h2>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
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
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${match.gender === 'Female' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                    {match.gender === 'Female' ? 'หญิง / Female' : 'ชาย / Male'}
                                </span>
                            )}
                            {(matchNo || match?.match_number || match?.matchNo) && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                    Match No. {matchNo || match?.match_number || match?.matchNo}
                                </span>
                            )}
                            {match?.round && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                    {match.round} {match?.pool ? `(${match.pool})` : ''}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Step Indicator */}
                        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                            <span className={`w-2.5 h-2.5 rounded-full ${step === 1 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-slate-300'}`}></span>
                            <span className={`w-2.5 h-2.5 rounded-full ${step === 2 ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-slate-300'}`}></span>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Step {step} of 2</span>
                        </div>
                        <button 
                            onClick={onClose}
                            className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 p-2 rounded-lg hover:bg-rose-50"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col p-8 overflow-hidden gap-6">
                    <div className="flex items-end justify-between px-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] ml-1">Currently Managing</span>
                            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">{teamName}</h1>
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
                </div>

                {/* Footer Controls */}
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <Info size={14} className="text-indigo-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Quick Instructions</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight max-w-[400px]">
                            Double-click a name to add quickly. Libero roles are limited to 2 players per team.
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
                            <button 
                                onClick={onPrev}
                                disabled={!onPrev}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${!onPrev ? 'text-slate-200 pointer-events-none' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <ChevronLeft size={18} />
                                <span>Back</span>
                            </button>
                            
                            <button 
                                onClick={onNext}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all duration-200 active:scale-95"
                            >
                                <span>{step === 1 ? 'Go to Away Roster' : 'Confirm Composition'}</span>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PreMatchRosterStepModal;
