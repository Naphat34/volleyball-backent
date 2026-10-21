// Leave room below Express's 8 MB request limit for metadata and JSON framing.
const MAX_BYTES = 7 * 1024 * 1024;
export function nextSyncBatch(queue, metadata = {}) {
    const batch = [];
    let bytes = new TextEncoder().encode(JSON.stringify(metadata)).length + 32;
    if (bytes > MAX_BYTES) throw Error('ข้อมูลเริ่มต้นมีขนาดใหญ่เกินซิงค์ กรุณาสำรอง JSON และติดต่อผู้ดูแล');
    for (const operation of queue.slice(0, 100)) {
        const size = new TextEncoder().encode(JSON.stringify(operation)).length + 1;
        if (bytes + size > MAX_BYTES) {
            if (!batch.length) throw Error('คำสั่งมีขนาดใหญ่เกินซิงค์ กรุณาสำรอง JSON และติดต่อผู้ดูแล');
            break;
        }
        batch.push(operation); bytes += size;
    }
    return batch;
}

export function assertAcknowledged(batch, acknowledged, key) {
    if (!Array.isArray(acknowledged) || batch.some(op => !acknowledged.includes(op[key]))) {
        throw Error('เซิร์ฟเวอร์ยืนยันคำสั่งไม่ครบ คิวในเครื่องยังอยู่ กรุณาลองซิงค์อีกครั้ง');
    }
}
