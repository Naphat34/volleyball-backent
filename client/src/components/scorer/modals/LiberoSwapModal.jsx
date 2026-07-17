import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { isPlayerLibero } from '../../../utils/playerFilters';

export default function LiberoSwapModal({
    isOpen,
    onClose,
    teamCode,
    teamName,
    lineup,
    roster,
    liberos,
    servingTeam,
    onConfirm
}) {
    const [step, setStep] = useState(1);
    const [playerOut, setPlayerOut] = useState(null);
    const [playerIn, setPlayerIn] = useState(null);

    // Reset state on open/close
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setPlayerOut(null);
            setPlayerIn(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Determine available OUT players (Back row: Pos 1, 6, 5 corresponding to indices 0, 5, 4 in lineup)
    const isServing = servingTeam === teamCode;
    const allowedIndices = isServing ? [4, 5] : [0, 4, 5];
    const posOrder = { 0: 1, 5: 2, 4: 3 };
    const allAvailableOut = lineup
        .map((p, idx) => p ? { ...p, posIndex: idx } : null)
        .filter(p => p && p.id && allowedIndices.includes(p.posIndex))
        .sort((a, b) => posOrder[a.posIndex] - posOrder[b.posIndex]);

    const hasLiberoOnCourt = allAvailableOut.some(p => isPlayerLibero(p));
    const availableOut = hasLiberoOnCourt
        ? allAvailableOut.filter(p => isPlayerLibero(p))
        : allAvailableOut;

    // Determine available IN (Libero) players
    let availableIn = [liberos?.l1, liberos?.l2].filter(Boolean);
    if (availableIn.length === 0) {
        availableIn = roster.filter(isPlayerLibero);
    }

    // Filter available IN players based on selected playerOut
    const filteredIn = playerOut
        ? availableIn.filter(lib => {
              const libId = lib.id || lib.player_id;
              const outId = playerOut.id || playerOut.player_id;
              if (String(libId) === String(outId)) return false;

              // Must not be on the court in other positions
              const isOnCourtElsewhere = lineup.some((p, idx) => {
                  if (idx === playerOut.posIndex) return false;
                  if (!p) return false;
                  const pId = p.id || p.player_id;
                  return String(pId) === String(libId);
              });
              return !isOnCourtElsewhere;
          })
        : [];

    const handleNext = () => {
        if (step === 1 && playerOut) {
            setStep(2);
        }
    };

    const handleBack = () => {
        if (step === 2) {
            setStep(1);
            setPlayerIn(null);
        }
    };

    const handleConfirm = () => {
        if (playerOut && playerIn) {
            onConfirm('IN', teamCode, {
                posIndex: playerOut.posIndex,
                playerIn: { ...playerIn, isLibero: true },
                playerOut
            });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center pointer-events-auto">
            <div className="bg-white w-[480px] p-6 rounded-2xl flex flex-col justify-between shadow-2xl border border-slate-100 relative max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                    <h3 className="text-lg font-extrabold text-slate-800 uppercase">
                        Libero In — {teamName}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 py-4 overflow-y-auto min-h-[200px] max-h-[380px]">
                    {step === 1 ? (
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">
                                Select Player Out (แถวหลัง)
                            </div>
                            {availableOut.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 font-medium">
                                    ไม่มีผู้เล่นแถวหลังที่สามารถสลับตัวได้ในขณะนี้
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {availableOut.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setPlayerOut(p)}
                                            className={`flex items-center gap-4 w-full p-3.5 rounded-xl border-2 transition-all text-left ${
                                                playerOut?.id === p.id
                                                    ? 'border-rose-500 bg-rose-50/30'
                                                    : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className={`w-9 h-9 rounded-lg font-extrabold text-base flex items-center justify-center transition-colors ${
                                                playerOut?.id === p.id ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-500'
                                            }`}>
                                                {p.number}
                                            </span>
                                            <span className="font-bold text-slate-700">
                                                {p.first_name || p.name || ''} {p.last_name || ''}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                                Select Libero In
                            </div>
                            
                            {/* Selected OUT Player Banner */}
                            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <span>Player Out:</span>
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-rose-100 text-rose-600 border border-rose-200 font-bold">
                                    #{playerOut.number}
                                </span>
                                <span className="font-bold text-slate-700">
                                    {playerOut.first_name || playerOut.name || ''}
                                </span>
                            </div>

                            {filteredIn.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 font-medium">
                                    ไม่มี Libero ที่พร้อมลงสนามในขณะนี้
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {filteredIn.map((lib, idx) => (
                                        <button
                                            key={lib.id}
                                            onClick={() => setPlayerIn(lib)}
                                            className={`flex items-center gap-4 w-full p-3.5 rounded-xl border-2 transition-all text-left ${
                                                playerIn?.id === lib.id
                                                    ? 'border-emerald-500 bg-emerald-50/30'
                                                    : idx === 0 
                                                        ? 'border-amber-100 bg-amber-50/20 hover:border-emerald-500' 
                                                        : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 font-extrabold text-base flex items-center justify-center">
                                                L{idx + 1}
                                            </span>
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 text-rose-600 border border-rose-200 font-bold text-sm">
                                                {lib.number}
                                            </span>
                                            <span className="font-bold text-slate-700 flex-1">
                                                {lib.first_name || lib.name || ''} {lib.last_name || ''}
                                            </span>
                                            {idx === 0 && (
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                                    Primary
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
                    {step === 2 && (
                        <button
                            onClick={handleBack}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors"
                        >
                            Back
                        </button>
                    )}
                    {step === 1 ? (
                        <button
                            onClick={handleNext}
                            disabled={!playerOut}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-colors"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            disabled={!playerIn}
                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-colors"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
