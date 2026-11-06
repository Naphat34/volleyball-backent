const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('admin CSV and Excel exports preserve Unicode and neutralize spreadsheet formulas', async () => {
    const scope = { exports: {}, Buffer, console, require: () => ({ query: async () => ({ rows: [{ id: 1, name: '=SUM(1,2)', code: 'ทีมทดสอบ' }] }) }) };
    vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/reportController'), 'utf8'), scope);
    for (const format of ['csv', 'xls']) {
        let body;
        await scope.exports.exportReport({ params: { type: 'teams', format } }, { setHeader() {}, send(value) { body = value; }, status() { return this; }, json(value) { throw Error(JSON.stringify(value)); } });
        assert.ok(body.includes('ทีมทดสอบ'));
        assert.ok(body.includes("'=SUM(1,2)"));
        if (format === 'csv') assert.ok(body.startsWith('\ufeff'));
    }
});
