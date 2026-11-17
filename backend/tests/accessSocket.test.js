const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const jwt=require('jsonwebtoken');
const {io:connect}=require('../../client/node_modules/socket.io-client');
process.env.DB_PROVIDER='postgres';
const {setup}=require('./helpers/postgresHarness');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function event(socket,name,timeout=3000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(name,done);reject(Error('Missing socket event: '+name));},timeout);function done(value){clearTimeout(timer);resolve(value);}socket.once(name,done);});}
test('Socket rooms enforce current role/scope and never broadcast internal requests to public viewers',async()=>{
    const h=await setup();let io,server;const clients=[];
    try{
        const d=h.db;
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Recorder','x','scorer','active'),(2,'Statistics','x','vims_operator','active'),(3,'Manager','x','super_admin_scorer','active')");
        await d.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Allowed','volleyball','Male'),(2,'Outside','volleyball','Female')");
        for(const id of [1,2,3])await d.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(?,1)',[id]);
        await d.query("INSERT INTO matches(id,competition_id) VALUES(1,1),(2,2)");
        const api=require('../server');server=http.createServer(api.app);io=api.createSocketIo(server);
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        const origin=`http://127.0.0.1:${server.address().port}`;
        async function open(id){
            const user=id?(await d.query('SELECT id,role,authorization_version FROM users WHERE id=?',[id])).rows[0]:null;
            const socket=connect(origin,{transports:['websocket'],forceNew:true,reconnection:false,auth:user?{token:jwt.sign(user,require('../config/security').getJwtSecret())}:{}});
            clients.push(socket);await event(socket,'connect');return socket;
        }
        const viewer=await open(),scorer=await open(1),vims=await open(2),admin=await open(3);
        viewer.emit('join_match',{matchId:1,role:'viewer'});await event(viewer,'connection_status_update');
        const joined=event(scorer,'connection_status_update');scorer.emit('join_match',{matchId:1,role:'scorer'});await joined;
        for(const [socket,matchId]of [[vims,1],[admin,1],[scorer,2]]){
            const denied=event(socket,'join_error');socket.emit('join_match',{matchId,role:'scorer'});await denied;
        }
        const customId='custom-11111111-1111-4111-8111-111111111111';
        await d.query("INSERT INTO custom_vis_matches(id,owner_id,public_token,payload,competition_id) VALUES(?,2,?,'{}',2)",[customId,'a'.repeat(48)]);
        const deniedCustom=event(vims,'join_error');vims.emit('join_match',{matchId:customId,role:'viewer'});await deniedCustom;
        let publicRequests=0;viewer.on('new_staff_request',()=>publicRequests++);
        const privateEvent=event(scorer,'new_staff_request');io.to('match_1:score').emit('new_staff_request',{id:1,details:'internal-only'});
        assert.equal((await privateEvent).details,'internal-only');
        const publicScore=event(viewer,'live_state_updated');io.to('match_1').emit('live_state_updated',{score:{home:8,away:5},offlineLease:{checkoutToken:'PRIVATE'}});
        const score=await publicScore;assert.deepEqual(score.score,{home:8,away:5});assert.equal(score.offlineLease,undefined);
        await d.query('UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=1');
        let afterRevocation=0;scorer.on('new_staff_request',()=>afterRevocation++);
        io.to('match_1:score').emit('new_staff_request',{id:2});await wait(150);
        assert.equal(afterRevocation,0);assert.equal(publicRequests,0);
    }finally{
        clients.forEach(socket=>socket.disconnect());
        if(io)await new Promise(resolve=>io.close(resolve));else if(server)await new Promise(resolve=>server.close(resolve));
        await h.close();
    }
});
