// Staging adapter. SQL dialect/schema migration is tracked separately.
const fs = require('node:fs');

// Replace bind markers only in SQL code, never in literals, identifiers or comments.
function prepareSql(sql, params = []) {
    if (typeof sql !== 'string' || !Array.isArray(params)) throw new TypeError('Expected SQL string and parameter array');
    let count = 0;
    const numbered = new Set();
    let text = '';
    for (let i=0; i<sql.length;) {
        const start=i;
        if (sql.startsWith('--',i)) {
            const end=sql.indexOf('\n',i); i=end<0?sql.length:end;
        } else if (sql.startsWith('/*',i)) {
            let depth=1; i+=2;
            while(i<sql.length && depth) {
                if(sql.startsWith('/*',i)){depth++;i+=2;}
                else if(sql.startsWith('*/',i)){depth--;i+=2;}
                else i++;
            }
            if(depth)throw Error('Unterminated SQL comment');
        } else if (sql[i]==="'" || sql[i]==='"') {
            const quote=sql[i++];
            const escaped=quote==="'" && /(^|[^\w])E$/i.test(sql.slice(0,start));
            let closed=false;
            while(i<sql.length) {
                if(escaped && sql[i]==='\\'){i+=2;continue;}
                if(sql[i++]===quote){if(sql[i]===quote)i++;else {closed=true;break;}}
            }
            if(!closed)throw Error('Unterminated SQL quote');
        } else if (sql[i]==='$') {
            const tag=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
            const bind=sql.slice(i).match(/^\$(\d+)/);
            if(tag) {
                const end=sql.indexOf(tag,i+tag.length);
                if(end<0)throw Error('Unterminated SQL dollar quote');
                i=end+tag.length;
            } else if(bind) {numbered.add(Number(bind[1]));i+=bind[0].length;}
            else i++;
        } else if (sql[i]==='?') {text+=`$${++count}`;i++;continue;}
        else i++;
        text+=sql.slice(start,i);
    }
    if (numbered.size && count) throw new Error('Mixed SQL placeholder styles are not supported');
    const expected=numbered.size?Math.max(...numbered):count;
    if (expected!==params.length || (numbered.size && (numbered.has(0) || numbered.size!==expected))) throw new Error('SQL parameter count mismatch');
    // Source schema uses numeric 0/1 flags, including booleans received from React.
    return { text, values: params.map(value => typeof value === 'boolean' ? Number(value) : value) };
}

function normalizeResult(result) {
    const rows = result.rows || [];
    const output = [rows];
    Object.assign(output, {
        rows, rowCount: result.rowCount, affectedRows: result.rowCount,
        insertId: result.command === 'INSERT' ? rows[0]?.id ?? null : null,
        fields: result.fields || [],
    });
    return output;
}

function poolOptions(env) {
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL');
    const url = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL connection string');
    // Prevent URL parameters from overriding certificate verification in node-postgres.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'options']) url.searchParams.delete(key);
    const max = Number(env.DB_POOL_MAX || 10);
    const schema = env.DB_PG_SCHEMA || 'volley';
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid DB_PG_SCHEMA');
    if (!Number.isInteger(max) || max < 1) throw new Error('DB_POOL_MAX must be a positive integer');
    return {
        connectionString: url.toString(), max,
        options: `-c search_path=${schema},public -c timezone=Asia/Bangkok`,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        ssl: env.DB_SSL === 'false' ? false : {
            rejectUnauthorized: true,
            ...(env.DB_SSL_CA_FILE ? { ca: fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8') } : {}),
        },
    };
}

function createDatabase(env = process.env, driver = require('pg')) {
    const types = { getTypeParser(oid, format) {
        if (format !== 'binary' && oid === 1082) return value => value;
        if (format !== 'binary' && oid === 20) return value => {
            const number = Number(value);
            if (!Number.isSafeInteger(number)) throw new RangeError('Database bigint exceeds JavaScript safe integer range');
            return number;
        };
        return driver.types.getTypeParser(oid, format);
    } };
    const nativePool = new driver.Pool({ ...poolOptions(env), types });
    nativePool.on('error', error => console.error('PostgreSQL idle connection error:', error.code));
    const queryOn = async (target, sql, params) => {
        try { return normalizeResult(await target.query(prepareSql(sql, params))); }
        catch (error) { throw normalizeError(error); }
    };
    const query = (sql, params) => queryOn(nativePool, sql, params);
    const connect = async () => {
        const client = await nativePool.connect();
        return {
            query: (sql, params) => queryOn(client, sql, params),
            beginTransaction: () => client.query('BEGIN'),
            commit: () => client.query('COMMIT'),
            rollback: () => client.query('ROLLBACK'),
            release: () => client.release(),
        };
    };
    return { query, connect, pool: { query, connect, getConnection: connect, end: () => nativePool.end() } };
}

function normalizeError(error) {
    // Preserve existing controller status codes/retry policies during transition.
    const codes = {
        '23505': 'ER_DUP_ENTRY', '23503': 'ER_ROW_IS_REFERENCED_2', '23001': 'ER_ROW_IS_REFERENCED_2',
        '23514': 'ER_CHECK_CONSTRAINT_VIOLATED', '40P01': 'ER_LOCK_DEADLOCK',
        '42P01': 'ER_NO_SUCH_TABLE', '42703': 'ER_BAD_FIELD_ERROR',
    };
    if (codes[error.code]) {
        error.pgCode = error.code;
        error.code = codes[error.code];
    }
    return error;
}

module.exports = { prepareSql, normalizeResult, poolOptions, createDatabase, normalizeError };
