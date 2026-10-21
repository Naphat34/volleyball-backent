import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rosterFromRows, readRosterExcel } from './visRosterImport.js';
test('roster import supports Thai headers, captain flags and blank trailing rows', () => {
    const rows = rosterFromRows([['เบอร์', 'ชื่อ', 'นามสกุล', 'ตำแหน่ง', 'กัปตัน'], [7, 'ชื่อ', 'สกุล', 'oh', 1], ['', '', '']]);
    assert.equal(rows.length, 1); assert.equal(rows[0].position, 'OH'); assert.equal(rows[0].is_captain, true);
    assert.throws(() => rosterFromRows([['number', 'first_name', 'last_name'], [1, 'A', 'B'], [1, 'C', 'D']]), /ซ้ำ/);
    assert.throws(() => rosterFromRows([['number', 'first_name', 'last_name'], [1, 'A', '']]), /นามสกุล/);
});
test('real xlsx import reads the selected team sheet and rejects formula cells', async () => {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('home'); sheet.addRow(['number', 'first_name', 'last_name', 'position']); sheet.addRow([9, 'First', 'Last', 'MB']);
    const bytes = await book.xlsx.writeBuffer();
    const file = { name: 'roster.xlsx', size: bytes.length, arrayBuffer: async () => bytes };
    assert.equal((await readRosterExcel(file, 'home'))[0].number, 9);
    sheet.getCell('A2').value = { formula: '1+1', result: 2 };
    const formulaBytes = await book.xlsx.writeBuffer();
    await assert.rejects(readRosterExcel({ ...file, arrayBuffer: async () => formulaBytes }, 'home'), /สูตร/);
});
