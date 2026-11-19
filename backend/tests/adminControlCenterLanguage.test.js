const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PROVIDER = 'postgres';
const { setup, invoke } = require('./helpers/postgresHarness');

test('control center overview preserves bilingual names and registered venues, leaving free-text venues intact', async () => {
    const h = await setup();
    try {
        await h.db.query("INSERT INTO stadiums(id,name,name_th,name_en) VALUES(1,'สนามไทย','สนามไทย','English Gym')");
        await h.db.query("INSERT INTO competitions(id,title,title_th,title_en,stadium_id,sport,gender) VALUES(1,'รายการเดิม','รายการไทย','English Cup',1,'volleyball','Male')");
        await h.db.query("INSERT INTO teams(id,name,name_th,name_en,code) VALUES(1,'ทีมเดิม','ทีมเหย้า','Home Team','H'),(2,'ทีมเยือน','ทีมเยือน','Away Team','A')");
        await h.db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,location) VALUES(1,1,1,2,'สนามไทย'),(2,1,1,2,'Other Court')");
        const response = await invoke(require('../controllers/adminVisController'), 'overview', {}, {}, {id:1,role:'super_admin'});
        assert.equal(response.code, 200, JSON.stringify(response.data));
        const registered = response.data.matches.find(row => row.id === 1);
        assert.equal(registered.home_team_name_th, 'ทีมเหย้า');
        assert.equal(registered.home_team_name_en, 'Home Team');
        assert.equal(registered.away_team_name_en, 'Away Team');
        assert.equal(registered.competition_name_th, 'รายการไทย');
        assert.equal(registered.competition_name_en, 'English Cup');
        assert.equal(registered.location_th, 'สนามไทย');
        assert.equal(registered.location_en, 'English Gym');
        const free = response.data.matches.find(row => row.id === 2);
        assert.equal(free.location, 'Other Court');
        assert.equal(free.location_en, null);
        assert.equal(registered.live_state, undefined);
        assert.equal(registered.vis_state, undefined);
    } finally { await h.close(); }
});
