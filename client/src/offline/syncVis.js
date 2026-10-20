import { getAuthToken, getOnlineUser } from '../authStorage.js';
import { getLocal, updateLocal } from './offlineStore.js';
import { deviceId } from './offlineAuth.js';

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
        const response = await send(current.serverId, {
        deviceId: deviceId(), baseRevision: current.baseRevision, operations: current.queue, release,
        ...(!current.serverCreated ? { config: current.initialConfig, importBackup: current.importBackup } : {}),
        });
        const saved = response.data, acknowledged = new Set(saved.acknowledged);
        await updateLocal(id, latest => {
        latest.queue = latest.queue.filter(operation => !acknowledged.has(operation.operationId));
        latest.baseRevision = saved.payload.revision;
        latest.serverCreated = true; latest.lastSyncedAt = saved.payload.lastSyncedAt;
        if (!latest.queue.length) latest.payload = saved.payload;
        if (release && latest.queue.length) throw Error('มีรายการใหม่ระหว่างซิงค์ กรุณาซิงค์และคืนสิทธิ์อีกครั้ง');
        latest.released = release || saved.payload.lifecycle === 'cancelled'; latest.updatedAt = new Date().toISOString(); return latest;
        });
        return saved;
    } finally {
        await updateLocal(id, latest => {
            if (latest.syncToken === syncToken) { delete latest.syncingUntil; delete latest.syncToken; }
            return latest;
        });
    }
}
