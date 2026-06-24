import React from 'react';
import { Calendar, MapPin, Swords, Edit2, Trash2, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import TeamLogoDisplay from './TeamLogoDisplay';
import { EmptyState } from '../pages/AdminShared';
import { formatThaiDate, formatThaiTime } from '../utils';

const MatchList = ({
    matches,
    darkMode,
    onScore,
    onClick,
    isAdmin = false // Default to false (read-only)
}) => {

    if (!matches || matches.length === 0) {
        return <EmptyState text="No matches found." darkMode={darkMode} />;
    }

    return (
        <div className="space-y-3">
            {matches.map((m, idx) => {
                if (!m) return null;
                const isCompleted = m.status === 'completed';
                const homeWin = isCompleted && Number(m.home_set_score || 0) > Number(m.away_set_score || 0);
                const awayWin = isCompleted && Number(m.away_set_score || 0) > Number(m.home_set_score || 0);

                return (
                    <div
                        key={m.id || idx}
                        onClick={() => onClick && onClick(m)}
                        className={`p-4 rounded-md border mb-3 flex flex-col md:flex-row items-center gap-4 transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    >

                        {/* 1. Info (Left) - ปรับปรุงใหม่: เพิ่ม Round, Pool, Gender, Time */}
                        <div className="flex flex-col items-center md:items-start w-full md:w-40 shrink-0 gap-1.5 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 pb-2 md:pb-0 md:pr-4">

                            {/* บรรทัด 1: เลขแมตช์ และ เพศ */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                                    #{m.match_number ?? '-'}
                                </span>
                                {/* แสดงเพศ */}
                                {m.gender && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${m.gender === 'Female' ? 'border-pink-200 text-pink-600 dark:text-pink-300 bg-pink-50 dark:bg-pink-900/20' :
                                        m.gender === 'Male' ? 'border-blue-200 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20' :
                                            'border-purple-200 text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20'
                                        }`}>
                                        {m.gender === 'Female' ? 'หญิง' : m.gender === 'Male' ? 'ชาย' : m.gender}
                                    </span>
                                )}
                            </div>

                            {/* บรรทัด 2: รอบการแข่งขัน และ สาย (Pool) */}
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate w-full text-center md:text-left">
                                {m.round_name || '-'}
                                {m.pool_name && <span className="ml-1 font-normal text-gray-500">({m.pool_name})</span>}
                            </div>

                            {/* บรรทัด 3: วันที่ และ เวลา (เน้นเวลา) */}
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                <Calendar size={12} className="mr-1.5 shrink-0" />
                                {m.start_time || m.match_date ? (
                                    <div className="flex items-center gap-1">
                                        <span>{formatThaiDate(m.start_date || m.match_date, { day: 'numeric', month: 'long' })}</span>
                                        {(m.start_time) && (
                                            <>
                                                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-0.5"></span>
                                                <span className="font-bold text-blue-600 dark:text-indigo-400">
                                                    {formatThaiTime(m.start_time)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                ) : 'TBD'}
                            </div>

                            {/* บรรทัด 4: สนามแข่งขัน */}
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                <MapPin size={12} className="mr-1.5 shrink-0" />
                                <span className="truncate max-w-[120px]">{m.location || '-'}</span>
                            </div>
                        </div>

                        {/* 2. Versus Area (Center) - Responsive: flex-col on mobile, grid on desktop */}
                        <div className="flex-1 flex flex-col sm:grid sm:grid-cols-7 items-center w-full gap-3 sm:gap-2">

                            {/* Home Team */}
                            <div className="sm:col-span-3 flex justify-center sm:justify-end w-full">
                                <TeamLogoDisplay
                                    logo={m.home_team_logo_url}
                                    code={m.home_team_code}
                                    name={m.home_team}
                                    isRightAligned={true}
                                    textColor={homeWin ? 'text-green-600 dark:text-green-400' : (isCompleted ? 'text-gray-400' : '')}
                                />
                            </div>

                            {/* Score / VS */}
                            <div className="sm:col-span-1 flex flex-col items-center justify-center min-w-[80px] w-full">
                                {(isCompleted || m.status === 'in_progress' || m.home_set_score != null || m.away_set_score != null) ? (
                                    <div className="flex flex-col items-center w-full">
                                        {/* 1. สกอร์หลัก (Score) */}
                                        <div className="text-2xl font-semibold tracking-widest text-gray-800 dark:text-white leading-none mb-1">
                                            {m.home_set_score ?? 0}-{m.away_set_score ?? 0}
                                        </div>

                                        {/* 2. คะแนนรายเซต (Set Scores) */}
                                        <div className="w-full flex justify-center mb-1.5">
                                            <div className="flex flex-wrap justify-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                                {(() => {
                                                    try {
                                                        const sets = typeof m.set_scores === 'string' ? JSON.parse(m.set_scores) : (Array.isArray(m.set_scores) ? m.set_scores : null);
                                                        return sets ? sets.join(', ') : null;
                                                    } catch { return m.set_scores; }
                                                })()}
                                            </div>
                                        </div>

                                        {/* 3. ป้ายสถานะ (Completed Badge) */}
                                        {isCompleted && (
                                            <div className="flex flex-col items-center gap-1 mt-1">
                                                <span className="text-[9px] px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 font-bold whitespace-nowrap border border-green-200 dark:border-green-700">
                                                    จบการแข่งขันเป็นทางการ
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
                                        VS
                                    </div>
                                )}
                            </div>

                            {/* Away Team */}
                            <div className="sm:col-span-3 flex justify-center sm:justify-start w-full">
                                <TeamLogoDisplay
                                    logo={m.away_team_logo_url}
                                    code={m.away_team_code}
                                    name={m.away_team}
                                    isRightAligned={false}
                                    textColor={awayWin ? 'text-green-600 dark:text-green-400' : (isCompleted ? 'text-gray-400' : '')}
                                />
                            </div>
                        </div>

                        {/* 3. Actions (Right) - Only show if isAdmin AND handlers are provided */}
                        {isAdmin && (
                            <div className="flex gap-2 justify-end border-l pl-4 border-gray-200 dark:border-gray-700">

                                {/* --- ปุ่มเดิม: Manual Score (สีเขียว) --- */}
                                {onScore && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); window.open(`/scoresheet/${m.id}`, '_blank'); }}
                                            className="flex items-center gap-1.5 px-2.5 py-1 mt-0.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-all hover:scale-105 active:scale-95"
                                            title="Official Score Sheet"
                                        >
                                            <FileText size={12} />
                                            Official Score Sheet
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); window.open(`/scoresheet/${m.id}?view=result`, '_blank'); }}
                                            className="flex items-center gap-1.5 px-2.5 py-1 mt-0.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-all hover:scale-105 active:scale-95"
                                            title="O-4 Match Report"
                                        >
                                            <FileText size={12} />
                                            O-4 Match Report
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MatchList;
