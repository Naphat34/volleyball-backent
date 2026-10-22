import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, Download, FolderDown, LockKeyhole, MonitorCog, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';
import client, { api } from '../../api';
import { getAccessSession, getStoredUser, switchAccessMode } from '../../auth/authStorage';
import useAccessSession from '../../hooks/useAccessSession';
import { deviceId, getOfflineUser, offlineMode, offlineProfile, offlineProfileMatchesUser } from '../../offline/offlineAuth';
import { backupScorer, prepareScorer, scorerRecords, syncScorer } from '../../offline/scorerOffline';
import { ensureOfflineShell } from '../../offline/offlineShell';
import { resolveAccess } from '../../offline/accessRouting';
import OfflineSetup from '../auth/OfflineSetup';
import OfflineUnlock from '../auth/OfflineUnlock';
import '../vis/VisOfflinePanel.css';
import './ScorerOfflineModal.css';

const loginUrl = '/login?reauth=1&returnTo=%2Fadminscorer';
const roles = ['admin', 'statistician', 'score', 'scorer'];
const date = value => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : 'ยังไม่ซิงค์';

export default function ScorerOfflineModal({ onClose }) {
    useAccessSession();
    const navigate = useNavigate();
    const dialog = useRef(null), inFlight = useRef(false);
    const [view, setView] = useState('overview'), [busy, setBusy] = useState(false);
    const [records, setRecords] = useState([]), [readState, setReadState] = useState('locked'), [readError, setReadError] = useState('');
    const [refresh, setRefresh] = useState(0), [notice, setNotice] = useState(''), [noticeError, setNoticeError] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [serverMatches, setServerMatches] = useState([]), [serverState, setServerState] = useState('idle'), [serverError, setServerError] = useState('');
    const [serverVersion, setServerVersion] = useState(0), [selectedId, setSelectedId] = useState('');
    const [lease, setLease] = useState(null), [leaseState, setLeaseState] = useState('idle'), [leaseError, setLeaseError] = useState(''), [leaseVersion, setLeaseVersion] = useState(0);
    const user = getStoredUser(), profile = offlineProfile(), grant = getOfflineUser(), backupGrant = getOfflineUser({ readOnly: true });
    const profileMismatch = Boolean(profile && !offlineProfileMatchesUser(profile, user));
    const readerId = backupGrant && roles.includes(backupGrant.role) && String(backupGrant.id) === String(user?.id) ? String(backupGrant.id) : null;
    const unlocked = Boolean(!profileMismatch && grant && readerId && roles.includes(grant.role));
    const session = getAccessSession({ onlineOnly: true });
    const serverReady = online && session.kind === 'online' && String(session.user.id) === String(user?.id);
    const expired = profile && profile.expiresAt <= Date.now();
    const permit = !profile ? 'ยังไม่เตรียมสิทธิ์' : profileMismatch ? 'บัญชี Offline ไม่ตรงกัน' : expired ? 'สิทธิ์หมดอายุ' : unlocked ? 'พร้อมใช้งาน' : 'ยังไม่ปลดล็อก';
    const pending = records.reduce((sum, record) => sum + record.queue.length, 0);
    const serverUserId = session.kind === 'online' ? String(session.user.id) : null;
    const available = serverMatches.filter(match => !['completed', 'finished', 'match_finished', 'cancelled', 'canceled'].includes(String(match.status).toLowerCase()) && match.home_team_id && match.away_team_id);
    const selected = available.find(match => String(match.id) === selectedId);
    const alreadyLocal = records.some(record => String(record.id) === selectedId && !record.released);
    const canDownload = unlocked && serverReady && serverState === 'ready' && readState === 'ready' && selected && !alreadyLocal && leaseState === 'ready' && lease?.matchId === selectedId && lease.canCheckout === true;

    useEffect(() => {
        const element = dialog.current, trigger = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        element.showModal();
        return () => { element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus(); };
    }, []);
    useEffect(() => {
        dialog.current.querySelector(view === 'overview' ? 'header button' : 'input')?.focus();
    }, [view]);
    useEffect(() => {
        const changed = () => setRefresh(value => value + 1);
        const network = () => setOnline(navigator.onLine);
        window.addEventListener('scorer-offline-updated', changed); window.addEventListener('focus', changed);
        window.addEventListener('online', network); window.addEventListener('offline', network);
        return () => {
            window.removeEventListener('scorer-offline-updated', changed); window.removeEventListener('focus', changed);
            window.removeEventListener('online', network); window.removeEventListener('offline', network);
        };
    }, []);
    useEffect(() => {
        if (!readerId) { setRecords([]); setReadState('locked'); return; }
        let active = true;
        setReadState('loading'); setReadError('');
        scorerRecords({ readOnly: true }).then(rows => { if (active) { setRecords(rows); setReadState('ready'); } })
            .catch(error => { if (active) { setRecords([]); setReadError(error.message); setReadState('error'); } });
        return () => { active = false; };
    }, [readerId, refresh]);
    useEffect(() => {
        if (!serverReady) { setServerMatches([]); setServerState('idle'); setServerError(''); return; }
        let active = true;
        setServerState('loading'); setServerError('');
        api.getScorerMatches().then(response => {
            if (!Array.isArray(response.data)) throw Error('รูปแบบรายการแมตช์ไม่ถูกต้อง');
            if (active) { setServerMatches(response.data); setServerState('ready'); }
        }).catch(error => { if (active) { setServerMatches([]); setServerError(error.response?.data?.error || error.message); setServerState('error'); } });
        return () => { active = false; };
    }, [serverReady, serverUserId, serverVersion]);
    useEffect(() => {
        if (!serverReady || !selectedId || !selected || alreadyLocal) { setLease(null); setLeaseState('idle'); return; }
        let active = true;
        setLease(null); setLeaseState('loading'); setLeaseError('');
        api.getScorerOfflineStatus(selectedId, deviceId()).then(response => {
            if (typeof response.data?.canCheckout !== 'boolean') throw Error('เซิร์ฟเวอร์ยังไม่รองรับการตรวจสถานะ กรุณาอัปเดต backend');
            if (active) { setLease({ ...response.data, matchId: selectedId }); setLeaseState('ready'); }
        }).catch(error => { if (active) { setLeaseError(error.response?.data?.error || error.message); setLeaseState('error'); } });
        return () => { active = false; };
    }, [serverReady, serverUserId, selectedId, selected, alreadyLocal, leaseVersion, refresh]);

    const beginAttempt = () => { if (inFlight.current) return false; inFlight.current = true; setBusy(true); return true; };
    const endAttempt = () => { inFlight.current = false; setBusy(false); };
    const authComplete = () => { setView('overview'); setRefresh(value => value + 1); setNotice('อัปเดตสิทธิ์บนอุปกรณ์นี้แล้ว'); setNoticeError(false); };
    const run = async action => {
        if (!beginAttempt()) return;
        setNotice(''); setNoticeError(false);
        try { await action(); setRefresh(value => value + 1); }
        catch (error) { setNotice(error.response?.data?.error || error.message); setNoticeError(true); }
        finally { endAttempt(); }
    };
    const openMatch = record => run(async () => {
        const target = `/scorer/${record.id}`;
        const result = await resolveAccess({ section: 'scorer', search: `?returnTo=${encodeURIComponent(target)}` }, { kind: 'offline', user: grant });
        if (result.kind !== 'ready' || result.path !== target) throw Error(result.notice || result.message || 'ยังไม่พร้อมเปิดแมตช์ในเครื่อง');
        switchAccessMode(true);
        navigate(target);
    });
    const download = () => run(async () => {
        if (!canDownload) throw Error('กรุณาเลือกแมตช์และตรวจสิทธิ์ก่อนดาวน์โหลด');
        await ensureOfflineShell();
        await prepareScorer(client, selectedId);
        setSelectedId(''); setServerVersion(value => value + 1);
        setNotice('ดาวน์โหลดและจองแมตช์แล้ว ใช้ปุ่มเปิดแมตช์ในรายการด้านล่างเพื่อทำงาน Offline');
    });
    return <dialog ref={dialog} id="scorer-dashboard-offline" className="vop-panel vop-dialog sop-dialog" aria-labelledby="scorer-offline-title"
        onClickCapture={event => { if (inFlight.current && event.target.closest('a')) { event.preventDefault(); event.stopPropagation(); } }}
        onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose(); }}>
        <header className="vop-heading"><div><span className="vop-eyebrow">VOLLEY / SCORER</span><h2 id="scorer-offline-title">{view === 'overview' ? 'ScorerControl Offline' : view === 'setup' ? 'เตรียม / ต่ออายุสิทธิ์' : 'ปลดล็อกด้วย PIN'}</h2><p>จัดการสิทธิ์และแมตช์ที่บันทึกบนอุปกรณ์นี้</p></div>
            <button type="button" className="vop-icon-button" disabled={busy} onClick={() => { if (!inFlight.current) onClose(); }} aria-label="ปิดหน้าต่าง ScorerControl Offline"><X aria-hidden="true" /></button></header>
        {view !== 'overview' ? <>
            <button type="button" className="vop-button" disabled={busy} onClick={() => setView('overview')}><ArrowLeft aria-hidden="true" />กลับภาพรวม</button>
            {view === 'unlock' ? <OfflineUnlock inline preserveMode section="scorer" disabled={busy} beginAttempt={beginAttempt} endAttempt={endAttempt} onUnlocked={authComplete} onPrepare={() => serverReady ? setView('setup') : navigate(loginUrl)} />
                : <OfflineSetup getPermit={() => client.get('/scorer/offline-permit')} disabled={busy || !serverReady} beginAttempt={beginAttempt} endAttempt={endAttempt} onPrepared={authComplete} />}
            {!serverReady && <Link className="vop-text-link" to={loginUrl}>เข้าสู่ระบบออนไลน์ด้วยบัญชีเจ้าของข้อมูล</Link>}
        </> : <>
            <div className="sop-network vop-network">{online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}{online ? 'มีเครือข่าย' : 'ไม่มีเครือข่าย'}</div>
            <dl className="vop-overview"><div><dt>การเข้าสู่ระบบ</dt><dd>{offlineMode() ? 'PIN Offline' : 'บัญชีออนไลน์'}</dd></div><div><dt>สิทธิ์บนอุปกรณ์นี้</dt><dd>{permit}</dd></div><div><dt>รอซิงค์</dt><dd>{readState === 'ready' ? `${pending} คำสั่ง` : readState === 'loading' ? 'กำลังอ่าน…' : '—'}</dd></div></dl>
            <div className="vop-action-row"><p className={`vop-state ${unlocked ? 'is-ready' : ''}`}>{unlocked ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{profileMismatch ? 'บัญชี Offline เดิมไม่ตรงกับบัญชีปัจจุบัน กรุณาเตรียมสิทธิ์ใหม่' : unlocked ? 'เปิดแมตช์ที่ดาวน์โหลดไว้เพื่อบันทึกคะแนนในเครื่อง' : expired ? 'ปลดล็อกเพื่อสำรองข้อมูล หรือต่ออายุสิทธิ์ออนไลน์' : profile ? 'ปลดล็อก PIN เพื่อดูแมตช์บนอุปกรณ์นี้' : 'เตรียม PIN ก่อนดาวน์โหลดแมตช์เพื่อใช้งานออฟไลน์'}</p>
                {!profile || profileMismatch ? serverReady ? <button type="button" className="vop-button vop-primary" disabled={busy} onClick={() => setView('setup')}>เตรียมสิทธิ์สำหรับบัญชีนี้</button> : <Link className="vop-button vop-primary" to={loginUrl}>เข้าสู่ระบบเพื่อเตรียมสิทธิ์</Link>
                    : !unlocked ? <button type="button" className="vop-button vop-primary" disabled={busy} onClick={() => setView('unlock')}>{expired ? 'ปลดล็อกเพื่อสำรองข้อมูล' : 'ปลดล็อกด้วย PIN'}</button>
                        : <Link className="vop-button vop-primary" to="/scorer-offline">รายการแมตช์ในเครื่อง</Link>}</div>
            {profileMismatch && <div className="vop-notice" role="status"><p>บัญชีปัจจุบัน: <strong>{user?.username || user?.id}</strong> · เจ้าของ PIN เดิม: <strong>{profile.user}</strong><br />กรุณาเตรียมสิทธิ์สำหรับบัญชีปัจจุบัน ระบบจะตรวจงานค้างก่อนเปลี่ยนโปรไฟล์ Offline</p></div>}
            <section className="sop-server" aria-label="แมตช์ Scorer จากเซิร์ฟเวอร์" aria-busy={serverState === 'loading'}>
                <div className="vop-section-title"><h3>แมตช์จากเซิร์ฟเวอร์</h3><button type="button" className="vop-button" disabled={busy || !serverReady || serverState === 'loading'} onClick={() => { setServerVersion(value => value + 1); setLeaseVersion(value => value + 1); }}>โหลดรายการใหม่</button></div>
                {!serverReady && <p className="sop-record-help">{!online ? 'เชื่อมต่อเครือข่ายก่อนโหลดรายการแมตช์' : 'ต้องเข้าสู่ระบบออนไลน์ด้วยบัญชีเดียวกับเจ้าของ PIN เพื่อดาวน์โหลด การปลดล็อก PIN อย่างเดียวไม่ใช้แทนเซสชันออนไลน์'} <Link className="vop-text-link" to={loginUrl}>เข้าสู่ระบบออนไลน์</Link></p>}
                {serverState === 'loading' && <p className="sop-record-help" role="status">กำลังโหลดแมตช์จากเซิร์ฟเวอร์…</p>}
                {serverReady && serverState === 'error' && <p className="vop-read-error" role="alert">โหลดรายการไม่สำเร็จ: {serverError}</p>}
                {serverReady && serverState === 'ready' && !available.length && <p className="sop-record-help">ไม่พบแมตช์ที่ยังไม่จบและมีทีมครบทั้งสองทีม</p>}
                <form className="vop-download" onSubmit={event => { event.preventDefault(); if (!inFlight.current && canDownload) void download(); }}>
                    <label htmlFor="scorer-offline-download">เลือกแมตช์ออนไลน์<select id="scorer-offline-download" disabled={busy || !serverReady || serverState !== 'ready' || !available.length} value={selected ? selectedId : ''} onChange={event => setSelectedId(event.target.value)}><option value="">เลือกแมตช์</option>{available.map(match => {
                        const downloaded = records.some(record => String(record.id) === String(match.id) && !record.released);
                        return <option key={match.id} value={match.id} disabled={downloaded}>#{match.match_number || match.id} · {match.home_team || match.home_team_name} — {match.away_team || match.away_team_name}{downloaded ? ' · อยู่ในเครื่องแล้ว' : ''}</option>;
                    })}</select></label>
                    <button type="submit" className="vop-button vop-primary" disabled={busy || !canDownload}><Download aria-hidden="true" />ดาวน์โหลด</button>
                </form>
                {!unlocked && <p className="sop-record-help">เตรียมสิทธิ์หรือปลดล็อก PIN ของบัญชีนี้ก่อนดาวน์โหลด</p>}
                {serverReady && selected && <div className="sop-record-help" aria-live="polite">{alreadyLocal ? 'แมตช์นี้อยู่ในเครื่องแล้ว เปิดจากรายการด้านล่างเพื่อบันทึกหรือซิงค์' : leaseState === 'loading' ? 'กำลังตรวจสถานะการจอง…' : leaseState === 'error' ? <><span role="alert">ตรวจสถานะไม่สำเร็จ: {leaseError}</span> <button type="button" className="vop-text-link" disabled={busy} onClick={() => setLeaseVersion(value => value + 1)}>ตรวจอีกครั้ง</button></> : lease?.matchId === selectedId ? lease.reason : ''}</div>}
                <p className="sop-record-help">จองหนึ่งอุปกรณ์ต่อแมตช์ ระบบตรวจการจองซ้ำอีกครั้งขณะดาวน์โหลด กรุณาบันทึกและปิดหน้าแมตช์ในแท็บอื่นก่อนดาวน์โหลด</p>
            </section>
            <section className="vop-matches" aria-label="แมตช์ Scorer ในเครื่อง" aria-busy={readState === 'loading'}><div className="vop-section-title"><h3>แมตช์ในเครื่อง</h3><span>{readState === 'ready' ? `${records.length} แมตช์` : ''}</span></div>
                {readState === 'locked' && <div className="vop-empty"><LockKeyhole aria-hidden="true" /><strong>ปลดล็อกเพื่อดูรายการแมตช์</strong><span>ใช้ PIN ของบัญชีเจ้าของข้อมูล</span></div>}
                {readState === 'loading' && <p className="vop-empty" role="status">กำลังอ่านรายการแมตช์…</p>}
                {readState === 'error' && <div className="vop-read-error" role="alert"><p>อ่านรายการไม่สำเร็จ: {readError}</p><button className="vop-button" type="button" onClick={() => setRefresh(value => value + 1)}>ลองอีกครั้ง</button></div>}
                {readState === 'ready' && !records.length && <div className="vop-empty"><FolderDown aria-hidden="true" /><strong>ยังไม่มีแมตช์บนอุปกรณ์นี้</strong><span>เลือกแมตช์จากเซิร์ฟเวอร์ด้านบน แล้วกดดาวน์โหลดเพื่อจองสิทธิ์</span></div>}
                {readState === 'ready' && records.map(record => {
                    const match = record.cache[`/scorer/match/${record.id}`] || {};
                    const primary = !record.recoveryReadOnly && record.deviceId === deviceId();
                    return <article className="vop-match" key={record.id}><div className="vop-match-heading"><div><h4>{match.home_team_name || match.home_team || 'ทีมเหย้า'} — {match.away_team_name || match.away_team || 'ทีมเยือน'}</h4><p>แมตช์ #{match.match_number || record.id} · {record.released ? 'คืนสิทธิ์แล้ว' : primary ? 'เครื่องหลัก' : 'สำเนาสำหรับสำรอง'} · {record.queue.length} คำสั่งรอซิงค์</p><p>ซิงค์ล่าสุด {date(record.syncedAt)}</p></div></div>
                        <div className="vop-match-actions">{unlocked && primary && !record.released && <button type="button" className="vop-button" disabled={busy} onClick={() => openMatch(record)}>เปิดแมตช์</button>}{record.released && serverReady && <Link className="vop-button" to={`/scorer/${record.id}`} onClick={event => { try { switchAccessMode(false); } catch (error) { event.preventDefault(); setNotice(error.message); setNoticeError(true); } }}>เปิดบนเซิร์ฟเวอร์</Link>}
                            {unlocked && primary && !record.released && <>
                                <button type="button" className="vop-button" disabled={busy || !serverReady} onClick={() => run(async () => { await syncScorer(client, record.id); setNotice('ซิงค์สำเร็จ ยังคงจองเครื่องหลัก'); })}>ซิงค์</button>
                                <button type="button" className="vop-button" disabled={busy || !serverReady} onClick={() => run(async () => { await syncScorer(client, record.id, true); setServerVersion(value => value + 1); setNotice('ซิงค์และคืนสิทธิ์แล้ว กรุณาเปิดแมตช์บนเซิร์ฟเวอร์เพื่อตรวจสอบผล'); })}>ซิงค์และคืนสิทธิ์</button>
                            </>}
                            {record.released && serverReady && <button type="button" className="vop-button" disabled={busy} onClick={() => run(async () => { await client.post(`/scorer/match/${record.id}/offline-confirm`); setNotice('ยืนยันผลทางการแล้ว'); })}>ตรวจสอบแล้ว · ยืนยันผลทางการ</button>}
                            <button type="button" className="vop-button" disabled={busy} onClick={() => run(() => backupScorer(record.id))}>สำรอง JSON</button>
                        </div>{!record.released && primary && <p className="sop-record-help">บันทึกและปิดหน้าแมตช์ในแท็บอื่นก่อนซิงค์หรือคืนสิทธิ์จากแดชบอร์ดนี้</p>}</article>;
                })}
            </section>
            <details className="vop-device"><summary><MonitorCog aria-hidden="true" />อุปกรณ์และสิทธิ์การใช้งาน<ChevronDown aria-hidden="true" /></summary><div className="vop-device-body"><dl><div><dt>อุปกรณ์นี้</dt><dd>{deviceId().slice(0, 8)}</dd></div><div><dt>บัญชี Offline</dt><dd>{profile?.user || 'ยังไม่เตรียม'}</dd></div><div><dt>สิทธิ์ถึง</dt><dd>{profile ? date(profile.expiresAt) : '—'}</dd></div></dl><div className="vop-match-actions"><button type="button" className="vop-button" disabled={busy || !serverReady} onClick={() => setView('setup')}>เตรียม / ต่ออายุสิทธิ์</button>{profile && <button type="button" className="vop-button" disabled={busy} onClick={() => setView('unlock')}>ปลดล็อกด้วย PIN</button>}<Link className="vop-text-link" to={loginUrl}>เข้าสู่ระบบออนไลน์</Link></div></div></details>
            <footer className="vop-footer"><span><ShieldCheck aria-hidden="true" />ข้อมูลเก็บในเบราว์เซอร์นี้</span><details><summary>การดาวน์โหลดและสำรองข้อมูล</summary><p>เตรียมสิทธิ์ เลือกแมตช์ และดาวน์โหลดจากแดชบอร์ด Scorer ขณะออนไลน์ ก่อนตัดเน็ตต้องเตรียมแอป PWA ผ่าน production build ให้พร้อม สำรอง JSON ก่อนล้างข้อมูลเว็บไซต์หรือย้ายอุปกรณ์</p></details></footer>
        </>}
        {notice && <div className={`vop-notice ${noticeError ? 'is-error' : ''}`} role={noticeError ? 'alert' : 'status'}><p>{notice}</p><button type="button" aria-label="ปิดข้อความ" onClick={() => setNotice('')}><X aria-hidden="true" /></button></div>}
        {busy && <p className="sop-busy" role="status">กำลังดำเนินการ กรุณารอสักครู่…</p>}
    </dialog>;
}
