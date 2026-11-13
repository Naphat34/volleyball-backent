// Read metadata only. Never export application rows or connection credentials.
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

async function exportSchema(destination) {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
        connectTimeout: 10000,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
    });
    try {
        const snapshot = {};
        for (const table of ['TABLES', 'COLUMNS', 'STATISTICS', 'KEY_COLUMN_USAGE', 'REFERENTIAL_CONSTRAINTS', 'TABLE_CONSTRAINTS', 'TRIGGERS']) {
            const schemaColumn = table === 'TRIGGERS' ? 'TRIGGER_SCHEMA' : table === 'REFERENTIAL_CONSTRAINTS' ? 'CONSTRAINT_SCHEMA' : 'TABLE_SCHEMA';
            const [rows] = await connection.query(`SELECT * FROM information_schema.${table} WHERE ${schemaColumn} = DATABASE()`);
            // Remove environment identifiers and volatile counters, retaining schema definitions.
            snapshot[table] = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) =>
                !/SCHEMA$|^DEFINER$|^TABLE_ROWS$|^AUTO_INCREMENT$|^(DATA_LENGTH|INDEX_LENGTH|AVG_ROW_LENGTH|DATA_FREE)$|_TIME$|^CHECKSUM$/.test(key))));
        }
        const [checks] = await connection.query(`SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS cc WHERE cc.CONSTRAINT_SCHEMA = DATABASE()`);
        snapshot.CHECK_CONSTRAINTS = checks;
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, JSON.stringify(snapshot, null, 2) + '\n');
        console.log(`Exported metadata for ${snapshot.TABLES.length} tables to ${destination}`);
    } finally { await connection.end(); }
}

if (require.main === module) exportSchema(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../../tmp/mysql-schema.json'))
    .catch(error => { console.error('Schema export failed:', error.code || error.name); process.exitCode = 1; });
module.exports = { exportSchema };
