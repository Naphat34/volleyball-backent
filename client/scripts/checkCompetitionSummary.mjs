// Browser fixture only. No authenticated API or database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const buildDirectory = fileURLToPath(new URL('../../tmp/competition-summary-build/', import.meta.url));
await build({ logLevel: 'error', publicDir: false, build: { outDir: buildDirectory, emptyOutDir: false, rollupOptions: { input: fileURLToPath(new URL('./fixtures/competition-summary.html', import.meta.url)) } } });
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
    await page.goto('http://wizard.test/scripts/fixtures/competition-summary.html');
    await page.getByRole('button', { name: 'Fixture EN', exact: true }).click();
    await page.getByRole('heading', {name:'Registered Championship',exact:true}).waitFor();
    const selector=page.locator('select').first();
    assert.equal(await selector.inputValue(),'ชื่อรายการเดิม');
    assert.equal(await selector.locator('option:checked').textContent(),'Registered Championship');
    await page.getByRole('button',{name:'Fixture TH',exact:true}).click();
    await page.getByRole('heading',{name:'ชื่อรายการภาษาไทย',exact:true}).waitFor();
    assert.equal(await selector.inputValue(),'ชื่อรายการเดิม');
    await page.getByRole('button',{name:'Fixture EN',exact:true}).click();
    await page.getByRole('heading',{name:'Registered Championship',exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'ชื่อรายการภาษาไทย',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('Passed real competition summary and selector switching EN -> TH -> EN without changing the selected competition.');
} finally { await browser.close(); }
