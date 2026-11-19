import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const directory=fileURLToPath(new URL('../../tmp/fixture-language-build/',import.meta.url));
await build({logLevel:'error',publicDir:false,build:{outDir:directory,emptyOutDir:false,rollupOptions:{input:fileURLToPath(new URL('./fixtures/fixture-language.html',import.meta.url))}}});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());if(url.hostname!=='fixture-language.test')return route.abort();
        try{if(url.pathname.includes('..'))return route.abort();await route.fulfill({body:await readFile(directory+url.pathname),contentType:url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}
    });
    await page.goto('http://fixture-language.test/scripts/fixtures/fixture-language.html');
    const row=page.locator('#admin-fixture-42');
    await row.getByText('Home Team',{exact:true}).waitFor();
    assert.ok((await row.innerText()).includes('English Gym'));
    assert.ok((await row.innerText()).includes('25/11/2026'));
    assert.doesNotMatch(await page.locator('body').innerText(),/[ก-๙]/);
    const selection=await page.locator('select').first().inputValue();
    await page.getByRole('button',{name:'Use Thai',exact:true}).click();
    await row.getByText('ทีมเหย้า',{exact:true}).waitFor();
    assert.ok((await row.innerText()).includes('สนามไทย'));
    assert.ok((await row.innerText()).includes('25/11/2569'));
    assert.equal(await page.locator('select').first().inputValue(),selection);
    await page.getByRole('button',{name:'Use English',exact:true}).click();
    await row.getByText('Home Team',{exact:true}).waitFor();
    await page.getByTitle('Edit',{exact:true}).click();
    await page.getByRole('option',{name:/^Home Team \(/}).waitFor({state:'attached'});
    assert.doesNotMatch(await page.locator('body').innerText(),/[ก-๙]/);
    assert.equal(await page.getByRole('option',{name:'English Gym',exact:true}).getAttribute('value'),'สนามไทย','display translation must preserve saved venue value');
    assert.equal(await page.locator('input[type=date]').inputValue(),'2026-11-25');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'Use Thai',exact:true}).click();
    await row.getByText('ทีมเหย้า',{exact:true}).waitFor();
    await page.getByTitle('แก้ไข',{exact:true}).click();
    await page.getByRole('option',{name:/^ทีมเหย้า \(/}).waitFor({state:'attached'});
    assert.ok((await page.getByRole('option',{name:/^ทีมเหย้า \(/}).innerText()).includes('อนุมัติแล้ว'));
    assert.equal(await page.getByRole('option',{name:'สนามไทย',exact:true}).getAttribute('value'),'สนามไทย');
    assert.deepEqual(errors,[]);
    console.log('Passed: fixture names, venue, date calendar, gender and age labels, edit options and stable selection values across languages.');
}catch(error){console.error((await page.locator('body').innerText()).slice(-6500));throw error;}finally{await browser.close();}
