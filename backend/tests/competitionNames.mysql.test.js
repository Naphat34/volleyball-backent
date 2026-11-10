const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
test('migration 39 stores bilingual names and exact dates in the actual MySQL schema', { skip: process.env.RUN_COMPETITION_DB_TESTS !== '1' }, async () => {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined });
    try {
        // Connection-scoped temporary copy: no real competition rows are created.
        await connection.query('CREATE TEMPORARY TABLE competition_names_test LIKE competitions');
        await connection.query(`INSERT INTO competition_names_test (title,title_th,title_en,short_title_en,details_th,details_en,gender,start_date,end_date,max_sets,max_players,status,sport)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, ['ทดสอบ', 'ทดสอบ', 'Test Championship', 'TEST', 'รายละเอียด', 'Description', 'Male', '2026-12-01', '2026-12-02', 3, 14, 'closed', 'Volleyball']);
        const [rows] = await connection.query("SELECT title_th,title_en,short_title_en,details_en,DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date FROM competition_names_test");
        assert.equal(rows[0].title_th, 'ทดสอบ');
        assert.equal(rows[0].title_en, 'Test Championship');
        assert.equal(rows[0].start_date, '2026-12-01');
        assert.equal(rows[0].details_en, 'Description');
    } finally { await connection.end(); }
});
