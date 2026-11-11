import { useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import { api } from '../../api';

const columns = [
    ['number', 'เบอร์เสื้อ'], ['first_name', 'ชื่อ'], ['last_name', 'นามสกุล'],
    ['position', 'ตำแหน่ง'], ['birth_date', 'วันเกิด'], ['height_cm', 'ส่วนสูง'],
    ['weight', 'น้ำหนัก'], ['nickname', 'ชื่อเล่น'], ['nationality', 'สัญชาติ'],
];
const cellText = value => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
        if (value.formula || value.sharedFormula) throw new Error('ไม่รองรับเซลล์สูตร กรุณาวางเป็นค่า / Paste formulas as values');
        if (value.richText) return value.richText.map(part => part.text).join('').trim();
        return String(value.text || '').trim();
    }
    return String(value).trim();
};

export default function PlayerExcelImport({ gender, players, onImported, language }) {
    const [rows, setRows] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const th = language === 'THA';
    const label = (thai, english) => th ? thai : english;

    const downloadTemplate = async () => {
        try {
            const { default: ExcelJS } = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Players');
            sheet.columns = columns.map(([key, title]) => ({ key, header: title, width: 22 }));
            sheet.getRow(1).font = { bold: true };
            sheet.addRow({ number: 1, first_name: 'ตัวอย่างชื่อ', last_name: 'ตัวอย่างนามสกุล', position: 'OH', birth_date: '2010-01-31' });
            sheet.getColumn('birth_date').numFmt = '@';
            const url = URL.createObjectURL(new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'players-template.xlsx';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            setMessage(label('ดาวน์โหลดแบบฟอร์มไม่สำเร็จ', 'Could not download template'));
        }
    };

    const readFile = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setBusy(true);
        setMessage('');
        setRows(null);
        try {
            if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error(label('กรุณาเลือกไฟล์ .xlsx ขนาดไม่เกิน 5 MB', 'Select an .xlsx file up to 5 MB'));
            const { default: ExcelJS } = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const sheet = workbook.worksheets[0];
            if (!sheet) throw new Error(label('ไม่พบแผ่นงาน', 'No worksheet found'));
            const headers = {};
            sheet.getRow(1).eachCell((cell, index) => {
                const text = cellText(cell.value).toLowerCase();
                const column = columns.find(([key, title]) => text === key || text === title);
                if (column) {
                    if (headers[column[0]]) throw new Error(`Duplicate column: ${column[0]}`);
                    headers[column[0]] = index;
                }
            });
            if (!['number', 'first_name', 'last_name'].every(key => headers[key])) throw new Error(label('ต้องมีหัวคอลัมน์ เบอร์เสื้อ ชื่อ และนามสกุล ในแถวแรก (ดูแบบฟอร์ม)', 'First row must contain number, first_name and last_name (see template)'));
            const imported = [];
            const seenNumbers = new Set(players.map(player => Number(player.number)));
            const seen = new Set(players.map(player => `${player.first_name} ${player.last_name}`.trim().toLowerCase()));
            sheet.eachRow((row, index) => {
                if (index === 1) return;
                const data = Object.fromEntries(columns.map(([key]) => [key, headers[key] ? cellText(row.getCell(headers[key]).value) : '']));
                if (!Object.values(data).some(Boolean)) return;
                if (imported.length >= 500) throw new Error(label('นำเข้าได้ครั้งละไม่เกิน 500 คน', 'Maximum 500 players per import'));
                const errors = [];
                if (!data.first_name || !data.last_name) errors.push(label('กรุณาระบุชื่อและนามสกุล', 'Name required'));
                if (data.first_name.length > 50 || data.last_name.length > 50) errors.push(label('ชื่อและนามสกุลยาวได้ช่องละไม่เกิน 50 ตัวอักษร', 'Each name must be at most 50 characters'));
                if (!/^\d+$/.test(data.number) || +data.number < 1 || +data.number > 999) errors.push(label('เบอร์เสื้อต้องเป็น 1–999', 'Number must be 1–999'));
                if (seenNumbers.has(Number(data.number))) errors.push(label('เบอร์เสื้อซ้ำในทีม/ไฟล์ กรุณาใช้หมายเลขอื่น', 'Jersey number is duplicated in the team/file'));
                seenNumbers.add(Number(data.number));
                data.position = data.position.toUpperCase() || 'OH';
                if (!['S', 'OH', 'OPP', 'MB', 'L'].includes(data.position)) errors.push(label('ตำแหน่งต้องเป็น S, OH, OPP, MB, L', 'Position must be S, OH, OPP, MB, L'));
                if (data.birth_date && (!/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date) || !Number.isFinite(Date.parse(data.birth_date)) || new Date(data.birth_date).toISOString().slice(0, 10) !== data.birth_date || data.birth_date > new Date().toISOString().slice(0, 10))) errors.push(label('วันเกิดต้องเป็น YYYY-MM-DD ค.ศ. และไม่เป็นวันในอนาคต', 'Use a valid birth date: YYYY-MM-DD (CE)'));
                for (const key of ['height_cm', 'weight']) if (data[key] && (!/^\d+$/.test(data[key]) || +data[key] <= 0)) errors.push(`${key}: ${label('ต้องเป็นจำนวนเต็มบวก', 'must be a positive integer')}`);
                const name = `${data.first_name} ${data.last_name}`.trim().toLowerCase();
                if (seen.has(name)) errors.push(label('ชื่อซ้ำในทีม/ไฟล์ กรุณาตรวจสอบ', 'Duplicate name in team/file'));
                seen.add(name);
                imported.push({ row: index, data: { ...data, gender }, error: errors.join('; ') });
            });
            if (!imported.length) throw new Error(label('ไม่พบรายชื่อนักกีฬา', 'No players found'));
            setRows(imported);
        } catch (error) {
            setMessage(error.message || label('อ่านไฟล์ไม่สำเร็จ', 'Could not read file'));
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        setBusy(true);
        let saved = 0;
        const failed = [];
        for (const row of rows) {
            try {
                await api.addPlayer(row.data);
                saved++;
            } catch (error) {
                failed.push({ ...row, error: error.response?.data?.error || label('บันทึกไม่สำเร็จ กรุณาตรวจรายชื่อในทีมก่อนลองใหม่', 'Save failed; check team roster before retrying') });
            }
        }
        setRows(failed.length ? failed : null);
        setMessage(label(`บันทึกสำเร็จ ${saved} คน ไม่สำเร็จ ${failed.length} คน`, `Saved ${saved}; failed ${failed.length}`));
        setBusy(false);
        await onImported();
    };

    return <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={downloadTemplate} disabled={busy} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50"><Download size={16} />{label('แบบฟอร์ม Excel', 'Excel template')}</button>
        <label className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${busy || !gender ? 'opacity-50' : 'cursor-pointer'}`}>
            <Upload size={16} />{busy ? label('กำลังดำเนินการ…', 'Processing…') : label('นำเข้า Excel', 'Import Excel')}
            <input type="file" accept=".xlsx" className="hidden" disabled={busy || !gender} onChange={readFile} />
        </label>
        {message && <p role="status" className="w-full text-sm">{message}</p>}
        {rows && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 text-gray-900" role="dialog" aria-modal="true" aria-label={label('ตรวจสอบรายชื่อนำเข้า', 'Review imported players')}>
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-md bg-white p-5">
                <div className="flex justify-between gap-4"><h3 className="text-lg font-bold">{label('ตรวจสอบรายชื่อก่อนนำเข้า', 'Review players before importing')} ({rows.length})</h3><button type="button" disabled={busy} onClick={() => setRows(null)} aria-label={label('ปิด', 'Close')}><X /></button></div>
                <p className="my-3 text-sm">{label('ใช้แผ่นงานแรก วันเกิดเป็น ค.ศ. YYYY-MM-DD เพศตามประเภททีม กรุณาลบแถวตัวอย่างก่อนนำเข้า แถวที่ผิดต้องแก้ในไฟล์แล้วเลือกใหม่', 'Uses the first worksheet. Dates: YYYY-MM-DD (CE). Gender follows the team. Remove the example row. Fix invalid rows in the file and select it again.')}</p>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['แถว / Row', 'เบอร์ / No.', 'ชื่อ / Name', 'ตำแหน่ง / Position', 'วันเกิด / Birth date', 'ผลตรวจ / Validation'].map(title => <th key={title} className="border p-2">{title}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.row}><td className="border p-2">{row.row}</td><td className="border p-2">{row.data.number}</td><td className="border p-2">{row.data.first_name} {row.data.last_name}</td><td className="border p-2">{row.data.position}</td><td className="border p-2">{row.data.birth_date}</td><td className="border p-2 text-red-700">{row.error || '✓'}</td></tr>)}</tbody></table></div>
                <div className="mt-4 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setRows(null)} className="rounded border px-4 py-2">{label('ปิด', 'Close')}</button><button type="button" disabled={busy || rows.some(row => row.error)} onClick={save} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? label('กำลังบันทึก…', 'Saving…') : label('ยืนยันนำเข้า', 'Confirm import')}</button></div>
            </div>
        </div>}
    </div>;
}
