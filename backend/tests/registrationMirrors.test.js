const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { inspect } = require('../scripts/auditRegistrationMirrors');

test('mirror preflight compares populated sources, detects drift and never writes', async () => {
    const db = new PGlite();
    try {
        await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/postgres/001_baseline.sql'),'utf8'));
        await db.exec(`INSERT INTO competitions(id,title,sport,gender) VALUES(1,'PRIVATE_COMPETITION','Volleyball','Male');
            INSERT INTO teams(id,name,code) VALUES(1,'PRIVATE_TEAM_1','T1'),(2,'PRIVATE_TEAM_2','T2');
            INSERT INTO team_entries(id,team_id,competition_id,status,gender,registered_at)
            VALUES(1,1,1,'approved','Male','2026-01-01'),(2,2,1,'approved','Male','2026-01-02');
            INSERT INTO team_competitions(team_id,competition_id,status,gender,registered_at)
            SELECT team_id,competition_id,status,gender,registered_at FROM team_entries;
            INSERT INTO players(id,team_id,number,first_name) VALUES(1,1,1,'PRIVATE_PLAYER');
            INSERT INTO team_entry_players(team_entry_id,player_id,number) VALUES(1,1,1);
            INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,home_set_score,away_set_score)
            VALUES(1,1,1,2,'completed',3,1);`);
        const statements=[];
        const client={query(sql){statements.push(sql);return db.query(sql);}};
        const before=await inspect(client);
        assert.equal(before.mismatchCount,0);
        assert.ok(before.checks.every(c=>c.equal));
        assert.equal(before.coverage.completedMatches,1);
        assert.equal(before.checks.find(c=>c.name==='roster.player_snapshots').canonicalRows,1);
        await db.exec("UPDATE team_competitions SET status='pending',gender='Female' WHERE team_id=1");
        const drift=await inspect(client);
        assert.equal(drift.mismatchCount,1);
        assert.equal(drift.sampleIds[0].entry_id,1);
        assert.ok(drift.sampleIds[0].status_diff);
        assert.ok(drift.sampleIds[0].gender_diff);
        assert.equal(drift.checks.find(c=>c.name==='standings.shared_calculation').equal,false);
        await db.exec('DELETE FROM team_competitions WHERE team_id=1');
        const missing=await inspect(client);
        assert.equal(missing.sampleIds[0].missing_mirror,true);
        assert.equal(missing.checks.find(c=>c.name==='roster.player_snapshots').equal,false);
        assert.ok(statements.every(sql=>/^\s*SELECT\b/.test(sql)));
        for(const secret of ['PRIVATE_COMPETITION','PRIVATE_TEAM_1','PRIVATE_PLAYER']) assert.ok(!JSON.stringify(before).includes(secret));
    } finally { await db.close(); }
});
