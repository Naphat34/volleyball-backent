import { getStoredUser, getAuthToken, getOnlineUser } from '../authStorage.js';
import { getOfflineUser, deviceId } from './offlineAuth.js';
import { localRead } from './localRead.js';
const activeKey = id => `scorer_offline_active_${id}`;
export const scorerOfflineActive = id => localStorage.getItem(activeKey(id)) === '1';
const owner = () => {
    const grant = getOfflineUser(), user = getStoredUser();
    if (!grant || String(user?.id) !== String(grant.id)) throw Error('กรุณาปลดล็อก PIN หรือต่ออายุสิทธิ์ Offline ของบัญชีนี้');
    return String(grant.id);
};
export async function scorerRecords() {
    const id = owner();
    return localRead(access('readonly', store => store.getAll())).then(records => records.filter(record => record.owner === id));
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
export async function scorerRecord(id) {
    const record = await access('readonly', store => store.get(String(id)));
    if (!record || record.owner !== owner()) throw Error('ไม่พบแมตช์ Offline ของบัญชีนี้');
    return record;
}
export async function changeScorerRecord(id, change) {
    const user = owner();
    return access('readwrite', (store, done, fail) => {
        const request = store.get(String(id)); request.onsuccess = () => {
            try { const record = request.result; if (!record || record.owner !== user) throw Error('ไม่มีสิทธิ์แมตช์ Offline'); const next = change(record); store.put(next); done(next); }
            catch (error) { fail(error); }
        };
    });
}
export async function prepareScorer(client, id) {
    owner();
    const previous = await access('readonly', store => store.get(String(id)));
    if (previous && previous.owner !== owner()) throw Error('แมตช์ในเครื่องเป็นของบัญชีอื่น กรุณาใช้โปรไฟล์เบราว์เซอร์ของเจ้าของ');
    if (previous?.queue.length) throw Error('ยังมีคำสั่งรอซิงค์ ห้ามดาวน์โหลดทับ');
    const paths = [`/scorer/match/${id}`, ...['roster', 'state', 'lineup', 'events'].map(key => `/scorer/match/${id}/${key}`), '/scorer/referees', '/scorer/line-judges', '/competitions/open', '/age-groups'];
    const cache = {};
    for (const path of paths) { try { cache[path] = (await client.get(path)).data; } catch (error) { if (path.startsWith(`/scorer/match/${id}`)) throw error; } }
    const response = await client.post(`/scorer/match/${id}/offline-checkout`, { deviceId: deviceId() });
    const record = { id: String(id), owner: owner(), deviceId: deviceId(), fingerprint: response.data.fingerprint, cache, queue: [], released: false, createdAt: Date.now() };
    await access('readwrite', store => store.put(record));
    localStorage.setItem(`match_${id}_history`, '[]');
    localStorage.setItem(activeKey(id), '1');
    return record;
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
                    if (current.syncingUntil > Date.now()) throw Error('กำลังซิงค์ กรุณารอ');
                    const operation = { id: crypto.randomUUID(), method, path, body, at: Date.now() };
                    // Timer ticks do not need thousands of consecutive full snapshots.
                    // Once sent, keep receipts immutable until the server acknowledges them.
                    if (path === 'state' && !current.hasSent && current.queue.at(-1)?.path === 'state') current.queue[current.queue.length-1] = operation;
                    else current.queue.push(operation);
                    if (path === 'state') current.cache[`/scorer/match/${id}/state`] = body.state;
                    if (path === 'roster') {
                        const cached = current.cache[`/scorer/match/${id}/roster`];
                        if (cached) for (const team of ['home','away']) cached[team].players = body[`${team}Players`] || cached[team].players;
                    }
                    if (path === 'officials') Object.assign(current.cache[`/scorer/match/${id}`], body);
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
    const record = await changeScorerRecord(id, current => {
        if (current.released || current.syncingUntil > Date.now()) throw Error('แมตช์คืนสิทธิ์แล้วหรือกำลังซิงค์');
        current.syncingUntil = Date.now() + 120000; current.hasSent = true; return current;
    });
    try {
        const response = await client.post(`/scorer/match/${id}/offline-sync`, { deviceId: deviceId(), fingerprint: record.fingerprint, operations: record.queue, release }, { timeout:60000 });
        await changeScorerRecord(id, current => ({ ...current, queue: current.queue.filter(op => !response.data.acknowledged.includes(op.id)), fingerprint: response.data.fingerprint, released: release, hasSent:false, syncedAt: response.data.syncedAt }));
        if (release) { localStorage.removeItem(activeKey(id)); localStorage.removeItem(`match_${id}_updatedAt`); }
        return response.data;
    } finally { await changeScorerRecord(id, current => { delete current.syncingUntil; return current; }); }
}
export async function backupScorer(id) {
    const record = await scorerRecord(id);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'volley-scorer-offline', version: 1, record }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `Scorer_match_${id}_${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
