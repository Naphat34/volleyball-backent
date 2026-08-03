const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const migrationsDir = path.join(__dirname, '..', 'migrations');

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

const ensureMigrationsTable = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const listMigrationFiles = () => fs.readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const getAppliedMigrations = async (connection) => {
  const [rows] = await connection.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((row) => row.filename));
};

const showStatus = async (connection, files, applied) => {
  files.forEach((file) => {
    const marker = applied.has(file) ? 'applied' : 'pending';
    console.log(`${marker.padEnd(8)} ${file}`);
  });
};

const run = async () => {
  const statusOnly = process.argv.includes('--status');
  const connection = await createConnection();

  try {
    await ensureMigrationsTable(connection);

    const files = listMigrationFiles();
    const applied = await getAppliedMigrations(connection);

    if (statusOnly) {
      await showStatus(connection, files, applied);
      return;
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip     ${file}`);
        continue;
      }

      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8').trim();
      if (!sql) {
        console.log(`empty    ${file}`);
        await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
        continue;
      }

      console.log(`apply    ${file}`);
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        err.message = `Migration failed: ${file}\n${err.message}`;
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
