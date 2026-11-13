import { GuardedButton } from '../ui/GuardedAction';
import useUiTranslation from '../../hooks/useUiTranslation';
import { lazy, Suspense, useState } from 'react';
import { Download, FileSpreadsheet, ArrowUpRight } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

const AdminTeamCompositionReport = lazy(() => import('../reports/AdminTeamCompositionReport'));

export default function AdminReportCenter({ onNavigate }) {
    const ui = useUiTranslation();
    const { language } = useLanguage(), th = language === 'THA';
    const t = (a, b) => th ? a : b;
    const [showComposition, setShowComposition] = useState(false);
    const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const reports = [['competitions', t('รายการแข่งขัน', 'Competitions'), t('ข้อมูลรายการ รุ่นอายุ เพศ สถานะ และจำนวนทีม', 'Competition, age, gender, status and registered team counts')], ['teams', t('สโมสรและทีม', 'Clubs & teams'), t('รายชื่อทีม รหัสทีม ผู้ฝึกสอน และสถานะ', 'Team names, codes, coach and status')], ['matches', t('ตารางและผลการแข่งขัน', 'Fixtures & results'), t('ข้อมูลคู่แข่งขันและคะแนนทางการจากรายงานเดิมของระบบ', 'Fixtures and official results from the existing reporting service')], ['audit', t('ประวัติการดำเนินการ', 'Audit history'), t('รายการล่าสุดไม่เกิน 1,000 รายการที่ระบบบันทึกไว้', 'Up to 1,000 most recent recorded audit entries')]];
    const download = async (type, format) => {
        if (busy) return; setBusy(`${type}-${format}`); setError(''); setNotice('');
        try {
            const response = await api.downloadReport(type, format), url = URL.createObjectURL(response.data), a = document.createElement('a');
            a.href = url; a.download = `${type}-report.${format}`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            setNotice(t('ดาวน์โหลดรายงานแล้ว', 'Report downloaded.'));
        } catch (failure) {
            let detail = failure.response?.data?.error;
            if (failure.response?.data instanceof Blob) {
                try { detail = JSON.parse(await failure.response.data.text()).error; } catch { /* Use the status-specific message. */ }
            }
            const status = failure.response?.status;
            const message = status === 401 ? t('กรุณาเข้าสู่ระบบใหม่ก่อนดาวน์โหลด', 'Sign in again before downloading.')
                : status === 403 ? t('บัญชีนี้ไม่มีสิทธิ์ส่งออกรายงาน หรือสิทธิ์เข้าสู่ระบบหมดอายุ', 'Report export is not permitted, or your login has expired.')
                : t('ส่งออกไม่สำเร็จ กรุณาลองใหม่', 'Export failed. Please retry.');
            setError(detail ? `${message} (${detail})` : message);
        }
        finally { setBusy(''); }
    };
    return <div className="admin-report-center"><header className="ac-heading"><div><p className="ac-kicker">{ui("REPORTS & DOCUMENTS")}</p><h2>{t('ศูนย์รายงานและเอกสาร', 'Reports & documents')}</h2><p>{t('รวมช่องทางส่งออกข้อมูลและเอกสารการแข่งขัน', 'One place for data exports and match documents.')}</p></div></header>
        <p className="ac-note">{t('รายงานทั่วไปด้านล่างส่งออกข้อมูลทั้งหมดตามขอบเขตของบริการรายงานเดิม ไม่มีตัวกรองรายการแข่งขันในหน้านี้ หากต้องการกรองสถิติให้ใช้ศูนย์ข้อมูล VIMS', 'General exports below use the existing reporting service scope without competition filters here. Use VIMS for filtered statistics exports.')}</p>
        {error && <p className="ac-alert" role="alert">{ui(error)}</p>}{notice && <p role="status" className="ac-success">{ui(notice)}</p>}
        <div className="ac-report-grid">{reports.map(([key, title, description]) => <article className="ac-panel" key={key}><div className="ac-report-icon"><FileSpreadsheet size={23} /></div><h3>{ui(title)}</h3><p>{description}</p><div className="ac-row-actions">{['csv', 'xls'].map(format => <GuardedButton key={format} disabled={Boolean(busy)} onClick={() => download(key, format)}><Download size={15} />{busy === `${key}-${format}` ? t('กำลังส่งออก…', 'Exporting…') : format.toUpperCase()}</GuardedButton>)}</div></article>)}
        <section className={`ac-panel ac-report-composition${showComposition ? ' is-expanded' : ''}`}>
            <div className="ac-report-icon"><FileSpreadsheet size={23} /></div>
            <h3>Team composition</h3>
            <p>{t('รายชื่อนักกีฬาและเจ้าหน้าที่ประจำทีม สีชุด และสถิติทีมในรูปแบบ PDF A4 แนวนอน', 'Team players, officials, uniform colors and statistics as an A4 landscape PDF.')}</p>
            <div className="ac-row-actions"><GuardedButton type="button" onClick={() => setShowComposition(value => !value)} aria-expanded={showComposition} aria-controls="team-composition-details"><FileSpreadsheet size={15} />{showComposition ? t('ปิดรายงาน Team composition', 'Close Team composition') : t('เปิดรายงาน Team composition', 'Open Team composition')}</GuardedButton></div>
            {showComposition && <div id="team-composition-details"><Suspense fallback={<p>{t('กำลังเปิดรายงาน…', 'Loading report…')}</p>}><AdminTeamCompositionReport /></Suspense></div>}
        </section></div>
        <section className="ac-panel ac-report-vims"><h3>{t('เอกสารรายแมตช์และสถิติ VIMS', 'Match documents & VIMS statistics')}</h3><p>{t('เลือกแมตช์เพื่อเปิด P-2 หรือใช้ตัวกรองก่อนส่งออกตารางแมตช์ อันดับทีม และอันดับนักกีฬา', 'Select a match for P-2, or filter before exporting match, team and player statistics.')}</p><GuardedButton onClick={() => onNavigate('escore')}>{t('เปิดศูนย์ข้อมูล VIMS', 'Open VIMS')}<ArrowUpRight size={16} /></GuardedButton></section>
        <p className="ac-note">{t('การดาวน์โหลดเป็นข้อมูล ณ เวลาส่งออก ไม่ได้ทำให้ผลการแข่งขันหรือสถิติเปลี่ยนเป็นยืนยันแล้ว', 'Exports are snapshots at download time; downloading does not confirm results or statistics.')}</p>
    </div>;
}
