import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const directory=fileURLToPath(new URL('../../tmp/access-language-build/',import.meta.url));
await build({logLevel:'error',publicDir:false,build:{outDir:directory,emptyOutDir:false,rollupOptions:{input:fileURLToPath(new URL('./fixtures/access-language.html',import.meta.url))}}});
const browser=await chromium.launch({headless:true,channel:'msedge'});
let activePage;
try {
    for(const role of ['super_admin','super_admin_scorer','super_admin_vims','organizer','scorer','vims_operator']) {
        const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
        activePage=page;
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/*',async route=>{
            const url=new URL(route.request().url());
            if(url.hostname!=='access-language.test')return route.abort();
            try {const path=url.pathname;if(path.includes('..'))return route.abort();await route.fulfill({body:await readFile(directory+path),contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}
        });
        const worker=['scorer','vims_operator'].includes(role);
        const views=worker?['all']:role==='organizer'?['overview','matches']:['overview','matches','reviews','history','users'];
        for(const view of views) {
            await page.goto(`http://access-language.test/scripts/fixtures/access-language.html?role=${role}&view=${view}`);
            await page.getByText('English Cup',{exact:true}).first().waitFor({state:'attached'});
            const language=page.getByRole('combobox',{name:'Language',exact:true});
            assert.ok(!/[ก-๙]/.test(await page.locator('body').innerText()),`${role}/${view}: English has Thai text`);
            if(view==='matches'||role==='scorer') {
                assert.ok((await page.locator('body').innerText()).includes('Home Team / Away Team'));
                await page.getByRole('searchbox').fill('Home Team');
                assert.ok((await page.locator('tbody').first().innerText()).includes('Home Team'));
                await page.getByRole('searchbox').fill('19');
                assert.ok((await page.locator('tbody').first().innerText()).includes('Home Team'));
                await page.getByRole('searchbox').fill('');
            }
            if(role==='scorer') {
                await page.getByRole('button',{name:'Correct past events',exact:true}).click();
                await page.getByRole('button',{name:'Recalculate and save',exact:true}).waitFor();
                assert.ok(!/[ก-๙]/.test(await page.locator('body').innerText()),'correction UI is English');
            }
            if(role==='vims_operator') {
                await page.screenshot({path:fileURLToPath(new URL('../../tmp/vims-review-center.png',import.meta.url)),fullPage:true});
                await page.evaluate(()=>{window.accessFixture.fail=true;});
                await page.getByRole('button',{name:'Inspect before submitting',exact:true}).click();
                const detail=page.getByRole('dialog');
                await detail.getByRole('alert').waitFor();
                assert.equal(await detail.getByRole('button',{name:'Submit statistics',exact:true}).count(),0,'failed reads never enable submission');
                await page.evaluate(()=>{window.accessFixture.fail=false;});
                await detail.getByRole('button',{name:'Retry',exact:true}).click();
                await detail.getByRole('button',{name:'Submit statistics',exact:true}).waitFor();
                assert.ok(await detail.getByRole('button',{name:'Submit statistics',exact:true}).isDisabled(),'acknowledgement required');
                for(const tab of ['Roster / lineup','Statistics','Events','Review history','Readiness']) {
                    await detail.getByRole('button',{name:tab,exact:true}).click();
                    assert.doesNotMatch(await detail.innerText(),/[ก-๙]/);
                }
                await page.waitForTimeout(350);
                await page.screenshot({path:fileURLToPath(new URL('../../tmp/vims-review-detail.png',import.meta.url))});
                await detail.getByRole('checkbox').check();
                page.once('dialog',dialog=>dialog.dismiss());
                await detail.getByRole('button',{name:'Submit statistics',exact:true}).click();
                assert.equal(await page.evaluate(()=>window.accessFixture.calls.filter(call=>call.action==='review').length),0);
                await page.waitForTimeout(350);
                page.once('dialog',dialog=>dialog.accept());
                await detail.getByRole('button',{name:'Submit statistics',exact:true}).click();
                await detail.getByRole('button',{name:'View readiness',exact:true}).waitFor();
                assert.equal(await page.evaluate(()=>window.accessFixture.calls.filter(call=>call.action==='review').length),1);
                await detail.getByRole('button',{name:'Back to list',exact:true}).click();
                await page.getByRole('button',{name:'View submission',exact:true}).waitFor();
                await page.setViewportSize({width:390,height:844});
                assert.ok(await page.locator('.vrc-table').isVisible());
                await page.setViewportSize({width:1440,height:1000});
                await page.evaluate(()=>window.accessFixture.returnVims());
                await page.getByRole('button',{name:'Refresh data',exact:true}).click();
                await page.getByRole('button',{name:'View reason and correct',exact:true}).click();
                await detail.getByText('Please check event 5',{exact:true}).waitFor();
                await detail.getByRole('button',{name:'Correct past events',exact:true}).click();
                await detail.waitFor({state:'hidden'});
                await page.locator('#access-retrospective-correction').waitFor();
                await page.getByRole('button',{name:'Close correction',exact:true}).click();
            }
            await language.selectOption('THA');
            await page.getByRole('button',{name:'โหลดข้อมูล',exact:true}).waitFor();
            assert.ok((await page.locator('body').innerText()).includes('รายการไทย'));
            await page.getByRole('combobox',{name:'ภาษา',exact:true}).selectOption('ENG');
            await page.getByRole('button',{name:'Refresh data',exact:true}).waitFor();
            assert.ok(!/[ก-๙]/.test(await page.locator('body').innerText()),`${role}/${view}: switch back to English`);
            if(view==='users') {
                if(role==='super_admin') {
                    assert.equal(await page.locator('.aam-table tbody tr').count(),10);
                    await page.screenshot({path:fileURLToPath(new URL('../../tmp/access-users-desktop.png',import.meta.url)),fullPage:true});
                    await page.getByRole('button',{name:'Next page',exact:true}).click();
                    assert.equal(await page.locator('.aam-pagination').innerText().then(text=>text.includes('11–20')),true);
                    const search=page.getByRole('searchbox',{name:'Search accounts',exact:true});
                    await search.fill('Fixture scorer');
                    assert.equal(await page.locator('.aam-table tbody tr').count(),1);
                    await page.getByRole('button',{name:'Manage account Fixture scorer',exact:true}).click();
                    const panel=page.getByRole('dialog');
                    await page.screenshot({path:fileURLToPath(new URL('../../tmp/access-user-drawer.png',import.meta.url))});
                    await panel.getByRole('checkbox',{name:'English Cup',exact:true}).uncheck();
                    page.once('dialog',dialog=>dialog.dismiss());
                    await panel.getByRole('button',{name:'Close details',exact:true}).click();
                    assert.ok(await panel.isVisible(),'cancel discard retains edits');
                    await panel.getByRole('button',{name:'Save access',exact:true}).click();
                    await panel.getByRole('status').filter({hasText:'Access saved.'}).waitFor();
                    // GuardedButton deliberately rejects duplicate clicks for 300ms.
                    await page.waitForTimeout(350);
                    assert.ok(await panel.getByRole('button',{name:'Save access',exact:true}).isDisabled());
                    assert.deepEqual(await page.evaluate(()=>window.accessFixture.calls.find(call=>call.action==='grants').ids),[]);
                    await panel.getByRole('checkbox',{name:'English Cup',exact:true}).check();
                    await page.evaluate(()=>{window.accessFixture.fail=true;});
                    await panel.getByRole('button',{name:'Save access',exact:true}).click();
                    await panel.getByRole('alert').filter({hasText:'Access denied'}).waitFor();
                    assert.ok(await panel.getByRole('checkbox',{name:'English Cup',exact:true}).isChecked(),'failed saves retain edits');
                    await page.waitForTimeout(350);
                    await page.evaluate(()=>{window.accessFixture.fail=false;});
                    await panel.getByRole('button',{name:'Save access',exact:true}).click();
                    await panel.getByRole('status').filter({hasText:'Access saved.'}).waitFor();
                    await panel.getByRole('combobox',{name:'New status',exact:true}).selectOption('inactive');
                    page.once('dialog',dialog=>dialog.dismiss());
                    await panel.getByRole('button',{name:'Save account status',exact:true}).click();
                    assert.equal(await page.evaluate(()=>window.accessFixture.calls.filter(call=>call.action==='status').length),0);
                    await page.waitForTimeout(350);
                    page.once('dialog',dialog=>dialog.accept());
                    await panel.getByRole('button',{name:'Save account status',exact:true}).click();
                    await panel.getByRole('status').filter({hasText:'Status updated.'}).waitFor();
                    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
                    await search.fill('Fixture admin');
                    await page.getByRole('button',{name:'Manage account Fixture admin',exact:true}).click();
                    assert.equal(await panel.getByRole('checkbox').count(),0,'system admin needs no competition grants');
                    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
                    await page.getByRole('button',{name:'Add account',exact:true}).click();
                    await panel.getByRole('textbox',{name:'Username',exact:true}).fill('Created user');
                    await panel.getByLabel('Password (at least 8 characters)',{exact:true}).fill('test-password');
                    await panel.getByRole('combobox',{name:'Role',exact:true}).selectOption('organizer');
                    await panel.getByRole('checkbox',{name:'English Cup',exact:true}).check();
                    await panel.getByRole('button',{name:'Create account',exact:true}).click();
                    await panel.waitFor({state:'hidden'});
                    await search.fill('Created user');
                    await page.getByRole('button',{name:'Manage account Created user',exact:true}).waitFor();
                    await page.setViewportSize({width:390,height:844});
                    await page.getByRole('button',{name:'Manage account Created user',exact:true}).click();
                    assert.ok((await panel.boundingBox()).width<=390);
                    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
                    await page.setViewportSize({width:1440,height:1000});
                } else {
                    await page.getByRole('button',{name:'Manage account Fixture scorer',exact:true}).click();
                    assert.equal(await page.getByRole('dialog').getByRole('combobox',{name:'New status',exact:true}).count(),0,'domain admins cannot change account status');
                    await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
                }
            }
        }
        assert.deepEqual(errors,[]);
        await page.close();
    }
    console.log('Passed: six access roles, all tabs, bilingual data, search, correction controls and repeated language switching.');
}catch(error){if(activePage)console.error((await activePage.locator('body').innerText()).slice(-7000));throw error;}finally{await browser.close();}
