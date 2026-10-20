import { useState } from 'react';

export default function VisLineupPanel({ teams, locked, send, onClose, onCancel, initialServingTeam, initialHomeLeft, requiresToss = true }) {
    const [step, setStep] = useState(1);
    const [servingTeam, setServingTeam] = useState(initialServingTeam || '');
    const [firstSetHomeLeft, setFirstSetHomeLeft] = useState(initialHomeLeft ?? null);
    const [lineups, setLineups] = useState(() => Object.fromEntries(teams.map(team =>
        [team.key, Array.from({ length: 6 }, (_, index) => team.lineup[index]?.id || '')])));
    const valid = teams.every(team => lineups[team.key].every(Boolean) && new Set(lineups[team.key]).size === 6);
    const rotate = (key, direction) => setLineups(previous => {
        const slots = previous[key];
        return { ...previous, [key]: direction === 1 ? [...slots.slice(1), slots[0]] : [slots[5], ...slots.slice(0, 5)] };
    });
    const save = async event => {
        event.preventDefault();
        if (step === 1 && requiresToss) { if (valid) setStep(2); return; }
        if (step === 2) { if (servingTeam) setStep(3); return; }
        if (!locked && valid && (!requiresToss || (servingTeam && typeof firstSetHomeLeft === 'boolean'))
            && await send({ type: 'SET_LINEUP', lineups, servingTeam, firstSetHomeLeft })) onClose();
    };
    return <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/95 p-4 text-white">
        <form onSubmit={save} className="mx-auto max-w-4xl rounded-xl border border-slate-600 bg-slate-900 p-5">
            <h2 className="text-xl font-bold">จัด Lineup สำหรับ VIS</h2>
            <p className="my-3 text-indigo-200">ขั้นตอน {step}/{requiresToss ? 3 : 1} · {step === 1 ? 'เลือก Lineup' : step === 2 ? 'เลือกทีมเสิร์ฟก่อน' : 'เลือกแดน A / B'}</p>
            <p className="mt-2 text-sm text-slate-300">เลือกผู้เล่น 6 คนตามตำแหน่ง P1–P6 ของทั้งสองทีม แล้วบันทึกเพื่อเริ่มลงสถิติ</p>
            {step === 1 && <div className="my-5 grid gap-6 md:grid-cols-2">{teams.map(team => <section key={team.key}>
                <h3 className="mb-3 font-bold">{team.name}</h3>
                {team.players.length < 6 && <p role="alert" className="mb-3 text-amber-300">ผู้เล่นไม่ครบ 6 คน กรุณาเพิ่มรายชื่อใน roster ของแมตช์</p>}
                <div className="mb-3 border-t-4 border-white bg-orange-950/40 p-3"><p className="mb-3 text-center text-xs text-slate-300">ตาข่าย · มุมมองจากแดนของทีม</p><div className="grid grid-cols-3 gap-3">
                {[3, 2, 1, 4, 5, 0].map(index => <label key={index} className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-600 bg-slate-950/70 p-2">
                    <span className="text-sm font-bold text-sky-200">P{index + 1}{index === 0 ? ' · เสิร์ฟ' : ''}</span><select aria-label={team.name + ' P' + (index + 1)} value={lineups[team.key][index]} disabled={locked}
                        className="w-full min-w-0 rounded border border-slate-500 bg-slate-800 p-2 text-sm"
                        onChange={event => { const value = Number(event.target.value) || ''; setLineups(previous => ({ ...previous,
                            [team.key]: previous[team.key].map((item, slot) => slot === index ? value : item) })); }}>
                        <option value="">เลือกผู้เล่น</option>{team.players.map(player => <option key={player.id} value={player.id}
                            disabled={player.id !== lineups[team.key][index] && lineups[team.key].includes(player.id)}>#{player.number} {player.name}</option>)}
                    </select>
                </label>)}</div></div>
                <div className="flex gap-2">{[-1, 1].map(direction => <button key={direction} type="button" disabled={locked || !lineups[team.key].every(Boolean)} onClick={() => rotate(team.key, direction)} className="rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-40">{direction === 1 ? '↻ หมุนปกติ' : '↺ หมุนย้อน'}</button>)}</div>
            </section>)}</div>}
            {step === 2 && <fieldset className="my-5 space-y-3"><legend className="mb-3 font-bold">ทีมใดเสิร์ฟก่อน?</legend>
                {teams.map(team => <label key={team.key} className="flex gap-3 rounded border border-slate-600 p-4">
                    <input type="radio" name="first-serve" value={team.key} checked={servingTeam === team.key} disabled={locked} onChange={() => setServingTeam(team.key)} />{team.name}
                </label>)}
                <p className="text-sm text-slate-300">ผู้เล่นตำแหน่ง P1 ของทีมที่เลือกจะเป็นผู้เสิร์ฟคนแรก</p>
            </fieldset>}
            {step === 3 && <fieldset className="my-5 space-y-3"><legend className="mb-3 font-bold">เลือกฝั่งสนามจากมุมมองผู้บันทึก</legend>
                {[true, false].map(homeLeft => <label key={String(homeLeft)} className="flex gap-3 rounded border border-slate-600 p-4">
                    <input type="radio" name="court-side" checked={firstSetHomeLeft === homeLeft} disabled={locked} onChange={() => setFirstSetHomeLeft(homeLeft)} />
                    แดน A (ซ้าย): {teams.find(team => team.key === (homeLeft ? 'home' : 'away'))?.name} · แดน B (ขวา): {teams.find(team => team.key === (homeLeft ? 'away' : 'home'))?.name}
                </label>)}
            </fieldset>}
            <div className="flex flex-wrap gap-3"><button type="submit" disabled={locked || !valid || (step === 2 && !servingTeam) || (step === 3 && firstSetHomeLeft === null)} className="rounded bg-indigo-600 px-5 py-3 disabled:opacity-40">{!requiresToss || step === 3 ? 'บันทึกและเริ่มลงสถิติ' : 'ถัดไป'}</button>
                {step > 1 && <button type="button" disabled={locked} onClick={() => setStep(step - 1)} className="rounded bg-slate-700 px-5 py-3">ย้อนขั้นตอน</button>}
                <button type="button" onClick={onCancel} className="rounded bg-slate-700 px-5 py-3">กลับ</button></div>
            {!valid && <p className="mt-3 text-sm text-amber-300">กรุณาเลือกผู้เล่นไม่ซ้ำกันให้ครบทั้งสองทีม</p>}
        </form>
    </div>;
}
