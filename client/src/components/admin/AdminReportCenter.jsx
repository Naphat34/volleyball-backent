import { useState } from 'react';
import { Download, FileSpreadsheet, ArrowUpRight } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminReportCenter({ onNavigate }) {
    const { language } = useLanguage(), th = language === 'THA';
    const t = (a, b) => th ? a : b;
    const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const reports = [['competitions', t('รายการแข่งขัน', 'Competitions'), t('ข้อมูลรายการ รุ่นอายุ เพศ สถานะ และจำนวนทีม', 'Competition, age, gender, status and registered team counts')], ['teams', t('สโมสรและทีม', 'Clubs & teams'), t('รายชื่อทีม รหัสทีม ผู้ฝึกสอน และสถานะ', 'Team names, codes, coach and status')], ['matches', t('ตารางและผลการแข่งขัน', 'Fixtures & results'), t('ข้อมูลคู่แข่งขันและคะแนนทางการจากรายงานเดิมของระบบ', 'Fixtures and official results from the existing reporting service')], ['audit', t('ประวัติการดำเนินการ', 'Audit history'), t('รายการล่าสุดไม่เกิน 1,000 รายการที่ระบบบันทึกไว้', 'Up to 1,000 most recent recorded audit entries')]];
    const download = async (type, format) => {
        if (busy) return; setBusy(`${type}-${format}`); setError(''); setNotice('');
        try {
            const response = await api.downloadReport(type, format), url = URL.createObjectURL(response.data), a = document.createElement('a');
            a.href = url; a.download = `${type}-report.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            setNotice(t('ดาวน์โหลดรายงานแล้ว', 'Report downloaded.'));
        } catch { setError(t('ส่งออกไม่สำเร็จ กรุณาตรวจสิทธิ์และการเชื่อมต่อแล้วลองใหม่', 'Export failed. Check access and connection, then retry.')); }
        finally { setBusy(''); }
    };
    return <div className="admin-report-center"><header className="ac-heading"><div><p className="ac-kicker">REPORTS & DOCUMENTS</p><h2>{t('ศูนย์รายงานและเอกสาร', 'Reports & documents')}</h2><p>{t('รวมช่องทางส่งออกข้อมูลและเอกสารการแข่งขัน', 'One place for data exports and match documents.')}</p></div></header>
        <p className="ac-note">{t('รายงานทั่วไปด้านล่างส่งออกข้อมูลทั้งหมดตามขอบเขตของบริการรายงานเดิม ไม่มีตัวกรองรายการแข่งขันในหน้านี้ หากต้องการกรองสถิติให้ใช้ศูนย์ข้อมูล VIMS', 'General exports below use the existing reporting service scope without competition filters here. Use VIMS for filtered statistics exports.')}</p>
        {error && <p className="ac-alert" role="alert">{error}</p>}{notice && <p role="status" className="ac-success">{notice}</p>}
        <div className="ac-report-grid">{reports.map(([key, title, description]) => <article className="ac-panel" key={key}><div className="ac-report-icon"><FileSpreadsheet size={23} /></div><h3>{title}</h3><p>{description}</p><div className="ac-row-actions">{['csv', 'xls'].map(format => <button key={format} disabled={Boolean(busy)} onClick={() => download(key, format)}><Download size={15} />{busy === `${key}-${format}` ? t('กำลังส่งออก…', 'Exporting…') : format.toUpperCase()}</button>)}</div></article>)}</div>
        <section className="ac-panel ac-report-vims"><h3>{t('เอกสารรายแมตช์และสถิติ VIMS', 'Match documents & VIMS statistics')}</h3><p>{t('เลือกแมตช์เพื่อเปิด P-2 หรือใช้ตัวกรองก่อนส่งออกตารางแมตช์ อันดับทีม และอันดับนักกีฬา', 'Select a match for P-2, or filter before exporting match, team and player statistics.')}</p><button onClick={() => onNavigate('escore')}>{t('เปิดศูนย์ข้อมูล VIMS', 'Open VIMS')}<ArrowUpRight size={16} /></button></section>
        <p className="ac-note">{t('การดาวน์โหลดเป็นข้อมูล ณ เวลาส่งออก ไม่ได้ทำให้ผลการแข่งขันหรือสถิติเปลี่ยนเป็นยืนยันแล้ว', 'Exports are snapshots at download time; downloading does not confirm results or statistics.')}</p>
    </div>;
}
