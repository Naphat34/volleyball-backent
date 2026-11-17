import test from 'node:test';
import assert from 'node:assert/strict';
import { identifier, remember, publicUrl, internalUrl, pathReferences } from './publicUrls.js';

const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key,value) => memory.set(key,String(value)) };
globalThis.sessionStorage = { getItem: () => null };
globalThis.location = { origin: 'http://localhost:5173' };
const competition = '06012119-33ce-4572-ae3b-8fcb00aa022b';
const match = 'a0e85d5b-6d7e-4eb5-8199-b433dc4a1069';
const team = 'b0e85d5b-6d7e-4eb5-8199-b433dc4a1069';
const player = 'c0e85d5b-6d7e-4eb5-8199-b433dc4a1069';

test('competition filter URLs use UUIDs while page filters keep internal references', async () => {
    remember({ entity: 'competitions', id: '1', public_id: competition });
    assert.equal(await publicUrl('/adminscorer?view=matches&compId=1'), `/adminscorer?view=matches&compId=${competition}`);
    assert.equal(await internalUrl(`/adminscorer?view=matches&compId=${competition}`), '/adminscorer?view=matches&compId=1');
    await assert.rejects(internalUrl('/adminscorer?compId=1'), /รหัสเดิม/);
});

test('every ID in multi-resource API paths is encoded, without changing non-ID pagination', async () => {
    for (const row of [{entity:'matches',id:'7',public_id:match},{entity:'teams',id:'8',public_id:team},{entity:'players',id:'9',public_id:player}]) remember(row);
    assert.equal(await publicUrl('/scorer/match/7/teams/8/players/9', {mode:'api',params:{eventPage:2}}), `/scorer/match/${match}/teams/${team}/players/${player}?eventPage=2`);
    assert.equal(await publicUrl('/scoresheet/7?view=result'), `/scoresheet/${match}?view=result`);
    await assert.rejects(internalUrl('/scoresheet/7'), /รหัสเดิม/);
});

test('native API download links and login return destinations contain public IDs', async () => {
    remember({entity:'team_entries',id:'91',public_id:player});
    assert.equal(await publicUrl('http://localhost:3000/api/reports/team-composition/91'),`http://localhost:3000/api/reports/team-composition/${player}`);
    const url = await publicUrl('/login?returnTo='+encodeURIComponent('/scorer/7'));
    assert.equal(new URLSearchParams(url.split('?')[1]).get('returnTo'),`/scorer/${match}`);
    assert.equal(await publicUrl('https://example.com/teams/1'), 'https://example.com/teams/1');
});

test('offline and custom match URLs use UUIDs and preserve internal sync references', async () => {
    const local = 'local-admin-7';
    const uuid = await identifier('matchRecords',local);
    assert.match(uuid,/^[0-9a-f-]{36}$/);
    assert.equal(await internalUrl(`/adminvis/match/${uuid}`),`/adminvis/match/${local}`);
    const custom = `custom-${team}`;
    assert.equal(await publicUrl(`/adminvis/match/${custom}`),`/adminvis/match/${team}`);
    assert.equal(await internalUrl(`/adminvis/match/${team}`),`/adminvis/match/${custom}`);
    const reloaded = await import('./publicUrls.js?reload-offline-mapping');
    assert.equal(await reloaded.internalUrl(`/adminvis/match/${uuid}`),`/adminvis/match/${local}`);
});

test('URL schema covers all API reference classes while excluding static routes', () => {
    assert.equal(pathReferences('/public/competitions/open','api').length,0);
    assert.equal(pathReferences('/admin/matches/all','api').length,0);
    assert.equal(pathReferences('/vis-custom/offline-permit','api').length,0);
    assert.equal(pathReferences('/my-team/entries/11/players','api')[0].entity,'team_entries');
    assert.equal(pathReferences('/match/7/requests/11','api').length,2);
});
