import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVisMatchList } from './visMatchList.js';
import { getVisMatchGate } from './visMatchGate.js';
function fixture() {
    const calls = { regular: 0, custom: 0, direct: 0 };
    const options = { offline: false,
        readLocal: async () => [{ id: 'local-admin-7', server_id: '7', is_offline_vis: true }],
        getRegular: async () => { calls.regular++; return [{ id: 7 }, { id: 8 }]; },
        getCustom: async () => { calls.custom++; return [{ id: 'custom-own', is_custom_vis: true }]; },
        getRegularMatch: async id => { calls.direct++; return { id: Number(id) }; },
    };
    return { options, calls };
}
test('initial load and automatic refresh show custom/local matches without requesting Admin matches', async () => {
    const { options, calls } = fixture();
    for (let refresh = 0; refresh < 2; refresh++) {
        const result = await loadVisMatchList(options);
        assert.deepEqual(result.data.map(match => match.id), ['custom-own', 'local-admin-7']);
        assert.equal(result.serverMatchCount, 0);
    }
    assert.equal(calls.regular, 0); assert.equal(calls.direct, 0); assert.equal(calls.custom, 2);
});
test('explicit fetch counts all Admin matches before local replacement and subsequent refresh does not duplicate rows', async () => {
    const { options, calls } = fixture();
    const fetched = await loadVisMatchList({ ...options, fromServer: true });
    assert.equal(fetched.serverMatchCount, 2);
    assert.deepEqual(fetched.data.map(match => match.id), [8, 'custom-own', 'local-admin-7']);
    const refreshed = await loadVisMatchList({ ...options, includeServerMatches: true });
    assert.deepEqual(refreshed.data, fetched.data); assert.equal(calls.regular, 2);
});
test('direct Admin match links load only their target and do not enable the dashboard list', async () => {
    const { options, calls } = fixture(), gate = getVisMatchGate('direct-link-session');
    const result = await loadVisMatchList({ ...options, matchId: '8' });
    assert.equal(calls.regular, 0); assert.equal(calls.direct, 1);
    assert.equal(result.data[0].id, 8); assert.equal(gate.serverMatchesLoaded, false);
});
test('failed fetch stays rejected; Offline loads only local records and rejects an explicit server fetch', async () => {
    const { options, calls } = fixture();
    await assert.rejects(loadVisMatchList({ ...options, fromServer: true, getRegular: async () => { throw Error('server unavailable'); } }), /unavailable/);
    const result = await loadVisMatchList({ ...options, offline: true });
    assert.deepEqual(result.data.map(match => match.id), ['local-admin-7']);
    assert.equal(calls.regular, 0);
    await assert.rejects(loadVisMatchList({ ...options, offline: true, fromServer: true }), /Offline/);
});
test('fetch choice survives route remounts but resets on a different login session', () => {
    const gate = getVisMatchGate('7:login-one'); gate.serverMatchesLoaded = true;
    assert.equal(getVisMatchGate('7:login-one').serverMatchesLoaded, true);
    assert.equal(getVisMatchGate('7:login-two').serverMatchesLoaded, false);
    assert.equal(getVisMatchGate('8:login-two').serverMatchesLoaded, false);
});
