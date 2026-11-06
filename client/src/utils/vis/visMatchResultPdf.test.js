import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { appendMatchResultPages } from './visMatchResultPdf.js';
import { buildVisReport } from './visReportData.js';

test('P-2 keeps all table rectangles on A4 and retains every player across continuation pages', async () => {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(await readFile(new URL('../../../public/fonts/Sarabun-Regular.ttf', import.meta.url)));
    const addPage = pdf.addPage.bind(pdf);
    pdf.addPage = size => {
        const page = addPage(size), draw = page.drawRectangle.bind(page);
        page.drawRectangle = options => {
            assert.ok(options.width > 0 && options.height > 0);
            assert.ok(options.x >= 0 && options.y >= 0);
            assert.ok(options.x + options.width <= size[0] + .01);
            assert.ok(options.y + options.height <= size[1] + .01);
            return draw(options);
        };
        return page;
    };
    const roster = base => Array.from({ length: 30 }, (_, i) => ({ id: base + i, number: i + 1, name: `Player${base + i}` }));
    const data = { match: { id: 1, home_team_id: 10, away_team_id: 20 }, homePlayers: roster(100), awayPlayers: roster(200), events: [], sets: [] };
    const printed = [];
    appendMatchResultPages(pdf, font, data, buildVisReport(data), (page, value) => printed.push(value));
    assert.equal(pdf.getPageCount(), 3);
    for (const player of [...data.homePlayers, ...data.awayPlayers]) assert.ok(printed.some(value => value.includes(player.name)), player.name);
    assert.ok(printed.includes('P-2'));
    assert.ok(printed.includes('Best scorers'));
});

test('P-2 total includes fixed intervals but omits the one before a deciding set', async () => {
    for (const [maxSets, played, expected] of [[5, 3, '1:06'], [3, 3, '1:03'], [5, 5, '1:49']]) {
        const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
        const font = await pdf.embedFont(await readFile(new URL('../../../public/fonts/Sarabun-Regular.ttf', import.meta.url)));
        const data = { match: { id: 1, home_team_id: 10, away_team_id: 20, max_sets: maxSets, status: 'completed' }, homePlayers: [], awayPlayers: [], events: [],
            sets: Array.from({ length: played }, (_, i) => ({ set_number: i + 1, home_score: i + 1 === maxSets ? 15 : 25, away_score: 0, duration_minutes: 20, end_time: '2026-11-03T01:00:00Z' })) };
        const printed = [];
        appendMatchResultPages(pdf, font, data, buildVisReport(data), (page, text) => printed.push(text));
        assert.ok(printed.some(text => text.includes(`Total: ${expected}`)), `${maxSets}/${played}`);
    }
});
