const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const provider = process.env.DB_PROVIDER || 'mysql';
if (!['mysql', 'postgres'].includes(provider)) throw new Error('DB_PROVIDER must be mysql or postgres');
if (provider === 'postgres' && process.env.DB_POSTGRES_PREVIEW !== 'true') {
    throw new Error('PostgreSQL migration is not production-ready. Set DB_POSTGRES_PREVIEW=true only in staging; see SUPABASE_MIGRATION.md');
}
module.exports = provider === 'postgres'
    ? require('./postgres').createDatabase()
    : require('./mysql');
