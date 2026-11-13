import { GuardedButton, GuardedForm } from '../ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Download, FolderDown, HardDrive, LockKeyhole, MonitorCog, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';
import { api } from '../../api';
import OfflineSetup from '../auth/OfflineSetup';
import OfflineUnlock from '../auth/OfflineUnlock';
import { getAccessSession, getStoredUser, switchAccessMode } from '../../auth/authStorage';
import useAccessSession from '../../hooks/useAccessSession';
import { deviceId, getOfflineUser, offlineProfile, offlineProfileMatchesUser, offlineMode } from '../../offline/offlineAuth';
import { listLocal, localView, getLocal, updateLocal, prepareVisCheckout, createLocal } from '../../offline/offlineStore';
import { syncLocalMatch } from '../../offline/syncVis';
import { visPanelState } from '../../offline/visPanelState';
import { exportVisMatch } from '../../utils/vis/visMatchFiles';
import { ensureOfflineShell } from '../../offline/offlineShell';
import './VisOfflinePanel.css';

const loginUrl = '/login?reauth=1&returnTo=%2Fadminvis';
const date = value => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : 'ยังไม่ซิงค์';

export default function VisOfflinePanel({ matches, reload }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const session = useAccessSession();
    const [records, setRecords] = useState([]), [readState, setReadState] = useState('locked'), [readError, setReadError] = useState('');
    const [notice, setNotice] = useState(''), [noticeError, setNoticeError] = useState(false);
    const [busy, setBusy] = useState(false), [conflict, setConflict] = useState(null), [online, setOnline] = useState(navigator.onLine);
    const [refresh, setRefresh] = useState(0), [selectedMatch, setSelectedMatch] = useState(''), [authMode, setAuthMode] = useState(null);
    const [pwaReady, setPwaReady] = useState(false);
    const attempt = useRef(false), dialog = useRef(null);
    const user = getStoredUser(), profile = offlineProfile(), grant = getOfflineUser(), backupUser = getOfflineUser({ readOnly: true });
    const profileMismatch = Boolean(profile && !offlineProfileMatchesUser(profile, user));
    const readerId = backupUser && String(backupUser.id) === String(user?.id) ? String(backupUser.id) : null;
    const offline = offlineMode(), onlineSession = getAccessSession({ onlineOnly: true });
    const model = visPanelState({ profile, profileMismatch, userId: user?.id, grant, offline, readOnly: session.readOnly,
        online, onlineUserId: onlineSession.kind === 'online' ? onlineSession.user.id : null, pwaReady, shellRequired: import.meta.env.PROD });
    const pending = records.reduce((sum, record) => sum + record.queue.length, 0);
    const downloadable = matches.filter(match => !match.is_offline_vis && !['confirmed', 'cancelled'].includes(match.vis_lifecycle) && !['completed', 'cancelled'].includes(match.status) && match.home_team_id && match.away_team_id);
    const selectionValid = downloadable.some(match => String(match.id) === selectedMatch);

    useEffect(() => {
        const changed = () => setRefresh(value => value + 1);
        window.addEventListener('vis-local-updated', changed); window.addEventListener('focus', changed);
        return () => { window.removeEventListener('vis-local-updated', changed); window.removeEventListener('focus', changed); };
    }, []);
    useEffect(() => {
        let active = true;
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(() => { if (active) setPwaReady(true); }).catch(() => { if (active) setPwaReady(false); });
        }
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (!readerId) { setRecords([]); setReadState('locked'); setReadError(''); return; }
        let active = true;
        setReadState('loading'); setReadError('');
        listLocal({ readOnly: true }).then(result => {
            if (active) { setRecords(result); setReadState('ready'); }
        }).catch(error => { if (active) { setRecords([]); setReadError(error.message); setReadState('error'); } });
        return () => { active = false; };
    }, [refresh, readerId]);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update); window.addEventListener('offline', update);
        return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }, []);
    useEffect(() => { if (authMode && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [authMode]);

    const beginAttempt = () => { if (attempt.current) return false; attempt.current = true; setBusy(true); return true; };
    const endAttempt = () => { attempt.current = false; setBusy(false); };
    const run = async action => {
        if (!beginAttempt()) return;
        setNotice(''); setNoticeError(false);
        try { await action(); setRefresh(value => value + 1); reload(); }
        catch (error) { setNotice(error.response?.data?.error || error.message); setNoticeError(true); }
        finally { endAttempt(); }
    };
    const authComplete = () => { setAuthMode(null); setRefresh(value => value + 1); reload(); };
    const primaryAction = () => {
        if (model.action === 'setup' || model.action === 'unlock') { setAuthMode(model.action); return; }
        void run(async () => {
            if (!offline) await ensureOfflineShell();
            switchAccessMode(!offline);
        });
    };
    const sync = (record, release) => run(async () => {
        try {
            await syncLocalMatch(record.id, release); setConflict(null);
            setNotice(release ? 'ซิงค์ครบและคืนสิทธิ์แล้ว เปิดแมตช์บนเซิร์ฟเวอร์เพื่อตรวจสอบผล' : 'ซิงค์สำเร็จ ยังคงจองสิทธิ์บนอุปกรณ์นี้');
        } catch (error) { if (error.response?.status === 409) setConflict(record.id); throw error; }
    });
    const download = () => run(async () => {
        await ensureOfflineShell();
        await prepareVisCheckout(selectedMatch, api.checkoutOfflineVis, api.cancelOfflineVisCheckout);
        setSelectedMatch(''); setNotice('ดาวน์โหลดแมตช์และจองสิทธิ์บนอุปกรณ์นี้แล้ว');
    });
    const countLabel = readState === 'ready' ? `${records.length} แมตช์` : readState === 'loading' ? 'กำลังอ่านข้อมูล' : '';

    return <section className="vop-panel" aria-label={ui("การทำงานออฟไลน์ VIMS")}>
        <header className="vop-heading">
            <div><span className="vop-eyebrow">{ui("VOLLEY / VIMS")}</span><h2>{ui("การทำงานออฟไลน์")}</h2><p>{ui("จัดการแมตช์และข้อมูลบนอุปกรณ์นี้")}</p></div>
            <span className="vop-network">{online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}{online ? ui('มีเครือข่าย') : ui('ไม่มีเครือข่าย')}</span>
        </header>
        <dl className="vop-overview">
            <div><dt>{ui("โหมดปัจจุบัน")}</dt><dd>{offline ? ui('ในเครื่อง') : ui('ออนไลน์')}</dd></div>
            <div><dt>{ui("สิทธิ์บนอุปกรณ์นี้")}</dt><dd>{model.permit}</dd></div>
            <div><dt>{ui("รอซิงค์")}</dt><dd>{readState === 'ready' ? ui(`{0} คำสั่ง`, [pending]) : readState === 'loading' ? ui('กำลังอ่าน…') : '—'}</dd></div>
        </dl>
        {profileMismatch && <div className="vop-notice" role="status"><p>{ui("บัญชีปัจจุบัน:")}{' '}<strong>{user?.username || user?.id}</strong>{' '}{ui("· เจ้าของ PIN เดิม:")}{' '}<strong>{profile.user}</strong><br />{ui("กรุณาเตรียมสิทธิ์สำหรับบัญชีปัจจุบัน ระบบจะตรวจงานค้างก่อนเปลี่ยนโปรไฟล์ Offline")}</p></div>}
        <div className="vop-action-row">
            <p className={`vop-state ${model.unlocked ? 'is-ready' : ''}`}>{model.unlocked ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{ui(model.hint)}</p>
            {model.action === 'signin' && !model.disabled ? <Link className="vop-button vop-primary" to={loginUrl}>{ui(model.label)}</Link> : <GuardedButton className="vop-button vop-primary" type="button" disabled={busy || model.disabled} onClick={primaryAction}>{busy ? ui('กำลังดำเนินการ…') : ui(model.label)}</GuardedButton>}
        </div>

        <section className="vop-matches" aria-label={ui("แมตช์ในเครื่อง")} aria-busy={readState === 'loading'}>
            <div className="vop-section-title"><h3>{ui("แมตช์ในเครื่อง")}</h3><span>{countLabel}</span></div>
            {readState === 'locked' && <div className="vop-empty"><LockKeyhole aria-hidden="true" /><strong>{ui("ปลดล็อกเพื่อดูแมตช์ในเครื่อง")}</strong><span>{ui("ใช้ PIN ของบัญชีเจ้าของข้อมูล")}</span></div>}
            {readState === 'loading' && <p className="vop-empty" role="status">{ui("กำลังอ่านรายการแมตช์…")}</p>}
            {readState === 'error' && <div className="vop-read-error" role="alert"><p>{ui("อ่านรายการแมตช์ไม่สำเร็จ:")}{' '}{readError}</p><GuardedButton className="vop-button" type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}>{ui("ลองอ่านข้อมูลอีกครั้ง")}</GuardedButton></div>}
            {readState === 'ready' && !records.length && <div className="vop-empty"><FolderDown aria-hidden="true" /><strong>{ui("ยังไม่มีแมตช์ในเครื่อง")}</strong><span>{ui("ดาวน์โหลดแมตช์ที่ต้องการก่อนเริ่มใช้งานออฟไลน์")}</span></div>}
            {readState === 'ready' && records.map(record => <article key={record.id} className="vop-match">
                <div className="vop-match-heading"><div><h4>{record.payload.config.home.name} — {record.payload.config.away.name}</h4><p>{record.released ? ui('คืนสิทธิ์แล้ว · อ่านอย่างเดียว') : ui(`{0} คำสั่งรอซิงค์{1}`, [record.queue.length, record.serverCreated ? '' : ' · แมตช์ใหม่ยังไม่ขึ้นเซิร์ฟเวอร์'])}</p><p>{ui("ซิงค์ล่าสุด")}{' '}{date(record.lastSyncedAt)}</p></div>{record.released ? <ShieldCheck aria-label={ui("คืนสิทธิ์แล้ว")} /> : <HardDrive aria-label={ui("ข้อมูลในเครื่อง")} />}</div>
                <div className="vop-match-actions">
                    {!record.released && model.unlocked && <Link className="vop-button" to={`/adminvis/match/${record.id}`}>{ui("เปิดแมตช์")}</Link>}
                    <GuardedButton disabled={busy} className="vop-button" type="button" onClick={() => run(() => exportVisMatch(localView(record).match))}>{ui("สำรอง JSON")}</GuardedButton>
                    {!record.released && <><GuardedButton disabled={busy || !model.canSync} className="vop-button" type="button" onClick={() => sync(record, false)}>{ui("ซิงค์")}</GuardedButton><GuardedButton disabled={busy || !model.canSync} className="vop-button" type="button" onClick={() => sync(record, true)}>{ui("ซิงค์และคืนสิทธิ์")}</GuardedButton></>}
                    {record.released && model.serverReady && <a href={`/adminvis/match/${record.serverId}`} className="vop-button" onClick={event => { try { switchAccessMode(false); } catch (error) { event.preventDefault(); setNotice(error.message); setNoticeError(true); } }}>{ui("เปิดบนเซิร์ฟเวอร์")}</a>}
                </div>
                {conflict === record.id && <div role="alert" className="vop-conflict"><p>{ui("ข้อมูลขัดแย้ง ระบบไม่ได้เขียนทับ เลือกเก็บเป็นสำเนาหรือสำรองก่อนใช้ข้อมูลเซิร์ฟเวอร์")}</p><div className="vop-match-actions">
                    <GuardedButton disabled={busy || !model.unlocked} className="vop-button" type="button" onClick={() => run(async () => { const latest = await getLocal(record.id); await createLocal({ creationId: crypto.randomUUID(), importBackup: { config: latest.payload.config, match: latest.payload.match, actions: latest.payload.actions } }); setNotice('สร้างสำเนาใหม่แล้ว ต้นฉบับในเครื่องยังอยู่'); setConflict(null); })}>{ui("สร้างสำเนาเป็นแมตช์ใหม่")}</GuardedButton>
                    <GuardedButton disabled={busy || !model.canSync} className="vop-button" type="button" onClick={() => run(async () => {
                        await exportVisMatch(localView(record).match);
                        if (!window.confirm(String(record.serverId).startsWith('custom-') ? 'ดาวน์โหลดสำรองแล้วหรือไม่? ข้อมูลเซิร์ฟเวอร์จะแทนที่ข้อมูลและคำสั่งรอซิงค์ของแมตช์นี้ในเครื่อง' : 'ดาวน์โหลดสำรองแล้วหรือไม่? ระบบจะคืนสิทธิ์และยุติคิวซิงค์ เก็บสำเนาในเครื่องไว้อ่านอย่างเดียว จากนั้นให้เปิดแมตช์บนเซิร์ฟเวอร์เพื่อตรวจสอบ')) return;
                        if (!String(record.serverId).startsWith('custom-')) {
                            await api.releaseOfflineAdminVis(record.serverId, { deviceId: deviceId(), offlineSession: record.payload.offlineSession });
                            await updateLocal(record.id, current => ({ ...current, released: true, queue: [] }));
                            setNotice('คืนสิทธิ์แล้ว สำเนาในเครื่องอ่านอย่างเดียว กรุณาเปิดแมตช์บนเซิร์ฟเวอร์เพื่อตรวจสอบ');
                            setConflict(null); return;
                        }
                        const response = await api.getCustomVis(record.serverId);
                        await api.syncOfflineVis(record.serverId, { deviceId: deviceId(), baseRevision: response.data.state.revision, operations: [], release: true });
                        await updateLocal(record.id, current => ({ ...current, payload: response.data.offlinePayload, baseRevision: response.data.state.revision, queue: [], released: true, serverCreated: true })); setConflict(null);
                    })}>{ui("สำรองแล้วใช้ข้อมูลเซิร์ฟเวอร์")}</GuardedButton>
                </div></div>}
            </article>)}
            <GuardedForm className="vop-download" onSubmit={event => { event.preventDefault(); if (!busy && model.canDownload && selectionValid) void download(); }}>
                <label htmlFor="vis-offline-download">{ui("แมตช์จากเซิร์ฟเวอร์")}<select id="vis-offline-download" disabled={busy || !model.canDownload || !downloadable.length} value={selectionValid ? selectedMatch : ''} onChange={event => setSelectedMatch(event.target.value)}><option value="">{ui("เลือกแมตช์")}</option>{downloadable.map(match => <option key={match.id} value={match.id}>{match.match_number || match.id} · {displayNames.matchTeamName(match, 'home')} — {displayNames.matchTeamName(match, 'away')} · {match.is_custom_vis ? ui('VIMS') : ui('Admin')}</option>)}</select></label>
                <GuardedButton className="vop-button" disabled={busy || !model.canDownload || !selectionValid}><Download aria-hidden="true" />{ui("ดาวน์โหลด")}</GuardedButton>
            </GuardedForm>
            <p className="vop-download-help">{offline ? ui('กลับโหมดออนไลน์เพื่อดาวน์โหลดแมตช์เพิ่มเติม') : !online ? ui('เชื่อมต่อเครือข่ายก่อนดาวน์โหลดแมตช์') : model.unlocked && !model.serverReady ? ui('เข้าสู่ระบบออนไลน์ด้วยบัญชีเจ้าของข้อมูลก่อนดาวน์โหลด') : ui('รองรับแมตช์จาก Admin และแมตช์สร้างเองใน VIMS · จองสิทธิ์หนึ่งอุปกรณ์ต่อแมตช์')}</p>
            {readerId && !model.serverReady && online && <Link className="vop-text-link" to={loginUrl}>{ui("เข้าสู่ระบบออนไลน์เพื่อซิงค์")}</Link>}
        </section>

        <details className="vop-device"><summary><MonitorCog aria-hidden="true" />{ui("อุปกรณ์และสิทธิ์การใช้งาน")}<ChevronDown aria-hidden="true" /></summary><div className="vop-device-body">
            <dl><div><dt>{ui("อุปกรณ์นี้")}</dt><dd>{deviceId().slice(0, 8)}</dd></div><div><dt>{ui("บัญชี Offline")}</dt><dd>{(profile?.user) || (ui('ยังไม่เตรียม'))}</dd></div><div><dt>{ui("สิทธิ์ถึง")}</dt><dd>{profile ? date(profile.expiresAt) : '—'}</dd></div><div><dt>{ui("แอปออฟไลน์")}</dt><dd>{pwaReady ? ui('พร้อมใช้งาน') : import.meta.env.PROD ? ui('กำลังเตรียม / ตรวจการเชื่อมต่อ') : ui('ยังไม่พร้อมในโหมดพัฒนา')}</dd></div></dl>
            <div className="vop-match-actions"><GuardedButton type="button" className="vop-button" disabled={busy || !model.serverReady} onClick={() => setAuthMode('setup')}>{ui("เตรียม / ต่ออายุสิทธิ์")}</GuardedButton>{profile && <GuardedButton type="button" className="vop-button" disabled={busy} onClick={() => setAuthMode('unlock')}>{ui("ปลดล็อกด้วย PIN")}</GuardedButton>}<Link className="vop-text-link" to={loginUrl}>{ui("เข้าสู่ระบบออนไลน์")}</Link></div>
        </div></details>
        <footer className="vop-footer"><span><ShieldCheck aria-hidden="true" />{ui("ข้อมูลเก็บในเบราว์เซอร์นี้")}</span><details><summary>{ui("การสำรองข้อมูล")}</summary><p>{ui("ใช้ปุ่ม “สำรอง JSON” ของแต่ละแมตช์ ก่อนล้างข้อมูลเว็บไซต์ ใช้โหมดไม่ระบุตัวตน หรือย้ายอุปกรณ์")}</p></details></footer>
        {readState === 'ready' && records.some(record => !record.released && (record.queue.length || !record.serverCreated)) && <p className="vop-backup-reminder">{ui("ยังมีข้อมูลที่ไม่ได้ซิงค์ ควรสำรอง JSON ก่อนย้ายอุปกรณ์หรือล้างข้อมูลเว็บไซต์")}</p>}
        {notice && <div className={`vop-notice ${noticeError ? 'is-error' : ''}`} role={noticeError ? 'alert' : 'status'}><p>{ui(notice)}</p><GuardedButton type="button" aria-label={ui("ปิดข้อความ")} onClick={() => setNotice('')}><X aria-hidden="true" /></GuardedButton></div>}

        {authMode && <dialog ref={dialog} className="vop-dialog" aria-labelledby="vis-offline-auth-title" onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }} onCancel={event => { if (busy) event.preventDefault(); else setAuthMode(null); }} onClose={() => setAuthMode(null)}>
            <header><h3 id="vis-offline-auth-title">{authMode === 'setup' ? ui('เตรียม / ต่ออายุสิทธิ์ออฟไลน์') : ui('ปลดล็อกข้อมูลบนอุปกรณ์นี้')}</h3><GuardedButton className="vop-icon-button" type="button" disabled={busy} aria-label={ui("ปิดหน้าต่าง")} onClick={() => setAuthMode(null)}><X aria-hidden="true" /></GuardedButton></header>
            {authMode === 'setup' ? <OfflineSetup getPermit={api.getOfflinePermit} disabled={busy || !model.serverReady} beginAttempt={beginAttempt} endAttempt={endAttempt} onPrepared={authComplete} /> : <OfflineUnlock inline preserveMode section="vis" disabled={busy} beginAttempt={beginAttempt} endAttempt={endAttempt} onUnlocked={authComplete} onPrepare={() => setAuthMode('setup')} />}
            {!model.serverReady && authMode === 'setup' && <Link className="vop-text-link" to={loginUrl}>{ui("เข้าสู่ระบบออนไลน์เพื่อต่ออายุสิทธิ์")}</Link>}
        </dialog>}
    </section>;
}
