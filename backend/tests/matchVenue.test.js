const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PROVIDER = 'postgres';
const {setup,invoke} = require('./helpers/postgresHarness');

test('match lists expose registered venue translations without replacing a different free-text venue', async () => {
    const h = await setup();
    try {
        await h.db.query("INSERT INTO stadiums(id,name,name_th,name_en) VALUES(1,'สนามไทย','สนามไทย','English Gymnasium')");
        await h.db.query("INSERT INTO competitions(id,title,stadium_id,sport,gender) VALUES(1,'Cup',1,'volleyball','Male')");
        await h.db.query("INSERT INTO teams(id,name,name_th,name_en,code) VALUES(1,'Home','เหย้า','Home Team','H'),(2,'Away','เยือน','Away Team','A')");
        await h.db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,location) VALUES(1,1,1,2,'สนามไทย'),(2,1,1,2,'Different Court')");
        const controller = require('../controllers/matchController');
        for (const method of ['getAllMatches','getMatchesByCompetition']) {
            const result = await invoke(controller,method,{}, {competitionId:1});
            assert.equal(result.code,200,JSON.stringify(result.data));
            const registered = result.data.find(row=>row.id===1);
            const freeText = result.data.find(row=>row.id===2);
            assert.equal(registered.location_en,'English Gymnasium');
            assert.equal(registered.location_th,'สนามไทย');
            assert.equal(freeText.location,'Different Court');
            assert.equal(freeText.location_en,null);
            assert.equal(registered.home_team_name_en,'Home Team');
        }
        const competitions=require('../controllers/competitionsController');
        const fallback=await invoke(competitions,'getCompetitionTeams',{}, {competitionId:1});
        assert.equal(fallback.code,200);
        assert.equal(fallback.data.find(team=>team.id===1).name_en,'Home Team');
        await h.db.query("INSERT INTO team_entries(team_id,competition_id,status) VALUES(1,1,'approved'),(2,1,'approved')");
        const registered=await invoke(competitions,'getCompetitionTeams',{}, {competitionId:1});
        assert.equal(registered.code,200);
        assert.equal(registered.data.find(team=>team.id===1).name_en,'Home Team');
        assert.equal(registered.data.find(team=>team.id===2).name_th,'เยือน');
    } finally { await h.close(); }
});
