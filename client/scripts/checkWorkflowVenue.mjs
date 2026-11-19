import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const directory=fileURLToPath(new URL('../../tmp/workflow-venue-build/',import.meta.url));
await build({logLevel:'error',publicDir:false,build:{outDir:directory,emptyOutDir:false,rollupOptions:{input:fileURLToPath(new URL('./fixtures/workflow-venue.html',import.meta.url))}}});
const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());if(url.hostname!=='workflow-venue.test')return route.abort();
        try{if(url.pathname.includes('..'))return route.abort();await route.fulfill({body:await readFile(directory+url.pathname),contentType:url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}
    });
    await page.goto('http://workflow-venue.test/scripts/fixtures/workflow-venue.html');
    const first=page.getByRole('combobox',{name:'Venue R4-1',exact:true});
    await first.getByRole('option',{name:'Main Gym',exact:true}).waitFor({state:'attached'});
    assert.equal(await first.inputValue(),'1');
    assert.ok(await page.getByRole('combobox',{name:'Venue R2-1',exact:true}).isDisabled());
    assert.equal(await page.getByRole('combobox',{name:'Venue R4-2',exact:true}).inputValue(),'legacy');
    await page.getByRole('textbox',{name:'Round R4-2',exact:true}).fill('Custom semifinal');
    const save=page.getByRole('button',{name:'Save match numbers, rounds, dates, times and venues',exact:true});
    await save.click();
    let payload=await page.evaluate(()=>window.savedWorkflow);
    assert.equal(payload.matches[0].location,'Legacy Court');assert.ok(!Object.hasOwn(payload.matches[0],'stadium_id'));
    await first.selectOption('2');
    await page.getByRole('button',{name:'Use Thai',exact:true}).click();
    const thai=page.getByRole('combobox',{name:'สนาม R4-1',exact:true});
    assert.equal(await thai.inputValue(),'2');assert.equal(await thai.locator('option:checked').innerText(),'สนามสอง');
    await page.getByRole('button',{name:'Use English',exact:true}).click();
    assert.equal(await first.locator('option:checked').innerText(),'Second Gym');
    await page.waitForTimeout(350);await save.click();
    payload=await page.evaluate(()=>window.savedWorkflow);
    assert.equal(payload.matches.find(match=>match.id===1).stadium_id,2);
    assert.equal(payload.matches.find(match=>match.id===1).location,'สนามสอง');
    await first.selectOption('');await page.waitForTimeout(350);await save.click();
    payload=await page.evaluate(()=>window.savedWorkflow);
    assert.equal(payload.matches.find(match=>match.id===1).stadium_id,null);
    assert.equal(payload.matches.find(match=>match.id===1).location,'');
    await page.goto('http://workflow-venue.test/scripts/fixtures/workflow-venue.html?fail');
    await page.getByRole('alert').waitFor();assert.ok(await first.isDisabled());
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await first.getByRole('option',{name:'Main Gym',exact:true}).waitFor({state:'attached'});
    assert.ok(await first.isEnabled());assert.deepEqual(errors,[]);
    console.log('Passed: database-backed venue dropdown, bilingual labels, legacy preservation, IDs, clearing, live locks and failed-load retry.');
}catch(error){console.error((await page.locator('body').innerText()).slice(-5000));throw error;}finally{await browser.close();}
