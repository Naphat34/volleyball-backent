const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareSql, normalizeResult, poolOptions, createDatabase } = require('../config/postgres');

test('bind markers preserve quoted text, identifiers, dollar strings and comments', () => {
    const sql = `SELECT '?', "?", $$?$$, $body$?$body$, id FROM teams -- ?\nWHERE id = ? /* ? */ AND name = ?`;
    const prepared = prepareSql(sql, [7, "O'Reilly"]);
    assert.equal(prepared.text, sql.replace('id = ?', 'id = $1').replace('name = ?', 'name = $2'));
    assert.deepEqual(prepared.values, [7, "O'Reilly"]);
    assert.deepEqual(prepareSql('SELECT $1::int', [7]), { text: 'SELECT $1::int', values: [7] });
    assert.throws(() => prepareSql('SELECT ?, $2', [1, 2]), /Mixed/);
    assert.throws(() => prepareSql('SELECT ?', []), /count mismatch/);
    assert.equal(prepareSql('SELECT $outer$ $inner$ ? $inner$ $outer$, ? /* outer /* ? */ ? */',[1]).text,
        'SELECT $outer$ $inner$ ? $inner$ $outer$, $1 /* outer /* ? */ ? */');
    assert.throws(()=>prepareSql('SELECT $2',[1,2]),/count mismatch/);
    assert.throws(()=>prepareSql('SELECT $tag$?$$'),/dollar quote/);
    assert.deepEqual(prepareSql('SELECT ?, ?',[true,false]).values,[1,0]);
});

test('result supports array destructuring and the existing rows/affectedRows contract', () => {
    const result = normalizeResult({ command: 'INSERT', rows: [{ id: 9 }], rowCount: 1 });
    const [rows] = result;
    assert.equal(rows, result.rows);
    assert.equal(result.insertId, 9);
    assert.equal(result.affectedRows, 1);
    assert.equal(normalizeResult({ command: 'INSERT', rows: [], rowCount: 1 }).insertId, null);
    assert.equal(normalizeResult({ command: 'UPDATE', rows: [], rowCount: 0 }).affectedRows, 0);
});

test('connection config verifies TLS and strips URL SSL overrides', () => {
    const options = poolOptions({ DATABASE_URL: 'postgresql://user:pass@localhost/db?sslmode=no-verify&options=search_path%3Dpublic' });
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
    assert.equal(new URL(options.connectionString).searchParams.has('options'), false);
    assert.match(options.options,/search_path=volley,public/);
    assert.equal(poolOptions({ DATABASE_URL: 'postgres://localhost/db', DB_SSL: 'false' }).ssl, false);
    assert.throws(() => poolOptions({}), /DATABASE_URL/);
    assert.throws(() => poolOptions({ DATABASE_URL: 'mysql://localhost/db' }), /PostgreSQL/);
    assert.throws(() => poolOptions({ DATABASE_URL: 'postgres://localhost/db', DB_POOL_MAX: '0' }), /positive integer/);
    assert.throws(() => poolOptions({ DATABASE_URL: 'postgres://localhost/db', DB_PG_SCHEMA: 'public;drop schema volley' }), /Invalid DB_PG_SCHEMA/);
});

test('transactions use one checked-out connection and preserve rollback/release', async () => {
    const calls = [];
    let options;
    const client = {
        async query(query) { calls.push(query); return { command: 'SELECT', rows: [{ id: 3 }], rowCount: 1 }; },
        release() { calls.push('release'); },
    };
    const driver = {
        types: { getTypeParser: () => value => value },
        Pool: class {
            constructor(config) { options = config; }
            on() {}
            async connect() { return client; }
            async query() { throw new Error('Transaction escaped its connection'); }
            async end() { calls.push('end'); }
        },
    };
    const db = createDatabase({ DATABASE_URL: 'postgres://localhost/db', DB_SSL: 'false' }, driver);
    const connection = await db.connect();
    await connection.beginTransaction();
    assert.equal((await connection.query('SELECT ? AS id', [3])).rows[0].id, 3);
    await connection.commit();
    await connection.beginTransaction();
    await connection.rollback();
    connection.release();
    await db.pool.end();
    assert.deepEqual(calls, ['BEGIN', { text: 'SELECT $1 AS id', values: [3] }, 'COMMIT', 'BEGIN', 'ROLLBACK', 'release', 'end']);
    assert.equal(options.types.getTypeParser(1082)('2026-11-13'), '2026-11-13');
    assert.equal(options.types.getTypeParser(20)('123'), 123);
    assert.throws(() => options.types.getTypeParser(20)('9007199254740993'), /safe integer/);
});

test('PostgreSQL integration: binds, returning, dates, rollback and duplicate constraint', {
    skip: process.env.RUN_POSTGRES_TESTS !== '1',
}, async () => {
    require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env'), quiet: true });
    const db = createDatabase();
    let connection;
    try {
        connection = await db.connect();
        await connection.beginTransaction();
        await connection.query('CREATE TEMP TABLE adapter_probe (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text UNIQUE, day date) ON COMMIT DROP');
        const inserted = await connection.query('INSERT INTO adapter_probe (name, day) VALUES (?, ?) RETURNING id, day', ['ทีมทดสอบ', '2026-11-13']);
        assert.equal(typeof inserted.insertId, 'number');
        assert.equal(inserted.rows[0].day, '2026-11-13');
        await connection.query('SAVEPOINT duplicate_probe');
        await assert.rejects(connection.query('INSERT INTO adapter_probe (name) VALUES (?)', ['ทีมทดสอบ']), { code: 'ER_DUP_ENTRY', pgCode: '23505' });
        await connection.query('ROLLBACK TO SAVEPOINT duplicate_probe');
        const count = await connection.query('SELECT COUNT(*) AS count FROM adapter_probe');
        assert.equal(count.rows[0].count, 1);
        await connection.rollback();
    } finally {
        if (connection) {
            try { await connection.rollback(); } finally { connection.release(); }
        }
        await db.pool.end();
    }
});
