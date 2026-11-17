const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const db = require('../config/db');

async function run() {
    const postgres = process.env.DB_PROVIDER === 'postgres';
    const filename = postgres ? '005_bilingual_official_names.sql' : '42_add_bilingual_official_names.sql';
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', postgres ? 'postgres' : '', filename), 'utf8');
    const connection = await db.connect();
    try {
        if (postgres) await connection.query('BEGIN');
        // Use one connection for MySQL PREPARE session variables.
        for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await connection.query(statement);
        if (postgres) {
            await connection.query('CREATE SCHEMA IF NOT EXISTS volley_meta');
            await connection.query('REVOKE ALL ON SCHEMA volley_meta FROM PUBLIC');
            await connection.query('CREATE TABLE IF NOT EXISTS volley_meta.schema_migrations (filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
            const checksum = createHash('sha256').update(sql).digest('hex');
            const previous = await connection.query('SELECT checksum FROM volley_meta.schema_migrations WHERE filename = ?', [filename]);
            if (previous.rows.length && previous.rows[0].checksum !== checksum) throw Error('Applied migration checksum mismatch');
            await connection.query('INSERT INTO volley_meta.schema_migrations (filename, checksum) VALUES (?, ?) ON CONFLICT (filename) DO NOTHING', [filename, checksum]);
            await connection.query('COMMIT');
        } else {
            await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
            await connection.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [filename]);
        }
        const result = await connection.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = " + (postgres ? "current_schema()" : "DATABASE()") + " AND table_name IN ('referees', 'scorers', 'line_judges') AND column_name IN ('firstname_en', 'lastname_en') ORDER BY table_name, column_name");
        console.log(JSON.stringify(result.rows));
    } catch (error) {
        if (postgres) await connection.query('ROLLBACK');
        throw error;
    } finally {
        connection.release();
        await db.pool.end();
    }
}
run().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
