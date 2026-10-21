export async function ensureOfflineShell() {
    if (!import.meta.env?.PROD) return;
    if (!navigator.serviceWorker) throw Error('เบราว์เซอร์นี้ยังไม่พร้อมใช้งาน Offline กรุณาใช้ HTTPS หรือ localhost');
    let timer;
    try {
        await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('แอป Offline ยังดาวน์โหลดไม่ครบ กรุณารอขณะออนไลน์แล้วลองอีกครั้ง')), 15000);
        })]);
    } finally { clearTimeout(timer); }
}
