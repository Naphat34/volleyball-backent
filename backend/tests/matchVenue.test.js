const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PROVIDER = 'postgres';
const {setup,invoke} = require('./helpers/postgresHarness');

test('match lists expose registered venue translations without replacing a different free-text venue', async () => {
    const h = await setup();
    try {
        await h.db.query("INSERT INTO stadiums(id,name,name_th,name_en) VALUES(1,'สนามไทย','สนามไทย','English Gymnasium')");
        await h.db.query("INSERT INTO competitions(id,title,stadium_id,sport,gender) VALUES(1,'Cup',1,'volleyball','Male')");
        await h.db.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','H'),(2,'Away','A')");
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
        }
    } finally { await h.close(); }
});
