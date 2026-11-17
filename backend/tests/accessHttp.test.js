const {publicTestUrl}=require('./helpers/publicTestUrl');
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const jwt=require('jsonwebtoken');
process.env.DB_PROVIDER='postgres';
const {setup}=require('./helpers/postgresHarness');

test('mounted HTTP boundary denies cross-domain/cross-competition access and preserves public scores safely',async t=>{
    const h=await setup();let server;
    try{
        const d=h.db;
        await d.query(`INSERT INTO users(id,username,password_hash,role,status) VALUES
            (1,'Admin','x','super_admin','active'),(2,'Scorer','x','scorer','active'),
            (3,'Vims','x','vims_operator','active'),(4,'ScoreAdmin','x','super_admin_scorer','active'),
            (5,'Blocked','x','scorer','banned'),(6,'Organizer','x','organizer','active')`);
        await d.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Visible','volleyball','Male'),(2,'Other','volleyball','Female')");
        for(const id of [2,3,4,5,6])await d.query('INSERT INTO user_competition_access(user_id,competition_id,granted_by) VALUES(?,1,1)',[id]);
        await d.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','HOME'),(2,'Away','AWAY')");
        const state={score:{home:7,away:4},offlineLease:{checkoutToken:'PRIVATE_TOKEN'},deviceId:'PRIVATE_DEVICE'};
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,live_state) VALUES(1,1,1,2,'scheduled',?),(2,2,1,2,'scheduled',?)",[JSON.stringify(state),JSON.stringify(state)]);
        const {app}=require('../server');
        server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        const origin=`http://127.0.0.1:${server.address().port}`;
        const publicFetch=async(url,options)=>fetch(await publicTestUrl(d,url),options);
        async function token(id){const user=(await d.query('SELECT id,role,authorization_version FROM users WHERE id=?',[id])).rows[0];return jwt.sign(user,require('../config/security').getJwtSecret(),{expiresIn:'10m'});}
        async function request(path,{id,method='GET',body,credential}={}){
            const response=await publicFetch(origin+'/api'+path,{method,headers:{...(id||credential?{Authorization:'Bearer '+(credential||await token(id))}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
            return {status:response.status,body:await response.json()};
        }
        await t.test('public official state stays readable but contains no recording lease secrets',async()=>{
            const result=await request('/scorer/match/1/state');
            assert.equal(result.status,200);assert.deepEqual(result.body.score,{home:7,away:4});
            assert.ok(!JSON.stringify(result.body).includes('PRIVATE_'));
        });
        await t.test('scorer cannot record VIMS, VIMS cannot score, and administrators cannot record either',async()=>{
            for(const [id,path]of [[2,'/scorer/match/1/vis'],[3,'/scorer/match/1/event'],[1,'/scorer/match/1/event'],[4,'/scorer/match/1/vis']]){
                const result=await request(path,{id,method:'POST',body:{}});assert.equal(result.status,403,JSON.stringify({id,path,result}));
            }
        });
        await t.test('outside competition recording and account-wide domain administration are denied',async()=>{
            assert.equal((await request('/scorer/match/2/event',{id:2,method:'POST',body:{}})).status,403);
            assert.equal((await request('/access/users/2',{id:4,method:'PUT',body:{status:'banned'}})).status,403);
        });
        await t.test('scorer match list includes only granted competition and banned users cannot list officials',async()=>{
            const list=await request('/scorer/matches',{id:2});assert.equal(list.status,200,JSON.stringify(list.body));
            assert.deepEqual(list.body.map(r=>r.id),[1]);
            assert.equal((await request('/scorer/scorers',{id:5})).status,403);
        });
        await t.test('debug file listing requires the central administrator',async()=>{
            assert.equal((await request('/debug/uploads')).status,401);
            assert.equal((await request('/debug/uploads',{id:2})).status,403);
        });
        await t.test('exports filter source rows and trailing slash cannot bypass custom-match scope filtering',async()=>{
            const report=await publicFetch(origin+'/api/reports/matches.csv',{headers:{Authorization:'Bearer '+await token(4)}});
            assert.equal(report.status,200);const csv=await report.text();assert.ok(csv.includes('Visible'));assert.ok(!csv.includes('Other'));
            const {createPayload}=require('../utils/customVis');
            for(const [index,competition]of [[1,null],[2,1],[3,2]]){
                const id=`custom-${index}1111111-1111-4111-8111-111111111111`;
                const payload=createPayload({title:'Private',maxSets:3,home:{name:'H',players:[]},away:{name:'A',players:[]}},id);
                await d.query('INSERT INTO custom_vis_matches(id,owner_id,public_token,payload,competition_id) VALUES(?,3,?,?,?)',[id,String(index).repeat(48),JSON.stringify(payload),competition]);
            }
            for(const suffix of ['', '/']){
                const list=await request('/vis-custom'+suffix,{id:3});assert.equal(list.status,200);
                assert.equal(list.body.length,2);assert.ok(list.body.every(row=>row.competition_id===null||row.competition_id===1));
            }
        });
        await t.test('private athlete and team URLs enforce identical ACLs for numeric, UUID and encoded IDs',async()=>{
            await d.query("INSERT INTO teams(id,name,code) VALUES(10,'PrivateHome','PH'),(11,'PrivateAway','PA')");
            await d.query("INSERT INTO players(id,team_id,number,first_name,last_name) VALUES(10,10,1,'Private','Athlete')");
            await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,manual_owner_id,manual_lifecycle,manual_published) VALUES(10,1,10,11,'scheduled',2,'ready',0)");
            const team=(await d.query('SELECT public_id FROM teams WHERE id=10')).rows[0].public_id;
            const player=(await d.query('SELECT public_id FROM players WHERE id=10')).rows[0].public_id;
            const paths=[`/public/teams/10/players`,`/public/teams/${team}/players`,`/public/teams/%31%30/players`,
                `/public/players/10/stats`,`/public/players/${player}/stats`,`/public/players/%31%30/stats`];
            for(const path of paths){
                assert.equal((await request(path)).status,401,path);
                assert.equal((await request(path,{id:3})).status,404,path);
                assert.equal((await request(path,{id:2})).status,200,path);
            }
        });
        await t.test('admin detail HTTP route authenticates and checks role and competition for direct links',async()=>{
            assert.equal((await request('/access/matches/match/1/detail')).status,401);
            assert.equal((await request('/access/matches/match/1/detail',{id:2})).status,403);
            const detail=await request('/access/matches/match/1/detail',{id:4});
            assert.equal(detail.status,200,JSON.stringify(detail.body));
            assert.equal(detail.body.match.id,1);
            assert.ok(!JSON.stringify(detail.body).includes('PRIVATE_'));
            assert.equal((await request('/access/matches/match/2/detail',{id:4})).status,403);
            const organizer=await request('/access/matches/match/1/detail',{id:6});
            assert.equal(organizer.status,200,JSON.stringify(organizer.body));
            assert.deepEqual(organizer.body.events,[]);
            assert.deepEqual(organizer.body.history,[]);
            assert.equal((await request('/access/matches/match/2/detail',{id:6})).status,403);
            assert.equal((await request('/access/matches/match/1/score/confirm',{id:6,method:'POST',body:{revision:1}})).status,403);
            assert.equal((await request('/scorer/match/1/event',{id:6,method:'POST',body:{}})).status,403);
        });
        await t.test('revoking competition access invalidates old sessions and rejects renewed sessions outside scope',async()=>{
            const credential=await token(2);
            await d.query('UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=2 AND competition_id=1');
            assert.equal((await request('/scorer/match/1/settings',{credential})).status,403);
            assert.equal((await request('/scorer/match/1/settings',{id:2})).status,403);
            // Guest access to official scores still works after internal access is revoked.
            assert.equal((await request('/scorer/match/1/state')).status,200);
        });
    }finally{
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        await h.close();
    }
});
