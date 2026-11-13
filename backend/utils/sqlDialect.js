// Explicit query alternatives keep the existing MySQL deployment working during cutover.
function sqlDialect(mysql, postgres) {
    return process.env.DB_PROVIDER === 'postgres' ? postgres : mysql;
}
module.exports = { sqlDialect };
