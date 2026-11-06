import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVisMatchList } from './visMatchList.js';

const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
let sequence = 0;
const freshPage = () => import(`./visMatchGate.js?page=${++sequence}`);

test('refresh restores server matches automatically after one successful explicit fetch', async () => {
    globalThis.sessionStorage = storage();
    const first = await freshPage();
    const gate = first.getVisMatchGate('7:1');
    assert.equal(gate.serverMatchesLoaded, false);
    gate.serverMatchesLoaded = true;
    const refreshed = await freshPage();
    // The in-memory auth version restarts after a page reload; account identity remains the same.
    const restored = refreshed.getVisMatchGate('7:0');
    assert.equal(restored.serverMatchesLoaded, true);
    let serverReads = 0;
    const result = await loadVisMatchList({ includeServerMatches: restored.serverMatchesLoaded, offline: false,
        readLocal: async () => [], getCustom: async () => [],
        getRegular: async () => { serverReads++; return [{ id: 42 }]; } });
    assert.equal(serverReads, 1);
    assert.deepEqual(result.data, [{ id: 42 }]);
});

test('logout, new login, and another account cannot reuse the previous fetch choice', async () => {
    globalThis.sessionStorage = storage();
    const first = await freshPage();
    first.getVisMatchGate('7:1').serverMatchesLoaded = true;
    assert.equal(first.getVisMatchGate('7:2').serverMatchesLoaded, false);
    first.getVisMatchGate('7:2').serverMatchesLoaded = true;
    const otherPage = await freshPage();
    assert.equal(otherPage.getVisMatchGate('8:0').serverMatchesLoaded, false);
    first.clearVisMatchGate();
    const afterLogout = await freshPage();
    assert.equal(afterLogout.getVisMatchGate('7:0').serverMatchesLoaded, false);
});

test('blocked or malformed storage keeps the page usable and remembers the choice in memory', async () => {
    globalThis.sessionStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
    const page = await freshPage();
    const gate = page.getVisMatchGate('7:0');
    gate.serverMatchesLoaded = true;
    assert.equal(page.getVisMatchGate('7:0').serverMatchesLoaded, true);
    assert.doesNotThrow(() => page.clearVisMatchGate());
    globalThis.sessionStorage = { getItem: () => 'invalid json' };
    const malformed = await freshPage();
    assert.equal(malformed.getVisMatchGate('7:0').serverMatchesLoaded, false);
});
