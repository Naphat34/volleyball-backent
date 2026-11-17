// Read-only inventory. Never import config/db: that adapter may open extra connections.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { normalizeRole, getRolePermissions, permissionsByRole } = require('../config/permissions');

function baselineColumns(sql) {
    const result = {};
    for (const match of sql.matchAll(/CREATE TABLE "([^"]+)" \(([\s\S]*?)\n\);/g)) {
        result[match[1]] = [...match[2].matchAll(/^    "([^"]+)" /gm)].map(column => column[1]);
    }
    return result;
}

async function audit(env, output, drivers = {}) {
    const provider = env.DB_PROVIDER || 'mysql';
    if (!['mysql', 'postgres'].includes(provider)) throw Error('INVALID_PROVIDER');
    let client;
    let transaction = false;
    const report = { capturedAt: new Date().toISOString(), provider, readOnly: true,
        limitations: ['Unused data cannot be established from row counts alone.',
            'Duplicate candidates require review; no automatic merge or deletion.',
            'Baseline comparison is structural, not proof of applied migrations.'],
        schema: {}, tables: [], distributions: [], checks: [], skipped: [] };
    const q = name => provider === 'postgres'
        ? '"' + name.replaceAll('"', '""') + '"' : '`' + name.replaceAll('`', '``') + '`';
    try {
        if (provider === 'postgres') {
            const Client = drivers.Client || require('pg').Client;
            const { poolOptions } = require('../config/postgres');
            client = new Client(poolOptions(env));
            await client.connect();
            await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
            transaction = true;
            await client.query("SET LOCAL statement_timeout = '20s'");
            await client.query("SET LOCAL lock_timeout = '3s'");
            report.schema.name = env.DB_PG_SCHEMA || 'volley';
        } else {
            client = await require('mysql2/promise').createConnection({ host: env.DB_HOST,
                port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD,
                database: env.DB_NAME, connectTimeout: 10000, supportBigNumbers: true,
                bigNumberStrings: true, ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true,
                    ...(env.DB_SSL_CA_FILE ? { ca: fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8') } : {}) } : undefined });
            await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            await client.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
            transaction = true;
            report.schema.name = env.DB_NAME;
        }
        const select = async (sql, params = []) => provider === 'postgres'
            ? (await client.query(sql, params)).rows : (await client.query({ sql, timeout: 25000 }, params))[0];
        const bind = provider === 'postgres' ? '$1' : '?';
        const schema = report.schema.name;
        const table = name => `${q(schema)}.${q(name)}`;
        const columns = await select(`SELECT table_name AS table_name, column_name AS column_name,
            data_type AS data_type, is_nullable AS is_nullable FROM information_schema.columns
            WHERE table_schema = ${bind} ORDER BY table_name, ordinal_position`, [schema]);
        const tables = await select(`SELECT table_name AS table_name FROM information_schema.tables
            WHERE table_schema = ${bind} AND table_type = 'BASE TABLE' ORDER BY table_name`, [schema]);
        const catalog = new Map(tables.map(t => [t.table_name,
            new Set(columns.filter(c => c.table_name === t.table_name).map(c => c.column_name))]));
        report.schema.columns = columns;
        const expected = baselineColumns(fs.readFileSync(path.join(__dirname, '../migrations/postgres/001_baseline.sql'), 'utf8'));
        report.schema.baselineMissing = Object.entries(expected).flatMap(([name, fields]) => !catalog.has(name)
            ? [{ table: name, missingTable: true }] : fields.filter(f => !catalog.get(name).has(f)).map(f => ({ table: name, column: f })));
        report.schema.extraTables = [...catalog.keys()].filter(name => !expected[name]);
        const available = (name, fields) => catalog.has(name) && fields.every(f => catalog.get(name).has(f));
        async function collect(name, sql, destination) {
            if (provider === 'postgres') await client.query('SAVEPOINT audit_check');
            try {
                const rows = await select(sql);
                destination(rows);
            } catch (error) {
                if (provider === 'postgres') await client.query('ROLLBACK TO SAVEPOINT audit_check');
                report.skipped.push({ name, code: error.code || 'QUERY_FAILED' });
            } finally {
                if (provider === 'postgres') await client.query('RELEASE SAVEPOINT audit_check');
            }
        }
        for (const name of catalog.keys()) {
            await collect(`count:${name}`, `SELECT COUNT(*) AS count FROM ${table(name)}`,
                rows => report.tables.push({ table: name, count: Number(rows[0].count) }));
            for (const field of ['status', 'role']) if (available(name, [field]) && ['users', 'teams', 'team_entries', 'team_competitions', 'matches'].includes(name)) {
                await collect(`distribution:${name}.${field}`,
                    `SELECT ${q(field)} AS value, COUNT(*) AS count FROM ${table(name)} GROUP BY ${q(field)}`,
                    rows => report.distributions.push({ table: name, field, values: rows.map(r => ({
                        value: r.value, count: Number(r.count), ...(name === 'users' && field === 'role'
                            ? { normalizedRole: normalizeRole(r.value), permissions: getRolePermissions(r.value) } : {}) })) }));
            }
        }
        async function check(name, severity, requirements, from, where, ids) {
            if (!requirements.every(([t, fields]) => available(t, fields))) {
                report.skipped.push({ name, code: 'MISSING_SCHEMA' }); return;
            }
            await collect(name, `SELECT COUNT(*) AS count FROM ${from} WHERE ${where}`,
                rows => report.checks.push({ name, severity, count: Number(rows[0].count), sampleIds: [] }));
            const result = report.checks.find(c => c.name === name);
            if (result?.count && ids) await collect(`${name}:sample`,
                `SELECT ${ids} FROM ${from} WHERE ${where} ORDER BY 1 LIMIT 20`, rows => { result.sampleIds = rows; });
        }
        const refs = [
            ['users', 'team_id', 'teams'], ['teams', 'user_id', 'users'], ['players', 'team_id', 'teams'],
            ['team_staff', 'team_id', 'teams'], ['referees', 'user_id', 'users'], ['scorers', 'user_id', 'users'],
            ['team_entries', 'team_id', 'teams'], ['team_entries', 'competition_id', 'competitions'],
            ['team_entries', 'age_group_id', 'age_groups'], ['team_entry_players', 'team_entry_id', 'team_entries'],
            ['team_entry_players', 'player_id', 'players'], ['team_entry_staff', 'team_entry_id', 'team_entries'],
            ['team_entry_staff', 'staff_id', 'team_staff'], ['matches', 'competition_id', 'competitions'],
            ['matches', 'home_team_id', 'teams'], ['matches', 'away_team_id', 'teams'],
            ['matches', 'stadium_id', 'stadiums'], ['matches', 'scorer_id', 'scorers'],
            ['matches', 'manual_vis_assignee_id', 'users'], ['custom_vis_matches', 'owner_id', 'users'],
        ];
        for (const [child, field, parent] of refs) await check(`orphan:${child}.${field}`, 'high',
            [[child, ['id', field]], [parent, ['id']]], `${table(child)} c`,
            `c.${q(field)} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${table(parent)} p WHERE p.id=c.${q(field)})`, 'c.id');
        for (const [name, fields] of [['teams', ['code']], ['players', ['national_id']], ['players', ['fivb_id']],
            ['scorers', ['user_id']], ['referees', ['user_id']],
            ['team_entries', ['team_id', 'competition_id', 'gender', 'age_group_id']],
            ['team_entry_players', ['team_entry_id', 'player_id']]]) {
            if (!available(name, ['id', ...fields])) { report.skipped.push({ name: `duplicate:${name}.${fields.join('+')}`, code: 'MISSING_SCHEMA' }); continue; }
            const nonempty = fields.length === 1 ? `WHERE ${q(fields[0])} IS NOT NULL AND TRIM(CAST(${q(fields[0])} AS ${provider === 'postgres' ? 'TEXT' : 'CHAR'})) <> ''` : '';
            const group = fields.map(q).join(',');
            // Do not export duplicate keys: national IDs and names must stay in the database.
            const duplicates = `(SELECT MIN(id) AS first_id, COUNT(*) AS members FROM ${table(name)} ${nonempty} GROUP BY ${group} HAVING COUNT(*) > 1) d`;
            await collect(`duplicate:${name}.${fields.join('+')}`, `SELECT COUNT(*) AS groups, COALESCE(SUM(members),0) AS members FROM ${duplicates}`,
                rows => report.checks.push({ name: `duplicate:${name}.${fields.join('+')}`, severity: 'review',
                    count: Number(rows[0].groups), affectedRows: Number(rows[0].members), sampleIds: [] }));
        }
        // Canonical roles come from the application registry; retain recognized migration aliases.
        const knownRoles = [...Object.keys(permissionsByRole), 'admin', 'score', 'statistician']
            .map(role => "'" + role.replaceAll("'", "''") + "'").join(',');
        for (const [name, fields, condition] of [
            ['users', ['role'], `role IS NULL OR TRIM(role) NOT IN (${knownRoles})`],
            ['users', ['status'], "status = 'approved'"],
            ['players', ['birth_date'], 'birth_date IS NULL'],
            ['players', ['first_name', 'first_name_th', 'first_name_en'], "COALESCE(NULLIF(TRIM(first_name),''),NULLIF(TRIM(first_name_th),''),NULLIF(TRIM(first_name_en),'')) IS NULL"],
            ['matches', ['home_team_id', 'away_team_id'], 'home_team_id = away_team_id'],
            ['matches', ['manual_owner_id', 'competition_id'], 'manual_owner_id IS NULL AND competition_id IS NULL'],
        ]) await check(`review:${name}:${condition}`, 'review', [[name, ['id', ...fields]]], table(name), condition, 'id');
        await check('mirror:entry_without_team_competition', 'review',
            [['team_entries', ['id', 'team_id', 'competition_id']], ['team_competitions', ['team_id', 'competition_id']]],
            `${table('team_entries')} e`, `NOT EXISTS (SELECT 1 FROM ${table('team_competitions')} c WHERE c.team_id=e.team_id AND c.competition_id=e.competition_id)`, 'e.id');
        await check('mirror:team_competition_without_entry', 'review',
            [['team_entries', ['team_id', 'competition_id']], ['team_competitions', ['team_id', 'competition_id']]],
            `${table('team_competitions')} c`, `NOT EXISTS (SELECT 1 FROM ${table('team_entries')} e WHERE c.team_id=e.team_id AND c.competition_id=e.competition_id)`, 'c.team_id, c.competition_id');
        await check('mirror:status_disagreement', 'review',
            [['team_entries', ['id', 'team_id', 'competition_id', 'status']], ['team_competitions', ['team_id', 'competition_id', 'status']]],
            `${table('team_entries')} e JOIN ${table('team_competitions')} c ON c.team_id=e.team_id AND c.competition_id=e.competition_id`,
            "COALESCE(e.status,'') <> COALESCE(c.status,'')", 'e.id');
        // Collect declared constraints without reading application payloads.
        report.schema.constraints = await select(`SELECT table_name AS table_name, constraint_name AS constraint_name,
            constraint_type AS constraint_type FROM information_schema.table_constraints WHERE table_schema = ${bind}`, [schema]);
        report.schema.indexes = provider === 'postgres'
            ? await select('SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition FROM pg_indexes WHERE schemaname=$1', [schema])
            : await select(`SELECT table_name AS table_name, index_name AS index_name, non_unique AS non_unique,
                column_name AS column_name, seq_in_index AS position FROM information_schema.statistics WHERE table_schema=?`, [schema]);
        if (provider === 'mysql') {
            report.schema.engines = await select(`SELECT table_name AS table_name, engine AS engine FROM information_schema.tables
                WHERE table_schema=? AND table_type='BASE TABLE'`, [schema]);
            if (report.schema.engines.some(t => t.engine !== 'InnoDB')) report.limitations.push('Non-InnoDB tables do not provide a consistent transactional snapshot.');
        }
        const histories = provider === 'postgres'
            ? [['volley_meta', 'schema_migrations'], ['volley_meta', 'seed_migrations']]
            : [[schema, 'schema_migrations'], [schema, 'seed_migrations']];
        report.migrations = [];
        for (const [historySchema, name] of histories) {
            const fields = await select(`SELECT column_name AS column_name FROM information_schema.columns
                WHERE table_schema=${bind} AND table_name=${provider === 'postgres' ? '$2' : '?'}`, [historySchema, name]);
            const field = fields.map(f => f.column_name).find(f => ['filename', 'name', 'migration'].includes(f));
            if (field) await collect(`history:${name}`, `SELECT ${q(field)} AS filename FROM ${q(historySchema)}.${q(name)} ORDER BY ${q(field)}`,
                rows => report.migrations.push({ table: name, files: rows }));
        }
        await client.query('ROLLBACK'); transaction = false;
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
        return report;
    } finally {
        if (client) {
            if (transaction) await client.query('ROLLBACK').catch(() => {});
            await client.end();
        }
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const envFile = args[args.indexOf('--env-file') + 1];
    const output = args[args.indexOf('--output') + 1];
    if (!args.includes('--env-file') || !args.includes('--output') || !envFile || !output) {
        console.error('Usage: node scripts/auditMasterData.js --env-file <file> --output <local-report.json>');
        process.exitCode = 1;
    } else {
        audit(dotenv.parse(fs.readFileSync(path.resolve(envFile))), path.resolve(output)).then(report => {
            console.log(JSON.stringify({ provider: report.provider, tables: report.tables.length,
                rows: report.tables.reduce((n, t) => n + t.count, 0),
                flaggedChecks: report.checks.filter(c => c.count > 0).length, skipped: report.skipped.length,
                output: path.resolve(output) }));
        }).catch(error => { console.error('Read-only audit failed:', error.code || 'AUDIT_FAILED'); process.exitCode = 1; });
    }
}

module.exports = { audit, baselineColumns };
