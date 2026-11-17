const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PGlite } = require('@electric-sql/pglite');
const { audit } = require('../scripts/auditMasterData');

test('audit detects scope/mirror/role issues without exporting identity data or writing database rows', async () => {
    const database = new PGlite();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'volley-audit-'));
    try {
        await database.exec(fs.readFileSync(path.join(__dirname, '../migrations/postgres/001_baseline.sql'), 'utf8'));
        await database.exec(`INSERT INTO users(id,username,password_hash,role,status)
            VALUES (1,'PRIVATE_USERNAME','PRIVATE_HASH','user','approved');
            INSERT INTO users(id,username,password_hash,role,status) VALUES
            (2,'PRIVATE_ADMIN','PRIVATE_HASH','super_admin','active'),
            (3,'PRIVATE_SCORE_ADMIN','PRIVATE_HASH','super_admin_scorer','active'),
            (4,'PRIVATE_VIMS_ADMIN','PRIVATE_HASH','super_admin_vims','active'),
            (5,'PRIVATE_VIMS','PRIVATE_HASH','vims_operator','active'),
            (6,'PRIVATE_ALIAS','PRIVATE_HASH','score','active');
            INSERT INTO teams(id,name,code) VALUES(1,'PRIVATE_TEAM','T1');
            INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Test','volleyball','Male');
            INSERT INTO team_entries(id,team_id,competition_id) VALUES(1,1,1);
            INSERT INTO players(id,team_id,number,first_name,national_id)
            VALUES(1,1,1,'PRIVATE_PERSON','1234567890123');`);
        const statements = [];
        class Client {
            async connect() {}
            async query(sql, params) { statements.push(sql); return database.query(sql, params); }
            async end() {}
        }
        const output = path.join(directory, 'report.json');
        const result = await audit({ DB_PROVIDER: 'postgres', DATABASE_URL: 'postgres://unused:unused@localhost/unused',
            DB_SSL: 'false' }, output, { Client });
        assert.equal(result.checks.find(c => c.name === 'mirror:entry_without_team_competition').count, 1);
        const unsupported = result.checks.find(c => c.name.startsWith('review:users:role IS NULL'));
        assert.equal(unsupported.count, 1);
        assert.deepEqual(unsupported.sampleIds, [{ id: 1 }]);
        assert.equal(result.distributions.find(d => d.table === 'users' && d.field === 'role').values.find(row => row.value === 'user').permissions.length, 0);
        assert.equal(result.schema.baselineMissing.length, 0);
        assert.equal(result.skipped.length, 0, JSON.stringify(result.skipped));
        assert.match(statements[0], /READ ONLY/);
        assert.ok(statements.every(sql => !/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i.test(sql)));
        assert.equal((await database.query('SELECT count(*) AS count FROM players')).rows[0].count, 1);
        const serialized = fs.readFileSync(output, 'utf8');
        for (const secret of ['PRIVATE_USERNAME', 'PRIVATE_HASH', 'PRIVATE_PERSON', 'PRIVATE_TEAM', '1234567890123']) assert.ok(!serialized.includes(secret));
    } finally {
        await database.close();
        // Delete only files created by this test; no recursive filesystem operation.
        const output = path.join(directory, 'report.json');
        if (fs.existsSync(output)) fs.unlinkSync(output);
        fs.rmdirSync(directory);
    }
});
