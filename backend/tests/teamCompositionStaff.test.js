const test = require('node:test');
const assert = require('node:assert/strict');
const { teamCompositionStaff } = require('../utils/teamCompositionStaff');
test('explicit entry assignments take precedence over team defaults', async () => {
    let count = 0;
    const assigned = [{ id: 3, selected: 1, role: 'Head Coach' }];
    const result = await teamCompositionStaff({ query: async () => { count++; return { rows: assigned }; } }, 83);
    assert.equal(result.source, 'entry');
    assert.equal(result.staff, assigned);
    assert.equal(count, 1);
});
test('missing assignment uses only unassigned staff of the same team without changing registration', async () => {
    const calls = [];
    const database = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: 5, selected: 1 }] }; } };
    const result = await teamCompositionStaff(database, 83, []);
    assert.equal(result.source, 'team');
    assert.equal(result.staff[0].id, 5);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /s.team_id=te.team_id/);
    assert.match(calls[0].sql, /NOT EXISTS.*team_entry_staff/);
    assert.deepEqual(calls[0].params, [83]);
    assert.ok(!calls.some(call => /INSERT|UPDATE|DELETE/.test(call.sql)));
});
test('teams with no eligible staff remain empty instead of inventing a coach', async () => {
    const result = await teamCompositionStaff({ query: async () => ({ rows: [] }) }, 83, []);
    assert.equal(result.source, 'none');
    assert.deepEqual(result.staff, []);
});
