import React from 'react';
import { Loader } from 'lucide-react';

const RosterList = ({ list, team, toggleSelect, setRole }) => {
    if (!list || list.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
                <Loader className="animate-spin mb-3 text-blue-500" size={32} />
                <p className="font-bold">กำลังโหลดรายชื่อนักกีฬา...</p>
                <p className="text-xs opacity-60 mt-1">(หากรอนาน โปรดตรวจสอบว่าทีมนี้มีนักกีฬาในระบบหรือไม่)</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase mb-2 px-4 select-none">
                <div className="col-span-1 text-center">Select</div>
                <div className="col-span-1 text-center">No.</div>
                <div className="col-span-6">Name</div>
                <div className="col-span-2 text-center">Capt.</div>
                <div className="col-span-2 text-center">Libero</div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-2 pb-4">
                {list.map(p => {
                    const fName = p.first_name || p.firstname || '';
                    const lName = p.last_name || p.lastname || '';
                    const nickname = p.nickname ? `(${p.nickname})` : '';
                    const displayName = (fName || lName) ? `${fName} ${lName} ${nickname}`.trim() : (p.name || '');

                    return (
                        <div key={p.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-all duration-200 ${p.selected ? 'bg-slate-700 border-slate-600 shadow-md' : 'bg-slate-800/30 border-slate-800 opacity-60 hover:opacity-80' }`}>
                            <div className="col-span-1 flex justify-center">
                                <input type="checkbox" checked={p.selected || false} onChange={() => toggleSelect(team, p.id)} className="w-5 h-5 accent-green-500 rounded cursor-pointer transition-transform active:scale-90" />
                            </div>
                            <div className={`col-span-1 font-semibold text-center text-lg ${p.selected ? 'text-white' : 'text-slate-500'}`}>{p.number}</div>
                            <div className={`col-span-6 text-sm truncate font-medium ${p.selected ? 'text-slate-200' : 'text-slate-500'}`} title={displayName}>{displayName}</div>
                            <div className="col-span-2 flex justify-center">
                                <button onClick={() => p.selected && setRole(team, p.id, 'isCaptain')} disabled={!p.selected} className={`w-8 h-8 rounded-full text-xs font-bold transition-all border-2 flex items-center justify-center ${!p.selected ? 'opacity-20 cursor-not-allowed border-slate-700 text-slate-700' : p.isCaptain ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.4)] scale-110' : 'bg-transparent text-slate-500 border-slate-600 hover:border-slate-400 hover:text-white' }`}>C</button>
                            </div>
                            <div className="col-span-2 flex justify-center">
                                <button onClick={() => p.selected && setRole(team, p.id, 'isLibero')} disabled={!p.selected} className={`w-8 h-8 rounded-full text-xs font-bold transition-all border-2 flex items-center justify-center ${!p.selected ? 'opacity-20 cursor-not-allowed border-slate-700 text-slate-700' : p.isLibero ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)] scale-110' : 'bg-transparent text-slate-500 border-slate-600 hover:border-slate-400 hover:text-white' }`}>L</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RosterList;
