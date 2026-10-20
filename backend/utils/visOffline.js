const { commandPayload } = require('./customVis');
const { fail } = require('./visWorkflow');
const DAY = 86400000;
const validDevice = value => typeof value === 'string' && /^[\w-]{16,80}$/.test(value);
function assertAvailable(payload, deviceId, now = Date.now()) {
    const lease = payload.offlineLease;
    if (lease && lease.expiresAt > now && lease.deviceId !== deviceId) fail('แมตช์ถูกจองสำหรับเครื่อง Offline อีกเครื่อง กรุณาซิงค์และคืนสิทธิ์จากเครื่องหลักก่อน', 409);
}
function checkout(payload, deviceId, now = Date.now()) {
    if (!validDevice(deviceId)) fail('Invalid device ID');
    assertAvailable(payload, deviceId, now);
    if (['confirmed', 'cancelled'].includes(payload.lifecycle)) fail('แมตช์ถูกล็อกแล้ว', 409);
    payload.offlineLease = { deviceId, expiresAt: now + 7 * DAY };
    payload.offlineDevice = deviceId;
    return payload;
}
function syncPayload(previous, request, now = Date.now()) {
    if (!validDevice(request.deviceId) || !Array.isArray(request.operations) || request.operations.length > 5000
        || !Number.isSafeInteger(request.baseRevision) || request.baseRevision < 0) fail('ข้อมูลซิงค์ไม่ถูกต้อง');
    assertAvailable(previous, request.deviceId, now);
    if (previous.offlineDevice && previous.offlineDevice !== request.deviceId) fail('แมตช์นี้ใช้เครื่อง Offline หลักอีกเครื่อง กรุณาสร้างสำเนาจากไฟล์สำรอง', 409);
    const ids = request.operations.map(op => op?.operationId);
    if (new Set(ids).size !== ids.length) fail('รหัสรายการซิงค์ซ้ำ');
    const acknowledged = ids.length > 0 && ids.every(id => previous.operations.includes(id));
    if (!acknowledged && request.baseRevision !== previous.revision) fail('ข้อมูลบนเซิร์ฟเวอร์เปลี่ยน กรุณาเก็บไฟล์สำรอง แล้วเลือกโหลดเซิร์ฟเวอร์หรือสร้างสำเนา ห้ามเขียนทับ', 409);
    let payload = structuredClone(previous);
    if (!acknowledged) {
        for (const operation of request.operations) {
            if (!['SET_LINEUP', 'RALLY', 'UNDO', 'TIMEOUT', 'SUBSTITUTION', 'CANCEL'].includes(operation.command?.type)) fail('ต้องซิงค์ให้ครบก่อนยืนยันผลหรือเผยแพร่');
            payload = commandPayload(payload, operation).payload;
        }
    }
    payload.offlineDevice = request.deviceId;
    payload.lastSyncedAt = new Date(now).toISOString();
    if (request.release || payload.lifecycle === 'cancelled') payload.offlineLease = null;
    else checkout(payload, request.deviceId, now);
    return { payload, acknowledged: ids };
}
module.exports = { assertAvailable, checkout, syncPayload };
