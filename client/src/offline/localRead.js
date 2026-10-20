// A blocked local database must produce a retryable error instead of trapping Login.
// Only wrap reads: a timed-out write must never be reported as failed while still running.
export async function localRead(promise, timeoutMs = 10000) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('อ่านฐานข้อมูลในเครื่องนานเกินไป กรุณาปิดแท็บอื่นแล้วลองใหม่ ข้อมูลยังไม่ได้ถูกลบ')), timeoutMs);
        })]);
    } finally { clearTimeout(timer); }
}
