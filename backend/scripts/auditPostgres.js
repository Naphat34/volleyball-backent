const fs = require('node:fs');
const path = require('node:path');

const rules = [
    ['MySQL aggregate/date functions', /\b(GROUP_CONCAT|DATE_FORMAT|IFNULL|DATEDIFF|TIMESTAMPDIFF|DATE_ADD|DATE_SUB)\s*\(/i],
    ['MySQL upsert/ignore', /\bINSERT\s+IGNORE\b|\bON\s+DUPLICATE\s+KEY\b/i],
    ['MySQL schema inspection', /\bDATABASE\s*\(|\bSHOW\s+COLUMNS\b/i],
    ['MySQL JSON/conversion', /\b(JSON_[A-Z_]+|CONVERT)\s*\(|\bCOLLATE\s+utf8mb4/i],
    ['SQL conditional (review)', /\bIF\s*\(/],
    ['MySQL casts/regex', /\bAS\s+(SIGNED|UNSIGNED|CHAR)\b|\bREGEXP\b/i],
    ['MySQL schema syntax', /\bAUTO_INCREMENT\b|\bENUM\s*\(|\bMODIFY\s+COLUMN\b|\bDELIMITER\b/i],
    ['MySQL error handling', /\bER_[A-Z_]+\b/],
    ['Insert result needs RETURNING', /\.insertId\b/],
    ['Direct MySQL dependency', /require\(['"]mysql2/],
];

function audit(root) {
    const findings = [];
    function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory() && entry.name !== 'debug') visit(filename);
            else if (/\.(js|sql)$/.test(entry.name)) {
                fs.readFileSync(filename, 'utf8').split(/\r?\n/).forEach((line, index) => {
                    for (const [reason, pattern] of rules) if (pattern.test(line)) {
                        // Print locations and categories only; never SQL or data values.
                        findings.push({ file: path.relative(root, filename).replaceAll('\\', '/'), line: index + 1, reason });
                    }
                });
            }
        }
    }
    for (const folder of ['controllers', 'utils', 'middleware', 'migrations', 'seeds', 'scripts']) visit(path.join(root, folder));
    return findings.filter(item => item.file !== 'scripts/auditPostgres.js');
}

if (require.main === module) {
    const findings = audit(path.join(__dirname, '..'));
    if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
    else {
        for (const finding of findings) console.log(`${finding.file}:${finding.line} ${finding.reason}`);
        console.log(`\n${findings.length} review findings, including retained MySQL alternatives and historical migrations. This inventory is not a PostgreSQL readiness gate. Run npm run test:postgres for native SQL and workflow validation.`);
    }
    if (process.argv.includes('--check') && findings.length) process.exitCode = 1;
}

module.exports = { audit };
