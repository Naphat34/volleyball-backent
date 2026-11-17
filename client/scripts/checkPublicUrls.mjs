import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { pathReferences } = require('../../backend/middleware/publicUrl');
const comp = '06012119-33ce-4572-ae3b-8fcb00aa022b';
const match = 'a0e85d5b-6d7e-4eb5-8199-b433dc4a1069';
const records = [{entity:'competitions',id:'1',public_id:comp},{entity:'matchRecords',id:'7',public_id:match},{entity:'matches',id:'7',public_id:match}];
const user = {id:7,role:'scorer',username:'URL test',status:'active',authorization_version:1};
const competitions = [{id:1,public_id:comp,title:'UUID Test Cup',title_th:'UUID Test Cup',gender:'Male',status:'open'}];
const matches = [{id:7,public_id:match,match_number:1,competition_id:1,competition_name:'UUID Test Cup',location:'สนามทดสอบ',location_th:'สนามทดสอบ',location_en:'English Test Gymnasium',home_team:'ทีมเจ้าบ้าน',away_team:'ทีมเยือน',home_team_name_th:'ทีมเจ้าบ้าน',home_team_name_en:'Home UUID',away_team_name_th:'ทีมเยือน',away_team_name_en:'Away UUID',home_team_id:1,away_team_id:2,status:'scheduled'}];
let vite, browser;
try {
    vite = await createServer({server:{host:'localhost',port:5184,strictPort:true},define:{'import.meta.env.VITE_API_URL':JSON.stringify('http://localhost:3199')}});
    await vite.listen();
    browser = await chromium.launch({channel:'msedge',headless:true});
    const page = await browser.newPage();
    const errors = [], sent = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('http://localhost:3199/api/**', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.slice(4);
        sent.push(path+url.search);
        if(path === '/public-identifiers') {
            const references=request.postDataJSON().references.map(ref=>records.find(row=>row.entity===ref.entity&&(row.id===ref.value||row.public_id===ref.value)));
            assert.ok(references.every(Boolean),JSON.stringify(request.postDataJSON()));
            return route.fulfill({json:{references}});
        }
        for(const ref of pathReferences(path)) assert.match(ref.value,/^[0-9a-f-]{36}$/);
        const body=path==='/access/session'?user:path==='/access/competitions'?competitions:path==='/scorer/matches'?matches:[];
        await route.fulfill({json:body});
    });
    await page.addInitScript(({user})=>{
        const token=`e30.${btoa(JSON.stringify({...user,exp:Math.floor(Date.now()/1000)+3600}))}.test`;
        sessionStorage.setItem('token',token);sessionStorage.setItem('user',JSON.stringify(user));
    },{user});
    await page.goto('http://localhost:5184/login');
    await page.evaluate(async({matches,competitions})=>new Promise((resolve,reject)=>{
        const request=indexedDB.open('volley-scorer-dashboard-v1',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('snapshots',{keyPath:'key'});
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{
            const db=request.result,tx=db.transaction('snapshots','readwrite');
            tx.objectStore('snapshots').put({key:'7:scorer:server',version:1,matches,competitions,updatedAt:new Date().toISOString(),partialCompetitionIds:[]});
            tx.oncomplete=()=>{db.close();resolve();};
        };
    }),{matches,competitions});
    await page.goto('http://localhost:5184/adminscorer?view=matches');
    await page.getByRole('combobox',{name:'รายการแข่งขัน',exact:true}).selectOption('1');
    await page.getByRole('button',{name:'EN',exact:true}).click();
    await page.getByText('English Test Gymnasium',{exact:true}).waitFor();
    assert.deepEqual(await page.locator('.vd-filters select').nth(2).locator('option').allTextContents(),['All teams','Away UUID','Home UUID']);
    await page.locator('.vd-filters select').nth(2).selectOption('ทีมเจ้าบ้าน');
    await page.getByRole('link',{name:'Review / status',exact:true}).waitFor();
    await page.getByRole('button',{name:'ไทย',exact:true}).click();
    await page.getByText('สนามทดสอบ',{exact:true}).waitFor();
    assert.equal(await page.locator('.vd-filters select').nth(2).inputValue(),'ทีมเจ้าบ้าน');
    assert.ok((await page.locator('.vd-filters select').nth(2).locator('option').allTextContents()).includes('ทีมเจ้าบ้าน'));
    assert.equal(await page.locator('tbody .vd-number').count(),1);
    await page.waitForURL(`**/adminscorer?view=matches&compId=${comp}`);
    await page.getByRole('button',{name:'เมนูแมตช์ 1',exact:true}).click();
    await page.locator('a[href^="/scoresheet/"]').first().waitFor();
    assert.equal(await page.locator('a[href^="/scoresheet/"]').first().getAttribute('href'),`/scoresheet/${match}`);
    await page.reload();
    await page.getByRole('combobox',{name:'รายการแข่งขัน',exact:true}).waitFor();
    assert.equal(await page.getByRole('combobox',{name:'รายการแข่งขัน',exact:true}).inputValue(),'1');
    await page.goto('http://localhost:5184/adminscorer?view=matches&compId=1');
    await page.getByRole('alert').filter({hasText:'ลิงก์นี้ใช้รหัสเดิม'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:['team options and review link follow EN, selected team survives switching to Thai','venue follows TH/EN language','competition selector writes UUID','reports use UUID hrefs','reload restores UUID filter','legacy numeric deep link rejected','no browser errors'],apiRequests:sent.length}));
} finally {await browser?.close();await vite?.close();}
