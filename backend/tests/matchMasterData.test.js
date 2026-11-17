const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');

test('scoped scorer creates master people, registration links, snapshots and audit atomically',async()=>{
    const h=await setup();
    try{
        const d=h.db,c=require('../controllers/matchSettingsController');
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Scorer','x','scorer','active'),(2,'Other','x','scorer','active'),(3,'Admin','x','super_admin','active'),(4,'Viewer','x','referee','active')");
        await d.query("INSERT INTO age_groups(id,name) VALUES(1,'Open'),(2,'U18')");
        await d.query("INSERT INTO competitions(id,title,sport,gender,age_group_id,max_sets,start_date,max_players) VALUES(1,'Cup','volleyball','Male',1,3,'2026-11-17',12),(2,'Other Cup','volleyball','Male',1,3,'2026-11-17',12)");
        await d.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(1,1),(4,1)');
        for(const id of [10,20,30])await d.query('INSERT INTO teams(id,name,code) VALUES(?,?,?)',[id,`Team ${id}`,`T${id}`]);
        await d.query("INSERT INTO team_entries(id,competition_id,team_id,gender,age_group_id,status) VALUES(1,1,10,'Male',1,'approved'),(2,1,20,'Male',1,'approved'),(3,2,30,'Male',1,'approved')");
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,max_sets) VALUES(1,1,10,20,'scheduled',3),(2,2,30,20,'scheduled',3),(3,NULL,10,20,'scheduled',3)");
        const user={id:1,role:'scorer',username:'Scorer'};
        const read=async(matchId=1)=>{const res=await invoke(c,'read',{}, {matchId},user);assert.equal(res.code,200,JSON.stringify(res.data));return res.data;};
        const payload=async()=>{const state=await read();return {revision:state.revision,fingerprint:state.fingerprint,draft:state.draft};};
        const athlete=(extra={})=>({id:'new-test',create_master:true,number:7,first_name:'New',last_name:'Athlete',gender:'Male',birth_date:'2010-01-01',position:'S',role:'',...extra});
        const staff=(extra={})=>({id:'new-staff',create_master:true,first_name:'New',last_name:'Coach',role:'Head Coach',...extra});
        const count=async table=>Number((await d.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
        let body=await payload();body.draft.home.players.push(athlete());body.draft.home.staff.push(staff());
        let res=await invoke(c,'save',body,{matchId:1},user);assert.equal(res.code,200,JSON.stringify(res.data));assert.equal(res.data.createdMaster.length,2);
        const player=(await d.query("SELECT * FROM players WHERE team_id=10")).rows[0];
        assert.equal(player.first_name_en,'New');assert.equal(player.is_captain,0);assert.equal(player.is_libero1,0);
        assert.equal(await count('team_entry_players'),1);assert.equal(await count('team_entry_staff'),1);
        const raw=(await d.query('SELECT match_setup FROM matches WHERE id=1')).rows[0].match_setup;
        const saved=typeof raw==='string'?JSON.parse(raw):raw;
        assert.equal(saved.home.players[0].id,player.id);assert.ok(saved.home.staff[0].id);
        assert.equal(saved.home.players[0].create_master,undefined);
        assert.equal(Number((await d.query("SELECT count(*) AS count FROM audit_logs WHERE action='match.master.create' AND user_id=1")).rows[0].count),2);
        assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,409,'stale retry does not create duplicate people');
        const reopened=await read();assert.equal(reopened.availableStaff.home.length,1);assert.equal(reopened.draft.home.players.length,1);
        // Normal changes remain match-only; master and registration roles are unchanged.
        body=await payload();body.draft.home.staff[0].first_name='Match only';body.draft.home.players[0].first_name='Display only';
        res=await invoke(c,'save',body,{matchId:1},user);assert.equal(res.code,200,JSON.stringify(res.data));
        assert.equal((await d.query('SELECT first_name FROM players WHERE id=?',[player.id])).rows[0].first_name,'New');
        assert.equal((await d.query('SELECT first_name FROM team_staff WHERE team_id=10')).rows[0].first_name,'New');
        // A late validation error rolls back every new person and link, including audit.
        const originalCounts=await Promise.all(['players','team_staff','team_entry_players','team_entry_staff','audit_logs'].map(count));
        body=await payload();body.draft.away.players.push(athlete({number:9,first_name:'Rollback'}));body.draft.away.staff.push(staff({first_name:'Rollback'}));body.draft.match_number=-1;
        assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,400);
        assert.deepEqual(await Promise.all(['players','team_staff','team_entry_players','team_entry_staff','audit_logs'].map(count)),originalCounts);
        body=await payload();body.draft.home.players.push(athlete({number:9}));assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,409,'duplicate name');
        body=await payload();body.draft.home.players.push(athlete({first_name:'Different'}));assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,409,'duplicate jersey');
        body=await payload();body.draft.away.staff.push(staff({first_name:'Foreign role',role:'Referee'}));assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,400);
        body=await payload();body.draft.away.players.push(athlete({gender:'Female'}));assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,409);
        body=await payload();body.draft.away.players.push(athlete({birth_date:'2010-02-30'}));assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,400);
        await d.query("INSERT INTO competitions(id,title,sport,gender,age_group_id,max_sets,start_date) VALUES(3,'Youth Cup','volleyball','Male',2,3,'2026-11-17')");
        await d.query("INSERT INTO team_entries(id,competition_id,team_id,gender,age_group_id,status) VALUES(4,3,10,'Male',2,'approved'),(5,3,20,'Male',2,'approved')");
        await d.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(1,3)');
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,max_sets) VALUES(5,3,10,20,'scheduled',3)");
        const youth=await read(5),youthBody={revision:youth.revision,fingerprint:youth.fingerprint,draft:youth.draft};
        youthBody.draft.away.players.push(athlete({first_name:'Too old',number:9,birth_date:'1990-01-01'}));
        assert.equal((await invoke(c,'save',youthBody,{matchId:5},user)).code,409,'age eligibility cannot be bypassed');
        // An audit insert failure must roll back the person and registration too.
        await d.query("CREATE FUNCTION reject_master_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='match.master.create' THEN RAISE EXCEPTION 'test audit rejection'; END IF; RETURN NEW; END $$");
        await d.query('CREATE TRIGGER reject_master_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_master_audit()');
        body=await payload();body.draft.away.players.push(athlete({first_name:'Audit rollback',number:9}));
        const beforeAuditFailure=await count('players');
        assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,500);
        assert.equal(await count('players'),beforeAuditFailure);
        await d.query('DROP TRIGGER reject_master_audit ON audit_logs');
        await d.query("CREATE OR REPLACE FUNCTION reject_master_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='match.settings.update' THEN RAISE EXCEPTION 'test final audit rejection'; END IF; RETURN NEW; END $$");
        await d.query('CREATE TRIGGER reject_settings_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_master_audit()');
        body=await payload();body.draft.away.staff.push(staff({first_name:'Final audit rollback'}));
        const staffBefore=await count('team_staff');
        assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,500);
        assert.equal(await count('team_staff'),staffBefore,'final settings audit must fail the whole transaction, not silently roll back and report success');
        await d.query('DROP TRIGGER reject_settings_audit ON audit_logs');
        // Scopes and roles are checked in the same transaction before master writes.
        for(const actor of [{id:2,role:'scorer'},{id:3,role:'super_admin'},{id:4,role:'referee'}]){
            body=await payload();body.draft.away.players.push(athlete());assert.equal((await invoke(c,'save',body,{matchId:1},actor)).code,403);
        }
        body=await payload();body.draft.away.staff.push({...staff(),create_master:false,id:999});assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,400,'foreign staff ID');
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,max_sets) VALUES(4,1,20,30,'live',3)");
        body=await payload();body.draft.away.staff.push(staff());assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,409);
        await d.query("UPDATE matches SET status='scheduled' WHERE id=4");
        await d.query("UPDATE matches SET status='live' WHERE id=1");
        body=await payload();body.draft.away.players.push(athlete());assert.equal((await invoke(c,'save',body,{matchId:1},user)).code,409);
        assert.equal(await count('players'),1);assert.equal(await count('team_staff'),1);
        // Private manual matches can create master records only when owned and linked to a real team.
        await d.query('UPDATE matches SET manual_owner_id=1 WHERE id=3');
        const manual=await read(3),manualBody={revision:manual.revision,fingerprint:manual.fingerprint,draft:manual.draft};
        manualBody.draft.title='Private match';manualBody.draft.away.players.push(athlete({first_name:'Manual athlete',number:9}));
        res=await invoke(c,'save',manualBody,{matchId:3},user);assert.equal(res.code,200,JSON.stringify(res.data));
        assert.equal(await count('players'),2);
        assert.equal((await d.query('SELECT count(*) AS count FROM team_entry_players WHERE player_id=?',[res.data.createdMaster[0].id])).rows[0].count,0,'manual creation does not register in unrelated competitions');
    }finally{await h.close();}
});
