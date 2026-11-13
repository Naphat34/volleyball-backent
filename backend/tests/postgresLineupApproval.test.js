const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PROVIDER = 'postgres';
const { setup, invoke } = require('./helpers/postgresHarness');
const { approveLineupRequest } = require('../utils/approveLineupRequest');

test('PostgreSQL lineup approval is atomic, validates current registration and is retry-safe', async () => {
    const h = await setup();
    try {
        const db = h.db;
        await db.query("INSERT INTO age_groups(id,name) VALUES(1,'Open')");
        await db.query("INSERT INTO teams(id,name,code,gender) VALUES(1,'Home','HOME','Male'),(2,'Away','AWAY','Male')");
        const competition = (await db.query("INSERT INTO competitions(title,sport,gender,age_group_id,status,start_date,max_players,max_sets) VALUES('Approval cup','Volleyball','Male',1,'open','2099-01-01',14,5) RETURNING id")).insertId;
        await db.query('INSERT INTO team_entries(team_id,competition_id) VALUES(1,?),(2,?)',[competition,competition]);
        for (const team of [1,2]) for (let number=1;number<=6;number++) {
            await db.query("INSERT INTO players(id,team_id,number,first_name,gender,position) VALUES(?,?,?,'Athlete','Male','OH')",[team*10+number,team,number]);
        }
        const setup = {title:'Approval cup',gender:'Male',maxSets:5,pointsPerSet:25,decidingSetPoints:15,
            home:{name:'Home',code:'HOME',players:[{id:999,number:99}],staff:[]},away:{name:'Away',code:'AWAY',players:[],staff:[]}};
        const matchId = (await db.query("INSERT INTO matches(home_team_id,away_team_id,competition_id,status,match_setup,live_state,first_serve_team_id) VALUES(1,2,?,'scheduled',?,?,1) RETURNING id",[competition,JSON.stringify(setup),JSON.stringify({workflowStep:'LINEUP',matchData:{currentSet:1}})])).insertId;
        const details = ids => ({setNumber:1,lineup:ids.map((id,index)=>({position:index+1,player_id:id}))});
        const add = async ids => (await db.query("INSERT INTO match_requests(match_id,team_id,request_type,status,details) VALUES(?,1,'LINEUP','PENDING',?) RETURNING id",[matchId,JSON.stringify(details(ids))])).insertId;
        const ids = [11,12,13,14,15,16];
        const requestId = await add(ids);
        const req = {params:{matchId,requestId},user:{id:3,role:'scorer'},app:{get:()=>null}};
        const controller = require('../controllers/matchController');
        const accepted = await invoke(controller,'updateRequest',{status:'APPROVED'},req.params,req.user);
        assert.equal(accepted.code,200,JSON.stringify(accepted.data));
        assert.equal(accepted.data.status,'APPROVED');
        const original = (await db.query('SELECT * FROM match_lineups WHERE match_id=?',[matchId])).rows[0];
        assert.deepEqual(ids.map((_,index)=>original[`player_id_p${index+1}`]),ids);
        await approveLineupRequest(db,req);
        assert.equal((await db.query('SELECT id FROM match_lineups WHERE match_id=?',[matchId])).rows[0].id,original.id);
        const foreignId = await add([21,12,13,14,15,16]);
        await assert.rejects(approveLineupRequest(db,{...req,params:{matchId,requestId:foreignId}}),/unavailable/);
        assert.equal((await db.query('SELECT status FROM match_requests WHERE id=?',[foreignId])).rows[0].status,'PENDING');
        await assert.rejects(approveLineupRequest(db,{...req,user:{role:'team_staff'}}),error=>error.status===403);
        const retryId = await add([...ids].reverse());
        const failingDb = {connect:async()=>{
            const c = await db.connect();
            return {...c,query:(sql,params)=>sql.startsWith('UPDATE match_requests') ? Promise.reject(Error('simulated approval write failure')) : c.query(sql,params)};
        }};
        await assert.rejects(approveLineupRequest(failingDb,{...req,params:{matchId,requestId:retryId}}),/simulated/);
        const after = (await db.query('SELECT * FROM match_lineups WHERE match_id=?',[matchId])).rows[0];
        assert.equal(after.id,original.id,'failed approval must restore the previous lineup');
        assert.deepEqual(ids.map((_,index)=>after[`player_id_p${index+1}`]),ids);
        assert.equal((await db.query('SELECT status FROM match_requests WHERE id=?',[retryId])).rows[0].status,'PENDING');
        await db.query('UPDATE players SET is_libero1=1,position=\'L\' WHERE id=11');
        // Registration sync picks up the new role before a pending approval.
        await assert.rejects(approveLineupRequest(db,{...req,params:{matchId,requestId:retryId}}),/unavailable/);
    } finally { await h.close(); }
});
