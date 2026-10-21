import { getStoredUser, getAuthToken, getOnlineUser } from '../auth/authStorage.js';
import { getOfflineUser, deviceId } from './offlineAuth.js';
import { localRead } from './localRead.js';
import { nextSyncBatch, assertAcknowledged } from './syncBatch.js';
import { applyScorerCache, hydrateScorerCache, scorerStorageSnapshot } from './scorerCache.js';
const activeKey = id => `scorer_offline_active_${id}`;
export const scorerOfflineActive = id => localStorage.getItem(activeKey(id)) === '1';
const owner = (options) => {
    const grant = getOfflineUser(options), user = getStoredUser();
    if (!grant || String(user?.id) !== String(grant.id)) throw Error('กรุณาปลดล็อก PIN หรือต่ออายุสิทธิ์ Offline ของบัญชีนี้');
    return String(grant.id);
};
export async function scorerRecords(options) {
    const id = owner(options);
    return localRead(access('readonly', store => store.getAll())).then(records => records.filter(record => record.owner === id && record.cache));
}
function access(mode, action) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open('volley-scorer-offline-v1', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('matches', { keyPath: 'id' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result, tx = db.transaction('matches', mode);
            let result, failure;
            try { const request = action(tx.objectStore('matches'), value => { result = value; }, error => { failure = error; tx.abort(); }); if (request) request.onsuccess = () => { result = request.result; }; }
            catch (error) { failure = error; tx.abort(); }
            tx.oncomplete = () => { db.close(); if (mode === 'readwrite') window.dispatchEvent(new Event('scorer-offline-updated')); resolve(result); };
            tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error); };
        };
    });
}
export async function scorerRecord(id, options) {
    const record = await access('readonly', store => store.get(String(id)));
    if (!record || record.owner !== owner(options)) throw Error('ไม่พบแมตช์ Offline ของบัญชีนี้');
    if (record.recoveryReadOnly && !options?.readOnly) throw Error('ไฟล์จากเครื่องอื่นเปิดได้เฉพาะสำรอง กรุณาซิงค์จากเครื่องหลักเดิม');
    return hydrateScorerCache(record);
}
export async function changeScorerRecord(id, change) {
    const user = owner();
    return access('readwrite', (store, done, fail) => {
        const request = store.get(String(id)); request.onsuccess = () => {
            try { const record = request.result; if (!record || record.owner !== user) throw Error('ไม่มีสิทธิ์แมตช์ Offline'); const next = change(hydrateScorerCache(record)); store.put(next); done(next); }
            catch (error) { fail(error); }
        };
    });
}
export async function prepareScorer(client, id) {
    const user = owner(), token = crypto.randomUUID();
    await access('readwrite', (store, done, fail) => {
        const request = store.get(String(id));
        request.onsuccess = () => {
            const previous = request.result;
            if (previous && previous.owner !== user) return fail(Error('แมตช์ในเครื่องเป็นของบัญชีอื่น กรุณาใช้โปรไฟล์เบราว์เซอร์ของเจ้าของ'));
            if (previous?.queue.length) return fail(Error('ยังมีคำสั่งรอซิงค์ ห้ามดาวน์โหลดทับ'));
            if (previous?.syncingUntil > Date.now() || previous?.preparingUntil > Date.now()) return fail(Error('แมตช์กำลังดาวน์โหลดหรือซิงค์จากอีกหน้าต่าง'));
            store.put({ ...previous, id: String(id), owner: user, queue: previous?.queue || [], preparingToken: token, preparingUntil: Date.now() + 120000 });
            done();
        };
    });
    let checkout, persisted = false;
    try {
        const cache = {};
        for (const path of ['/scorer/referees', '/scorer/line-judges', '/competitions/open', '/age-groups']) {
            try { cache[path] = (await client.get(path, { timeout: 15000 })).data; } catch { /* Optional reference data. */ }
        }
        checkout = (await client.post(`/scorer/match/${id}/offline-checkout`, { deviceId: deviceId() }, { timeout: 60000 })).data;
        const prefix = `/scorer/match/${id}`;
        if (!checkout.fingerprint || !checkout.cache || [prefix, ...['roster', 'state', 'lineup', 'events'].map(key => `${prefix}/${key}`)].some(path => !(path in checkout.cache))) {
            throw Error('ข้อมูลดาวน์โหลดไม่ครบ กรุณาอัปเดตเซิร์ฟเวอร์แล้วลองใหม่');
        }
        const record = { id: String(id), owner: user, deviceId: deviceId(), fingerprint: checkout.fingerprint, cache: { ...cache, ...checkout.cache }, cacheVersion: 1, queue: [], released: false, createdAt: Date.now() };
        record.localStorage = { ...scorerStorageSnapshot(record), [`match_${id}_history`]: '[]' };
        await access('readwrite', (store, done, fail) => {
            const request = store.get(String(id));
            request.onsuccess = () => {
                try {
                    const latest = request.result;
                    if (latest?.preparingToken !== token || latest.queue.length || latest.syncingUntil > Date.now() || owner() !== user) return fail(Error('ข้อมูลในเครื่องเปลี่ยนระหว่างดาวน์โหลด จึงไม่เขียนทับ'));
                    store.put(record); done();
                } catch (error) { fail(error); }
            };
        });
        persisted = true;
        for (const key of Object.keys(localStorage)) if (key.startsWith(`match_${id}_`)) localStorage.removeItem(key);
        for (const [key, value] of Object.entries(record.localStorage)) localStorage.setItem(key, value);
        localStorage.setItem(activeKey(id), '1');
        return record;
    } catch (error) {
        if (!checkout) error.message += ' · หากเครือข่ายหลุดหลังจอง ให้ใช้บัญชีและเบราว์เซอร์เดิมดาวน์โหลดแมตช์นี้ซ้ำ';
        if (checkout?.leaseCreated && !persisted) {
            try { await client.post(`/scorer/match/${id}/offline-cancel-checkout`, { deviceId: deviceId(), fingerprint: checkout.fingerprint, checkoutToken: checkout.checkoutToken }, { timeout: 15000 }); }
            catch { error.message += ' · คืนสิทธิ์ไม่สำเร็จ กรุณาเชื่อมต่อแล้วดาวน์โหลดแมตช์เดิมอีกครั้ง'; }
        }
        throw error;
    } finally {
        await access('readwrite', (store, done) => {
            const request = store.get(String(id)); request.onsuccess = () => {
                const latest = request.result;
                if (latest?.preparingToken === token) {
                    if (!latest.cache) store.delete(String(id));
                    else { delete latest.preparingToken; delete latest.preparingUntil; store.put(latest); }
                }
                done();
            };
        });
    }
}
export function installScorerOffline(client) {
    client.interceptors.request.use(async config => {
        const url = new URL(config.url, 'https://local.test');
        const match = /^\/scorer\/match\/(\d+)(?:\/(.*))?$/.exec(url.pathname);
        const currentId = /^\/scorer\/(\d+)\/?$/.exec(window.location.pathname)?.[1];
        const id = match?.[1] || currentId;
        if (!currentId || id !== currentId || !scorerOfflineActive(id) || match?.[2]?.startsWith('offline-') || url.pathname === '/scorer/offline-permit') return config;
        const path = match?.[2] || '', method = (config.method || 'get').toUpperCase();
        config.adapter = async () => {
            let record = await scorerRecord(id), data;
            if (record.preparingUntil > Date.now()) throw Error('กำลังดาวน์โหลดแมตช์ กรุณารอ');
            if (record.released) throw Error('คืนสิทธิ์แล้ว กรุณากลับไปเปิดแมตช์ออนไลน์');
            if (method === 'GET') {
                data = record.cache[url.pathname];
                if (data === undefined) {
                    if (url.pathname.includes('/requests/pending')) data = [];
                    else throw Error('ข้อมูลนี้ไม่ได้ดาวน์โหลดก่อน Offline');
                }
            } else {
                if (!match || !['event','state','lineup','toss','start-set','end-set','officials','roster','undo'].includes(path)) throw Error('คำสั่งนี้ต้องใช้ออนไลน์');
                const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                record = await changeScorerRecord(id, current => {
                    if (current.released) throw Error('คืนสิทธิ์แล้ว กรุณาเปิดแมตช์ออนไลน์');
                    if (current.preparingUntil > Date.now() || current.syncingUntil > Date.now()) throw Error('กำลังดาวน์โหลดหรือซิงค์ กรุณารอ');
                    const operation = { id: crypto.randomUUID(), method, path, body, at: Date.now() };
                    // Timer ticks do not need thousands of consecutive full snapshots.
                    // Once sent, keep receipts immutable until the server acknowledges them.
                    // Migrate old ambiguous sends conservatively; only unsent tails can change.
                    current.sentIds ||= current.hasSent ? current.queue.map(op => op.id) : [];
                    if (path === 'state' && current.queue.at(-1)?.path === 'state' && !current.sentIds.includes(current.queue.at(-1).id)) current.queue[current.queue.length-1] = operation;
                    else current.queue.push(operation);
                    applyScorerCache(current, operation);
                    current.localStorage = Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith(`match_${id}_`)).map(key => [key, localStorage.getItem(key)]));
                    return current;
                });
                data = { success: true, offline: true, pending: record.queue.length };
            }
            return { data, status: 200, statusText: 'OK', headers: {}, config };
        };
        return config;
    });
}
export async function syncScorer(client, id, release = false) {
    if (!getAuthToken() || !navigator.onLine) throw Error('กรุณาเข้าสู่ระบบออนไลน์ด้วยบัญชีเดิมก่อนซิงค์');
    if (String(getOnlineUser()?.id) !== owner()) throw Error('บัญชีออนไลน์ไม่ตรงกับเจ้าของแมตช์ กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของข้อมูล');
    const token = crypto.randomUUID();
    let record = await changeScorerRecord(id, current => {
        if (current.recoveryReadOnly || current.deviceId !== deviceId()) throw Error('ต้องซิงค์จากเครื่องหลักเดิมของแมตช์นี้');
        if (current.released || current.syncingUntil > Date.now() || current.preparingUntil > Date.now()) throw Error('แมตช์คืนสิทธิ์แล้วหรือกำลังดาวน์โหลด/ซิงค์');
        current.syncingUntil = Date.now() + 120000; current.syncToken = token;
        current.sentIds ||= current.hasSent ? current.queue.map(op => op.id) : [];
        return current;
    });
    try {
        let saved;
        do {
            const batch = nextSyncBatch(record.queue), finalRelease = release && batch.length === record.queue.length;
            record = await changeScorerRecord(id, current => {
                if (current.syncToken !== token) throw Error('สิทธิ์ซิงค์เปลี่ยน กรุณาลองใหม่');
                current.syncingUntil = Date.now() + 120000;
                current.sentIds = [...new Set([...current.sentIds, ...batch.map(op => op.id)])];
                return current;
            });
            saved = (await client.post(`/scorer/match/${id}/offline-sync`, { deviceId: deviceId(), fingerprint: record.fingerprint, operations: batch, release: finalRelease }, { timeout: 60000 })).data;
            assertAcknowledged(batch, saved.acknowledged, 'id');
            if (!saved.fingerprint || (finalRelease && !saved.released)) throw Error('เซิร์ฟเวอร์ยังไม่ยืนยันการซิงค์และคืนสิทธิ์ กรุณาลองใหม่');
            const acknowledged = new Set(batch.map(op => op.id));
            record = await changeScorerRecord(id, current => {
                if (current.syncToken !== token) throw Error('สิทธิ์ซิงค์เปลี่ยน คิวในเครื่องยังอยู่');
                if (finalRelease && current.queue.some(op => !acknowledged.has(op.id))) throw Error('มีคำสั่งใหม่ระหว่างคืนสิทธิ์ กรุณาสำรองและตรวจสอบ คิวในเครื่องยังอยู่');
                return { ...current, queue: current.queue.filter(op => !acknowledged.has(op.id)), sentIds: current.sentIds.filter(opId => !acknowledged.has(opId)), fingerprint: saved.fingerprint, released: Boolean(saved.released), hasSent: false, syncedAt: saved.syncedAt };
            });
        } while (record.queue.length);
        if (record.released) { localStorage.removeItem(activeKey(id)); localStorage.removeItem(`match_${id}_updatedAt`); }
        return saved;
    } finally { await changeScorerRecord(id, current => { if (current.syncToken === token) { delete current.syncingUntil; delete current.syncToken; } return current; }); }
}
export async function backupScorer(id) {
    const record = await scorerRecord(id, { readOnly: true });
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'volley-scorer-offline', version: 1, record }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `Scorer_match_${id}_${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importScorerBackup(value) {
    const user = owner({ readOnly: true }), source = value?.record;
    const methods = { event: 'POST', state: 'PUT', lineup: 'POST', toss: 'POST', 'start-set': 'POST', 'end-set': 'POST', officials: 'PUT', roster: 'PUT', undo: 'POST' };
    if (value?.format !== 'volley-scorer-offline' || value.version !== 1 || !source || !/^[1-9]\d*$/.test(String(source.id))
        || !/^[\w-]{16,80}$/.test(source.deviceId || '') || typeof source.fingerprint !== 'string' || !source.fingerprint
        || !Array.isArray(source.queue) || !source.cache || String(source.owner) !== user) throw Error('ไฟล์สำรอง Scorer ไม่ถูกต้องหรือเป็นของบัญชีอื่น');
    const id = String(source.id), prefix = `/scorer/match/${id}`;
    if ([prefix, ...['state', 'roster', 'lineup', 'events'].map(key => `${prefix}/${key}`)].some(path => !(path in source.cache))
        || source.queue.some(op => !/^[\w-]{16,80}$/.test(op?.id || '') || methods[op.path] !== op.method || !op.body || typeof op.body !== 'object')
        || new Set(source.queue.map(op => op.id)).size !== source.queue.length) throw Error('ข้อมูลแมตช์หรือคิวในไฟล์สำรองไม่ครบถ้วน');
    if (!Array.isArray(source.cache[`${prefix}/events`]) || !Array.isArray(source.cache[`${prefix}/lineup`])
        || !source.cache[prefix] || !source.cache[`${prefix}/roster`]?.home || !source.cache[`${prefix}/roster`]?.away
        || (source.sentIds !== undefined && (!Array.isArray(source.sentIds) || source.sentIds.some(opId => !source.queue.some(op => op.id === opId))))
        || source.queue.some(op => (['state', 'undo'].includes(op.path) && (!op.body.state || typeof op.body.state !== 'object'))
            || (op.path === 'lineup' && (!Array.isArray(op.body.player_positions) || op.body.player_positions.length !== 6))
            || (op.path === 'event' && (!Number.isSafeInteger(op.at) || typeof op.body.event_type !== 'string')))) throw Error('รูปแบบข้อมูลในไฟล์สำรองไม่ถูกต้อง');
    const record = structuredClone(source);
    record.id = id; record.owner = user; record.recoveryReadOnly = source.deviceId !== deviceId() || Boolean(source.recoveryReadOnly);
    delete record.syncingUntil; delete record.syncToken; delete record.preparingUntil; delete record.preparingToken;
    record.localStorage = Object.fromEntries(Object.entries(source.localStorage || {}).filter(([key, val]) => key.startsWith(`match_${id}_`) && typeof val === 'string'));
    await access('readwrite', (store, done, fail) => {
        const request = store.get(id); request.onsuccess = () => {
            if (request.result) return fail(Error('แมตช์นี้มีอยู่ในเครื่องแล้ว ระบบไม่นำเข้าเขียนทับ กรุณาสำรองและตรวจสอบก่อน'));
            store.add(record); done();
        };
    });
    return record;
}
