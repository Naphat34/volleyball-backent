// Browser fixture only. No authenticated API or database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const buildDirectory = fileURLToPath(new URL('../../tmp/team-staff-assignments-build/', import.meta.url));
await build({ logLevel: 'error', publicDir: false, build: { outDir: buildDirectory, emptyOutDir: false, rollupOptions: { input: fileURLToPath(new URL('./fixtures/team-staff-assignments.html', import.meta.url)) } } });
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
    await page.goto('http://wizard.test/scripts/fixtures/team-staff-assignments.html');
    const category=page.getByRole('combobox');
    await category.selectOption('83');
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Save entry officials',exact:true}).click();
    await page.getByText('1 entry officials saved.',{exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.savedTeamStaff),[7]);
    await category.selectOption('');await category.selectOption('83');
    await page.waitForFunction(()=>document.querySelector('input[type=checkbox]')?.checked===true);
    assert.ok((await page.evaluate(()=>window.assignmentRequests)).every(request=>request.url==='/my-team/entries/83/staff'));
    assert.deepEqual(errors,[]);
    console.log('Passed team-owned selection, save and reload using only my-team endpoints.');
} finally { await browser.close(); }
