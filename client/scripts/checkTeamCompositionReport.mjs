// Browser fixture only. No authenticated API or database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const buildDirectory = fileURLToPath(new URL('../../tmp/team-composition-report-build/', import.meta.url));
await build({ logLevel: 'error', publicDir: false, build: { outDir: buildDirectory, emptyOutDir: false, rollupOptions: { input: fileURLToPath(new URL('./fixtures/team-composition-report.html', import.meta.url)) } } });
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
    await page.goto('http://wizard.test/scripts/fixtures/team-composition-report.html');
    const screenshotDirectory=new URL('../../tmp/competition-wizard/',import.meta.url);
    await mkdir(screenshotDirectory,{recursive:true});
    await page.screenshot({path:fileURLToPath(new URL('report-cards.png',screenshotDirectory)),fullPage:true});
    await page.getByRole('button',{name:'Open Team composition',exact:true}).click();
    await page.getByLabel('Competition',{exact:false}).selectOption('5');
    assert.equal(await page.getByLabel('Competition',{exact:false}).locator('option').count(),2,'One event must appear only once');
    await page.getByLabel('Age group & gender',{exact:false}).selectOption('5:1:Male');
    await page.getByLabel('Registered team',{exact:false}).selectOption('11');
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();
    const download=await pending;
    assert.equal(download.suggestedFilename(),'CLUB_Team_composition_11.pdf');
    const stream=await download.createReadStream(),chunks=[];
    for await(const chunk of stream)chunks.push(chunk);
    const bytes=Buffer.concat(chunks);
    assert.equal(bytes.subarray(0,4).toString(),'%PDF');
    assert.ok(bytes.length>10000);
    const output=new URL('../../tmp/pdfs/',import.meta.url);await mkdir(output,{recursive:true});
    await download.saveAs(fileURLToPath(new URL('Admin-team-composition-test.pdf',output)));
    await page.getByText('6 players · 1 officials',{exact:true}).waitFor();
    await page.getByText('Using officials from the team roster saved in Team dashboard.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Assign entry officials',exact:true}).count(),0);
    await page.getByRole('button',{name:'Preview PDF',exact:true}).click();
    await page.locator('iframe[title="Team composition PDF"]').waitFor();
    const requests=await page.evaluate(()=>window.compositionRequests);
    assert.ok(requests.includes('/reports/team-composition/11'));
    assert.ok(!requests.includes('/reports/team-composition/12'));
    assert.deepEqual(errors,[]);
    console.log('Passed report entry point, grouped event selection, exact registration, real PDF download and PDF preview.');
} finally { await browser.close(); }
