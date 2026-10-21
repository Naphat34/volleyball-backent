import { getAuthToken, getOnlineUser } from '../auth/authStorage.js';
import { getLocal, updateLocal } from './offlineStore.js';
import { deviceId } from './offlineAuth.js';
import { nextSyncBatch, assertAcknowledged } from './syncBatch.js';

export async function syncLocalMatch(id, release = false, transport = null) {
    let current = await getLocal(id);
    if (current.released) throw Error('แมตช์นี้คืนสิทธิ์แล้ว กรุณาเปิดแมตช์บนเซิร์ฟเวอร์');
    if (!navigator.onLine || !getAuthToken() || String(getOnlineUser()?.id) !== current.ownerId) throw Error('กรุณาเชื่อมต่อและเข้าสู่ระบบออนไลน์ด้วยบัญชีเจ้าของก่อนซิงค์');
    const syncToken = crypto.randomUUID();
    current = await updateLocal(id, latest => {
        if (latest.released) throw Error('แมตช์นี้คืนสิทธิ์แล้ว กรุณาเปิดแมตช์เซิร์ฟเวอร์');
        if (latest.syncingUntil > Date.now()) throw Error('แมตช์นี้กำลังซิงค์จากอีกหน้าต่าง');
        latest.syncToken = syncToken; latest.syncingUntil = Date.now() + 120000; return latest;
    });
    try {
        const send = transport || (await import('../api.js')).api.syncOfflineVis;
        let saved;
        do {
            const initial = !current.serverCreated ? { config: current.initialConfig, importBackup: current.importBackup } : {};
            const batch = nextSyncBatch(current.queue, initial), finalRelease = release && batch.length === current.queue.length;
            current = await updateLocal(id, latest => {
                if (latest.syncToken !== syncToken) throw Error('สิทธิ์ซิงค์เปลี่ยน กรุณาลองใหม่');
                latest.syncingUntil = Date.now() + 120000; return latest;
            });
            const response = await send(current.serverId, {
                deviceId: deviceId(), baseRevision: current.baseRevision, operations: batch, release: finalRelease,
                ...initial,
            });
            saved = response.data;
            assertAcknowledged(batch, saved.acknowledged, 'operationId');
            if (!Number.isSafeInteger(saved.payload?.revision) || saved.payload.revision < current.baseRevision || !saved.payload.config || !saved.payload.match || (finalRelease && saved.payload.offlineLease)) {
                throw Error('เซิร์ฟเวอร์ยืนยันสถานะแมตช์ไม่ครบ คิวในเครื่องยังอยู่ กรุณาลองซิงค์อีกครั้ง');
            }
            const acknowledged = new Set(batch.map(op => op.operationId));
            current = await updateLocal(id, latest => {
                if (latest.syncToken !== syncToken) throw Error('สิทธิ์ซิงค์เปลี่ยน คิวในเครื่องยังอยู่');
                if (finalRelease && latest.queue.some(operation => !acknowledged.has(operation.operationId))) throw Error('มีคำสั่งใหม่ระหว่างคืนสิทธิ์ กรุณาสำรองและตรวจสอบ คิวในเครื่องยังอยู่');
                latest.queue = latest.queue.filter(operation => !acknowledged.has(operation.operationId));
                latest.baseRevision = saved.payload.revision;
                latest.serverCreated = true; latest.lastSyncedAt = saved.payload.lastSyncedAt;
                if (!latest.queue.length) latest.payload = saved.payload;
                latest.released = finalRelease || saved.payload.lifecycle === 'cancelled'; latest.updatedAt = new Date().toISOString(); return latest;
            });
        } while (current.queue.length);
        return saved;
    } finally {
        await updateLocal(id, latest => {
            if (latest.syncToken === syncToken) { delete latest.syncingUntil; delete latest.syncToken; }
            return latest;
        });
    }
}
