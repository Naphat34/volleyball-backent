import { useState } from 'react';
import { Clock3, ArrowLeftRight, X } from 'lucide-react';

export default function VisMatchControls({ teams, locked, send, timeouts, substitutions, showTeamName = true, stacked = false }) {
    const [teamKey, setTeamKey] = useState(null);
    const [playerOut, setPlayerOut] = useState('');
    const [playerIn, setPlayerIn] = useState('');
    const team = teams.find(item => item.key === teamKey);
    const bench = team?.players.filter(player => !team.lineup.some(item => item.id === player.id)) || [];
    const buttonClass = `inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 py-2 text-slate-100 hover:bg-slate-700 disabled:opacity-40 ${stacked ? 'w-full px-2 text-xs' : 'px-3 text-sm'}`;
    const submit = async event => {
        event.preventDefault();
        if (locked || !playerOut || !playerIn) return;
        if (await send({ type: 'SUBSTITUTION', team: teamKey, playerOut: Number(playerOut), playerIn: Number(playerIn) })) setTeamKey(null);
    };
    return <>
        {teams.map(item => <div key={item.key} className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={`ควบคุมทีม ${item.name}`}>
            {showTeamName && <span className="max-w-32 truncate text-xs text-slate-300" title={item.name}>{item.name}</span>}
            <button className={buttonClass} aria-label={`เวลานอก ${item.name} ${timeouts[item.key]}/2`} disabled={locked || timeouts[item.key] >= 2} onClick={() => send({ type: 'TIMEOUT', team: item.key })}>
                <Clock3 size={15} />เวลานอก {timeouts[item.key]}/2
            </button>
            <button className={buttonClass} aria-label={`เปลี่ยนตัว ${item.name} ${substitutions[item.key]}/6`} disabled={locked || substitutions[item.key] >= 6 || item.players.length <= item.lineup.length}
                onClick={() => { setTeamKey(item.key); setPlayerOut(''); setPlayerIn(''); }}>
                <ArrowLeftRight size={15} />เปลี่ยนตัว {substitutions[item.key]}/6
            </button>
        </div>)}
        {team && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
            <form onSubmit={submit} aria-label="เปลี่ยนตัวผู้เล่น" className="w-full max-w-lg space-y-4 rounded-xl border border-slate-600 bg-slate-900 p-5 text-white">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold">เปลี่ยนตัว · {team.name}</h2><button type="button" onClick={() => setTeamKey(null)} aria-label="ปิด"><X size={20} /></button></div>
                <label className="block">ผู้เล่นออก<select value={playerOut} disabled={locked} onChange={event => setPlayerOut(event.target.value)} className="mt-2 block w-full rounded bg-slate-800 p-3">
                    <option value="">เลือกผู้เล่นในสนาม</option>{team.lineup.map(player => <option key={player.id} value={player.id}>#{player.number} {player.name}</option>)}
                </select></label>
                <label className="block">ผู้เล่นเข้า<select value={playerIn} disabled={locked} onChange={event => setPlayerIn(event.target.value)} className="mt-2 block w-full rounded bg-slate-800 p-3">
                    <option value="">เลือกผู้เล่นสำรอง</option>{bench.map(player => <option key={player.id} value={player.id}>#{player.number} {player.name}</option>)}
                </select></label>
                <button type="submit" disabled={locked || !playerOut || !playerIn} className="rounded bg-indigo-600 px-4 py-3 disabled:opacity-40">ยืนยันเปลี่ยนตัว</button>
                <button type="button" onClick={() => setTeamKey(null)} className="ml-3 rounded bg-slate-700 px-4 py-3">ยกเลิก</button>
            </form>
        </div>}
    </>;
}
