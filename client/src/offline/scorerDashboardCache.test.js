import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { readDashboardCache, writeDashboardCache, mergeRefereeMatches, readDashboardPreferences, writeDashboardPreferences } from './scorerDashboardCache.js';

const snapshot = { matches: [{ id: 42, competition_id: 1 }], competitions: [{ id: 1, title: 'Cup' }] };
test('dashboard snapshot survives a module reload (F5) and includes fetch time', async () => {
    globalThis.indexedDB = new IDBFactory();
    assert.equal(await readDashboardCache(7, 'scorer', 'server'), null);
    await writeDashboardCache(7, 'scorer', 'server', snapshot);
    const reloaded = await import('./scorerDashboardCache.js?reload-test');
    const cached = await reloaded.readDashboardCache(7, 'scorer', 'server');
    assert.deepEqual(cached.matches, snapshot.matches);
    assert.deepEqual(cached.competitions, snapshot.competitions);
    assert.ok(Number.isFinite(Date.parse(cached.updatedAt)));
});
test('snapshots are isolated by account, role and source', async () => {
    globalThis.indexedDB = new IDBFactory();
    await writeDashboardCache(7, 'scorer', 'server', snapshot);
    for (const scope of [[8, 'scorer', 'server'], [7, 'referee', 'server'], [7, 'scorer', 'manual']]) {
        assert.equal(await readDashboardCache(...scope), null);
    }
    await writeDashboardCache(7, 'scorer', 'manual', { matches: [{ id: 99 }], competitions: [] });
    assert.equal((await readDashboardCache(7, 'scorer', 'server')).matches[0].id, 42);
});
test('successfully fetched empty lists remain distinguishable from never fetched', async () => {
    globalThis.indexedDB = new IDBFactory();
    await writeDashboardCache(7, 'scorer', 'server', { matches: [], competitions: [] });
    assert.deepEqual((await readDashboardCache(7, 'scorer', 'server')).matches, []);
});
test('invalid writes do not replace a previous snapshot', async () => {
    globalThis.indexedDB = new IDBFactory();
    await writeDashboardCache(7, 'scorer', 'server', snapshot);
    await assert.rejects(writeDashboardCache(7, 'scorer', 'server', { matches: null, competitions: [] }));
    assert.equal((await readDashboardCache(7, 'scorer', 'server')).matches[0].id, 42);
});
test('partial referee updates preserve failed competitions and replace successful ones', () => {
    const previous = [{ id: 1, competition_id: 1 }, { id: 2, competition_id: 2 }, { id: 3, competition_id: 3 }];
    const result = mergeRefereeMatches([{ id: 1 }, { id: 2 }], [
        { status: 'fulfilled', value: { data: [{ id: 10 }] } }, { status: 'rejected', reason: Error('network') },
    ], previous);
    assert.deepEqual(result.matches.map(row => row.id), [10, 2]);
    assert.equal(result.matches[1].dashboard_stale, true);
    assert.deepEqual(result.partialCompetitionIds, ['2']);
});
test('an empty successful response removes old rows only from that competition', () => {
    const result = mergeRefereeMatches([{ id: 1 }, { id: 2 }], [
        { status: 'fulfilled', value: { data: [] } }, { status: 'fulfilled', value: { data: null } },
    ], [{ id: 1, competition_id: 1 }, { id: 2, competition_id: 2 }]);
    assert.deepEqual(result.matches.map(row => row.id), [2]);
    assert.deepEqual(result.partialCompetitionIds, ['2']);
});
test('all failed referee reads retain the previous open-competition rows', () => {
    const result = mergeRefereeMatches([{ id: 1 }], [{ status: 'rejected' }], snapshot.matches);
    assert.equal(result.matches[0].id, 42);
});
test('filters and pagination survive reload and are isolated by account', () => {
    const entries = new Map();
    globalThis.sessionStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
    const preferences = { search: 'Team A', status: 'live', team: 'A', sort: { field: 'date', descending: true }, page: 3, pageSize: 25 };
    writeDashboardPreferences(7, 'scorer', preferences);
    assert.deepEqual(readDashboardPreferences(7, 'scorer'), preferences);
    assert.equal(readDashboardPreferences(8, 'scorer').search, '');
    writeDashboardPreferences(7, 'scorer', { page: -1, pageSize: 999, sort: { field: 'invalid' } });
    const checked = readDashboardPreferences(7, 'scorer');
    assert.equal(checked.page, 1); assert.equal(checked.pageSize, 10); assert.equal(checked.sort.field, 'number');
});
test('dashboard storage excludes authentication and checkout secrets', async () => {
    globalThis.indexedDB = new IDBFactory();
    await writeDashboardCache(7, 'scorer', 'server', {
        matches: [{ ...snapshot.matches[0], token: 'secret', offline_checkout_token: 'secret', manual_config: { password: 'secret' } }],
        competitions: [{ id: 1, title: 'Cup', private_token: 'secret' }],
    });
    const cached = await readDashboardCache(7, 'scorer', 'server');
    assert.equal(JSON.stringify(cached).includes('secret'), false);
});
