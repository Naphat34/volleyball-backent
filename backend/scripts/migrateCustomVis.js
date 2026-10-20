// Install only the additive custom VIS migration; do not run older pending migrations.
const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');
async function run() {
    try {
        const filename = '32_create_custom_vis_matches.sql';
        await db.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', filename), 'utf8'));
        await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        await db.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [filename]);
        console.log('Migration 32 applied successfully');
    } finally { await db.pool.end(); }
}
run().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
