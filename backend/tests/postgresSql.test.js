const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const { setup } = require('./helpers/postgresHarness');
const { prepareSql } = require('../config/postgres');
const backend = path.join(__dirname, '..');

function staticQueries() {
    const queries = [];
    for (const folder of ['controllers', 'utils', 'middleware']) for (const file of fs.readdirSync(path.join(backend, folder)).filter(file=>file.endsWith('.js'))) {
        const code=fs.readFileSync(path.join(backend,folder,file),'utf8');
        function visit(node, parent) {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'CallExpression' && (node.callee.name || node.callee.property?.name) === 'sqlDialect') { visit(node.arguments[1], node); return; }
            const sql=node.type==='StringLiteral'?node.value:node.type==='TemplateLiteral'&&!node.expressions.length?node.quasis[0].value.cooked:null;
            if (parent?.type==='CallExpression' && !['query','sqlDialect'].includes(parent.callee.property?.name || parent.callee.name)) return;
            if (sql && /^\s*(SELECT\b[\s\S]*\bFROM\b|INSERT\s+(INTO|IGNORE)\b|UPDATE\s+\w+\s+SET\b|DELETE\s+FROM\b)/i.test(sql) && parent?.type !== 'BinaryExpression') {
                // Only complete literals: dynamic statement prefixes are reviewed by workflow tests.
                if (/^\s*UPDATE\s+\w+\s+SET\s*$/i.test(sql)) return;
                queries.push({ sql, location: `${folder}/${file}:${node.loc.start.line}` });
            }
            for (const [key,value] of Object.entries(node)) {
                if (['loc','start','end','extra'].includes(key)) continue;
                if (Array.isArray(value)) value.forEach(n=>visit(n,node)); else if (value && typeof value==='object') visit(value,node);
            }
        }
        visit(parser.parse(code,{sourceType:'script'}));
    }
    return queries;
}

test('PostgreSQL plans complete static SQL from the real application against the migrated schema', async t => {
    const harness=await setup();
    const db=harness.db;
    try {
        const failures=[];
        const queries=staticQueries();
        for(const {sql,location} of queries) {
            // Prepare with null binds; EXPLAIN plans writes without executing them.
            const markers=prepareSql(sql,Array((sql.match(/\?/g)||[]).length).fill(null));
            const numbered=Math.max(0,...[...markers.text.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])));
            try { await db.query('EXPLAIN '+markers.text,Array(numbered).fill(null)); }
            catch(error) { failures.push(`${location} [${error.code}] ${error.message}`); }
        }
        assert.ok(queries.length>150, `Expected substantial query coverage, found ${queries.length}`);
        t.diagnostic(`Planned ${queries.length} complete static SQL literals; dynamic SQL is covered separately by workflow tests`);
        assert.deepEqual(failures,[]);
        t.diagnostic(harness.staging?'Target: Supabase staging, isolated schema':'Target: local PGlite PostgreSQL');
    } finally { await harness.close(); }
});

module.exports={staticQueries};
