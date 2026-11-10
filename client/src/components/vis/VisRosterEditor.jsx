import useUiTranslation from '../../hooks/useUiTranslation';
export default function VisRosterEditor({ players, onChange, disabled, teamLabel }) {
    const ui = useUiTranslation();
    const input = 'w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white disabled:opacity-60';
    const update = (index, fields) => onChange(players.map((player, i) => {
        if (i !== index) return player;
        const next = {...player,...fields};
        for (const base of ['first_name','last_name']) if (fields[base+'_th'] !== undefined || fields[base+'_en'] !== undefined) next[base] = next[base+'_th'] || next[base+'_en'] || '';
        return next;
    }));
    return <fieldset disabled={disabled} className="space-y-3 rounded border border-slate-700 p-3">
        <legend className="px-1 text-sm font-semibold">{ui("พิมพ์รายชื่อนักกีฬา ·")}{' '}{teamLabel}</legend>
        <p className="text-xs text-slate-400">{ui("เพิ่มหรือแก้ไขรายชื่อได้โดยตรง รวมถึงรายชื่อที่นำเข้าจาก Excel สูงสุดทีมละ 30 คน")}</p>
        <div className="max-h-96 space-y-3 overflow-y-auto">
            {players.map((player, index) => <div key={index} className="space-y-2 rounded bg-slate-800 p-3">
                <div className="flex items-center justify-between text-xs"><span>{ui("นักกีฬาคนที่")}{' '}{index + 1}</span><button type="button" className="text-red-300 disabled:opacity-40" aria-label={ui(`ลบนักกีฬาคนที่ {0} {1}`, [index + 1, teamLabel])} onClick={() => onChange(players.filter((_, i) => i !== index))}>{ui("ลบรายชื่อ")}</button></div>
                <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">{ui("เบอร์ *")}<input className={input} type="number" min="1" max="999" step="1" value={player.number} onChange={event => update(index, { number: event.target.value })} /></label>
                    <label className="text-xs">{ui("ตำแหน่ง")}<select className={input} value={player.position || ''} onChange={event => update(index, { position: event.target.value })}><option value="">{ui("ไม่ระบุ")}</option>{['S', 'OH', 'MB', 'OPP', 'OP', 'L'].map(position => <option key={position} value={position}>{position}</option>)}</select></label>
                    <label className="text-xs">{ui("ชื่อ *")}<input className={input} maxLength={160} value={player.first_name} onChange={event => update(index, { first_name: event.target.value })} /></label>
                    <label className="text-xs">{ui("นามสกุล *")}<input className={input} maxLength={160} value={player.last_name} onChange={event => update(index, { last_name: event.target.value })} /></label>
                </div>
                <div className="grid grid-cols-2 gap-2">{[['first_name_th','ชื่อ (ไทย)'],['last_name_th','นามสกุล (ไทย)'],['first_name_en','First name (English)'],['last_name_en','Last name (English)']].map(([key,label]) => <label key={key} className="text-xs">{ui(label)}<input className={input} maxLength={50} value={player[key] || ''} onChange={event => update(index,{[key]:event.target.value})} /></label>)}</div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(player.is_captain)} onChange={event => onChange(players.map((p, i) => ({ ...p, is_captain: i === index ? event.target.checked : false })))} />{ui("กัปตันทีม (C)")}</label>
            </div>)}
        </div>
        <button type="button" disabled={disabled || players.length >= 30} className="rounded bg-sky-800 px-3 py-2 text-sm disabled:opacity-40" onClick={() => onChange([...players, { number: '', first_name: '', last_name: '', position: '', is_captain: false }])}>{ui("+ เพิ่มนักกีฬา")}</button>
        <p className="text-xs text-slate-400">{players.length}{ui("/30 คน · ต้องระบุเบอร์ ชื่อ และนามสกุลก่อนกดถัดไป")}</p>
    </fieldset>;
}
