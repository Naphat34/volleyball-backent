const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
process.env.DB_PROVIDER = 'postgres';
process.env.JWT_SECRET = 'public-url-tests-only-not-a-live-secret';
const { setup } = require('./helpers/postgresHarness');
const { publicUrl, pathReferences } = require('../middleware/publicUrl');
const uuid = '06012119-33ce-4572-ae3b-8fcb00aa022b';

test('all URL identifiers are checked before SQL, including encoded IDs and duplicate query values', async () => {
    let queries = 0, next = 0;
    const middleware = publicUrl({ database: { query: async () => { queries++; return { rows: [{id:1}] }; } } });
    for (const url of ['/scorer/match/1/state','/scorer/match/%31/state','/public/matches?competitionId=1',`/public/matches?competitionId=${uuid}&competitionId=1`,'/match/1%2F2']) {
        const req = { path: url.split('?')[0], url, method:'GET' };
        const res = {status(code){this.code=code;return this;},json(body){this.body=body;}};
        await middleware(req,res,()=>next++);
        assert.equal(res.code,400,url);
    }
    assert.equal(queries,0); assert.equal(next,0);
    assert.equal(pathReferences('/my-team/players/stats').length,0);
});

test('HTTP UUID routes preserve public projection, scopes and recording permissions', async t => {
    const native = process.env.RUN_LOCAL_PUBLIC_URL_TESTS === '1';
    const h = await setup({ local: native }); let server;
    try {
        const db = h.db;
        await db.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'PublicUrlAdmin','x','super_admin','active'),(2,'PublicUrlScorer','x','scorer','active')");
        await db.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Visible','volleyball','Male'),(2,'Outside','volleyball','Female')");
        await db.query('INSERT INTO user_competition_access(user_id,competition_id,granted_by) VALUES(2,1,1)');
        await db.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','H'),(2,'Away','A')");
        await db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,live_state) VALUES(1,1,1,2,'scheduled',?),(2,2,1,2,'scheduled','{}')",[JSON.stringify({score:{home:7,away:4},offlineLease:{checkoutToken:'PRIVATE_SECRET'}})]);
        const ids = {};
        for (const table of ['matches','competitions','teams']) ids[table] = Object.fromEntries((await db.query(`SELECT id,public_id FROM ${table}`)).rows.map(row=>[row.id,row.public_id]));
        const user = (await db.query('SELECT id,role,authorization_version FROM users WHERE id=2')).rows[0];
        const token = jwt.sign(user,require('../config/security').getJwtSecret(),{expiresIn:'5m'});
        server = http.createServer(require('../server').app);
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        const origin = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (path, { auth=false, method='GET', body }={}) => {
            const res = await fetch(origin+path,{method,headers:{...(auth?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
            return { status:res.status, body:await res.json() };
        };
        await t.test('UUID match state is public with private lease data removed', async () => {
            const response = await request(`/scorer/match/${ids.matches[1]}/state`);
            assert.equal(response.status,200); assert.deepEqual(response.body.score,{home:7,away:4});
            assert.ok(!JSON.stringify(response.body).includes('PRIVATE_SECRET'));
            assert.equal((await request('/scorer/match/1/state')).status,400);
        });
        await t.test('UUID query filters resolve while integer queries are rejected', async () => {
            assert.equal((await request(`/public/matches?competitionId=${ids.competitions[1]}`)).status,200);
            assert.equal((await request('/public/matches?competitionId=1')).status,400);
        });
        await t.test('scope and role ACLs still see internal IDs and deny unauthorized writes', async () => {
            assert.equal((await request(`/scorer/match/${ids.matches[2]}/event`,{auth:true,method:'POST',body:{}})).status,403);
            assert.equal((await request(`/scorer/match/${ids.matches[1]}/vis`,{auth:true,method:'POST',body:{}})).status,403);
        });
        await t.test('reference exchange uses JSON bodies, returns UUIDs and rejects arbitrary SQL entities', async () => {
            const response = await request('/public-identifiers',{method:'POST',body:{references:[{entity:'matches',value:'1'},{entity:'competitions',value:ids.competitions[1]}]}});
            assert.equal(response.status,200);
            assert.equal(response.body.references[0].public_id,ids.matches[1]);
            assert.equal(response.body.references[1].id,'1');
            assert.equal((await request('/public-identifiers',{method:'POST',body:{references:[{entity:'users; DROP TABLE users',value:'1'}]}})).status,400);
        });
        await t.test('missing valid UUIDs return 404 instead of falling back to integers', async () => {
            assert.equal((await request(`/scorer/match/${uuid}/state`)).status,404);
        });
        await t.test('first offline VIMS sync creates a record behind a UUID URL', {skip:!native}, async () => {
            await db.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(3,'PublicUrlVims','x','vims_operator','active')");
            const vims = (await db.query('SELECT id,role,authorization_version FROM users WHERE id=3')).rows[0];
            const credential = jwt.sign(vims,require('../config/security').getJwtSecret(),{expiresIn:'5m'});
            const res = await fetch(`${origin}/vis-custom/${uuid}/offline-sync`,{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},body:JSON.stringify({config:{title:'Offline UUID',maxSets:3,home:{name:'H',players:[]},away:{name:'A',players:[]}},deviceId:'public-url-test-device-0001',baseRevision:0,operations:[],release:true})});
            assert.equal(res.status,200,await res.text());
            const row = (await db.query('SELECT id,public_id FROM custom_vis_matches WHERE public_id=?',[uuid])).rows[0];
            assert.equal(row.id,`custom-${uuid}`);
        });
    } finally {
        if (server) { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
        await h.close();
    }
});
