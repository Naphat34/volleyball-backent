import { GuardedButton } from '../ui/GuardedAction';
import { RefreshCw, ArrowUpRight, CalendarDays, ListChecks, AlertCircle } from 'lucide-react';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useEffect, useRef, useState } from 'react';

import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { buildControlCenter, bangkokDay, matchPreparationIssues } from '../../utils/admin/controlCenter';
import { dashboardRefresh } from '../../utils/navigation/dashboardRefresh';
import { dashboardMatchStatusLabel } from '../../utils/vis/dashboardStatus';
import { dashboardSetResult } from '../../utils/vis/dashboardResult';
import { adminVisIssues } from '../../utils/vis/adminVims';
import { previewVisMatchResultPDF } from '../../utils/reports/pdfGenerator';
import AdminVisDetail from './AdminVisDetail';
import { getStoredUser } from '../../auth/authStorage';
import { readViewPreference, writeViewPreference } from '../../utils/common/viewPreferences';
import { groupPublicCompetitions, findCompetitionGroupById } from '../../utils/scorer/publicCompetitionGrouping';

export default function AdminControlCenter({ onNavigate, actionsOnly = false, theme = 'light' }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const { language } = useLanguage(), th = language === 'THA';
    const t = (a, b) => th ? a : b;
    const [data, setData] = useState({ matches: null, competitions: null, pending: null });
    const [errors, setErrors] = useState([]), [loading, setLoading] = useState(true), [updated, setUpdated] = useState(null);
    const preference = `admin-center:${getStoredUser()?.id || 'guest'}:${bangkokDay()}`;
    const [competition, setCompetition] = useState(() => readViewPreference(`${preference}:competition`));
    const [day, setDay] = useState(() => readViewPreference(`${preference}:day`, bangkokDay()));
    const [task, setTask] = useState('preparation');
    useEffect(() => { writeViewPreference(`${preference}:competition`, competition); writeViewPreference(`${preference}:day`, day); }, [preference, competition, day]);
    const [detail, setDetail] = useState(null), [notice, setNotice] = useState(''), [exporting, setExporting] = useState(false);
    const updatesRef = useRef(null);
    useEffect(() => {
        let active = true;
        const updates = dashboardRefresh(async silent => {
            if (!silent && active) setLoading(true);
            const sources = [['matches', api.getAdminVisOverview], ['competitions', api.getAllCompetitions], ['pending', api.getPendingUsers]];
            const results = await Promise.allSettled(sources.map(([, request]) => request()));
            if (!active) return;
            const failed = [], patch = {};
            results.forEach((result, i) => {
                const key = sources[i][0];
                const values = result.status === 'fulfilled' ? key === 'matches' ? result.value.data.matches : result.value.data : null;
                if (Array.isArray(values)) patch[key] = values;
                else failed.push(key);
            });
            setData(previous => ({ ...previous, ...patch }));
            setErrors(failed); if (!failed.length) setUpdated(new Date()); setLoading(false);
        }, { intervalMs: 60000 });
        updatesRef.current = updates; void updates.refresh(false);
        return () => { active = false; updates.stop(); updatesRef.current = null; };
    }, []);
    const competitionGroups = groupPublicCompetitions(data.competitions || [], language);
    const selectedGroup = findCompetitionGroupById(competitionGroups, competition);
    const selectedCompetitionIds = new Set(selectedGroup?.items.map(c => String(c.id)) || [competition]);
    const matches = (data.matches || []).filter(m => !competition || selectedCompetitionIds.has(String(m.competition_id)));
    const competitions = (data.competitions || []).filter(c => !competition || selectedCompetitionIds.has(String(c.id)));
    const overview = buildControlCenter(matches, competitions, new Date(`${day || bangkokDay()}T12:00:00+07:00`));
    const labels = { teams: t('ทีมไม่ครบ', 'Missing teams'), schedule: t('วัน / เวลาไม่ครบ', 'Missing schedule'), venue: t('ยังไม่ระบุสนาม', 'Missing venue'), officials: t('ผู้ตัดสินยังไม่ครบ', 'Missing referees'),
        review: t('รอตรวจ / ยืนยันสถิติ', 'Unconfirmed statistics'), no_stats: t('ไม่มีสถิติหลังจบแมตช์', 'Finished without statistics'), lineup: t('ไลน์อัปไม่ครบ', 'Incomplete lineup'), offline: t('สิทธิ์ Offline ยังใช้งานอยู่', 'Active offline lease'), result: t('ผล VIMS กับทางการไม่ตรง', 'VIMS / official result mismatch') };
    const sourceLabels = { matches: t('แมตช์', 'Matches'), competitions: t('รายการแข่งขัน', 'Competitions'), pending: t('บัญชีรออนุมัติ', 'Pending accounts') };
    const number = (key, value) => data[key] === null ? '—' : value;
    const pdf = async (match, source) => {
        if (exporting) return; setExporting(true); setNotice('');
        try { await previewVisMatchResultPDF(source || (await api.getMatchScoresheetData(match.id)).data, { language }); }
        catch (error) { setNotice(error.message || t('ส่งออกไม่สำเร็จ', 'Export failed')); }
        finally { setExporting(false); }
    };
    const openManager = match => { setDetail(null); onNavigate('matches', { competitionId: match.competition_id, matchId: match.id }); };
    const table = rows => <div className="ac-table-scroll" tabIndex={0} role="region" aria-label={t('รายการคู่แข่งขัน', 'Match list')}><table><thead><tr><th>#</th><th>{t('วัน / เวลา', 'Date / time')}</th><th>{t('คู่แข่งขัน / รายการ', 'Match / competition')}</th><th>{t('สถานะ / สิ่งที่ต้องตรวจ', 'Status / attention')}</th><th>{t('ดำเนินการ', 'Actions')}</th></tr></thead><tbody>{rows.map(m => <tr key={m.id}><td>{m.match_number || m.id}</td><td>{m.match_date || '—'}<small>{m.start_time || '—'}</small></td><td><strong>{(displayNames.matchTeamName(m, 'home')) || (ui('TBA'))} <span className="ac-muted">{ui("vs")}</span> {(displayNames.matchTeamName(m, 'away')) || (ui('TBA'))}</strong><small>{m.competition_name}</small><small>{m.location || t('ยังไม่ระบุสนาม', 'Venue not set')}</small></td><td><span className="ac-status">{dashboardMatchStatusLabel(m, th)} · {dashboardSetResult(m)}</span><div className="ac-tags">{(task === 'statistics' ? adminVisIssues(m) : matchPreparationIssues(m)).map(key => <span key={key}>{labels[key]}</span>)}</div></td><td><div className="ac-row-actions"><GuardedButton onClick={() => setDetail(m)}>{t('ดูข้อมูล', 'View')}</GuardedButton>{!m.is_custom_vis && <GuardedButton onClick={() => openManager(m)}>{t('จัดการตาราง', 'Manage fixture')}</GuardedButton>}</div></td></tr>)}</tbody></table>{!rows.length && <p className="ac-empty">{data.matches === null ? t('ยังไม่มีข้อมูลที่โหลดสำเร็จ', 'Match data has not loaded.') : t('ไม่พบรายการตามเงื่อนไข', 'No matching records.')}</p>}</div>;
    return <div className="admin-control-center"><header className="ac-heading"><div><p className="ac-kicker">{ui("COMPETITION ADMINISTRATION")}</p><h2>{actionsOnly ? t('งานที่ต้องดำเนินการ', 'Action center') : t('ศูนย์บริหารการแข่งขัน', 'Competition control center')}</h2><p>{t('ติดตามความพร้อม การแข่งขัน และงานตรวจรับข้อมูลจากจุดเดียว', 'Monitor readiness, fixtures and outstanding work in one place.')}</p></div><GuardedButton disabled={loading} onClick={() => updatesRef.current?.refresh(false)}><RefreshCw size={16} />{t('โหลดใหม่', 'Refresh')}</GuardedButton></header>
        <div className="ac-context"><label>{t('ขอบเขตการแข่งขัน', 'Competition scope')}<select value={selectedGroup ? String(selectedGroup.items[0].id) : competition} onChange={e => setCompetition(e.target.value)}><option value="">{t('ทุกรายการแข่งขัน', 'All competitions')}</option>{competitionGroups.map(group => <option key={group.key} value={group.items[0].id}>{group.title}</option>)}</select></label><label>{t('วันที่ติดตาม', 'Monitoring date')}<input type="date" value={day} onChange={e => setDay(e.target.value || bangkokDay())} /></label><p>{t('ดึงข้อมูลเมื่อ', 'Last refreshed')}: {updated ? updated.toLocaleString(th ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok' }) : '—'}<small>{t('อัปเดตทุก 60 วินาทีเมื่อเปิดหน้านี้', 'Refreshes every 60 seconds while visible')}</small></p></div>
        {errors.length > 0 && <div className="ac-alert" role="alert"><AlertCircle size={18} /><span>{t('โหลดข้อมูลบางส่วนไม่สำเร็จ', 'Some sources failed')}: {errors.map(key => sourceLabels[key]).join(', ')} · {t('ส่วนที่มีข้อมูลเดิมอาจไม่เป็นปัจจุบัน', 'Previously loaded values may be stale.')}</span><GuardedButton onClick={() => updatesRef.current?.refresh(false)}>{t('ลองใหม่', 'Retry')}</GuardedButton></div>}
        {notice && <p className="ac-alert" role="alert">{ui(notice)}</p>}
        <section className="ac-metrics" aria-label={t('ภาพรวม', 'Overview')}>{[[t('รายการที่เปิดอยู่', 'Open competitions'), number('competitions', overview.openCompetitions)], [t('คู่แข่งขันในวันที่เลือก', 'Fixtures on selected date'), number('matches', overview.todayMatches.length)], [t('กำลังแข่งขัน', 'Live fixtures'), number('matches', overview.live)], [t('จบการแข่งขัน', 'Finished fixtures'), number('matches', overview.completed)]].map(([label, value]) => <article key={label}><p>{ui(label)}</p><strong>{loading && !updated ? '…' : value}</strong></article>)}</section>
        <section className="ac-work-cards">{[['pending', t('บัญชีรออนุมัติ', 'Account approvals'), number('pending', data.pending?.length), 'pending_users'], ['preparation', t('ความพร้อมก่อนแข่งขัน', 'Fixture readiness'), number('matches', overview.needsPreparation.length), null], ['collisions', t('เวลาเริ่มตรงกัน', 'Start-time conflicts'), number('matches', overview.collisions.length), null], ['statistics', t('สถิติที่ต้องตรวจ', 'Statistics attention'), number('matches', overview.needsStatistics.length), null]].map(([key, label, count, target]) => <GuardedButton key={key} onClick={() => target ? onNavigate(target) : setTask(key)} aria-pressed={!target ? task === key : undefined}><span>{ui(label)}</span><strong>{count}</strong><small>{key === 'pending' ? t('ทุกบัญชี · ไม่ขึ้นกับรายการแข่งขัน', 'All accounts · independent of competition') : t('ตามขอบเขตการแข่งขันที่เลือก', 'Within selected competition scope')}</small><ArrowUpRight size={17} /></GuardedButton>)}</section>
        <section className="ac-panel"><header><h3><ListChecks size={18} />{t('รายการติดตาม', 'Work queue')}</h3><div className="ac-tabs">{[['preparation', t('ความพร้อม', 'Readiness')], ['collisions', t('ตารางชนกัน', 'Conflicts')], ['statistics', 'VIMS']].map(([key, label]) => <GuardedButton key={key} aria-pressed={task === key} onClick={() => setTask(key)}>{ui(label)}</GuardedButton>)}</div></header>
            {task === 'collisions' ? <><p className="ac-note">{t('ตรวจคู่ที่เริ่มวันและเวลาเดียวกัน โดยใช้ทีมเดียวกันหรือชื่อสนามตรงกัน ยังไม่ตรวจเวลาจบและสนามย่อย', 'Checks identical start times sharing a team or venue name. End times and sub-courts are not evaluated.')}</p>{overview.collisions.map(item => <article className="ac-conflict" key={item.id}><strong>{item.first.match_date} {item.first.start_time} · {item.venue ? t('สนามซ้ำ', 'Same venue') : ''}{item.team ? ' · ' + t('ทีมซ้ำ', 'Same team') : ''}</strong><div>{[item.first, item.second].map(m => <GuardedButton key={m.id} onClick={() => setDetail(m)}>#{m.match_number || m.id} {displayNames.matchTeamName(m, 'home')}{' '}{ui("vs")}{' '}{displayNames.matchTeamName(m, 'away')} <ArrowUpRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton>)}</div></article>)}{!overview.collisions.length && <p className="ac-empty">{t('ไม่พบเวลาเริ่มที่ชนกันในข้อมูลที่โหลด', 'No matching start-time conflicts in loaded data.')}</p>}</> : table(task === 'statistics' ? overview.needsStatistics : overview.needsPreparation)}
        </section>
        {!actionsOnly && <section className="ac-panel"><header><h3><CalendarDays size={18} />{t('คู่แข่งขันในวันที่ติดตาม', 'Fixtures on monitoring date')}</h3><GuardedButton onClick={() => onNavigate('matches')}>{t('ตารางทั้งหมด', 'All fixtures')} <ArrowUpRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton></header>{table(overview.todayMatches)}</section>}
        <p className="ac-note">{t('ข้อมูล Offline ที่ยังไม่ซิงค์ไม่รวมในสรุปนี้ การตรวจความพร้อมเป็นการแจ้งเตือน ไม่เปลี่ยนสถานะหรือคะแนนการแข่งขัน', 'Unsynced offline data is excluded. Readiness checks are advisory and never change match status or scores.')}</p>
        {detail && <div className="admin-vims ac-modal-host" data-theme={theme}><AdminVisDetail match={detail} onClose={() => setDetail(null)} onPDF={pdf} /></div>}
    </div>;
}
