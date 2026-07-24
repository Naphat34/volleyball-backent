import React from 'react';
import { getContrastClass, getContrastColorHex } from '../../../utils/colorUtils';

export default function TeamInfoPanel({ team, align = 'left', onPlayerClick }) {
    if (!team) return null;

    const { lineup = [], roster = [], liberos = {}, color = '#1d4ed8', subTracker } = team;

    // 1. ดึงข้อมูลนักกีฬาที่อยู่ในสนาม 
    const validLineup = lineup
        .map((p, index) => p ? { ...p, posIndex: index } : null)
        .filter(Boolean);

    const onCourtIds = validLineup.map(p => p.id || p.player_id);
    const sortedOnCourt = [...validLineup].sort((a, b) => a.posIndex - b.posIndex);

    // 2. ดึงข้อมูลนักกีฬาที่อยู่ม้านั่งสำรอง
    const benchPlayers = roster.filter(p => {
        const pId = p.id || p.player_id;
        return !onCourtIds.includes(pId);
    }).sort((a, b) => parseInt(a.number) - parseInt(b.number));

    const isRight = align === 'right';
    const courtTextClass = getContrastClass(color, 0.35);

    return (
        <div className="flex flex-col h-full bg-white select-none border border-slate-200 rounded-sm">
            {/* Header ชื่อทีม */}
            <div
                className="flex items-center justify-center gap-2 bg-white px-4 py-3 text-center text-xl font-black uppercase tracking-wide"
                style={{ borderBottom: `3px solid ${color}`, color: '#000000' }}
            >
                <span className="w-full truncate" title={team.name}>{team.name}</span>
                
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ================= SECTION 1: ON COURT ================= */}
                <div className="flex flex-1 overflow-hidden border-b border-gray-200 min-h-[50%]">

                    {!isRight && (
                        <div className="w-7 flex items-center justify-center border-r border-gray-200 shrink-0" style={{ backgroundColor: `${color}5A` }}>
                            <span className={`${courtTextClass} text-[10px] font-bold tracking-widest uppercase [writing-mode:vertical-rl] rotate-180`}>On court</span>
                        </div>
                    )}

                    <div className={`flex-1 bg-white overflow-y-auto`}>
                        {sortedOnCourt.map((p) => {
                            let subbedOutNum = null;
                            const pId = p.id || p.player_id;

                            const isLibero = p.isLibero || (liberos.l1 && liberos.l1.id === p.id) || (liberos.l2 && liberos.l2.id === p.id);
                            let liberoLabel = null;
                            if (liberos.l1 && liberos.l1.id === p.id) liberoLabel = 'L1';
                            else if (liberos.l2 && liberos.l2.id === p.id) liberoLabel = 'L2';
                            else if (isLibero) liberoLabel = 'L';

                            if (subTracker && subTracker.positions) {
                                const activeSub = Object.values(subTracker.positions).find(
                                    data => data.currentOnCourt == pId && !data.returned
                                );

                                if (activeSub && activeSub.starterId) {
                                    const starter = roster.find(r => (r.id || r.player_id) == activeSub.starterId);
                                    if (starter) {
                                        subbedOutNum = `(${starter.number})`;
                                    }
                                }
                            }

                            const badgeBg = color;
                            const badgeColor = getContrastColorHex(color);

                            return (
                                <div
                                    key={p.id || p.number}
                                    onClick={() => onPlayerClick && onPlayerClick(align === 'left' ? 'home' : 'away', p.posIndex)}
                                    className="flex items-center px-3 py-2 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    {/* หมายเลขผู้เล่นปัจจุบัน + (หมายเลขเดิม) */}
                                    <div className="w-8 flex items-baseline justify-start gap-1 shrink-0">
                                        <span className="font-bold text-[14px] text-slate-700 leading-none">
                                            {p.number}
                                        </span>
                                        
                                        {subbedOutNum && (
                                            <span className="text-[11px] text-slate-400 font-normal tracking-tighter">
                                                {subbedOutNum}
                                            </span>
                                        )}
                                    </div>

                                    {/* ชื่อนักกีฬา */}
                                    <div className="flex-1 text-slate-600 font-medium truncate text-sm">
                                        {p.first_name || p.name}
                                    </div>

                                    {/* Icon กัปตัน / ลิเบอโร่ */}
                                    <div className="flex items-center justify-end gap-1 shrink-0">
                                        {(p.isCaptain || p.is_captain || p.role === 'C') && (
                                            <span className="mt-1 text-[10px] font-bold px-1.5 rounded-sm" style={{ backgroundColor: badgeBg, color: badgeColor }}>
                                                C
                                            </span>
                                        )}
                                        {isLibero && (
                                            <span className="bg-[#f59e0b] text-white font-bold text-[10px] rounded px-1.5 py-0.5 leading-none">{liberoLabel}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {isRight && (
                        <div className="w-7 flex items-center justify-center border-l border-gray-200 shrink-0" style={{ backgroundColor: `${color}5A` }}>
                            <span className={`${courtTextClass} text-[10px] font-bold tracking-widest uppercase [writing-mode:vertical-rl]`}>On court</span>
                        </div>
                    )}
                </div>

                {/* ================= SECTION 2: ON BENCH ================= */}
                <div className="flex flex-1 overflow-hidden min-h-[50%]">
                    {!isRight && (
                        <div className="w-7 bg-slate-400 flex items-center justify-center border-r border-gray-200 shrink-0">
                            <span className="text-white text-[10px] font-bold tracking-widest uppercase [writing-mode:vertical-rl] rotate-180">On bench</span>
                        </div>
                    )}

                    <div className={`flex-1 bg-[#f8fafc] overflow-y-auto`}>
                        {benchPlayers.map((p) => {
                            const isLibero = p.isLibero || (liberos.l1 && liberos.l1.id === p.id) || (liberos.l2 && liberos.l2.id === p.id);
                            const pId = p.id || p.player_id;

                            let liberoLabel = null;
                            if (liberos.l1 && liberos.l1.id === p.id) liberoLabel = 'L1';
                            else if (liberos.l2 && liberos.l2.id === p.id) liberoLabel = 'L2';
                            else if (isLibero) liberoLabel = 'L';

                            // ตรวจสอบและดึงข้อมูลคนที่ไปเล่นแทน (สำหรับตัวจริงที่มานั่งพักอยู่ม้านั่งสำรอง)
                            let subbedInNum = null;
                            let subScoreText = null;

                            if (subTracker && subTracker.positions) {
                                // หากรณีที่คนนี้คือตัวจริง (starterId) และยังมีตัวสำรองอยู่ในสนาม (!returned)
                                const activeSubOut = Object.values(subTracker.positions).find(
                                    data => data.starterId == pId && !data.returned
                                );

                                if (activeSubOut) {
                                    const subPlayer = roster.find(r => (r.id || r.player_id) == activeSubOut.subId);
                                    if (subPlayer) {
                                        subbedInNum = `(${subPlayer.number})`;
                                        subScoreText = activeSubOut.subScore; // เช่น "2-1"
                                    }
                                }
                            }

                            return (
                                <div key={p.id || p.number} className="flex items-center px-3 py-2 bg-[#f8fafc] border-b border-gray-100 hover:bg-slate-100 transition-colors">

                                    {/* หมายเลขตัวจริงที่นั่งอยู่ + (หมายเลขตัวสำรองที่เล่นแทน) */}
                                    <div className="w-8 flex items-baseline justify-start gap-1 shrink-0">
                                        <span className="font-bold text-[14px] text-slate-700">
                                            {p.number}
                                        </span>
                                        {subbedInNum && (
                                            <span className="text-[11px] text-slate-400 font-normal tracking-tighter">
                                                {subbedInNum}
                                            </span>
                                        )}
                                    </div>

                                    {/* ชื่อนักกีฬา และ คะแนนตอนเปลี่ยนตัว (ชิดขวา) */}
                                    <div className="flex-1 flex items-center justify-between overflow-hidden">
                                        <span className="font-medium truncate text-sm text-slate-600">
                                            {p.first_name || p.name}
                                        </span>

                                        {subScoreText && (
                                            <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded shrink-0 shadow-sm border border-slate-200 tracking-wider ml-2">
                                                {subScoreText.replace('-', ' - ')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Icon กัปตัน / ลิเบอโร่ */}
                                    <div className="flex items-center justify-end gap-1 shrink-0">
                                        {(p.isCaptain || p.is_captain || p.role === 'C') && (
                                            <span className="bg-[#3b82f6] text-white font-bold text-[10px] rounded px-1.5 py-0.5 leading-none">C</span>
                                        )}
                                        {isLibero && (
                                            <span className="bg-[#f59e0b] text-white font-bold text-[10px] rounded px-1.5 py-0.5 leading-none">{liberoLabel}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {isRight && (
                        <div className="w-7 bg-slate-400 flex items-center justify-center border-l border-gray-200 shrink-0">
                            <span className="text-white text-[10px] font-bold tracking-widest uppercase [writing-mode:vertical-rl]">On bench</span>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
