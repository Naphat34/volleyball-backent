// Check first; apply only migration 36, never unrelated pending migrations.
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const checks = {
    entryNumbers: 'SELECT team_entry_id,number FROM team_entry_players WHERE number IS NOT NULL GROUP BY team_entry_id,number HAVING COUNT(*)>1',
    nationalIds: 'SELECT COUNT(*) FROM players WHERE national_id IS NOT NULL GROUP BY national_id HAVING COUNT(*)>1',
    masterRoles: "SELECT id FROM players WHERE (COALESCE(is_libero1,0)=1 AND COALESCE(is_libero2,0)=1) OR ((COALESCE(is_libero1,0)=1 OR COALESCE(is_libero2,0)=1) AND COALESCE(position,'')<>'L')",
    entryRoles: "SELECT id FROM team_entry_players WHERE (is_libero1=1 AND is_libero2=1) OR (is_libero1=1 AND COALESCE(role,'') NOT IN ('L','L1','L1+C')) OR (is_libero2=1 AND COALESCE(role,'') NOT IN ('L','L2','L2+C')) OR (role IN ('L1','L1+C') AND is_libero1<>1) OR (role IN ('L2','L2+C') AND is_libero2<>1)",
};
for (const [table, scope] of [['players', 'team_id'], ['team_entry_players', 'team_entry_id']]) {
    for (const role of ['captain', 'libero1', 'libero2']) checks[`${table}_${role}`] = `SELECT ${scope} FROM ${table} WHERE is_${role}=1 ${table === 'players' ? 'AND COALESCE(is_active,1)=1' : ''} GROUP BY ${scope} HAVING COUNT(*)>1`;
}
async function run() {
    const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined });
    try {
        for (const [name, sql] of Object.entries(checks)) {
            const [rows] = await connection.query(sql);
            console.log(`${name}: ${rows.length} conflict groups`);
            if (rows.length) throw Error('Resolve existing athlete conflicts before migration; no data was repaired automatically.');
        }
        if (!process.argv.includes('--apply')) return;
        const filename = '36_enforce_athlete_integrity.sql';
        await connection.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', filename), 'utf8'));
        await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        await connection.query('INSERT IGNORE INTO schema_migrations(filename) VALUES(?)', [filename]);
        console.log('Migration 36 applied.');
    } finally { await connection.end(); }
}
if (require.main === module) run().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { checks };
