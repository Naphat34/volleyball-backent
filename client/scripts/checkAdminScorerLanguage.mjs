// Browser test uses an isolated cached fixture and never accesses a live account.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const directory = fileURLToPath(new URL('../../tmp/adminscorer-language-build/', import.meta.url));
await build({ logLevel: 'error', publicDir: false, build: { outDir: directory, emptyOutDir: false, rollupOptions: { input: fileURLToPath(new URL('./fixtures/adminscorer-language.html', import.meta.url)) } } });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: 'chrome' }) });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'scorer-language.test') return route.abort();
        try {
            const path = url.pathname;
            if (path.includes('..')) return route.abort();
            const file = path.startsWith('/fonts/') ? fileURLToPath(new URL(`../public${path}`, import.meta.url)) : directory + path;
            await route.fulfill({ body: await readFile(file), contentType: path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.ttf') ? 'font/ttf' : 'text/html' });
        } catch { await route.fulfill({ status: 404, body: '' }); }
    });
    const check = async (title, gender) => {
        try {
            await page.waitForFunction(value => document.querySelector('.vd-competition > span')?.textContent.includes(value), title);
        } catch (error) {
            throw new Error(`${error.message}\nBrowser errors: ${JSON.stringify(errors)}\nPage: ${await page.locator('body').innerText()}`);
        }
        assert.equal(await page.locator('select').first().inputValue(), '7', 'Language switches must keep the selected competition ID');
        assert.equal(await page.locator('select').first().locator('option:checked').textContent(), title);
        assert.ok((await page.locator('.vd-competition > span').textContent()).includes(gender));
        assert.ok((await page.locator('.vd-brand').textContent()).includes(title));
    };
    await page.goto('http://scorer-language.test/scripts/fixtures/adminscorer-language.html?compId=7');
    await check('English Championship', 'Men');
    await page.getByRole('button', { name: 'ไทย', exact: true }).click();
    await check('รายการภาษาไทย', 'ชาย');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await check('English Championship', 'Men');
    await page.reload();
    await check('English Championship', 'Men');
    assert.deepEqual(errors, []);
    console.log('AdminScorer Thai/English row, filter and navbar labels switch offline, preserve selection, and survive reload.');
} finally { await browser.close(); }
