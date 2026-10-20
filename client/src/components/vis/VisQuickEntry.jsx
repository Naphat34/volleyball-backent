import { useEffect, useRef, useState } from 'react';
import { parseVisRally, rallyCode } from '../../utils/visRally';
import { visSkillNames } from '../../utils/visPresentation';

export default function VisQuickEntry({ teams, locked, send, commandContext, servingTeam, score, lastSavedOperationId, onUndo, undoDisabled }) {
    const [draft, setDraft] = useState('');
    const [choice, setChoice] = useState(0);
    const [skip, setSkip] = useState(false);
    const [notice, setNotice] = useState('');
    const input = useRef(null), busy = useRef(false), context = useRef(null);
    const paintedCode = useRef(null);
    const ownOperation = useRef(null);
    useEffect(() => {
        if (!locked && ownOperation.current && ownOperation.current === lastSavedOperationId) {
            ownOperation.current = null; context.current = null;
            setDraft(''); setChoice(0); setSkip(false); setNotice('บันทึกทั้งแรลลี่แล้ว');
        }
    }, [lastSavedOperationId, locked]);
    const parsed = parseVisRally(draft, teams, servingTeam);
    for (const event of parsed.events) {
        if (event.skill === 'S' && (event.team !== servingTeam || event.player !== Object.values(teams).find(team => team.key === servingTeam)?.lineup[0]?.id)) {
            parsed.errors.push('ผู้เสิร์ฟต้องเป็น P1 ของทีมที่มีสิทธิ์เสิร์ฟ · กรุณาตรวจไลน์อัป');
        }
    }
    const suggestion = !skip ? parsed.suggestions[choice % (parsed.suggestions.length || 1)] : null;
    const events = [...parsed.events, ...(suggestion ? [suggestion] : [])];
    const valid = parsed.events.length && parsed.winner && !parsed.errors.length;
    const teamData = key => Object.values(teams).find(team => team.key === key);
    const teamColor = team => team === 'home' ? 'text-blue-400' : 'text-red-400';
    const describe = event => {
        const player = teamData(event.team)?.players.find(player => Number(player.id) === event.player);
        const actor = player ? `#${event.number} ${player.name || ''}` : teamData(event.team)?.name;
        const action = event.skill === 'OP' ? 'คู่แข่งเสีย → ได้แต้ม' : event.skill === 'T' ? 'ทีมเสีย → แต้มให้คู่แข่ง'
            : event.grade === '/' ? 'ตบ → โดนบล็อก/เสีย' : event.grade === '#' ? `${visSkillNames[event.skill]} → ได้แต้ม/สมบูรณ์`
                : event.grade === '=' ? `${visSkillNames[event.skill]} → เสีย` : `${visSkillNames[event.skill]}${event.grade ? ` (${event.grade})` : ''}`;
        return `${actor}  ${action}`;
    };
    const chip = 'inline-flex items-center justify-center gap-1 rounded-md border border-slate-600/70 bg-slate-700/40 px-2 py-1 text-[11px] leading-none text-slate-200 hover:bg-slate-600/60 disabled:opacity-40';
    const teamCommands = Object.values(teams).flatMap(team => ['OP#', 'T='].map(code => ({ team, code })));
    const append = code => { update(draft + code); input.current?.focus(); };
    const update = value => {
        if (locked || busy.current) return;
        if (!draft) context.current = commandContext;
        setDraft(value); setChoice(0); setSkip(false); setNotice('');
    };
    const auto = () => {
        if (locked || busy.current) return;
        if (!draft.trim()) {
            const player = teamData(servingTeam)?.lineup[0];
            if (!player) { setNotice('ยังไม่มีผู้เสิร์ฟในไลน์อัป'); return; }
            update(`${servingTeam === 'home' ? '*' : 'a'}${player.number}S`);
        } else if (suggestion) update(`${draft.trim()} ${rallyCode(suggestion)}`);
        else update(`${draft.trim()} ${parsed.events.at(-1)?.team === 'home' ? 'a' : '*'} `);
        input.current?.focus();
    };
    const save = async event => {
        event.preventDefault();
        if (locked || busy.current || !valid) return;
        busy.current = true;
        const operationId = crypto.randomUUID();
        ownOperation.current = operationId;
        try {
            const saved = await send({ type: 'RALLY', events: events.map(({ team, player, skill, grade, generated }) => ({ team, player, skill, grade, generated })), context: context.current || commandContext }, false, operationId);
            if (saved) { setDraft(''); setChoice(0); setSkip(false); context.current = null; setNotice('บันทึกทั้งแรลลี่แล้ว'); }
            else setNotice('ยังไม่บันทึก · เก็บรหัสเดิมไว้เพื่อให้ตรวจสอบและลองใหม่');
        } finally { busy.current = false; input.current?.focus(); }
    };
    const nextScore = score && parsed.winner && !parsed.errors.length ? { ...score, [parsed.winner]: score[parsed.winner] + 1 } : null;
    return <form onSubmit={save} className="rounded-lg border border-slate-600/70 bg-slate-800 p-2" aria-label="บันทึกทั้งแรลลี่">
        <label htmlFor="vis-code-input" className="sr-only">คีย์ทั้งแรลลี่</label>
        <div id="vis-code-preview" className="mb-2 space-y-1 text-[11px] leading-4" aria-live="polite">
            {events.map((event, index) => <div key={index} className={`flex flex-wrap items-baseline gap-x-2 ${event.generated ? 'opacity-60' : ''}`}>
                <span className={event.generated ? 'text-sky-400' : 'text-emerald-400'}>✓</span><code className={`min-w-12 font-bold ${teamColor(event.team)}`}>{rallyCode(event)}</code>
                <span className={teamColor(event.team)}>{describe(event)}</span>{event.generated && <span className="italic text-slate-400">แนะนำ → ↑↓ เปลี่ยน · Tab / Space รับ · Esc ไม่ใส่</span>}
            </div>)}
            {parsed.errors.map(error => <p key={error} className="text-red-300">✗ {error}</p>)}
            {nextScore && <p className="text-right text-slate-400">+1 {teamData(parsed.winner)?.name} ({nextScore.home}–{nextScore.away}) · auto: {servingTeam === 'home' ? '*' : 'a'}</p>}
            {!draft && <p className="text-slate-400">* เจ้าบ้าน · a ทีมเยือน · เช่น *03S a 10# · *7S a4/</p>}
        </div>
        {parsed.suggestions.length > 0 && !parsed.automatic && <div className="mb-2 rounded-lg border border-dashed border-sky-700 bg-slate-900/30 p-2" aria-label="รหัสของอีกฝ่าย">
            <div className="flex flex-wrap items-center gap-1"><span className={`mr-1 text-[11px] font-semibold ${teamColor(parsed.suggestions[0].team)}`}>รหัสฝั่ง {teamData(parsed.suggestions[0].team)?.name}</span>
                {parsed.suggestions.map((event, index) => <button key={rallyCode(event)} type="button" disabled={locked} aria-pressed={!skip && choice === index} onClick={() => { setChoice(index); setSkip(false); input.current?.focus(); }} className={`${chip} ${!skip && choice === index ? '!border-sky-400 !bg-sky-400 !text-slate-950' : ''}`}><code className="font-bold">{rallyCode(event)}</code><span>{describe(event)}</span></button>)}
                <button type="button" disabled={locked} onClick={() => setSkip(true)} className={chip}>ไม่ใส่ <kbd>Esc</kbd></button>
            </div><p className="mt-1 text-right text-[10px] text-slate-500">↑↓ เลือก · Tab / Space รับ · Enter บันทึก</p>
        </div>}
        <div className="relative rounded-md border border-sky-500 bg-slate-950/80 focus-within:ring-1 focus-within:ring-sky-400">
            <div ref={paintedCode} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 py-2 font-mono text-base leading-6">{draft.split(/(\s+)/).map((token, index) => <span key={index} className={token.startsWith('*') || token.startsWith('A:') ? 'text-blue-400' : /^a(?!:)|^B:/i.test(token) ? 'text-red-400' : 'text-slate-200'}>{token}</span>)}</div>
            <input id="vis-code-input" ref={input} value={draft} readOnly={locked} onChange={event => update(event.target.value)} onScroll={event => { if (paintedCode.current) paintedCode.current.scrollLeft = event.currentTarget.scrollLeft; }}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); auto(); }
                if (['ArrowUp', 'ArrowDown'].includes(event.key) && parsed.suggestions.length && !parsed.automatic) {
                    event.preventDefault(); setSkip(false); setChoice(previous => (previous + (event.key === 'ArrowDown' ? 1 : parsed.suggestions.length - 1)) % parsed.suggestions.length);
                }
                if (event.key === ' ' && suggestion && !parsed.automatic) { event.preventDefault(); auto(); }
                if (event.key === 'Escape') { event.preventDefault(); if (suggestion && !parsed.automatic) setSkip(true); else { update(''); context.current = null; } }
                if (event.key === 'Enter' && event.repeat) event.preventDefault();
            }} autoComplete="off" spellCheck={false} placeholder="*03S a 10#" aria-invalid={Boolean(parsed.errors.length)} aria-describedby="vis-code-preview"
            className="relative block h-10 w-full min-w-0 bg-transparent px-3 py-2 font-mono text-base leading-6 text-transparent caret-white placeholder:text-slate-600 selection:bg-sky-800/60" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1"><button type="button" disabled={locked} onClick={auto} className={`${chip} !border-sky-700 text-sky-300`}>↗ {suggestion ? rallyCode(suggestion) : 'AUTO'} <kbd className="text-[9px] opacity-60">Tab</kbd></button>
            {Object.values(teams).map(team => <button type="button" key={team.key} disabled={locked} onClick={() => append(`${draft && !/\s$/.test(draft) ? ' ' : ''}${team.key === 'home' ? '*' : 'a'}`)} className={chip}><span className={teamColor(team.key)}>{team.key === 'home' ? '*' : 'a'}</span><span className="max-w-24 truncate">{team.name}</span></button>)}
            {['S', 'R', 'A', 'B', 'D', 'E', '#', '+', '!', '-', '=', '/'].map(code => <button type="button" key={code} title={visSkillNames[code] || code} disabled={locked} onClick={() => append(code)} className={`${chip} !px-1.5 font-mono`}>{code}</button>)}
            {teamCommands.map(({ team, code }) => <button type="button" key={`${team.key}-${code}`} disabled={locked} onClick={() => append(`${draft && !/\s$/.test(draft) ? ' ' : ''}${team.key === 'home' ? '*' : 'a'}${code}`)} className={chip}><span className="max-w-20 truncate">{team.name}</span><code>{code}</code></button>)}
            <span className="ml-auto flex gap-1"><button type="button" disabled={undoDisabled} onClick={onUndo} className={chip}>↶ ย้อนกลับ</button><button disabled={locked || !valid} className={`${chip} !border-sky-700 text-sky-200`}>บันทึก ↵</button></span>
        </div>
        {notice && <p className="mt-1 text-[11px] text-amber-200" role="status">{notice}</p>}
        <details className="mt-2 text-xs leading-relaxed text-slate-300">
            <summary className="cursor-pointer text-slate-400 hover:text-sky-300">คู่มือคีย์ VIS</summary>
            <div className="mt-2 space-y-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <p>พิมพ์หรือกดปุ่มเพื่อเติมรหัสตามลำดับ <strong>ทีม + เบอร์ผู้เล่น + ทักษะ + ผล</strong> เช่น <code className="text-sky-300">*07S a04A/</code> หมายถึงเจ้าบ้านเบอร์ 7 เสิร์ฟ แล้วทีมเยือนเบอร์ 4 ตบติดบล็อก</p>
                <div><p className="mb-1 font-semibold text-sky-200">ทักษะ</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        {Object.entries(visSkillNames).map(([code, name]) => <div key={code} className="contents"><dt><kbd className="font-mono font-bold text-sky-300">{code}</kbd></dt><dd>{name}{code === 'R' ? ' (Reception)' : code === 'D' ? ' / ป้องกัน (Dig)' : code === 'E' ? 'บอลให้ผู้ตบ (Set)' : ''}</dd></div>)}
                    </dl>
                </div>
                <div><p className="mb-1 font-semibold text-sky-200">ผลการเล่น</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        {[
                            ['#', 'ได้แต้มสำหรับ S / A / B เช่น เสิร์ฟเอซ ตบได้แต้ม บล็อกได้แต้ม; สำหรับ R / D / E หมายถึงทำได้สมบูรณ์ ยังไม่จบแต้ม'],
                            ['+', 'ผลบวก / เล่นต่อได้ดี'],
                            ['!', 'เล่นต่อได้'],
                            ['-', 'ผลลบ / เล่นต่อยาก'],
                            ['=', 'ผิดพลาด / เสียแรลลี่ คู่แข่งได้แต้ม'],
                            ['/', 'ตบติดบล็อก / เสียแต้ม ใช้กับ A เท่านั้น เช่น a04A/'],
                        ].map(([code, meaning]) => <div key={code} className="contents"><dt><kbd className="font-mono font-bold text-amber-300">{code}</kbd></dt><dd>{meaning}</dd></div>)}
                    </dl>
                    <p className="mt-1 text-slate-400">ไม่ใส่ผล = บอลยังเล่นต่อ เช่น *07S ต้องคีย์ต่อจนมีผลจบแต้มจึงบันทึกทั้งแรลลี่ได้</p>
                </div>
                <div><p className="mb-1 font-semibold text-sky-200">ทีมและคำสั่งทีม</p><p><code>*</code> เจ้าบ้าน · <code>a</code> ทีมเยือน · <code>OP#</code> คู่แข่งเสีย → ทีมที่ระบุได้แต้ม · <code>T=</code> ทีมที่ระบุเสีย → คู่แข่งได้แต้ม เช่น <code>*OP#</code> หรือ <code>aT=</code></p></div>
                <div><p className="mb-1 font-semibold text-sky-200">ปุ่มลัดระหว่างคีย์</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt><kbd>Space</kbd></dt><dd>เว้นวรรคเพื่อคีย์เหตุการณ์ถัดไป; ถ้ามีคำแนะนำให้รับรหัสที่เลือก</dd>
                        <dt><kbd>Tab</kbd></dt><dd>ช่องว่าง: เติมผู้เสิร์ฟ P1 · หลังเสิร์ฟ: สลับทีม · มีคำแนะนำ: รับรหัสที่เลือก</dd>
                        <dt><kbd>↑ / ↓</kbd></dt><dd>เลือกรหัสฝั่งตรงข้ามในกล่องคำแนะนำ</dd>
                        <dt><kbd>Esc</kbd></dt><dd>ไม่ใส่รหัสคู่ที่แนะนำ; หากไม่มีคำแนะนำให้ล้างช่องคีย์</dd>
                        <dt><kbd>Enter</kbd></dt><dd>บันทึกทั้งแรลลี่พร้อมคำแนะนำที่เลือก เพิ่มเพียง 1 แต้ม และหมุนเมื่อได้เสิร์ฟคืน</dd>
                        <dt>↶ ย้อนกลับ</dt><dd>ยกเลิกทั้งแรลลี่ล่าสุด คืนคะแนน ทีมเสิร์ฟ และตำแหน่งผู้เล่น; หากรายการล่าสุดเป็นเวลานอกหรือเปลี่ยนตัว จะย้อนเฉพาะรายการนั้น</dd>
                    </dl>
                </div>
            </div>
        </details>
    </form>;
}
