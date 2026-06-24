const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: 'postgres://postgres:vb11421@localhost:5432/volleyball_db',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'matches'
      ORDER BY ordinal_position;
    `);
    console.log("COLUMNS:");
    res.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
