import React, { useState, useEffect } from 'react';
import { isPlayerLibero } from '../../../utils/playerFilters';

export default function SubstitutionModal({ 
    isOpen, onClose, teamName, roster, currentLineup, playerOut, posIndex, subTracker, disqualifiedPlayers = [], initialExceptional, onConfirm
}) {
    const [selectedPlayerIn, setSelectedPlayerIn] = useState(null);
    const [isExceptional, setIsExceptional] = useState(false); 
    
    // 🌟 ใหม่: State สำหรับควบคุมการเปิดหน้า Confirm
    const [isConfirmStep, setIsConfirmStep] = useState(false); 

    const [localPosIndex, setLocalPosIndex] = useState(null);
    const [localPlayerOut, setLocalPlayerOut] = useState(null);

    const playerOutId = localPlayerOut?.id || localPlayerOut?.player_id;
    let posData = null;

    if (subTracker && subTracker.positions) {
        const entry = Object.entries(subTracker.positions).find(
            ([, data]) => data.currentOnCourt == playerOutId || data.starterId == playerOutId
        );
        if (entry) posData = entry[1];
    }

    // รีเซ็ตค่าและเลือก Auto-select เมื่อเปิด Modal
    useEffect(() => {
        if (isOpen) {
            setSelectedPlayerIn(null);
            setIsExceptional(!!initialExceptional);
            setIsConfirmStep(false); // รีเซ็ตหน้า Confirm เสมอเมื่อเปิดใหม่
            setLocalPosIndex(posIndex);
            setLocalPlayerOut(playerOut);
        }
    }, [isOpen, posIndex, playerOut, initialExceptional]);

    useEffect(() => {
        
        if (isOpen && posData && !posData.returned && posData.starterId) {
            const starter = roster.find(p => (p.id || p.player_id) == posData.starterId);
            if (starter) setSelectedPlayerIn(starter);
        }
    }, [isOpen, posData, roster]);

    if (!isOpen) return null;

    const courtIds = currentLineup.filter(p => p).map(p => p?.id || p?.player_id || p);
    
    const isBackRow = [0, 4, 5].includes(localPosIndex);

    const availableBench = roster.filter(p => {
        const pId = p.id || p.player_id;
        const isLib = isPlayerLibero(p);
        
        // กฎ: ในการเปลี่ยนตัวปกติ (Substitution) จะไม่ใช้ Libero
        // Libero จะแสดงในหน้านี้เฉพาะกรณีที่เป็น Exceptional Substitution เท่านั้น
        if (isLib && !isExceptional) return false;

        // กฎ: Libero เข้าได้เฉพาะตำแหน่งแดนหลัง (0, 4, 5) ในกรณีที่เป็น Exceptional
        if (isLib && isExceptional && !isBackRow) return false;

        return !courtIds.some(cId => cId == pId) && 
               !disqualifiedPlayers.some(dId => dId == pId);
    });
    
    // --- FIVB LOGIC ---
    let eligibleBenchPlayers = [];
    let isError = false;
    let ruleMessage = "";

    if (isExceptional) {
        eligibleBenchPlayers = availableBench;
    } else {
        if (subTracker && localPlayerOut) {
            if (subTracker.count >= 6) { 
                isError = true;
                ruleMessage = "หมดโควต้าเปลี่ยนตัวปกติ 6 ครั้งแล้ว";
            } else if (posData) {
                if (posData.returned) {
                    isError = true;
                    ruleMessage = "ตำแหน่งนี้ไม่สามารถเปลี่ยนตัวได้อีก";
                } else {
                    eligibleBenchPlayers = availableBench.filter(p => {
                        const pId = p.id || p.player_id;
                        return pId == posData.starterId;
                    });
                    if (eligibleBenchPlayers.length === 0) {
                        isError = true;
                        ruleMessage = "ไม่พบผู้เล่นตัวจริงในม้านั่งสำรอง";
                    }
                }
            } else {
                const usedIds = subTracker.usedPlayers || [];
                eligibleBenchPlayers = availableBench.filter(p => {
                    const pId = p.id || p.player_id;
                    return !usedIds.some(uId => uId == pId);
                });
            }
        }
    }

    // เมื่อกดปุ่ม Run the substitution ให้แสดงหน้า Confirm ก่อน
    const handleRunSubstitution = () => {
        if (selectedPlayerIn && localPlayerOut) {
            setIsConfirmStep(true); 
        }
    };

    // เมื่อกดยืนยันในหน้า Confirm จึงจะทำการเปลี่ยนตัวและปิดหน้าต่างทั้งหมด
    const finalizeSubstitution = () => {
        onConfirm(selectedPlayerIn, isExceptional, localPosIndex, localPlayerOut);
        setIsConfirmStep(false);
        onClose();
    };



    // ==========================================
    // 🌟 หน้า 2: หน้าต่าง Confirm Substitution (Modern Preview)
    // ==========================================
    if (isConfirmStep) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300">
                <div className="bg-white rounded-3xl shadow-2xl w-[500px] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                    
                    {/* Header */}
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Confirm Substitution</span>
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                        </div>
                    </div>

                    <div className="p-8 flex flex-col items-center">
                        <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight uppercase text-center">{teamName}</h2>

                        <div className="w-full flex items-center justify-between gap-4 relative py-4">
                            
                            {/* OUT PLAYER CARD */}
                            <div className="flex-1 flex flex-col items-center">
                                <div className="text-[10px] font-bold text-rose-500 uppercase tracking-tighter mb-2">Player Out</div>
                                <div className="w-full aspect-[3/4] bg-rose-50 rounded-2xl border-2 border-rose-100 flex flex-col items-center justify-center relative overflow-hidden shadow-sm group">
                                    <div className="absolute top-2 left-2 p-1.5 bg-rose-500 rounded-lg text-white">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                                    </div>
                                    <span className="text-6xl font-black text-rose-600 mb-1 leading-none">{localPlayerOut?.number}</span>
                                    <span className="text-xs font-bold text-rose-700 px-3 truncate w-full text-center">{localPlayerOut?.first_name || localPlayerOut?.name}</span>
                                </div>
                            </div>

                            {/* VS/ARROW AREA */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold shadow-inner">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 8 4 4-4 4M6 8l-4 4 4 4M2 12h20"/></svg>
                                </div>
                            </div>

                            {/* IN PLAYER CARD */}
                            <div className="flex-1 flex flex-col items-center">
                                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter mb-2">Player In</div>
                                <div className="w-full aspect-[3/4] bg-emerald-50 rounded-2xl border-2 border-emerald-100 flex flex-col items-center justify-center relative overflow-hidden shadow-sm group">
                                    <div className="absolute top-2 right-2 p-1.5 bg-emerald-500 rounded-lg text-white">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                    </div>
                                    <span className="text-6xl font-black text-emerald-600 mb-1 leading-none">{selectedPlayerIn?.number}</span>
                                    <span className="text-xs font-bold text-emerald-700 px-3 truncate w-full text-center">{selectedPlayerIn?.first_name || selectedPlayerIn?.name}</span>
                                </div>
                            </div>

                        </div>

                        {/* EXCEPTIONAL BADGE */}
                        {isExceptional && (
                            <div className="mt-4 px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest border border-amber-100 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                Exceptional Substitution
                            </div>
                        )}

                        {/* ACTION BUTTONS */}
                        <div className="flex gap-3 mt-10 w-full">
                            <button 
                                onClick={finalizeSubstitution} 
                                className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                Confirm
                            </button>
                            <button 
                                onClick={() => setIsConfirmStep(false)} 
                                className="px-8 h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all active:scale-95"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    // ==========================================
    // 🌟 หน้า 1: หน้าต่างเลือกนักกีฬา (Selection)
    // ==========================================
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-[900px] h-[650px] overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-300">
                
                {/* Modern Header Bar */}
                <div className="bg-white px-8 py-6 flex justify-between items-center shrink-0 border-b border-slate-50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 8 4 4-4 4M6 8l-4 4 4 4M2 12h20"/></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">Substitution</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{teamName || 'Select Team'}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden p-6 gap-6">
                    
                    {/* LEFT PANEL: COURT (OUT) */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                                </div>
                                <span className="font-black text-slate-900 text-sm uppercase tracking-wider">Out</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Players on Court</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 gap-2">
                            {currentLineup.map((p, idx) => {
                                if (!p) return null;
                                const isSelected = idx === localPosIndex;
                                
                                return (
                                    <button 
                                        key={idx}
                                        onClick={() => {
                                            setLocalPosIndex(idx);
                                            setLocalPlayerOut(p);
                                        }}
                                        className={`group relative flex items-center p-3 rounded-2xl border-2 transition-all duration-200 text-left ${
                                            isSelected 
                                            ? 'bg-rose-500 border-rose-500 shadow-lg shadow-rose-200' 
                                            : 'bg-white border-slate-100 hover:border-rose-200 hover:shadow-md'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center shrink-0 transition-colors ${
                                            isSelected ? 'bg-white text-rose-600' : 'bg-slate-50 text-slate-900 group-hover:bg-rose-50 group-hover:text-rose-600'
                                        }`}>
                                            {p.number}
                                        </div>
                                        <div className="ml-4 flex-1 truncate">
                                            <div className={`font-bold text-sm leading-none truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                {p.first_name || p.name}
                                            </div>
                                            
                                        </div>
                                        {p.isCaptain && (
                                            <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border shrink-0 ${
                                                isSelected ? 'bg-white/20 border-white/30 text-white' : 'bg-amber-50 border-amber-200 text-amber-600'
                                            }`}>C</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* MIDDLE DIVIDER */}
                    <div className="w-px bg-slate-50 relative flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 text-slate-300 flex items-center justify-center absolute">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 8 4 4-4 4M6 8l-4 4 4 4M2 12h20"/></svg>
                        </div>
                    </div>

                    {/* RIGHT PANEL: BENCH (IN) */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                </div>
                                <span className="font-black text-slate-900 text-sm uppercase tracking-wider">In</span>
                            </div>
                            
                            <label className="group flex items-center gap-2 cursor-pointer">
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-amber-500 transition-colors uppercase tracking-widest">Exceptional</span>
                                <div className="relative inline-flex items-center">
                                    <input 
                                        type="checkbox" 
                                        checked={isExceptional} 
                                        onChange={() => setIsExceptional(!isExceptional)}
                                        className="sr-only"
                                    />
                                    <div className={`w-8 h-4 rounded-full transition-colors ${isExceptional ? 'bg-amber-500' : 'bg-slate-200'}`}></div>
                                    <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform shadow-sm transform ${isExceptional ? 'translate-x-4' : 'translate-x-1'}`}></div>
                                </div>
                            </label>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 gap-2">
                            {isError && !isExceptional ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    </div>
                                    <div className="text-xs font-bold text-slate-600 uppercase mb-1">Rule Violation</div>
                                    <div className="text-[10px] font-medium text-slate-400">{ruleMessage}</div>
                                </div>
                            ) : (
                                <>
                                    {eligibleBenchPlayers.map((p) => {
                                        const isLib = p.isLibero;
                                        const isSelected = selectedPlayerIn?.id === (p.id || p.player_id);

                                        return (
                                            <button
                                                key={p.id || p.number}
                                                onClick={() => setSelectedPlayerIn(p)}
                                                className={`group relative flex items-center p-3 rounded-2xl border-2 transition-all duration-200 text-left ${
                                                    isSelected 
                                                    ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-200' 
                                                    : isLib ? 'bg-amber-50 border-amber-100 hover:border-amber-300' : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-md'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center shrink-0 transition-colors ${
                                                    isSelected 
                                                    ? 'bg-white text-emerald-600' 
                                                    : isLib ? 'bg-amber-400 text-white' : 'bg-slate-50 text-slate-900 group-hover:bg-emerald-50 group-hover:text-emerald-600'
                                                }`}>
                                                    {p.number}
                                                </div>
                                                <div className="ml-4 flex-1 truncate">
                                                    <div className={`font-bold text-sm leading-none truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                        {p.first_name || p.name}
                                                    </div>
                                                </div>
                                                {isLib && (
                                                    <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border shrink-0 ${
                                                        isSelected ? 'bg-white/20 border-white/30 text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                                    }`}>L</div>
                                                )}
                                            </button>
                                        );
                                    })}
                                    {eligibleBenchPlayers.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-20"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                                            <div className="text-xs font-bold uppercase tracking-widest">No Players</div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* PREMIUM FOOTER */}
                <div className="bg-slate-50 px-10 py-8 flex items-center justify-between gap-6">
                    <div className="flex-1 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900 leading-tight">Need assistance?</p>
                            <p className="text-[10px] text-slate-400 mt-1">Select an active player on the left and a replacement from the bench on the right.</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose}
                            className="px-8 h-14 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-2xl border border-slate-200 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleRunSubstitution}
                            disabled={!selectedPlayerIn}
                            className={`px-10 h-14 font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                                selectedPlayerIn 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                            Proceed to Preview
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
