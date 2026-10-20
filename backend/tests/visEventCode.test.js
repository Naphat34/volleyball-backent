const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatVisEventCode, getVisJerseyNumber } = require('../utils/visEventCode');

test('VIS codes use skill, jersey number and grade, accepting skill aliases', () => {
    assert.equal(formatVisEventCode('S', 21, '#'), 'S21#');
    assert.equal(formatVisEventCode('attack', '12', '='), 'A12=');
    assert.equal(formatVisEventCode('R', 7, '+'), 'R7+');
    for (const value of [null, undefined, '', 'unknown', -1, 1.5]) assert.equal(formatVisEventCode('S', value, '#'), null);
    assert.equal(formatVisEventCode('TIMEOUT', 21, '#'), null);
    assert.equal(formatVisEventCode('S', 21, 'invalid'), null);
});

test('jersey lookup scopes entry numbers to the match competition, age and gender', async () => {
    const calls = [];
    const connection = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ jersey_number: 21 }] }; } };
    assert.equal(await getVisJerseyNumber(connection, { competition_id: 8, effective_age_group_id: 3, effective_gender: 'Female' }, 10, 1234), 21);
    assert.deepEqual(calls[0].params, [8, 3, 3, 'Female', 'Female', 1234, 10]);
    assert.match(calls[0].sql, /COALESCE\(\([\s\S]*\), p.number\)/);
});
