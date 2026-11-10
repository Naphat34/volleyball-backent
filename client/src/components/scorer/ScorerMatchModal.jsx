import { ArrowUpRight as UiArrowUpRight } from 'lucide-react';
import useUiTranslation from '../../hooks/useUiTranslation';
import MatchSettingsFields from './MatchSettingsFields';
import { validateMatchSettings } from '../../utils/scorer/matchSettings';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { getAccessSession } from '../../auth/authStorage';
import { reviewMatch } from '../../utils/scorer/matchReview';
import './ScorerMatchModal.css';

const checkLabels = {
    source: ['ข้อมูลตรงกับแมตช์ที่เลือก', 'Data belongs to the selected match'],
    teams: ['ทีมแข่งขันสองทีมไม่ซ้ำกัน', 'Two distinct teams'], schedule: ['วันแข่งขันและสนาม', 'Schedule and venue'],
    homeRoster: ['รายชื่อและหมายเลขเสื้อทีมเหย้า', 'Home roster and shirt numbers'], awayRoster: ['รายชื่อและหมายเลขเสื้อทีมเยือน', 'Away roster and shirt numbers'],
    homeRoles: ['กัปตันและ Libero ทีมเหย้า', 'Home captain and liberos'], awayRoles: ['กัปตันและ Libero ทีมเยือน', 'Away captain and liberos'],
    rules: ['กติกาจำนวนเซตและคะแนน', 'Set and point rules'], sets: ['ลำดับเซตและคะแนนที่จบแล้ว', 'Completed set sequence and scores'],
    winner: ['มีผู้ชนะครบจำนวนเซต', 'Required set wins reached'], completed: ['การแข่งขันจบแล้ว', 'Match completed'],
    sync: ['คิวออฟไลน์และประวัติการซิงก์ยังไม่ได้ตรวจในหน้าต่างนี้', 'Offline queue and sync history are not checked in this panel'],
};

export default function ScorerMatchModal({ source, canConfirm = false, onClose, onConfirmed }) {
    const ui = useUiTranslation();
    const { language } = useLanguage(), th = language === 'THA';
    const t = (thai, english) => th ? thai : english;
    const dialog = useRef(null), sequence = useRef(0), actionLock = useRef(false), mounted = useRef(false);
    const id = useId(), matchId = source.id, isManual = Boolean(source.is_manual_scorer);
    const [tab, setTab] = useState('overview');
    const [snapshot, setSnapshot] = useState(null), [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [draft, setDraft] = useState(null), [baseline, setBaseline] = useState(null);
    const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(baseline));
    const [validation, setValidation] = useState([]);
    const close = () => { if (!actionLock.current && (!dirty || window.confirm(t('มีข้อมูลที่ยังไม่บันทึก ต้องการทิ้งการแก้ไขหรือไม่?', 'Discard unsaved changes?')))) onClose(); };
    const cancelRequest = useCallback(() => { sequence.current++; }, []);
    const online = () => navigator.onLine && getAccessSession().kind === 'online';
    const requestSnapshot = useCallback(async () => {
        const calls = [api.getMatchRosterData(matchId), api.getMatchScoresheetData(matchId), api.getMatchSettings(matchId)];
        if (isManual) calls.push(api.getManualScorerMatch(matchId));
        const results = await Promise.allSettled(calls);
        const value = index => results[index]?.status === 'fulfilled' ? results[index].value.data : null;
        return { roster: value(0), sheet: value(1), settings: value(2), manual: isManual ? value(3) : null,
            errors: results.flatMap((result, index) => result.status === 'rejected' ? [{ section: ['roster', 'scores', 'settings', 'rules'][index], message: result.reason?.response?.data?.error || result.reason?.message || 'Unable to load' }] : []),
            loadedAt: new Date().toISOString() };
    }, [matchId, isManual]);
    const load = useCallback(async () => {
        const version = ++sequence.current;
        setLoading(true); setError(''); setAcknowledged(false); setValidation([]);
        try {
            if (!navigator.onLine || getAccessSession().kind !== 'online') throw Error('OFFLINE');
            const next = await requestSnapshot();
            if (version === sequence.current) { setSnapshot(next); setDraft(next.settings?.draft || null); setBaseline(next.settings?.draft || null); }
        } catch (failure) { if (version === sequence.current) setError(failure.message); }
        finally { if (version === sequence.current) setLoading(false); }
    }, [requestSnapshot]);
    useEffect(() => {
        const element = dialog.current, trigger = document.activeElement, overflow = document.body.style.overflow;
        mounted.current = true; document.body.style.overflow = 'hidden'; element.showModal();
        return () => { mounted.current = false; cancelRequest(); element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus(); };
    }, [cancelRequest]);
    useEffect(() => { void load(); return cancelRequest; }, [load, cancelRequest]);

    const review = reviewMatch({ ...snapshot, matchId });
    const match = { ...source, ...review.match };
    const team = side => match[`${side}_team_name`] || match[`${side}_team`] || '—';
    const tabs = [['overview', t('ข้อมูลการแข่งขัน', 'Competition')], ['roster', t('ข้อมูลทีม', 'Teams')], ['staff', t('เจ้าหน้าที่ทีม', 'Team staff')], ['officials', t('ผู้ตัดสิน', 'Referees')], ['scores', t('ผลรายเซต', 'Set results')], ['review', t('ผลตรวจสอบ', 'Review')]];
    const changeDraft = next => { setDraft(next); setAcknowledged(false); setNotice(''); if (validation.length) setValidation(validateMatchSettings(next, th)); };
    const changedTab = key => {
        if (!draft || !baseline) return false;
        if (key === 'roster' || key === 'staff') return ['home', 'away'].some(side => JSON.stringify(key === 'staff' ? draft[side].staff : { ...draft[side], staff: null }) !== JSON.stringify(key === 'staff' ? baseline[side].staff : { ...baseline[side], staff: null }));
        const official = k => /^(referee_|line_judge_|scorer_id$)/.test(k);
        const keys = Object.keys(draft).filter(k => !['home','away'].includes(k) && (key === 'officials' ? official(k) : key === 'overview' && !official(k)));
        return keys.some(k => draft[k] !== baseline[k]);
    };
    const save = (closeAfter = false) => run(async () => {
        if (!dirty || !snapshot?.settings?.canEdit || !online()) return;
        const errors = validateMatchSettings(draft, th);
        setValidation(errors);
        if (errors.length) { setTab(errors[0].tab); return; }
        await api.updateMatchSettings(matchId, { revision: snapshot.settings.revision, fingerprint: snapshot.settings.fingerprint, draft });
        if (!mounted.current) return;
        await load();
        setNotice(t('บันทึกการตั้งค่าแมตซ์แล้ว', 'Match settings saved.'));
        onConfirmed?.(matchId);
        if (closeAfter) onClose();
    });
    const format = value => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(th ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok' });
    };
    const run = async action => {
        if (actionLock.current) return;
        actionLock.current = true; setSaving(true); setError('');
        try { await action(); } catch (failure) { if (mounted.current) setError(failure.response?.data?.error || failure.message); }
        finally { actionLock.current = false; if (mounted.current) setSaving(false); }
    };
    const confirm = () => run(async () => {
        if (dirty || !canConfirm || !isManual || !acknowledged || !online()) return;
        const latest = await requestSnapshot();
        if (!mounted.current) return;
        setSnapshot(latest);
        const checked = reviewMatch({ ...latest, matchId });
        if (latest.errors.length || !checked.canConfirm) throw Error(t('ข้อมูลล่าสุดยังไม่พร้อมยืนยัน กรุณาตรวจสอบอีกครั้ง', 'Latest data is not eligible for confirmation. Review again.'));
        if (JSON.stringify([snapshot.roster, snapshot.sheet, snapshot.manual]) !== JSON.stringify([latest.roster, latest.sheet, latest.manual])) {
            setAcknowledged(false); throw Error(t('ข้อมูลเปลี่ยนระหว่างตรวจสอบ กรุณาตรวจข้อมูลล่าสุดและรับรองอีกครั้ง', 'Data changed during review. Check and acknowledge the latest data again.'));
        }
        if (!window.confirm(t('ยืนยันผลแมตช์นี้? หลังยืนยันจะล็อกการแก้ไขผล และยังแยกจากตารางคะแนนทางการ', 'Confirm this result? Editing will be locked. This remains separate from official standings.'))) return;
        await api.confirmManualScorerMatch(matchId);
        if (!mounted.current) return;
        setSnapshot({ ...latest, manual: { ...latest.manual, match: { ...latest.manual.match, manual_lifecycle: 'confirmed' } } });
        setAcknowledged(false); setNotice(t('ยืนยันผลและล็อกแมตช์แล้ว', 'Result confirmed and match locked.')); onConfirmed?.(matchId);
    });
    const keyTabs = event => {
        const index = tabs.findIndex(([key]) => key === tab);
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault(); setTab(tabs[next][0]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
    };

    return <dialog ref={dialog} className="smm-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }}>
        <header className="smm-header"><h2 id={`${id}-title`}>{t('ตั้งค่าแมตช์', 'Match settings')}</h2><div className="smm-actions"><button type="button" disabled={saving} onClick={close}>{t('ปิด', 'Close')}</button>{snapshot?.settings?.canEdit && <button type="button" className="smm-primary" disabled={saving || loading || !online() || Boolean(snapshot?.errors.length)} onClick={() => dirty ? save(true) : close()}>{saving ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกและปิด', 'Save and close')}</button>}</div></header>
        <div className="smm-tabs" role="tablist" aria-label={t('ข้อมูลแมตช์', 'Match information')}>{tabs.map(([key, label]) => <button type="button" key={key} role="tab" id={`${id}-tab-${key}`} aria-selected={tab === key} aria-controls={`${id}-panel`} tabIndex={tab === key ? 0 : -1} onKeyDown={keyTabs} onClick={() => setTab(key)}>{ui(label)}{changedTab(key) ? ' ?' : ''}</button>)}</div>
        <div className="smm-body" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0} aria-busy={loading}>
            {validation.length > 0 && <ul className="smm-error" role="alert">{validation.map((failure, index) => <li key={index}><button type="button" onClick={() => setTab(failure.tab)}>{failure.message}</button></li>)}</ul>}
            {notice && <p className="smm-notice" role="status">{ui(notice)}</p>}
            {error && <div className="smm-error" role="alert"><p>{error === 'OFFLINE' ? t('ออฟไลน์หรือไม่ได้อยู่ในโหมดออนไลน์ ข้อมูลด้านล่างมาจากรายการเดิม ยังไม่ได้ตรวจจากเซิร์ฟเวอร์', 'Offline or not in online mode. Only existing list data is shown; server data is not verified.') : ui(error)}</p><button disabled={loading || saving} onClick={() => { if (!dirty || window.confirm(t('โหลดข้อมูลใหม่และทิ้งการแก้ไข?', 'Reload and discard changes?'))) void load(); }}>{t('ลองใหม่', 'Retry')}</button></div>}
            {snapshot?.errors.map(failure => <p className="smm-error" role="alert" key={failure.section}>{failure.section}: {failure.message} <button disabled={loading || saving} onClick={() => void load()}>{t('ลองใหม่', 'Retry')}</button></p>)}
            {loading ? <p role="status">{t('กำลังอ่านข้อมูลล่าสุด…', 'Loading latest data…')}</p> : <>
                {draft && ['overview', 'roster', 'staff', 'officials'].includes(tab) && <>
                    {!snapshot.settings.canEdit && <p className="smm-notice">{t('ดูข้อมูลเท่านั้น: ไม่มีสิทธิ์แก้ไข หรือแมตซ์ถูกล็อกแล้ว', 'Read only: insufficient permission or match locked.')}</p>}
                    <MatchSettingsFields tab={tab} draft={draft} settings={snapshot.settings} isManual={isManual} disabled={saving || !snapshot.settings.canEdit || !online()} onChange={changeDraft} t={t}/>
                    {tab === 'overview' && <MatchSettingsFields tab="roster" draft={draft} settings={snapshot.settings} isManual={isManual} disabled={saving || !snapshot.settings.canEdit || !online()} onChange={changeDraft} t={t}/>}
                </>}
                {tab === 'scores' && <><div className="smm-score"><span>{team('home')}</span><strong>{review.sets ? `${review.home} – ${review.away}` : '—'}</strong><span>{team('away')}</span></div><div className="smm-scroll"><table><thead><tr><th>{t('เซต', 'Set')}</th><th>{team('home')}</th><th>{team('away')}</th><th>{t('สถานะ', 'Status')}</th></tr></thead><tbody>{review.sets?.map((set, index) => <tr key={set.id || index}><td>{set.set_number}</td><td>{set.home_score ?? '—'}</td><td>{set.away_score ?? '—'}</td><td>{set.end_time ? t('จบเซต', 'Ended') : t('ยังไม่จบเซต', 'Not ended')}</td></tr>)}</tbody></table></div>{!review.sets?.length && <p>{t('ยังไม่มีผลรายเซตที่โหลดได้', 'No set results available.')}</p>}</>}
                {tab === 'review' && <><p>{t('ผลตรวจจากข้อมูลที่อ่านได้ ไม่ใช่การรับรองผลอัตโนมัติ', 'Checks reflect loaded data and do not automatically certify results.')}</p><ul className="smm-checks">{review.checks.map(check => <li key={check.code} className={`is-${check.status}`}><span>{checkLabels[check.code][th ? 0 : 1]}</span><b>{({ pass: t('ผ่าน', 'Passed'), warning: t('ตรวจเพิ่มเติม', 'Review'), block: t('ยังไม่ผ่าน', 'Not passed'), unknown: t('ยังไม่ได้ตรวจ', 'Not checked') })[check.status]}</b></li>)}</ul>
                    {review.confirmed && <p className="smm-notice">{t('ยืนยันผลแล้ว แมตช์นี้ถูกล็อกการแก้ไข', 'Confirmed. This match is locked.')}</p>}
                    {canConfirm && isManual && !review.confirmed && <label className="smm-ack"><input type="checkbox" checked={acknowledged} disabled={dirty || !review.canConfirm || saving || Boolean(snapshot?.errors.length)} onChange={event => setAcknowledged(event.target.checked)}/>{t('ฉันตรวจสอบรายงาน PDF ผลเซต และงานค้างซิงก์แล้ว', 'I have checked the PDF, set results and pending sync work.')}</label>}
                </>}
            </>}
        </div>
        <footer className="smm-footer"><div>{dirty && <strong className="smm-unsaved">{t('มีข้อมูลที่ยังไม่บันทึก', 'Unsaved changes')}</strong>}<small>{snapshot ? `${t('อ่านข้อมูลเมื่อ', 'Loaded at')} ${format(snapshot.loadedAt)}` : t('ยังไม่มีข้อมูลล่าสุด', 'No fresh data loaded')}</small><a href={`/match/${encodeURIComponent(matchId)}`} target="_blank" rel="noreferrer">{t('เปิดหน้าเต็ม', 'Open full page')} <UiArrowUpRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></a></div><div className="smm-actions"><button disabled={saving} onClick={close}>{t('ยกเลิก / ปิด', 'Cancel / Close')}</button>{snapshot?.settings?.canEdit && <button className="smm-primary" disabled={!dirty || saving || loading || !online() || Boolean(snapshot?.errors.length)} onClick={() => save()}>{saving ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกการเปลี่ยนแปลง', 'Save changes')}</button>}<a href={`/scoresheet/${encodeURIComponent(matchId)}`} target="_blank" rel="noreferrer">{ui("Preview Scorer Sheet")}</a>{tab === 'review' && canConfirm && isManual && !review.confirmed && <button className="smm-primary" disabled={dirty || loading || saving || !acknowledged || !review.canConfirm || Boolean(snapshot?.errors.length) || !online()} onClick={confirm}>{saving ? t('กำลังดำเนินการ…', 'Working…') : t('ตรวจสอบแล้ว · ยืนยันผล', 'Reviewed · Confirm result')}</button>}</div></footer>
    </dialog>;
}
