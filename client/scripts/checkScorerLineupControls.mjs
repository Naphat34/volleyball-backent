import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from 'playwright-core';
const directory=fileURLToPath(new URL('../../tmp/scorer-lineup-controls-build/',import.meta.url));
await build({logLevel:'error',publicDir:false,build:{outDir:directory,emptyOutDir:false,rollupOptions:{input:fileURLToPath(new URL('./fixtures/scorer-lineup-controls.html',import.meta.url))}}});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.hostname!=='lineup-controls.test'||url.pathname.includes('..'))return route.abort();
        try{await route.fulfill({body:await readFile(directory+url.pathname),contentType:url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}
    });
    await page.goto('http://lineup-controls.test/scripts/fixtures/scorer-lineup-controls.html');
    const allDisabled=async selector=>{const buttons=page.locator(selector).getByRole('button');assert.ok(await buttons.count()>0);for(const button of await buttons.all())assert.equal(await button.isDisabled(),true);};
    await page.getByRole('button',{name:'Fill home',exact:true}).waitFor();
    await allDisabled('[data-team="home"]');await allDisabled('[data-team="away"]');
    await page.getByRole('button',{name:'Fill home',exact:true}).click();
    assert.equal(await page.locator('[data-team="home"]').getByRole('button',{name:'Timeout',exact:true}).isEnabled(),true);
    await allDisabled('[data-team="away"]');
    await page.locator('[data-team="home"]').getByRole('button',{name:'Timeout',exact:true}).click();
    assert.equal(await page.getByTestId('events').innerText(),'1');
    await page.getByRole('button',{name:'Swap ends',exact:true}).click();await allDisabled('[data-team="away"]');
    await page.getByLabel('Phase').selectOption('RALLY');
    assert.equal(await page.locator('[data-team="home"]').getByRole('button',{name:'Point scored',exact:true}).isEnabled(),true);
    await allDisabled('[data-team="away"]');
    await page.getByLabel('Phase').selectOption('SERVING');
    await page.getByRole('button',{name:'Five home',exact:true}).click();await allDisabled('[data-team="home"]');
    await page.getByRole('button',{name:'Duplicate home',exact:true}).click();await allDisabled('[data-team="home"]');
    await page.getByRole('button',{name:'Fill home',exact:true}).click();
    for(const side of ['away','home']){
        await page.getByLabel('Surface').selectOption(side);
        const button=page.getByRole('button',{name:'Timeout',exact:true});
        assert.equal(await button.isDisabled(),side==='away');
        assert.equal(await page.getByRole('button',{name:'Close team panel',exact:true}).isEnabled(),true);
    }
    await page.getByLabel('Surface').selectOption('official');
    await page.getByRole('button',{name:'Exceptional sub. / Injury',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:/Home Team/}).isEnabled(),true);
    assert.equal(await page.getByRole('button',{name:/Away Team/}).isDisabled(),true);
    await page.getByLabel('Surface').selectOption('sanction');
    assert.equal(await page.getByRole('button',{name:/Home Team/}).isEnabled(),true);
    assert.equal(await page.getByRole('button',{name:/Away Team/}).isDisabled(),true);
    await page.getByLabel('Surface').selectOption('desktop');
    await page.getByRole('button',{name:'Fill away',exact:true}).click();
    assert.equal(await page.locator('[data-team="away"]').getByRole('button',{name:'Timeout',exact:true}).isEnabled(),true);
    await page.getByRole('button',{name:'New set',exact:true}).click();await allDisabled('[data-team="home"]');await allDisabled('[data-team="away"]');
    await page.getByLabel('Surface').selectOption('court');
    assert.equal(await page.locator('.scorer-player-jersey').count(),12);
    await page.locator('.scorer-player-jersey').filter({hasText:'99'}).click();
    assert.equal(await page.getByTestId('events').innerText(),'2');
    await page.setViewportSize({width:1440,height:900});
    await page.getByTestId('court').locator(':scope > div').screenshot({path:'scorer-jersey-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.getByTestId('court').locator(':scope > div').screenshot({path:'scorer-jersey-mobile.png'});
    assert.deepEqual(errors,[]);
    console.log('Passed: independent team locks, partial and duplicate lineups, end swaps, desktop/mobile controls, injury team selection and next-set reset.');
}finally{await browser.close();}
