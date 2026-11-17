// Stage 7 preflight only. No application adapter, migration, or write queries.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { poolOptions } = require('../config/postgres');

const stable = value => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const digest = rows => createHash('sha256').update(JSON.stringify(rows.map(row => JSON.stringify(stable(row))).sort())).digest('hex');
const compare = (name, legacy, canonical) => ({ name, legacyRows: legacy.length, canonicalRows: canonical.length,
    legacyHash: digest(legacy), canonicalHash: digest(canonical), equal: digest(legacy) === digest(canonical) });

async function inspect(client) {
    const read = async sql => (await client.query(sql)).rows;
    const checks = [];
    checks.push(compare('registration.fields',
        await read('SELECT team_id,competition_id,status,gender,age_group_id,registered_at FROM team_competitions'),
        await read('SELECT team_id,competition_id,status,gender,age_group_id,registered_at FROM team_entries')));
    const differences = await read(`SELECT e.id AS entry_id,COALESCE(e.team_id,c.team_id) AS team_id,
        COALESCE(e.competition_id,c.competition_id) AS competition_id,
        e.id IS NULL AS missing_entry,c.team_id IS NULL AS missing_mirror,
        e.status IS DISTINCT FROM c.status AS status_diff,
        e.gender IS DISTINCT FROM c.gender AS gender_diff,
        e.age_group_id IS DISTINCT FROM c.age_group_id AS age_group_diff,
        e.registered_at IS DISTINCT FROM c.registered_at AS registered_at_diff
        FROM team_entries e FULL JOIN team_competitions c USING(team_id,competition_id)
        WHERE e.id IS NULL OR c.team_id IS NULL OR e.status IS DISTINCT FROM c.status
        OR e.gender IS DISTINCT FROM c.gender OR e.age_group_id IS DISTINCT FROM c.age_group_id
        OR e.registered_at IS DISTINCT FROM c.registered_at ORDER BY 2,3`);
    const registrationTables = ['team_competitions', 'team_entries'];
    const teams = [], fixtures = [];
    for (const table of registrationTables) {
        teams.push(await read(`SELECT r.competition_id,t.* FROM ${table} r JOIN teams t ON t.id=r.team_id WHERE r.status='approved'`));
        fixtures.push(await read(`SELECT r.competition_id,r.team_id,r.registered_at FROM ${table} r WHERE r.status='approved'
            ORDER BY r.competition_id,r.registered_at,r.team_id`));
    }
    checks.push(compare('fixture.approved_participants', fixtures[0], fixtures[1]));
    checks.push(compare('standings.approved_team_inputs', teams[0], teams[1]));
    for (const [name, sql] of [
        ['roster.player_snapshots', `SELECT e.competition_id,e.team_id,ep.* FROM team_entries e
            JOIN team_entry_players ep ON ep.team_entry_id=e.id`],
        ['roster.staff', `SELECT e.competition_id,e.team_id,es.* FROM team_entries e
            JOIN team_entry_staff es ON es.team_entry_id=e.id`],
    ]) {
        checks.push(compare(name, await read(sql + ' JOIN team_competitions c ON c.team_id=e.team_id AND c.competition_id=e.competition_id'), await read(sql)));
    }
    checks.push(compare('reports.registration_counts',
        await read('SELECT c.id,COUNT(r.team_id) AS team_count FROM competitions c LEFT JOIN team_competitions r ON r.competition_id=c.id GROUP BY c.id'),
        await read('SELECT c.id,COUNT(r.team_id) AS team_count FROM competitions c LEFT JOIN team_entries r ON r.competition_id=c.id GROUP BY c.id')));
    const matches = await read('SELECT * FROM matches');
    const competitions = await read('SELECT * FROM competitions');
    const { calculateStandings } = await import(pathToFileURL(path.resolve(__dirname, '../../client/src/utils/scorer/standings.js')).href);
    const standings = teams.map(rows => competitions.flatMap(c => calculateStandings(
        rows.filter(row => String(row.competition_id) === String(c.id)),
        matches.filter(row => String(row.competition_id) === String(c.id)), [c]).map(row => ({ ...row, competition_id: c.id }))));
    checks.push(compare('standings.shared_calculation', standings[0], standings[1]));
    const dependencies = await read(`SELECT 'view' AS type,view_schema AS schema_name,view_name AS name
        FROM information_schema.view_table_usage WHERE table_schema=current_schema() AND table_name='team_competitions'
        UNION ALL SELECT 'trigger',event_object_schema,trigger_name FROM information_schema.triggers
        WHERE event_object_schema=current_schema() AND event_object_table='team_competitions'
        UNION ALL SELECT 'foreign_key',ns.nspname,con.conname FROM pg_constraint con
        JOIN pg_class t ON t.oid=con.confrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
        WHERE con.contype='f' AND ns.nspname=current_schema() AND t.relname='team_competitions'`);
    return { capturedAt: new Date().toISOString(), readOnly: true, checks,
        mismatchCount: differences.length, sampleIds: differences.slice(0,20), databaseDependencies: dependencies,
        coverage: { matches: matches.length, completedMatches: matches.filter(m => ['completed','finished','match_finished'].includes(m.status)).length },
        limitations: ['Preflight compares alternative registration sources in the same snapshot, not a deployed before/after change.',
            'Fixture comparison checks participants and timestamps; tied registration times require an explicit ordering decision.',
            'Roster/report checks compare source rows and counts, not rendered PDFs or every endpoint.',
            'Standings uses the shared public calculator; the separate admin calculator still requires regression coverage.',
            'Database catalog dependencies do not prove absence of dynamic SQL, external integrations or historical scripts.'] };
}

async function audit(env, output) {
    const options = poolOptions(env);
    const target = options.connectionString ? new URL(options.connectionString) : null;
    const host = target?.hostname || options.host;
    const database = target ? decodeURIComponent(target.pathname.slice(1)) : options.database;
    if (env.DB_PROVIDER !== 'postgres' || !['localhost','127.0.0.1','[::1]','::1'].includes(host)
        || database !== 'Volley_db2026') throw Error('LOCAL_TARGET_REQUIRED');
    const client = new (require('pg').Client)(options);
    let transaction = false;
    try {
        await client.connect();
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
        await client.query("SET LOCAL statement_timeout='20s'");
        await client.query("SET LOCAL lock_timeout='3s'");
        const result = await inspect(client);
        await client.query('ROLLBACK'); transaction = false;
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(result,null,2)+'\n');
        return result;
    } finally {
        if (transaction) await client.query('ROLLBACK').catch(() => {});
        await client.end();
    }
}
if (require.main === module) {
    const args = process.argv.slice(2), envIndex = args.indexOf('--env-file'), outputIndex = args.indexOf('--output');
    if (envIndex < 0 || outputIndex < 0 || !args[envIndex+1] || !args[outputIndex+1]) {
        console.error('Usage: node scripts/auditRegistrationMirrors.js --env-file .env --output <local-report.json>'); process.exitCode=1;
    } else audit(require('dotenv').parse(fs.readFileSync(path.resolve(args[envIndex+1]))), path.resolve(args[outputIndex+1]))
        .then(r => console.log(JSON.stringify({ checks:r.checks, mismatchCount:r.mismatchCount, coverage:r.coverage })))
        .catch(e => { console.error('Mirror preflight failed:', e.code || e.message); process.exitCode=1; });
}
module.exports = { inspect, compare };
