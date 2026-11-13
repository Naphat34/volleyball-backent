import { GuardedForm, GuardedButton } from '../ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, X, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { assignLineupPlayer, initialLineup, lineupCourtOrder, rotateLineup, validLineup } from '../../utils/vis/lineupSelection';
import './VisLineupPanel.css';
import { useVisTheme } from './visThemeContext';
import { visTeamPalette, contrastRatio } from '../../utils/vis/visThemeColors';

export default function VisLineupPanel({ teams, colors = {}, locked, send, onClose, onCancel, initialServingTeam, initialHomeLeft, requiresToss = true, setNumber = 1 }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const { language } = useLanguage();
    const { theme } = useVisTheme();
    const th = language === 'THA';
    const t = (thai, english) => th ? thai : english;
    const [step, setStep] = useState(1);
    const [servingTeam, setServingTeam] = useState(initialServingTeam || '');
    useEffect(() => { setServingTeam(initialServingTeam || ''); }, [initialServingTeam]);
    const [firstSetHomeLeft, setFirstSetHomeLeft] = useState(initialHomeLeft ?? null);
    const [lineups, setLineups] = useState(() => Object.fromEntries(teams.map(team => [team.key, initialLineup(team)])));
    const [enabled, setEnabled] = useState(() => Object.fromEntries(teams.map(team => [team.key, true])));
    const [active, setActive] = useState(() => Object.fromEntries(teams.map(team => [team.key, 0])));
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    const dialog = useRef(null), closeButton = useRef(null), savingRef = useRef(false);
    const disabled = locked || saving;
    const cancel = onCancel || onClose;
    const valid = teams.every(team => validLineup(lineups[team.key], team.players)) && teams.some(team => enabled[team.key]);
    useEffect(() => {
        const previous = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButton.current?.focus();
        return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
    }, []);
    const keys = event => {
        if (event.key === 'Escape') { event.stopPropagation(); if (!savingRef.current) cancel?.(); }
        if (event.key !== 'Tab') return;
        const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const choose = (team, player) => {
        if (disabled || !enabled[team.key]) return;
        const index = active[team.key], next = assignLineupPlayer(lineups[team.key], index, Number(player.id));
        setLineups(previous => ({ ...previous, [team.key]: next }));
        if (next[index]) {
            const empty = Array.from({ length: 6 }, (_, offset) => (index + offset + 1) % 6).find(slot => !next[slot]);
            if (empty !== undefined) setActive(previous => ({ ...previous, [team.key]: empty }));
        }
        setError('');
    };
    const save = async event => {
        event.preventDefault();
        if (disabled || savingRef.current || !valid) return;
        if (step === 1 && requiresToss) { setStep(2); return; }
        if (step === 2) { if (servingTeam) setStep(3); return; }
        if (requiresToss && (!servingTeam || typeof firstSetHomeLeft !== 'boolean')) return;
        savingRef.current = true; setSaving(true); setError('');
        try {
            if (await send({ type: 'SET_LINEUP', lineups, servingTeam, firstSetHomeLeft })) onClose();
            else setError(t('บันทึกไม่สำเร็จ กรุณาตรวจสอบแล้วลองใหม่', 'Could not save the lineup. Please check and try again.'));
        } catch { setError(t('บันทึกไม่สำเร็จ กรุณาลองใหม่', 'Could not save the lineup. Please try again.')); }
        finally { savingRef.current = false; setSaving(false); }
    };
    const names = player => {
        const thai = player.name_th || player.name || [player.first_name, player.last_name].filter(Boolean).join(' ');
        const english = player.name_en || [player.first_name_en, player.last_name_en].filter(Boolean).join(' ');
        return { primary: (th ? thai : english) || thai || english || `#${player.number}`, secondary: th ? english : english ? thai : '' };
    };
    return <div className="vis-lineup-overlay" onKeyDown={keys}>
        <GuardedForm ref={dialog} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="vis-lineup-title" aria-describedby="vis-lineup-help" className="vis-lineup-modal">
            <header className="vis-lineup-header"><h2 id="vis-lineup-title">{t('ไลน์อัปเริ่มเซต', 'Starting lineup · Set')} {setNumber}</h2>
                <div className="vis-lineup-header-actions"><GuardedButton ref={closeButton} type="button" disabled={saving} onClick={cancel} aria-label={t('ปิด', 'Close')}><X size={16} /></GuardedButton></div>
            </header>
            <div className="vis-lineup-body">
                {step === 1 ? <div className="vis-lineup-teams">{teams.map(team => {
                    const slots = lineups[team.key], selected = slots.filter(Boolean).length;
                    const editable = !disabled && enabled[team.key];
                    const color = colors[team.key] || (team.key === 'home' ? '#905cff' : '#397fff');
                    const palette = visTeamPalette(color, theme);
                    const teamStyle = { '--lu-accent': palette.ink, '--lu-highlight': palette.card, '--lu-team-color': color, '--lu-number-ink': contrastRatio('#ffffff', color) >= contrastRatio('#172033', color) ? '#ffffff' : '#172033' };
                    return <section style={teamStyle} key={team.key} className={`vis-lineup-team${enabled[team.key] ? '' : ' is-paused'}`} aria-label={team.fullName || displayNames.teamName(team)}>
                        <header className="vis-lineup-team-header"><label><input type="checkbox" checked={enabled[team.key]} disabled={disabled} onChange={event => setEnabled(previous => ({ ...previous, [team.key]: event.target.checked }))} /><strong>{ui("L-U")}{' '}{displayNames.teamName(team)}</strong></label><span role="status">{t('เลือกแล้ว', 'Selected')} {selected}/6</span><GuardedButton type="button" disabled={!editable || !selected} onClick={() => { setLineups(previous => ({ ...previous, [team.key]: Array(6).fill('') })); setActive(previous => ({ ...previous, [team.key]: 0 })); }}>{t('ล้าง', 'Clear')}</GuardedButton></header>
                        <div className="vis-lineup-team-body"><div className="vis-lineup-court-column"><div className="vis-lineup-court-tools"><p>{t('เลือกช่องตำแหน่ง แล้วกดผู้เล่น (ตำแหน่ง I = ผู้เสิร์ฟ)', 'Select a position, then a player (I = server)')}</p><div>{[-1, 1].map(direction => <GuardedButton key={direction} type="button" disabled={!editable || !selected} title={direction === 1 ? t('หมุนปกติ', 'Rotate forward') : t('หมุนย้อน', 'Rotate backward')} aria-label={`${displayNames.teamName(team)} ${direction === 1 ? t('หมุนปกติ', 'Rotate forward') : t('หมุนย้อน', 'Rotate backward')}`} onClick={() => setLineups(previous => ({ ...previous, [team.key]: rotateLineup(previous[team.key], direction) }))}>{direction === 1 ? <RotateCw size={16} /> : <RotateCcw size={16} />}</GuardedButton>)}</div></div>
                            <div className="vis-lineup-net"><span>{t('ตาข่าย', 'NET')}</span></div>
                            <div className="vis-lineup-court" role="group" aria-label={`${displayNames.teamName(team)} ${t('ตำแหน่งในสนาม', 'court positions')}`}>{lineupCourtOrder.map(index => {
                                const player = team.players.find(item => Number(item.id) === slots[index]);
                                return <GuardedButton key={index} type="button" disabled={!editable} className={`vis-lineup-slot${active[team.key] === index ? ' is-active' : ''}${player ? ' is-filled' : ''}`} aria-pressed={active[team.key] === index} aria-label={ui(`{0} P{1}{2}: {3}`, [displayNames.teamName(team), index + 1, index === 0 ? t(' ผู้เสิร์ฟ', ' server') : '', player ? `#${player.number} ${names(player).primary}` : t('ว่าง', 'Empty')])} onClick={() => setActive(previous => ({ ...previous, [team.key]: index }))}><small>{['I', 'II', 'III', 'IV', 'V', 'VI'][index]}{index === 0 ? t(' · เสิร์ฟ', ' · Serve') : ''}</small><strong>{player?.number ?? '–'}</strong>{player && <span title={names(player).primary}>{names(player).primary}</span>}</GuardedButton>;
                            })}</div>
                            {team.players.length < 6 && <p className="vis-lineup-warning">{t('ผู้เล่นไม่ครบ 6 คน กรุณาเพิ่มรายชื่อก่อน', 'At least six players are required. Add players to the roster first.')}</p>}
                            {!enabled[team.key] && <p className="vis-lineup-hint">{t('คงไลน์อัปเดิมของทีมนี้ หากยังไม่ครบต้องเลือกให้ครบก่อนบันทึก', 'Keep this team’s existing lineup. It must have six players before saving.')}</p>}
                        </div><div className="vis-lineup-roster" role="group" aria-label={`${t('รายชื่อ', 'Roster')} ${displayNames.teamName(team)}`}>{[...team.players].sort((a, b) => Number(a.number) - Number(b.number)).map(player => {
                            const name = names(player), assigned = slots.indexOf(Number(player.id)), libero = ['L', 'LIBERO', 'L1', 'L2'].includes(String(player.position || player.role || '').toUpperCase()) || [player.is_libero, player.is_libero1, player.is_libero2].some(value => value === true || Number(value) === 1);
                            return <GuardedButton key={player.id} type="button" disabled={!editable || libero} className={`vis-lineup-player${assigned >= 0 ? ' is-selected' : ''}`} aria-pressed={assigned >= 0} onClick={() => choose(team, player)} title={`${name.primary}${assigned >= 0 ? ` · P${assigned + 1}` : ''}`}><b>{player.number}</b><span className="vis-lineup-player-name"><span>{name.primary}</span>{name.secondary && <small>{name.secondary}</small>}</span><span className={`vis-lineup-role${libero ? ' is-libero' : ''}`}>{assigned >= 0 ? <><Check size={11} />{['I', 'II', 'III', 'IV', 'V', 'VI'][assigned]}</> : player.position || player.role || '—'}</span></GuardedButton>;
                        })}</div></div>
                    </section>;
                })}</div> : step === 2 ? <fieldset className="vis-lineup-toss"><legend>{t('ทีมใดเสิร์ฟก่อน?', 'Which team serves first?')}</legend>{teams.map(team => <label key={team.key}><input type="radio" name="first-serve" value={team.key} checked={servingTeam === team.key} disabled={disabled} onChange={() => setServingTeam(team.key)} />{displayNames.teamName(team)}</label>)}<p>{t('ผู้เล่นตำแหน่ง I ของทีมที่เลือกจะเป็นผู้เสิร์ฟคนแรก', 'Position I of the selected team is the first server.')}</p></fieldset> : <fieldset className="vis-lineup-toss"><legend>{t('เลือกฝั่งสนามจากมุมมองผู้บันทึก', 'Select court sides from the recorder’s view')}</legend>{[true, false].map(homeLeft => <label key={String(homeLeft)}><input type="radio" name="court-side" checked={firstSetHomeLeft === homeLeft} disabled={disabled} onChange={() => setFirstSetHomeLeft(homeLeft)} />{t('แดน A (ซ้าย)', 'Court A (left)')}: {displayNames.teamName(teams.find(team => team.key === (homeLeft ? 'home' : 'away')))} · {t('แดน B (ขวา)', 'Court B (right)')}: {displayNames.teamName(teams.find(team => team.key === (homeLeft ? 'away' : 'home')))}</label>)}</fieldset>}
                {error && <p className="vis-lineup-error" role="alert">{ui(error)}</p>}
            </div>
            <footer className="vis-lineup-footer"><p id="vis-lineup-help">{step === 1 ? t('เลือกได้ทั้งสองทีมพร้อมกัน หรือเอาเครื่องหมายออกเพื่อแก้ไขเฉพาะทีม · กดผู้เล่นที่เลือกแล้วเพื่อย้ายตำแหน่ง', 'Edit both teams, or uncheck one to keep its lineup · Select an assigned player to move them') : t(`ขั้นตอน ${step}/3 · ตรวจสอบทีมเสิร์ฟและแดนก่อนเริ่ม`, `Step ${step}/3 · Confirm first serve and court sides`)}</p><div>{step > 1 && <GuardedButton type="button" disabled={disabled} onClick={() => setStep(step - 1)}>{t('ย้อนขั้นตอน', 'Back')}</GuardedButton>}<GuardedButton type="button" disabled={saving} onClick={cancel}>{t('ภายหลัง', 'Later')}</GuardedButton><GuardedButton type="submit" className="vis-lineup-save" disabled={disabled || !valid || (step === 2 && !servingTeam) || (step === 3 && firstSetHomeLeft === null)}>{saving ? t('กำลังบันทึก…', 'Saving…') : requiresToss && step < 3 ? t('ถัดไป', 'Next') : t('บันทึกไลน์อัป', 'Save lineup')}</GuardedButton></div></footer>
        </GuardedForm>
    </div>;
}
