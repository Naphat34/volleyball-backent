const test = require('node:test');
const assert = require('node:assert/strict');
const {assertAdminRecordingPolicy: check} = require('../utils/adminRecordingPolicy');
test('admin cannot bypass recording restrictions through match management', () => {
 for (const body of [{home_set_score: 2}, {set_scores: ['25-20']}, {live_state: {home: 10}}, {winner_team_id: 8}, {home_lineup: [1]}]) assert.throws(() => check({role:'admin'}, body), {statusCode:403});
 assert.doesNotThrow(() => check({role:'admin'}, {location:'Court 2', home_set_score:'2', set_scores:'["25-20"]'}, {home_set_score:2, set_scores:['25-20']}));
 assert.doesNotThrow(() => check({role:'admin'}, {home_set_score:0, set_scores:[]}));
 assert.doesNotThrow(() => check({role:'scorer'}, {home_set_score:2}));
});
