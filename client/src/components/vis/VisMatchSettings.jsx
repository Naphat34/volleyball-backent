import { ArrowRight as UiArrowRight, X as UiX } from 'lucide-react';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import useVisTranslation from './useVisTranslation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { getStoredUser } from '../../auth/authStorage';
import './VisMatchSettings.css';
import { settingsPlayer, settingsPlayerDraft, coachingStaff, fullNamePatch } from '../../utils/vis/visSettingsRoster';

const palette = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b'];

export default function VisMatchSettings({ match, teams, onClose, onLineup, canEditLineup, readOnly, colors, onColors }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const isAdmin = getStoredUser()?.role === 'admin';
    const custom = Boolean(match.is_custom_vis);
    const [matchSettings,setMatchSettings] = useState(null);
    const locked = Boolean(readOnly || (!custom && matchSettings && !matchSettings.canEdit) || match.offline_released || ['confirmed', 'cancelled'].includes(match.vis_lifecycle));
    const customEditable = custom && !locked && ['draft', 'ready'].includes(match.vis_lifecycle);
    const metadataEditable = !locked && (customEditable || (isAdmin && !custom && !match.is_offline_vis && matchSettings?.editableTeams));
    const rosterEditable = !locked && !match.is_offline_vis && (custom ? customEditable : Boolean(matchSettings?.canEdit && matchSettings?.editableTeams));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(null);
    const originalSettings = useRef(null);
    useEffect(() => {
        let active = true;
        Promise.all([api.getVisState(match.id),!custom && !match.is_offline_vis ? api.getMatchSettings(match.id) : Promise.resolve(null),api.getMatchRosterData(match.id)]).then(([{data},official,roster]) => {
            if (!active) return;
            const state = data.state;
            const value = { substitutionLimit: state.substitutionLimit || 6, firstServingTeam: state.firstServingTeam || null,
                serveLocked: state.currentSet !== 1 || state.history.length > 0, setupComplete: state.setupComplete };
            originalSettings.current = value;
            setSettings(value);
            if(official) {
                const source=official.data, draft=source.draft;
                setMatchSettings(source);
                setForm(previous=>{
                    const next={...previous,title:draft.title,date:draft.match_date,location:draft.location,maxSets:draft.maxSets,round:draft.round_name,
                        ...Object.fromEntries(['home','away'].map(key=>[key,{...draft[key],players:draft[key].players.map(settingsPlayer)}]))};
                    baseline.current=structuredClone(next);return next;
                });
            } else {
                setForm(previous=>{
                    const next={...previous,...Object.fromEntries(['home','away'].map(key=>[key,{...previous[key],staff:roster.data[key]?.staff || []}]))};
                    baseline.current=structuredClone(next);return next;
                });
            }
        }).catch(error => { if (active) setError(error.response?.data?.error || 'โหลดการตั้งค่าไม่สำเร็จ กรุณาปิดและเปิดใหม่'); });
        return () => { active = false; };
    }, [match.id, custom, match.is_offline_vis]);
    const [teamColors, setTeamColors] = useState(colors);
    const [pasteTeam, setPasteTeam] = useState(null);
    const [pasteText, setPasteText] = useState('');
    const [form, setForm] = useState(() => ({
        title: match.competition_name || '', date: String(match.match_date || '').slice(0, 10),
        location: match.location || '', maxSets: Number(match.max_sets) || 5,
        round: match.round_name || '',
        ...Object.fromEntries(teams.map(team => [team.key, { name: team.name, code: match[`${team.key}_team_code`] || '',
            staff: team.staff || [], players: team.players.map(settingsPlayer) }]))
    }));
    const baseline = useRef(structuredClone(form));
    const closeButton = useRef(null);
    useEffect(() => {
        const previous = document.activeElement;
        closeButton.current?.focus();
        return () => previous?.focus?.();
    }, []);
    const updateTeam = (key, patch) => setForm(value => ({ ...value, [key]: { ...value[key], ...patch } }));
    const updatePlayer = (key, index, patch) => updateTeam(key, { players: form[key].players.map((p, i) => {
        if(i!==index)return p;const next={...p,...patch};
        for(const base of ['first_name','last_name'])if(patch[base+'_th']!==undefined||patch[base+'_en']!==undefined)next[base]=next[base+'_th']||next[base+'_en']||'';
        return next;
    }) });
    const replaceRoster = (key, source) => {
        if (!customEditable) return;
        const players = Array.isArray(source) ? source : source.players;
        if (!Array.isArray(players) || players.length > 30) throw Error(vt('รายชื่อไม่ถูกต้อง หรือมีผู้เล่นเกิน 30 คน'));
        updateTeam(key, { players: players.map(p => settingsPlayer({ ...p, number: p.number ?? '' })) });
    };
    const save = async event => {
        event.preventDefault();
        if (busy || !settings) return;
        setError('');
        setBusy(true);
        const customFormChanged = customEditable && JSON.stringify(form) !== JSON.stringify(baseline.current);
        try {
            if (!Number.isInteger(Number(settings.substitutionLimit)) || Number(settings.substitutionLimit) < 1 || Number(settings.substitutionLimit) > 8) throw Error(vt('จำนวนเปลี่ยนตัวต่อเซตต้องอยู่ระหว่าง 1–8 ครั้ง'));
            if (rosterEditable) for (const key of ['home', 'away']) {
                const players = form[key].players;
                if (players.some(p => !Number.isInteger(Number(p.number)) || Number(p.number) < 1 || Number(p.number) > 999 || !p.first_name.trim() || (custom && !p.last_name.trim()))) throw Error(vt('กรุณาระบุเบอร์ 1–999 ชื่อ และนามสกุลของผู้เล่นให้ครบ'));
                if (new Set(players.map(p => Number(p.number))).size !== players.length) throw Error(vt('เบอร์ผู้เล่นในทีมต้องไม่ซ้ำกัน'));
                if (players.filter(p => p.is_captain).length > 1) throw Error(vt('กำหนดกัปตันได้ทีมละหนึ่งคน'));
            }
            if (metadataEditable && (!form.home.name.trim() || !form.away.name.trim() || (custom && !form.title.trim()))) throw Error(vt('กรุณาระบุชื่อทีมและรายการแข่งขัน'));
            if (customFormChanged) {
                await api.updateCustomVis(match.id, { title: form.title, date: form.date, time: String(match.start_time || '').slice(0, 5), location: form.location, gender: match.gender || '', maxSets: form.maxSets, home: form.home, away: form.away });
            } else if (!custom && !locked && matchSettings) {
                const changed=JSON.stringify(form)!==JSON.stringify(baseline.current);
                const colorsChanged=['home','away'].some(key=>teamColors[key]!==colors[key]);
                if(changed || colorsChanged) {
                    const draft=structuredClone(matchSettings.draft);
                    if(metadataEditable){draft.match_date=form.date;draft.location=form.location;draft.round_name=form.round;}
                    for(const key of ['home','away']) {
                        if(metadataEditable){draft[key].name=form[key].name.trim();draft[key].code=form[key].code.trim();}
                        if(rosterEditable)draft[key].players=form[key].players.map(settingsPlayerDraft);
                        if(colorsChanged)draft[key].color=teamColors[key];
                    }
                    await api.updateMatchSettings(match.id,{revision:matchSettings.revision,fingerprint:matchSettings.fingerprint,draft});
                    const fresh=await api.getMatchSettings(match.id);setMatchSettings(fresh.data);baseline.current=structuredClone(form);
                }
            }
            if (!locked && (customFormChanged || Number(settings.substitutionLimit) !== originalSettings.current.substitutionLimit || settings.firstServingTeam !== originalSettings.current.firstServingTeam)) {
                const { data } = await api.getVisState(match.id);
                await api.saveVisCommand(match.id, { operationId: crypto.randomUUID(), revision: data.state.revision,
                    command: { type: 'CONFIGURE_SETTINGS', substitutionLimit: Number(settings.substitutionLimit), firstServingTeam: settings.firstServingTeam } });
                originalSettings.current = { ...settings, substitutionLimit: Number(settings.substitutionLimit) };
            }
            onColors(teamColors);
            onClose();
        } catch (error) { setError(error.response?.data?.error || error.message || vt('บันทึกไม่สำเร็จ กรุณาลองใหม่')); }
        finally { setBusy(false); }
    };
    const trapFocus = event => {
        if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(item => item.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    return <div className="vis-settings-overlay" onKeyDown={trapFocus}>
        <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="vis-settings-title" className="vis-settings-modal" aria-busy={busy}>
            <header className="vis-settings-header"><h2 id="vis-settings-title">{vt("ตั้งค่าแมตช์")}</h2><div><button ref={closeButton} type="button" disabled={busy} onClick={onClose}>{vt("ปิด")}</button><button className="vis-settings-save" disabled={busy || !settings}>{busy ? vt('กำลังบันทึก…') : vt('บันทึกและปิด')}</button></div></header>
            <div className="vis-settings-body">
            <fieldset className="vis-settings-fields" disabled={busy}>
                {error && <p role="alert" className="vis-settings-error">{vt(error)}</p>}
                <section className="vis-settings-card"><h3>{vt("ข้อมูลการแข่งขัน")}</h3><div className="vis-settings-card-body">
                    <div className="vis-settings-match-fields">
                        <label>{vt("ชื่อแมตช์")}<input value={custom ? `${form.home.name} vs ${form.away.name}` : form.round} readOnly={!metadataEditable || custom} onChange={event => setForm({ ...form, round: event.target.value })} placeholder={ui(`{0} vs {1}`, [form.home.name, form.away.name])} /></label>
                        <label>{vt("รายการแข่งขัน")}<input value={form.title} readOnly={!customEditable} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
                        <label>{vt("วันที่")}<input type="date" value={form.date} readOnly={!metadataEditable} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
                        <label>{vt("สนาม")}<input value={form.location} readOnly={!metadataEditable} onChange={event => setForm({ ...form, location: event.target.value })} /></label>
                        <label>{vt("รูปแบบ")}<select value={form.maxSets} disabled={!customEditable} onChange={event => setForm({ ...form, maxSets: Number(event.target.value) })}><option value={5}>{vt("ชนะ 3 ใน 5 เซต")}</option><option value={3}>{vt("ชนะ 2 ใน 3 เซต")}</option></select></label>
                    </div>
                    <div className="vis-settings-rules">{[[vt('แต้ม/เซต'), 25], [vt('แต้มเซตตัดสิน'), 15], [vt('เวลานอก/เซต'), 2]].map(([label, value]) => <label key={label}>{ui(label)}<input value={value} readOnly /></label>)}
                        <label>{vt("เปลี่ยนตัว/เซต")}<input type="number" min={1} max={8} step={1} value={settings?.substitutionLimit ?? ''} disabled={locked || !settings} onChange={event => setSettings({ ...settings, substitutionLimit: event.target.value })} /></label>
                        <label>{vt("เสิร์ฟก่อน (เซต 1)")}<select value={settings?.firstServingTeam || ''} disabled={locked || !settings || settings.serveLocked} onChange={event => setSettings({ ...settings, firstServingTeam: event.target.value || null })}><option value="" disabled={settings?.setupComplete}>{vt("เลือกทีม")}</option>{['home', 'away'].map(key => <option key={key} value={key}>{form[key].code || match[`${key}_team_short_name`] || form[key].name}</option>)}</select></label>
                    </div>
                </div></section>
                <div className="vis-settings-teams">{teams.map(team => {
                    const key = team.key, draft = form[key];
                    const coaches=coachingStaff(draft.staff,match[key+'_coach_name']||match[key+'_coach']||'');
                    return <section key={key} className="vis-settings-card vis-settings-team" style={{ '--settings-team-color': teamColors[key], borderTopColor: teamColors[key] }}>
                        <h3>{key === 'home' ? vt('ทีมเจ้าบ้าน (*)') : vt('ทีมเยือน (a)')}</h3>
                        <div className="vis-settings-card-body">
                            <div className="vis-settings-team-fields"><label>{vt("ชื่อทีม")}<input value={draft.name} readOnly={!metadataEditable} onChange={event => updateTeam(key, { name: event.target.value })} /></label><label>{vt("ชื่อย่อ")}<input value={draft.code} readOnly={!metadataEditable || custom} onChange={event => updateTeam(key, { code: event.target.value })} /></label></div>
                            <label>{vt("สีเสื้อ")}<div className="vis-settings-color"><input type="color" aria-label={`${vt("สีเสื้อ ")}${displayNames.teamName(team)}`} value={teamColors[key]} disabled={busy} onChange={event => setTeamColors({ ...teamColors, [key]: event.target.value })} /><span>{teamColors[key].toUpperCase()}</span></div></label>
                            <div className="vis-settings-palette">{palette.map(color => <button type="button" key={color} aria-label={`${vt("สี ")}${color} ${displayNames.teamName(team)}`} aria-pressed={teamColors[key].toLowerCase() === color} style={{ background: color }} onClick={() => setTeamColors({ ...teamColors, [key]: color })} />)}</div>
                            <label>{vt("ผู้ฝึกสอน")}<input value={coaches.head} readOnly placeholder={vt("ยังไม่ระบุ")} /></label><label>{vt("ผู้ช่วยผู้ฝึกสอน")}<input value={coaches.assistants.join(' · ')} readOnly placeholder={vt("ยังไม่ระบุ")} /></label>
                            <div className="vis-settings-lineup-label"><span>{canEditLineup ? vt('ตำแหน่งเริ่มต้นเซต 1') : vt('ตำแหน่งในสนามปัจจุบัน')}<><UiArrowRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" />{vt(" (I → VI, I = ผู้เสิร์ฟ)").replace(/→\uFE0F?/gu, '').trim()}</></span>{onLineup && <button type="button" disabled={!canEditLineup || locked || custom || busy} onClick={onLineup}>{vt("จัดไลน์อัป")}</button>}</div>
                            <div className="vis-settings-lineup">{['I', 'II', 'III', 'IV', 'V', 'VI'].map((position, index) => <div key={position}><small>{position}</small><strong>{team.lineup[index]?.number || '–'}</strong></div>)}</div>
                            <div className="vis-settings-roster-heading"><span>{vt("รายชื่อผู้เล่น (")}{draft.players.length})</span>{customEditable && <div><label className="vis-settings-file-button">{vt("นำเข้า JSON ทีม")}<input type="file" accept=".json,application/json" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { replaceRoster(key, JSON.parse(await file.text())); setError(''); } catch (error) { setError(error.message); } }} /></label><button type="button" onClick={() => { setPasteTeam(key); setPasteText(''); }}>{vt("วางรายชื่อ")}</button><button type="button" disabled={draft.players.length >= 30} onClick={() => updateTeam(key, { players: [...draft.players, { number: '', first_name: '', last_name: '', position: '', is_captain: false }] })}>{vt("+ เพิ่ม")}</button></div>}</div>
                            {pasteTeam === key && <div className="vis-settings-paste"><textarea aria-label={vt("วางรายชื่อ JSON")} value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder={vt('[{"number":1,"first_name":"ชื่อ","last_name":"นามสกุล"}]')} /><button type="button" onClick={() => { try { replaceRoster(key, JSON.parse(pasteText)); setPasteTeam(null); setError(''); } catch (error) { setError(error.message); } }}>{vt("ใช้รายชื่อ")}</button><button type="button" onClick={() => setPasteTeam(null)}>{vt("ยกเลิก")}</button></div>}
                            <div className="vis-settings-roster-summary">{vt("ผู้เล่น ")}{draft.players.length}{vt(" คน · ลิเบอโร ")}{draft.players.filter(p => p.position === 'L').length}{vt(" · กัปตัน ")}{draft.players.find(p => p.is_captain)?.number || '–'}</div>
                            <div className="vis-settings-table-scroll"><table><thead><tr><th>{vt("เบอร์")}</th><th>{vt("ชื่อ–นามสกุล (ไทย)")}</th><th>{vt("ชื่อ–นามสกุล (อังกฤษ)")}</th><th>{vt("ตำแหน่ง")}</th><th>{ui("L")}</th><th>{ui("C")}</th>{customEditable && <th />}</tr></thead><tbody>{draft.players.map((player, index) => <tr key={player.id || index}>
                                <td><input aria-label={`${vt("เบอร์ผู้เล่น ")}${index + 1} ${displayNames.teamName(team)}`} type="number" min={1} max={999} value={player.number} readOnly={!rosterEditable} onChange={event => updatePlayer(key, index, { number: event.target.value })} /></td>
                                {['th', 'en'].map(language => <td key={language} className="vis-settings-full-name"><input aria-label={vt('ชื่อ–นามสกุล') + (language === 'th' ? vt('ไทย') : vt('อังกฤษ')) + vt('ผู้เล่น ') + (index + 1) + ' ' + team?.name} placeholder={language === 'th' ? vt('ชื่อ–นามสกุล (ไทย)') : ui('Full name (English)')} maxLength={101} value={player['full_name_' + language] ?? [player['first_name_' + language], player['last_name_' + language]].filter(Boolean).join(' ')} readOnly={!rosterEditable} onChange={event => updatePlayer(key, index, fullNamePatch(language, event.target.value))} /></td>)}
                                <td><select aria-label={`${vt("ตำแหน่งผู้เล่น ")}${index + 1} ${displayNames.teamName(team)}`} value={player.position || ''} disabled={!rosterEditable} onChange={event => updatePlayer(key, index, { position: event.target.value, is_libero1:event.target.value==='L'&&!player.is_libero2,is_libero2:event.target.value==='L'&&player.is_libero2 })}><option value="">–</option>{['S', 'OH', 'MB', 'OPP', ...(custom ? ['OP'] : []), 'L'].map(position => <option key={position}>{position}</option>)}</select></td>
                                <td><select aria-label={`${vt("ลิเบอโร ")}${index + 1} ${displayNames.teamName(team)}`} value={player.is_libero2 ? 'L2' : player.is_libero1 || player.position === 'L' ? 'L1' : ''} disabled={!rosterEditable} onChange={event => updatePlayer(key,index,{position:event.target.value?'L':'',is_libero1:event.target.value==='L1',is_libero2:event.target.value==='L2'})}><option value="">—</option><option value="L1">{ui("L1")}</option><option value="L2">{ui("L2")}</option></select></td>
                                <td><input aria-label={`${vt("กัปตัน ")}${index + 1} ${displayNames.teamName(team)}`} type="checkbox" checked={Boolean(player.is_captain)} disabled={!rosterEditable} onChange={event => updateTeam(key, { players: draft.players.map((p, i) => ({ ...p, is_captain: i === index ? event.target.checked : false })) })} /></td>
                                {customEditable && <td><button type="button" aria-label={`${vt("ลบผู้เล่น ")}${index + 1} ${displayNames.teamName(team)}`} onClick={() => updateTeam(key, { players: draft.players.filter((_, i) => i !== index) })}><UiX size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></button></td>}
                            </tr>)}</tbody></table></div>
                        </div>
                    </section>;
                })}</div>
                <p className="vis-settings-note">{vt("ข้อมูลที่แก้ไขไม่ได้แสดงตามข้อมูลการแข่งขันในระบบ")}{!custom && vt(' · ข้อมูลนักกีฬาที่บันทึกใช้เฉพาะแมตช์นี้ ไม่เปลี่ยนทะเบียนหลักหรือรายการอื่น')}{custom && !customEditable && vt(' · รายชื่อถูกล็อกหลังเริ่มบันทึกการแข่งขัน')}</p>
            </fieldset>
            </div>
        </form>
    </div>;
}
