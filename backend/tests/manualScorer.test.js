const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeManualMatch, assertReady, canManage } = require('../utils/manualScorer');
const players = () => Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: `Player ${i}`, last_name: '', position: '', is_captain: i === 0 }));
const fixture = () => ({ maxSets: 3, home: { name: 'Home', players: players() }, away: { name: 'Away', players: players() } });
test('manual drafts need only team names, while ready matches require regular players and captains', () => {
    const draft = normalizeManualMatch({ home: { name: 'H', players: [] }, away: { name: 'A', players: [] } });
    assert.equal(draft.pointsPerSet, 25); assert.equal(draft.decidingSetPoints, 15);
    assert.throws(() => assertReady(draft), /6/);
    assert.doesNotThrow(() => assertReady(normalizeManualMatch(fixture())));
    const data = fixture(); data.home.players[0].position = 'L';
    assert.throws(() => assertReady(normalizeManualMatch(data)), /6/);
});
test('reject invalid dates, rules, duplicate numbers, captain and libero limits', () => {
    for (const change of [{ date: '2026-02-30' }, { time: '25:00' }, { maxSets: 4 }, { pointsPerSet: 0 }, { decidingSetPoints: 1.5 }]) {
        assert.throws(() => normalizeManualMatch({ ...fixture(), ...change }));
    }
    const duplicate = fixture(); duplicate.home.players[1].number = '1';
    assert.throws(() => normalizeManualMatch(duplicate), /ซ้ำ/);
    const captains = fixture(); captains.home.players[1].is_captain = true;
    assert.throws(() => normalizeManualMatch(captains), /กัปตัน/);
    const liberos = fixture(); liberos.away.players.slice(0, 3).forEach(p => { p.position = 'L'; });
    assert.throws(() => normalizeManualMatch(liberos), /Libero/);
});
test('only the owner or admin may manage a manual match', () => {
    assert.equal(canManage({ id: 4, role: 'scorer' }, { manual_owner_id: 4 }), true);
    assert.equal(canManage({ id: 5, role: 'scorer' }, { manual_owner_id: 4 }), false);
    assert.equal(canManage({ id: 5, role: 'admin' }, { manual_owner_id: 4 }), true);
    assert.equal(canManage(null, { manual_owner_id: 4 }), false);
});
