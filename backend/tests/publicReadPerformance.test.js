const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PROVIDER = 'postgres';
const { setup, invoke } = require('./helpers/postgresHarness');
const { syncTeamEntries } = require('../utils/automaticEntryRoster');

test('public lists read persisted, current rosters without team locks or writes', async () => {
    const h = await setup();
    try {
        const db = h.db;
        await db.query("INSERT INTO age_groups(id,name) VALUES(1,'Open')");
        await db.query("INSERT INTO competitions(id,title,sport,gender,age_group_id,status) VALUES(1,'Event','volleyball','Male',1,'open')");
        await db.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','H')");
        await db.query("INSERT INTO team_entries(id,team_id,competition_id,age_group_id,status) VALUES(1,1,1,1,'approved')");
        await db.query("INSERT INTO players(id,team_id,first_name,last_name,gender,number,is_active) VALUES(1,1,'First','Player','Male',7,1)");
        // The same sync used by master-data writes publishes the roster before reads.
        const connection = await db.connect();
        try {
            await connection.beginTransaction();
            await syncTeamEntries(connection, 1);
            await connection.query("UPDATE players SET first_name='Updated' WHERE id=1");
            await syncTeamEntries(connection, 1);
            await connection.commit();
        } catch (error) { await connection.rollback(); throw error; }
        finally { connection.release(); }

        const query = db.query.bind(db), connect = db.connect.bind(db), statements = [];
        db.query = async (sql, params) => {
            assert.match(sql.trim(), /^SELECT\b/i);
            assert.doesNotMatch(sql, /FOR UPDATE/i);
            statements.push(sql);
            return query(sql, params);
        };
        db.connect = async () => { throw Error('Public reads must not open roster transactions'); };
        const controller = require('../controllers/publicController');
        try {
            const competitions = await invoke(controller, 'getCompetitions');
            assert.equal(competitions.code, 200);
            assert.equal(competitions.data[0].age_group_name, 'Open');
            assert.equal(statements.length, 2, 'one schema query and one competition query');
            for (let visit = 0; visit < 2; visit++) {
                const teams = await invoke(controller, 'getCompetitionTeams', {}, { competitionId: 1 });
                assert.equal(teams.code, 200);
                assert.equal(Number(teams.data[0].player_count), 1);
                const players = await invoke(controller, 'getTeamPlayers', {}, { teamId: 1 }, undefined, { competitionId: 1 });
                assert.equal(players.code, 200);
                assert.equal(players.data[0].first_name, 'Updated');
                assert.equal(players.data[0].number, 7);
            }
        } finally { db.query = query; db.connect = connect; }
    } finally { await h.close(); }
});
