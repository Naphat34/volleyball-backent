import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { appendVisReportPages, visReportFilename } from './visReportPdf.js';

test('VIS filename uses match number and export date in Bangkok, including midnight rollover', () => {
    const date = new Date('2026-10-20T18:00:00Z');
    assert.equal(visReportFilename({ id: 84, match_number: 12 }, date), 'Vis_match_12_2026-10-21.pdf');
    assert.equal(visReportFilename({ id: 84 }, date), 'Vis_match_84_2026-10-21.pdf');
    assert.equal(visReportFilename({ match_number: 'A/1' }, date), 'Vis_match_A_1_2026-10-21.pdf');
});

async function createReport(count, options = {}) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const bytes = await readFile(new URL('../../../public/fonts/Sarabun-Regular.ttf', import.meta.url));
    const font = await pdf.embedFont(bytes);
    const roster = start => Array.from({ length: count }, (_, i) => ({ id: start + i, number: i + 1, first_name: 'นักกีฬา', last_name: 'ทดสอบ' }));
    const data = { match: { id: 1, home_team_id: 10, away_team_id: 20, home_team_name: 'โรงเรียนทีมหนึ่ง', away_team_name: 'โรงเรียนทีมสอง', status: 'completed' },
        homePlayers: roster(100), awayPlayers: roster(200), events: [], sets: [] };
    appendVisReportPages(pdf, font, data, { fontLayout: fontkit.create(bytes), ...options });
    return PDFDocument.load(await pdf.save());
}
test('default VIS report includes Match Result P2 before summary and player statistics', async () => {
    const pdf = await createReport(12);
    assert.equal(pdf.getPageCount(), 4);
    assert.ok(pdf.getPages()[0].getWidth() < pdf.getPages()[0].getHeight());
    assert.ok(pdf.getPages()[1].getWidth() < pdf.getPages()[1].getHeight());
    assert.ok(pdf.getPages()[2].getWidth() > pdf.getPages()[2].getHeight());
});
test('long rosters paginate without dropping players, and optional history adds a page', async () => {
    const pdf = await createReport(30, { includeHistory: true });
    assert.ok(pdf.getPageCount() > 4);
    assert.ok(pdf.getPages().filter(page => page.getWidth() === 595.28).length >= 4);
});
