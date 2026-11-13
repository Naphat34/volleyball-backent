// Isolated roster layout fixture; no live API, accounts, database or match data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const directory = fileURLToPath(new URL('../../tmp/scoresheet-roster-build/', import.meta.url));
const output = fileURLToPath(new URL('../../tmp/scoresheet-roster-preview/', import.meta.url));
await mkdir(output, { recursive: true });
await build({ logLevel: 'error', publicDir: false, build: { outDir: directory, emptyOutDir: false, rollupOptions: { input: fileURLToPath(new URL('./fixtures/scoresheet-roster.html', import.meta.url)) } } });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }) });
try {
    const page = await browser.newPage({ viewport: { width: 420, height: 520 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://scoresheet.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.includes('..')) return route.abort();
        try {
            const file = path.startsWith('/fonts/') ? fileURLToPath(new URL(`../public${path}`, import.meta.url)) : directory + path;
            await route.fulfill({ body: await readFile(file), contentType: path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.ttf') ? 'font/ttf' : 'text/html' });
        } catch { await route.fulfill({ status: 404, body: '' }); }
    });
    for (const capacity of [12, 14, 20]) for (const mode of ['screen', 'print']) for (const variant of ['', '&empty=true', '&noLibero=true', '&scaled=true']) {
        await page.emulateMedia({ media: mode });
        await page.goto(`http://scoresheet.test/scripts/fixtures/scoresheet-roster.html?capacity=${capacity}${variant}`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        const result = await page.evaluate(() => {
            const panel = document.querySelector('.scoresheet-roster');
            const bounds = panel.getBoundingClientRect();
            const names = [...panel.querySelectorAll('.ss-roster-name')];
            return { overflow: panel.scrollHeight > panel.clientHeight + 1, rowCount: panel.querySelectorAll('[data-roster-row][data-side="A"]').length,
                clipped: names.filter(element => { const text = element.firstElementChild.getBoundingClientRect(), cell = element.getBoundingClientRect(); return text.width > cell.width - 5 + 1 || text.height > cell.height + 1 || text.bottom > bounds.bottom + 1; }).length,
                signaturesInside: panel.querySelector('.ss-roster-signatures').getBoundingClientRect().bottom <= bounds.bottom,
                pageInside: bounds.bottom <= document.querySelector('.a3-container').getBoundingClientRect().bottom + 1,
            };
        });
        assert.equal(result.rowCount, capacity, `${capacity}/${mode}/${variant}: players must not disappear`);
        assert.equal(result.overflow, false, `${capacity}/${mode}/${variant}: panel overflow`);
        assert.equal(result.clipped, 0, `${capacity}/${mode}/${variant}: clipped names`);
        assert.equal(result.signaturesInside, true);
        assert.equal(result.pageInside, true, 'Roster must remain inside the A3 sheet');
        if (!variant && mode === 'screen') await page.locator('.scoresheet-roster').screenshot({ path: `${output}/roster-${capacity}.png` });
    }
    assert.deepEqual(errors, []);
    console.log('Passed 24 A3 screen/print cases for 12/14/20-player rosters, long names, empty opponents, zero liberos and scaled previews.');
} finally { await browser.close(); }
