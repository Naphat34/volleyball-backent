const aliases = {
    number: ['number', 'no', 'no.', 'เบอร์', 'หมายเลข'],
    first_name: ['first_name', 'firstname', 'first name', 'ชื่อ'],
    last_name: ['last_name', 'lastname', 'last name', 'นามสกุล'],
    position: ['position', 'ตำแหน่ง'],
    is_captain: ['captain', 'กัปตัน'],
};
export function rosterFromRows(rows) {
    const content = rows.filter(row => row.some(value => String(value ?? '').trim()));
    if (!content.length) throw new Error('ไฟล์ไม่มีรายชื่อ');
    const header = content[0].map(value => String(value ?? '').trim().toLowerCase());
    const indexes = Object.fromEntries(Object.entries(aliases).map(([key, list]) => [key, header.findIndex(value => list.includes(value))]));
    if (['number', 'first_name', 'last_name'].some(key => indexes[key] < 0)) throw new Error('ต้องมีหัวคอลัมน์ เบอร์, ชื่อ, นามสกุล (number, first_name, last_name)');
    if (content.length > 31) throw new Error('นำเข้าได้สูงสุดทีมละ 30 คน');
    const numbers = new Set();
    return content.slice(1).map((row, index) => {
        const value = key => String(row[indexes[key]] ?? '').trim();
        const number = Number(value('number'));
        if (!Number.isSafeInteger(number) || number < 1 || number > 999 || numbers.has(number)) throw new Error(`แถว ${index + 2}: เบอร์ไม่ถูกต้องหรือซ้ำ`);
        if (!value('first_name') || !value('last_name')) throw new Error(`แถว ${index + 2}: กรุณาระบุชื่อและนามสกุล`);
        const position = value('position').toUpperCase();
        if (position && !['S', 'OH', 'MB', 'OPP', 'OP', 'L'].includes(position)) throw new Error(`แถว ${index + 2}: ตำแหน่งไม่ถูกต้อง`);
        numbers.add(number);
        return { number, first_name: value('first_name'), last_name: value('last_name'), position,
            is_captain: ['1', 'true', 'yes', 'c', 'ใช่'].includes(value('is_captain').toLowerCase()) };
    });
}
export async function readRosterExcel(file, team) {
    if (!/\.xlsx$/i.test(file.name)) throw new Error('รองรับไฟล์ .xlsx กรุณาบันทึกไฟล์ Excel เป็น .xlsx ก่อน');
    if (file.size > 5 * 1024 * 1024) throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets.find(sheet => sheet.name.toLowerCase() === team) || workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 1000 || sheet.columnCount > 30) throw new Error('ไฟล์ไม่ตรงรูปแบบรายชื่อนักกีฬา');
    const rows = [];
    sheet.eachRow(row => {
        const values = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
            if (cell.value && typeof cell.value === 'object') throw new Error('กรุณาใช้ค่าข้อความหรือตัวเลข ไม่ใช้สูตรหรือลิงก์ในตารางรายชื่อ');
            values[col - 1] = cell.value ?? '';
        });
        rows.push(values);
    });
    return rosterFromRows(rows);
}
export async function downloadRosterTemplate() {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    for (const key of ['home', 'away']) {
        const sheet = book.addWorksheet(key);
        sheet.addRow(['number', 'first_name', 'last_name', 'position', 'captain']);
        sheet.columns.forEach(column => { column.width = 20; });
        sheet.getRow(1).font = { bold: true };
    }
    const url = URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a'); link.href = url; link.download = 'VIS_roster_template.xlsx'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
