// Apply only migration 37, never unrelated pending migrations.
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
async function run() {
    const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined });
    try {
        if (!process.argv.includes('--apply')) { console.log('Use --apply to install bilingual name columns.'); return; }
        const filename = '37_add_bilingual_athlete_team_names.sql';
        await connection.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', filename), 'utf8'));
        await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        await connection.query('INSERT IGNORE INTO schema_migrations(filename) VALUES(?)', [filename]);
        console.log('Migration 37 applied.');
    } finally { await connection.end(); }
}
if (require.main === module) run().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });

