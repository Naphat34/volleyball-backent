import React, { useState, useEffect } from 'react';

export default function LiberoModal({ isOpen, onClose, teamName, lineup = [], liberos = {}, tracker = {}, isServing, onConfirm }) {
    const [selectedOut, setSelectedOut] = useState(null);
    const [selectedIn, setSelectedIn] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedOut(null);
            setSelectedIn(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const allowedIndices = isServing ? [4, 5] : [0, 4, 5];

    // ฝั่ง Out: ดึงผู้เล่นตัวจริงที่อยู่ในสนามปัจจุบัน (และต้องไม่ใช่ Libero อยู่แล้ว)
    const availablePlayers = lineup
        .map((player, index) => ({ ...player, posIndex: index }))
        .filter(player => player && player.id && !player.isLibero && allowedIndices.includes(player.posIndex));

    // ฝั่ง In: ดึงข้อมูล Libero ที่ลงทะเบียนไว้
    const availableLiberos = [liberos.l1, liberos.l2].filter(Boolean);

    const handleReplace = () => {
        if (!selectedOut || !selectedIn) {
            alert("กรุณาเลือกผู้เล่นที่จะออก และ Libero ที่จะเข้าให้ครบถ้วน");
            return;
        }
        
        // ส่งค่าการสลับตัวกลับไปให้ ScorerConsole เพื่อทำงานต่อ (IN = เอา Libero ลงสนาม)
        onConfirm('IN', {
            posIndex: selectedOut.posIndex,
            playerIn: selectedIn,
            playerOut: selectedOut
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            {/* กล่อง Modal สไตล์คลาสสิกขอบน้ำเงิน */}
            <div className="bg-white border-[3px] border-[#000080] w-[700px] shadow-2xl font-sans select-none">
                
                {/* Header Bar */}
                <div className="bg-[#000080] text-white flex justify-between items-center px-2 py-1.5 text-sm">
                    <span className="font-bold tracking-wide">Libero in</span>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onClose}
                            className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-0.5 font-bold border border-white leading-none transition-colors"
                            title="Close"
                        >
                            X
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-gray-50/50">
                    {/* ชื่อทีม */}
                    <h2 className="text-center text-2xl font-bold text-[#000080] mb-6 drop-shadow-sm">{teamName || 'Team'}</h2>

                    <div className="flex justify-between gap-6">
                        
                        {/* ---------------- ฝั่งซ้าย: Out (ผู้เล่นที่จะออก) ---------------- */}
                        <div className="w-1/2">
                            <div className="flex items-center gap-2 mb-1 pl-1">
                                <span className="text-red-600 text-3xl font-semibold leading-none drop-shadow-sm">↓</span>
                                <span className="font-bold text-lg">Out</span>
                            </div>
                            <div className="border border-[#8aaee0] rounded-t-md overflow-hidden shadow-inner">
                                <div className="bg-[#8aaee0] text-white text-center py-1.5 font-semibold text-sm">
                                    Players available for replacement
                                </div>
                                <div className="p-2 min-h-[160px] bg-white border-t border-[#8aaee0]">
                                    {availablePlayers.map((player) => (
                                        <div
                                            key={player.id || player.number}
                                            onClick={() => setSelectedOut(player)}
                                            className={`flex items-center px-2 py-1.5 cursor-pointer border-b border-gray-100 last:border-0 transition-colors ${
                                                selectedOut?.id === player.id ? 'bg-[#3b82f6] text-white' : 'hover:bg-[#f0f5ff] text-slate-800'
                                            }`}
                                        >
                                            <div className="w-8"></div>
                                            <div className="w-12 font-bold text-base">{player.number}</div>
                                            <div className="truncate">{player.first_name || player.name}</div>
                                        </div>
                                    ))}
                                    {availablePlayers.length === 0 && (
                                        <div className="text-center text-gray-400 italic mt-4 text-sm">No players available</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ---------------- ฝั่งขวา: In (Libero ที่จะเข้า) ---------------- */}
                        <div className="w-1/2">
                            <div className="flex items-center justify-end gap-2 mb-1 pr-1">
                                <span className="font-bold text-lg">In</span>
                                <span className="text-green-500 text-3xl font-semibold leading-none drop-shadow-sm">↑</span>
                            </div>
                            <div className="border border-[#8aaee0] rounded-t-md overflow-hidden shadow-inner">
                                <div className="bg-[#8aaee0] text-white text-center py-1.5 font-semibold text-sm">
                                    Libero
                                </div>
                                <div className="p-2 min-h-[160px] bg-white border-t border-[#8aaee0]">
                                    {availableLiberos.map((libero, index) => (
                                        <div
                                            key={libero.id || libero.number}
                                            onClick={() => setSelectedIn(libero)}
                                            className={`flex items-center px-2 py-2 cursor-pointer mb-1 border-2 transition-all ${
                                                index === 0 ? 'bg-[#ffeb3b]' : 'bg-gray-200'
                                            } ${
                                                selectedIn?.id === libero.id ? 'border-blue-500 ring-2 ring-blue-500 shadow-md scale-[1.02]' : 'border-transparent'
                                            }`}
                                        >
                                            <div className="w-10 font-bold text-[#000080] text-sm flex items-center justify-center">
                                                <span className="bg-[#e6f0ff] rounded-full w-5 h-5 flex items-center justify-center border border-[#8aaee0] text-[11px] shadow-sm">L</span>
                                            </div>
                                            <div className="w-12 font-bold text-red-600 text-base">{libero.number}</div>
                                            <div className="text-red-600 font-medium truncate">{libero.first_name || libero.name}</div>
                                        </div>
                                    ))}
                                    {availableLiberos.length === 0 && (
                                        <div className="text-center text-gray-400 italic mt-4 text-sm">No Libero registered</div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* ---------------- ส่วนล่าง: ข้อความแนะนำและปุ่มกดยืนยัน ---------------- */}
                    <div className="mt-8 flex justify-between items-end">
                        <p className="text-[#3b82f6] text-sm max-w-[200px] text-center leading-tight">
                            Select the player to substitute the Libero and click on 'Replace'
                        </p>
                        <div className="flex gap-2 w-[300px]">
                            <button 
                                onClick={handleReplace}
                                className="flex-1 bg-[#1d4ed8] hover:bg-blue-800 text-white font-bold py-2.5 px-4 shadow-md transition-colors border border-[#000080]"
                            >
                                Replace
                            </button>
                            <button 
                                onClick={onClose}
                                className="w-[110px] bg-[#6b7280] hover:bg-gray-700 text-white font-bold py-2.5 px-4 shadow-md transition-colors border border-gray-600"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}