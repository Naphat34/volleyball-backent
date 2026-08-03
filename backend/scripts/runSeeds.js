const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const seedsDir = path.join(__dirname, '..', 'seeds');

const createConnection = () => mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  ssl: process.env.DB_SSL === 'false'
    ? undefined
    : { rejectUnauthorized: false },
});

const ensureSeedsTable = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS seed_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const listSeedFiles = () => fs.existsSync(seedsDir)
  ? fs.readdirSync(seedsDir).filter((file) => file.endsWith('.sql')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  : [];

const getAppliedSeeds = async (connection) => {
  const [rows] = await connection.query('SELECT filename FROM seed_migrations');
  return new Set(rows.map((row) => row.filename));
};

const run = async () => {
  const statusOnly = process.argv.includes('--status');
  const connection = await createConnection();

  try {
    await ensureSeedsTable(connection);
    const files = listSeedFiles();
    const applied = await getAppliedSeeds(connection);

    if (statusOnly) {
      files.forEach((file) => {
        const marker = applied.has(file) ? 'applied' : 'pending';
        console.log(`${marker.padEnd(8)} ${file}`);
      });
      return;
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip     ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8').trim();
      console.log(`apply    ${file}`);
      await connection.beginTransaction();
      try {
        if (sql) await connection.query(sql);
        await connection.query('INSERT INTO seed_migrations (filename) VALUES (?)', [file]);
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        err.message = `Seed failed: ${file}\n${err.message}`;
        throw err;
      }
    }
  } finally {
    await connection.end();
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
