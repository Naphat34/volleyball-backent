import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const handlers = new Map(), stores = new Map([['unrelated-cache', new Map()], ['vis-shell-old', new Map()]]);
const caches = {
    async open(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        return {
            async addAll(files) {
                for (const file of files) {
                    const target = path.join(dist, file);
                    assert.ok(fs.existsSync(target), `Missing precache asset ${file}`);
                    entries.set(file, { url: file, body: fs.readFileSync(target) });
                }
            },
            async match(file) { return entries.get(file); },
        };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
};
vm.runInNewContext(fs.readFileSync(path.join(dist, 'sw.js'), 'utf8'), {
    self: { location: { origin: 'https://vis.test' }, clients: { claim: async () => {} }, addEventListener: (name, fn) => handlers.set(name, fn) },
    caches, URL, fetch: async () => { throw Error('Offline'); },
});
for (const name of ['install', 'activate']) {
    let pending; handlers.get(name)({ waitUntil: promise => { pending = promise; } }); await pending;
}
assert.equal(stores.has('vis-shell-old'), false); assert.equal(stores.has('unrelated-cache'), true);
async function request(url, mode = 'navigate', method = 'GET') {
    let answer; handlers.get('fetch')({ request: { url, mode, method }, respondWith: result => { answer = result; } }); return answer;
}
assert.equal((await request('https://vis.test/adminvis/match/local-test')).url, '/index.html');
assert.equal((await request('https://vis.test/login')).url, '/index.html');
assert.equal((await request('https://vis.test/scorer/123')).url, '/index.html');
assert.equal((await request('https://vis.test/scorer-offline')).url, '/index.html');
assert.equal((await request('https://vis.test/adminscorer')).url, '/index.html');
assert.equal((await request('https://vis.test/workspaces')).url, '/index.html');
assert.equal((await request('https://vis.test/vis/login')).url, '/index.html');
assert.equal((await request('https://vis.test/scorer/login')).url, '/index.html');
assert.equal((await request('https://vis.test/fonts/Sarabun-Regular.ttf', 'cors')).url, '/fonts/Sarabun-Regular.ttf');
assert.equal(await request('https://vis.test/api/vis-custom', 'cors'), undefined);
assert.equal(await request('https://vis.test/api/vis-custom', 'cors', 'POST'), undefined);
assert.equal(await request('https://other.test/adminvis'), undefined);
console.log('PASS: every precached file exists; offline VIS/login/fonts work; APIs/mutations/external requests bypass cache; cache upgrades preserve unrelated stores');
