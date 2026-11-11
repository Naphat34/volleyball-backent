// Browser fixture only. No authenticated API or database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const buildDirectory = fileURLToPath(new URL('../../tmp/report-downloads-build/', import.meta.url));
await build({ logLevel: 'error', publicDir: false, build: { outDir: buildDirectory, emptyOutDir: false, rollupOptions: { input: fileURLToPath(new URL('./fixtures/report-downloads.html', import.meta.url)) } } });
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
    await page.goto('http://wizard.test/scripts/fixtures/report-downloads.html');
    const types=['competitions','teams','matches','audit'];
    for(let index=0;index<types.length;index++)for(const format of ['csv','xls']){
      const pending=page.waitForEvent('download');
      await page.locator('article').nth(index).getByRole('button',{name:format.toUpperCase(),exact:true}).click();
      const download=await pending;
      assert.equal(download.suggestedFilename(),`${types[index]}-report.${format}`);
      const stream=await download.createReadStream(),chunks=[];
      for await(const chunk of stream)chunks.push(chunk);
      assert.ok(Buffer.concat(chunks).toString('utf8').includes('ทีมทดสอบ'),'Downloaded bytes must preserve Unicode');
      await page.getByRole('status').waitFor();
    }
    const requests=await page.evaluate(()=>window.reportRequests);
    assert.equal(requests.length,8);
    assert.ok(requests.every(request=>request.authorization==='Bearer fixture-admin-token'));
    await page.evaluate(()=>{window.reportDenied=true;});
    await page.locator('article').first().getByRole('button',{name:'CSV',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').textContent(),/Insufficient permissions/);
    assert.deepEqual(errors,[]);
    console.log('Passed all eight report download buttons, real response interceptor, Bearer header, Unicode bytes and JSON Blob permission errors.');
} finally { await browser.close(); }
