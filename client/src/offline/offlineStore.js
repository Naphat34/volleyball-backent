import { getStoredUser } from '../authStorage.js';
import { getOfflineUser, deviceId } from './offlineAuth.js';
import { createPayload, commandPayload, view, importCustomVis } from './visEngine.js';
import { localRead } from './localRead.js';

const open = () => new Promise((resolve, reject) => {
    const request = indexedDB.open('volley-vis-offline-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('matches', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
const owner = () => {
    const user = getOfflineUser(), online = getStoredUser();
    if (!user || (online && String(online.id) !== String(user.id))) throw Error('กรุณาปลดล็อก Offline ด้วย PIN ของบัญชีปัจจุบัน หรือเตรียมสิทธิ์ออนไลน์ใหม่');
    return String(user.id);
};
async function transaction(mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('matches', mode), store = tx.objectStore('matches');
        let result, failure;
        const setResult = value => { result = value; };
        tx.oncomplete = () => { db.close(); if (mode === 'readwrite') window.dispatchEvent(new Event('vis-local-updated')); resolve(result); };
        tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || Error('บันทึกข้อมูลในเครื่องไม่สำเร็จ กรุณาสำรองข้อมูล')); };
        try { work(store, setResult, error => { failure = error; tx.abort(); }); } catch (error) { failure = error; tx.abort(); }
    });
}
export const isLocalVis = id => String(id).startsWith('local-');
export function updateLocal(id, transform) {
    const userId = owner();
    return transaction('readwrite', (store, done, fail) => {
        const request = store.get(id);
        request.onsuccess = () => {
            try {
                const current = request.result;
                if (!current || current.ownerId !== userId) throw Error('ไม่พบแมตช์ Offline ของบัญชีนี้');
                const next = transform(structuredClone(current));
                store.put(next); done(next);
            } catch (error) { fail(error); }
        };
    });
}
export async function listLocal() {
    const userId = owner();
    return localRead(transaction('readonly', (store, done) => {
        const request = store.getAll(); request.onsuccess = () => done(request.result.filter(item => item.ownerId === userId));
    }));
}
export async function getLocal(id) {
    const found = (await listLocal()).find(item => item.id === id);
    if (!found) throw Error('ไม่พบแมตช์ Offline');
    return found;
}
export function localView(record) {
    const result = view(record.payload);
    result.match = { ...result.match, id: record.id, is_offline_vis: true, offline_pending: record.queue.length,
        offline_released: Boolean(record.released), server_id: record.serverId, last_synced_at: record.lastSyncedAt,
        updated_at: record.updatedAt, published: false };
    if (record.released) result.state.isReadOnly = true;
    result.roster.match = result.match;
    return { ...result, config: record.payload.config, backup: { config: record.payload.config, match: record.payload.match, actions: record.payload.actions } };
}
export async function createLocal(input) {
    const id = `local-${input.creationId || crypto.randomUUID()}`, serverId = id.replace('local-', 'custom-');
    const userId = owner();
    // Imported events are recreated as commands so server scores are never trusted.
    const payload = input.importBackup ? importCustomVis(input.importBackup, serverId) : createPayload(input, serverId);
    const record = { id, ownerId: userId, deviceId: deviceId(), serverId, payload, baseRevision: payload.revision, queue: [],
        initialConfig: payload.config, importBackup: input.importBackup || null, updatedAt: new Date().toISOString() };
    return transaction('readwrite', (store, done, fail) => {
        const req = store.get(id); req.onsuccess = () => {
            if (req.result) { if (req.result.ownerId !== userId) return fail(Error('รหัสแมตช์ถูกใช้แล้ว')); done(req.result); }
            else { store.add(record); done(record); }
        };
    });
}
export async function saveLocal(id, operation) {
    let response;
    const record = await updateLocal(id, current => {
        if (current.released || current.deviceId !== deviceId()) throw Error('เครื่องนี้ไม่มีสิทธิ์บันทึกแมตช์ Offline นี้');
        if (current.syncingUntil > Date.now()) throw Error('กำลังซิงค์แมตช์นี้ กรุณารอให้เสร็จก่อนบันทึก');
        if (['CONFIRM', 'REOPEN'].includes(operation.command?.type)) throw Error('กรุณาซิงค์และคืนสิทธิ์ก่อนตรวจสอบยืนยันผลออนไลน์');
        const result = commandPayload(current.payload, operation); response = result.response;
        if (!response.duplicate) { current.payload = result.payload; current.queue.push(operation); }
        current.updatedAt = new Date().toISOString(); return current;
    });
    return { ...response, state: localView(record).state };
}
export async function editLocal(id, config) {
    return updateLocal(id, current => {
        if (current.released || current.syncingUntil > Date.now() || current.serverCreated || current.baseRevision || current.queue.length || current.payload.actions.length || current.importBackup) throw Error('แก้รายชื่อได้ก่อนจัดไลน์อัปหรือซิงค์เท่านั้น');
        current.payload = createPayload(config, current.serverId); current.initialConfig = current.payload.config;
        current.updatedAt = new Date().toISOString(); return current;
    });
}
export async function checkoutLocal(serverId, payload, match) {
    const id = serverId.replace('custom-', 'local-');
    const userId = owner();
    const record = { id, serverId, ownerId: userId, deviceId: deviceId(), payload, baseRevision: payload.revision,
        initialConfig: payload.config, serverCreated: true, queue: [], match, updatedAt: new Date().toISOString() };
    return transaction('readwrite', (store, done, fail) => {
        const request = store.get(id); request.onsuccess = () => {
            if (request.result?.queue.length || request.result?.syncingUntil > Date.now()) return fail(Error('มีข้อมูลรอซิงค์หรือกำลังซิงค์ในเครื่อง ห้ามเขียนทับ'));
            store.put(record); done(record);
        };
    });
}
