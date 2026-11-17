import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {createServer as createViteServer} from 'vite';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url);
process.env.DB_PROVIDER='postgres';
const {setup}=require('../../backend/tests/helpers/postgresHarness');
let harness,server,vite,browser,page;
try{
    harness=await setup({local:true});const d=harness.db;
    await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Workflow Browser Test','x','super_admin','active')");
    for(const id of [1,2])await d.query("INSERT INTO competitions(id,title,title_th,title_en,sport,gender,max_sets) VALUES(?,?,?,?, 'volleyball','Male',3)",[id,`Workflow ${id}`,`รายการทดสอบ ${id}`,`Workflow ${id}`]);
    await d.query("UPDATE competitions SET status='open' WHERE id IN (1,2)");
    for(let id=1;id<=24;id++){
        await d.query('INSERT INTO teams(id,name,name_th,name_en,code) VALUES(?,?,?,?,?)',[id,`ทีม ${id}`,`ทีม ${id}`,`Team ${id}`,`T${id}`]);
        for(const comp of id<=8?[1,2]:[2])await d.query("INSERT INTO team_entries(competition_id,team_id,status,gender) VALUES(?,?,'approved','Male')",[comp,id]);
    }
    process.env.FRONTEND_URL='http://localhost:5185';process.env.CORS_ORIGINS='';
    server=http.createServer(require('../../backend/server').app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    vite=await createViteServer({server:{host:'localhost',port:5185,strictPort:true},define:{'import.meta.env.VITE_API_URL':JSON.stringify(origin)}});await vite.listen();
    const user=(await d.query('SELECT id,username,role,status,authorization_version FROM users WHERE id=1')).rows[0];
    const token=require('../../backend/node_modules/jsonwebtoken').sign(user,process.env.JWT_SECRET,{expiresIn:'15m'});
    const publicIds=Object.fromEntries((await d.query('SELECT id,public_id FROM competitions')).rows.map(row=>[row.id,row.public_id]));
    const request=async(comp,action,body={})=>{
        const get=await fetch(`${origin}/api/competition-workflows/${publicIds[comp]}`,{headers:{Authorization:`Bearer ${token}`}}),snapshot=await get.json();
        assert.equal(get.status,200,JSON.stringify(snapshot));
        if(!action)return snapshot;
        const res=await fetch(`${origin}/api/competition-workflows/${publicIds[comp]}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({revision:snapshot.workflow?.revision||0,...body})});
        const result=await res.json();assert.equal(res.status,200,JSON.stringify(result));return result;
    };
    browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
    await page.addInitScript(({token,user})=>{sessionStorage.setItem('token',token);sessionStorage.setItem('user',JSON.stringify(user));}, {token,user});
    await page.goto(`http://localhost:5185/admin?view=workflow&competitionId=${publicIds[1]}`);
    await page.getByRole('button',{name:'บันทึกรูปแบบ (Super Admin)',exact:true}).click();
    await page.getByRole('button',{name:'เตรียมสายว่างตามรูปแบบ',exact:true}).click();
    for(const [pool,ids] of [['A',[4,1,3,2]],['B',[5,6,7,8]]]){
        for(let i=0;i<ids.length;i++){
            if(i>=2)await page.locator('.cw-pools article').filter({has:page.getByLabel(`ชื่อสาย ${pool==='A'?1:2}`,{exact:true})}).getByRole('button',{name:'เพิ่มตำแหน่ง',exact:true}).click();
            await page.getByLabel(`ทีมตำแหน่ง ${pool}${i+1}`,{exact:true}).selectOption(String(ids[i]));
        }
    }
    await page.getByRole('button',{name:'บันทึกทีมลงสาย',exact:true}).click();
    await page.getByRole('button',{name:'ยืนยันสร้างแมตช์พบกันหมดในสาย',exact:true}).click();
    await page.getByRole('heading',{name:'3. อันดับและยืนยันทีมเข้ารอบ',exact:true}).waitFor();
    assert.equal((await request(1)).matches.length,12);
    assert.deepEqual((await request(1)).workflow.state.groups[0].teamIds,[4,1,3,2]);
    await page.getByLabel('เริ่มเลขคู่ที่',{exact:true}).fill('19');
    await page.getByRole('cell',{name:'ผู้ชนะคู่ที่ 19',exact:true}).waitFor();
    await page.getByRole('button',{name:'เผยแพร่โปรแกรมรอบถัดไปล่วงหน้า',exact:true}).click();
    await page.getByLabel('เลขคู่ R4-1',{exact:true}).waitFor();
    const plannedIds=(await request(1)).matches.filter(match=>match.phase==='knockout').map(match=>match.id);
    await page.getByLabel('รอบ R4-1',{exact:true}).fill('รอบรองชนะเลิศ');
    await page.getByLabel('วันที่ R4-1',{exact:true}).fill('2026-11-20');
    await page.getByLabel('เวลา R4-1',{exact:true}).fill('14:30');
    await page.getByLabel('สนาม R4-1',{exact:true}).fill('Court 2');
    await page.getByRole('button',{name:'บันทึกเลขคู่ รอบ วัน เวลา และสนาม',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.cw-success[role="status"]')?.textContent?.includes('บันทึก'));
    const publicResponse=await fetch(`${origin}/api/public/matches?competitionId=${publicIds[1]}`);
    assert.equal(publicResponse.status,200);
    const publicMatches=await publicResponse.json();
    assert.equal(publicMatches.find(match=>match.match_number==19).home_team_name_th,'อันดับ 1 สาย A');
    assert.equal(publicMatches.find(match=>match.match_number==19).round_name,'รอบรองชนะเลิศ');
    await page.locator('.cw-panel').filter({has:page.getByRole('heading',{name:'โปรแกรมรอบถัดไปล่วงหน้า',exact:true})}).screenshot({path:'workflow-schedule-browser.png'});
    const publicPage=await browser.newPage();
    await publicPage.goto('http://localhost:5185/matches');
    await publicPage.getByText('อันดับ 1 สาย A',{exact:true}).waitFor();
    await publicPage.getByText('รอทีม / รอผลการแข่งขัน',{exact:true}).first().waitFor();
    await publicPage.close();
    const first=(await request(1)).matches[0];
    await page.getByLabel('แมตช์คำตัดสิน',{exact:true}).selectOption(String(first.id));
    await page.getByLabel('ทีมที่ปรับแพ้',{exact:true}).selectOption(String(first.away_team_id));
    await page.getByLabel('เหตุผลคำตัดสิน',{exact:true}).fill('ไม่มารายงานตัวตามคำตัดสิน');
    await page.getByRole('button',{name:'ยืนยันคำตัดสิน',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.cw-success[role="status"]')?.textContent?.includes('บันทึก'));
    let snapshot=await request(1);assert.equal(snapshot.matches.find(match=>match.id===first.id).result_type,'forfeit');
    for(const match of snapshot.matches.filter(match=>match.phase==='group'&&match.status==='scheduled'))await request(1,'forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Browser fixture forfeit'});
    await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();
    await page.getByRole('button',{name:'ตรวจและยืนยันอันดับ 1–2 ทุกสาย',exact:true}).click();
    await page.getByRole('cell',{name:'BRONZE-1',exact:true}).waitFor();
    snapshot=await request(1);assert.equal(snapshot.matches.filter(match=>match.phase==='knockout').length,4);
    assert.deepEqual(snapshot.matches.filter(match=>match.phase==='knockout').map(match=>match.id),plannedIds);
    assert.equal(snapshot.matches.find(match=>match.match_number==19).start_time,'14:30');
    assert.equal(snapshot.matches.find(match=>match.match_number==19).round_name,'รอบรองชนะเลิศ');
    // Prepare a 24-team event; its actual draw is entered through the UI.
    const groups=Array.from({length:8},(_,i)=>({name:String.fromCharCode(65+i),teamIds:[i*3+1,i*3+2,i*3+3]}));
    await request(2,'configure',{format:{teamCount:24,poolCount:8}});await request(2,'groups',{groups});await request(2,'publish');
    await page.goto(`http://localhost:5185/admin?view=workflow&competitionId=${publicIds[2]}`);
    await page.getByLabel('วิธีประกบคู่',{exact:true}).selectOption('waiting');
    await page.getByRole('button',{name:'เผยแพร่โปรแกรมรอบถัดไปล่วงหน้า',exact:true}).click();
    await page.getByLabel('เลขคู่ R16-1',{exact:true}).waitFor();
    const waitingIds=(await request(2)).matches.filter(match=>match.phase==='knockout').map(match=>match.id);
    for(const match of (await request(2)).matches.filter(match=>match.phase==='group'))await request(2,'forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Preliminary fixture result'});
    await request(2,'qualify');
    await page.goto(`http://localhost:5185/admin?view=workflow&competitionId=${publicIds[2]}`);
    await page.getByRole('heading',{name:'4. กรอกผลจับสลากจริงและตรวจผัง',exact:true}).waitFor();
    for(let i=0;i<8;i++){
        await page.getByLabel(`คู่ ${i+1} home`,{exact:true}).selectOption(String(groups[i].teamIds[0]));
        const blocked=page.getByLabel(`คู่ ${i+1} away`,{exact:true}).locator(`option[value="${groups[i].teamIds[1]}"]`);
        assert.equal(await blocked.isDisabled(),true);
        await page.getByLabel(`คู่ ${i+1} away`,{exact:true}).selectOption(String(groups[(i+1)%8].teamIds[1]));
    }
    await page.getByRole('button',{name:'ยืนยันผังและสร้างแมตช์รอบถัดไป',exact:true}).click();
    await page.getByRole('cell',{name:'R16-1',exact:true}).waitFor();await page.getByRole('cell',{name:'BRONZE-1',exact:true}).waitFor();
    assert.equal((await request(2)).matches.filter(match=>match.phase==='knockout').length,16);
    assert.deepEqual((await request(2)).matches.filter(match=>match.phase==='knockout').map(match=>match.id),waitingIds);
    await page.getByRole('checkbox',{name:'แข่งขันชิงอันดับ 3',exact:true}).uncheck();
    const bronzeRuleSave=page.getByRole('button',{name:'บันทึกกติกาชิงอันดับ 3',exact:true});
    assert.equal(await bronzeRuleSave.isDisabled(),true);
    await page.getByRole('checkbox',{name:'ยืนยันยกเลิกคู่ชิงอันดับ 3 และตารางของคู่นี้ โดยคงเลขคู่อื่นไว้',exact:true}).check();
    const beforeRemoval=(await request(2)).matches.filter(match=>match.phase==='knockout'&&match.slot_key!=='BRONZE-1').map(match=>({id:match.id,number:match.match_number}));
    await bronzeRuleSave.click();
    await page.getByRole('cell',{name:'BRONZE-1',exact:true}).waitFor({state:'detached'});
    assert.deepEqual((await request(2)).matches.filter(match=>match.phase==='knockout').map(match=>({id:match.id,number:match.match_number})),beforeRemoval);
    for(const match of (await request(2)).matches.filter(match=>match.phase==='knockout')){
        const current=(await request(2)).matches.find(item=>item.id===match.id);
        await request(2,'forfeit',{matchId:current.id,losingTeamId:current.away_team_id,reason:'Confirmed knockout result'});
    }
    await page.getByRole('button',{name:'โหลดใหม่',exact:true}).click();
    await page.getByRole('heading',{name:'อันดับสรุปรายการ',exact:true}).waitFor();
    assert.equal((await request(2)).workflow.state.podium.thirdJoint.length,2);
    await page.getByText(/^อันดับ 3 ร่วม:/).waitFor();
    await page.screenshot({path:'workflow-third-place-browser.png',fullPage:true});
    await page.getByRole('combobox',{name:'ภาษา',exact:true}).selectOption('ENG');
    await page.getByRole('heading',{name:'Audit history',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:['position-based pool membership preserves order','advance preview and knockout publication','date, time and venue persistence','public schedule shows waiting sources','pool-rank confirmation populates original fixtures','24-team waiting draw preserves all fixture IDs','manual draw rejects same-pool opponents','English UI','no browser errors'],database:'isolated local PostgreSQL schema'}));
}catch(error){
    if(page){console.error((await page.locator('body').innerText()).slice(-7000));await page.screenshot({path:'workflow-schedule-failure.png',fullPage:true});}
    throw error;
}finally{
    await browser?.close();await vite?.close();
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    await harness?.close();
}
