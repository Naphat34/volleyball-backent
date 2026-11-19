const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),jwt=require('jsonwebtoken');
process.env.DB_PROVIDER='postgres';process.env.JWT_SECRET='vims-review-test-only';
const {setup}=require('./helpers/postgresHarness');
test('review detail HTTP route requires login and scope and strips private match state',async()=>{
    const h=await setup();let server;
    try{
        await h.db.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Writer','private','vims_operator','active'),(2,'Outside','private','vims_operator','active')");
        await h.db.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Cup','volleyball','Male')");
        await h.db.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(1,1)');
        await h.db.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','H'),(2,'Away','A')");
        await h.db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,live_state,status) VALUES(1,1,1,2,?,'scheduled')",[JSON.stringify({offlineLease:{checkoutToken:'SECRET_PRIVATE_LEASE'}})]);
        server=http.createServer(require('../server').app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        const matchId=(await h.db.query('SELECT public_id FROM matches WHERE id=1')).rows[0].public_id;
        const url=`http://127.0.0.1:${server.address().port}/api/access/matches/match/${matchId}/vims-detail`;
        assert.equal((await fetch(url)).status,401);
        for(const id of [1,2]){
            const user=(await h.db.query('SELECT id,username,role,authorization_version FROM users WHERE id=?',[id])).rows[0];
            const response=await fetch(url,{headers:{Authorization:`Bearer ${jwt.sign(user,process.env.JWT_SECRET,{expiresIn:'5m'})}`}});
            assert.equal(response.status,id===1?200:403);
            const body=await response.json();assert.ok(!JSON.stringify(body).includes('SECRET_PRIVATE_LEASE'));
            if(id===1)assert.equal(body.readiness.canSubmit,false);
        }
    }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await h.close();}
});
