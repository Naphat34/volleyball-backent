const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');
test('access matches include registered bilingual names without changing IDs or scope',async()=>{
    const h=await setup();
    try {
        await h.db.query("INSERT INTO competitions(id,title,title_th,title_en,sport,gender) VALUES(1,'รายการเดิม','รายการไทย','English Cup','volleyball','Male'),(2,'Other','อื่น','Other','volleyball','Male')");
        await h.db.query("INSERT INTO teams(id,name,name_th,name_en,code) VALUES(1,'เดิม','เหย้า','Home','H'),(2,'เยือน','เยือน','Away','A')");
        await h.db.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Scorer','x','scorer','active')");
        await h.db.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(1,1)');
        await h.db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id) VALUES(1,1,1,2),(2,2,1,2)");
        const res=await invoke(require('../controllers/accessController'),'matches',{}, {},{id:1,role:'scorer'});
        assert.equal(res.code,200,JSON.stringify(res.data));
        assert.equal(res.data.matches.length,1);
        assert.equal(res.data.matches[0].id,1);
        assert.equal(res.data.matches[0].competition_name_en,'English Cup');
        assert.equal(res.data.matches[0].competition_name_th,'รายการไทย');
        assert.equal(res.data.matches[0].home_team_name_en,'Home');
        assert.equal(res.data.matches[0].away_team_name_th,'เยือน');
    } finally {await h.close();}
});
