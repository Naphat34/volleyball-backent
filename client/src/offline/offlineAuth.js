import { canEnterWorkspace } from './workspaceRouting.js';
import { localRead } from './localRead.js';
const PROFILE = 'vis_offline_profile_v1';
const SESSION = 'vis_offline_unlocked_v1';
const MODE = 'vis_offline_mode';
const encode = bytes => btoa(String.fromCharCode(...bytes));
const decode = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
async function keyFor(pin, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export function deviceId() {
    let id = localStorage.getItem('vis_device_id');
    if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''); localStorage.setItem('vis_device_id', id); }
    return id;
}
export function offlineProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE)); } catch { return null; }
}
export function getOfflineUser() {
    try {
        const grant = JSON.parse(sessionStorage.getItem(SESSION));
        return grant?.expiresAt > Date.now() && ['admin', 'statistician', 'score', 'scorer'].includes(grant.user?.role) ? grant.user : null;
    } catch { return null; }
}
export const offlineMode = () => sessionStorage.getItem(MODE) === '1';
export const setOfflineMode = enabled => sessionStorage.setItem(MODE, enabled ? '1' : '0');
export const clearOfflineSession = () => { sessionStorage.removeItem(SESSION); sessionStorage.removeItem(MODE); };
export async function prepareOffline(grant, pin, { replaceAccount = false } = {}) {
    if (!crypto.subtle) throw Error('การตั้ง PIN Offline ต้องใช้ HTTPS หรือ localhost');
    if (!/^\d{6,12}$/.test(pin)) throw Error('ใช้ PIN ตัวเลข 6–12 หลัก');
    if (!grant?.user?.id || !['admin', 'statistician', 'score', 'scorer'].includes(grant.user.role) || grant.expiresAt <= Date.now()) throw Error('บัญชีนี้ยังไม่มีสิทธิ์ Offline');
    const previous = offlineProfile();
    const different = previous && (previous.userId ? String(previous.userId) !== String(grant.user.id) : previous.user !== grant.user.username);
    if (different) {
        const pending = await pendingDeviceWork();
        if (pending) throw Error(`เปลี่ยนบัญชี Offline ไม่ได้ มี ${pending} รายการหรือแมตช์ใหม่รอซิงค์ กรุณาใช้บัญชีเดิมซิงค์และสำรอง JSON ก่อน`);
        if (!replaceAccount) throw Error(`เครื่องนี้เตรียมไว้สำหรับ ${previous.user} กรุณายืนยันเปลี่ยนบัญชี Offline หลังสำรองข้อมูลแล้ว`);
    }
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(pin, salt), new TextEncoder().encode(JSON.stringify(grant)));
    localStorage.setItem(PROFILE, JSON.stringify({ userId: grant.user.id, user: grant.user.username, expiresAt: grant.expiresAt, salt: encode(salt), iv: encode(iv), encrypted: encode(new Uint8Array(encrypted)) }));
    sessionStorage.setItem(SESSION, JSON.stringify(grant));
    deviceId();
    try { await navigator.storage?.persist?.(); } catch { /* Preparation has succeeded even if persistence is unavailable. */ }
}
export async function unlockOffline(pin, { workspace = null } = {}) {
    const record = offlineProfile();
    if (!record || record.expiresAt <= Date.now()) throw Error('สิทธิ์ Offline หมดอายุหรือยังไม่เตรียมเครื่อง กรุณาเข้าสู่ระบบออนไลน์');
    let grant;
    try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(record.iv) }, await keyFor(pin, decode(record.salt)), decode(record.encrypted));
        grant = JSON.parse(new TextDecoder().decode(plain));
    } catch { throw Error('PIN ไม่ถูกต้อง'); }
    if (grant.expiresAt <= Date.now()) throw Error('สิทธิ์ Offline หมดอายุ');
    if (!grant.user?.id || !['admin', 'statistician', 'score', 'scorer'].includes(grant.user.role)) throw Error('ข้อมูลสิทธิ์ Offline ไม่สมบูรณ์ กรุณาเตรียมสิทธิ์ออนไลน์ใหม่');
    if (workspace && !canEnterWorkspace(grant.user, workspace, true)) throw Error(`บัญชี ${grant.user.username} ไม่มีสิทธิ์เข้า ${workspace === 'vis' ? 'VIS' : 'ScorerControl'} กรุณาเลือกหน้าระบบที่มีสิทธิ์`);
    // Commit only after PIN, expiry and destination permissions have all passed.
    const keys = [SESSION, MODE, 'token', 'user'];
    const before = keys.map(key => sessionStorage.getItem(key));
    try {
        sessionStorage.setItem(SESSION, JSON.stringify(grant));
        setOfflineMode(true);
        // Local identity is authoritative while unlocked; never inherit another online account.
        let online = null;
        try { online = JSON.parse(sessionStorage.getItem('user') || 'null'); } catch { /* An invalid old online session must not block a valid PIN. */ }
        if (String(online?.id) !== String(grant.user.id)) {
            sessionStorage.removeItem('token'); sessionStorage.removeItem('user');
        }
    } catch (error) {
        keys.forEach((key, index) => { if (before[index] === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, before[index]); });
        throw error;
    }
    localStorage.removeItem('token'); localStorage.removeItem('user');
    return grant.user;
}

// Inspect both databases without changing their contents or requiring an unlocked account.
export async function pendingDeviceWork() {
    const results = await localRead(Promise.all(['volley-vis-offline-v1', 'volley-scorer-offline-v1'].map(name => new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('matches')) request.result.createObjectStore('matches', { keyPath: 'id' }); };
        request.onerror = () => reject(Error('อ่านข้อมูลในเครื่องไม่ได้ จึงยังเปลี่ยนบัญชีไม่ได้ กรุณาลองใหม่และสำรองข้อมูล'));
        request.onblocked = () => reject(Error('ฐานข้อมูลในเครื่องกำลังใช้งาน กรุณาปิดแท็บอื่นแล้วลองใหม่'));
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('matches')) { db.close(); resolve(0); return; }
            const tx = db.transaction('matches', 'readonly'), read = tx.objectStore('matches').getAll();
            let count = 0;
            read.onsuccess = () => { count = read.result.reduce((sum, row) => sum + (row.queue?.length || 0) + (name.includes('vis-') && !row.serverCreated ? 1 : 0), 0); };
            tx.oncomplete = () => { db.close(); resolve(count); };
            tx.onerror = tx.onabort = () => { db.close(); reject(Error('อ่านงานรอซิงค์ไม่สำเร็จ กรุณาลองใหม่')); };
        };
    }))));
    return results.reduce((sum, count) => sum + count, 0);
}
