// Browser fixture only. No authenticated API or database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const buildDirectory = fileURLToPath(new URL('../../tmp/competition-wizard-build/', import.meta.url));
await build({ logLevel: 'error', publicDir: false, build: { outDir: buildDirectory, emptyOutDir: false, rollupOptions: { input: fileURLToPath(new URL('./fixtures/competition-wizard.html', import.meta.url)) } } });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://wizard.test/**', async route => {
        const path = decodeURIComponent(new URL(route.request().url()).pathname);
        if (path.includes('..')) return route.abort();
        const filename = path.startsWith('/fonts/') ? fileURLToPath(new URL(`../public${path}`, import.meta.url)) : `${buildDirectory}${path}`;
        try {
            const body = await readFile(filename);
            const contentType = path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.ttf') ? 'font/ttf' : 'text/html';
            await route.fulfill({ body, contentType });
        } catch { await route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto('http://wizard.test/scripts/fixtures/competition-wizard.html');
    await page.getByRole('button', { name: 'Fixture EN', exact: true }).click();
    await page.getByLabel('Competition name (Thai)', { exact: false }).fill('วอลเลย์บอลเยาวชนทดสอบ');
    await page.getByLabel('Competition name (English)', { exact: false }).fill('Youth Volleyball Championship');
    await page.getByLabel('Short name (English)', { exact: true }).fill('YOUTH CUP');
    await page.getByRole('button', { name: 'Save device draft', exact: true }).click();
    assert.match(await page.getByRole('status').textContent(), /Draft saved/);
    await page.getByLabel('Competition name (English)', { exact: false }).fill('');
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
    assert.equal(await page.getByLabel('Competition name (English)', { exact: false }).inputValue(), 'Youth Volleyball Championship');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByLabel('Start date (CE)', { exact: false }).fill('2026-12-10');
    await page.getByLabel('End date (CE)', { exact: false }).fill('2026-12-01');
    await page.getByLabel('Primary venue', { exact: false }).selectOption('1');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    assert.match(await page.getByRole('status').textContent(), /End date/);
    await page.getByLabel('End date (CE)', { exact: false }).fill('2026-12-20');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    for (const label of ['U15 Men', 'U15 Women', 'U18 Men']) await page.getByRole('checkbox', { name: label, exact: true }).check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    assert.ok(await page.getByText('YOUTH CUP', { exact: true }).isVisible());
    await page.getByRole('button', { name: 'Create 3 categories', exact: true }).click();
    const saved = await page.evaluate(() => window.fixtureResult);
    assert.equal(saved.categories.length, 3);
    assert.deepEqual(saved.categories.map(row => `${row.age_group_id}:${row.gender}`), ['1:Male', '1:Female', '2:Male']);
    assert.equal(saved.title_th, 'วอลเลย์บอลเยาวชนทดสอบ');
    const output = new URL('../../tmp/competition-wizard/', import.meta.url);
    await mkdir(output, { recursive: true });
    for (const [name, width, height, theme, lang] of [['ipad-landscape-en', 1024, 768, 'light', 'EN'], ['ipad-portrait-th', 768, 1024, 'dark', 'TH'], ['mobile-th', 390, 844, 'light', 'TH']]) {
        await page.setViewportSize({ width, height });
        await page.getByRole('button', { name: `Fixture ${lang}`, exact: true }).click();
        await page.evaluate(theme => { document.documentElement.setAttribute('data-app-theme', theme); document.documentElement.setAttribute('data-vis-theme', theme); }, theme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.equal(overflow, false, `${name}: horizontal overflow`);
        const bounds = await page.locator('footer').boundingBox();
        assert.ok(bounds.y + bounds.height <= height + 1, `${name}: footer outside viewport`);
        await page.screenshot({ path: new URL(`${name}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('Passed bilingual wizard, draft restore, invalid dates, exact category matrix, preview and three responsive layouts.');
} finally { await browser.close(); }
