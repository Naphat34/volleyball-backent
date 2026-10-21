# โครงสร้างโครงการ

## Frontend: client

| โฟลเดอร์ / ไฟล์ | หน้าที่ |
| --- | --- |
| `src/main.jsx`, `src/App.jsx` | จุดเริ่มต้นและ route |
| `src/api.js` | การเรียก backend API |
| `src/auth/` | เซสชันและการยืนยันตัวตน |
| `src/pages/auth/` | Login และ Register |
| `src/pages/admin/` | AdminDashboard |
| `src/pages/team/` | ทีมและการสมัครทีม |
| `src/pages/scorer/` | ควบคุมคะแนน เจ้าหน้าที่ทีม และรายการ Offline |
| `src/pages/vis/` | AdminVis และหน้าบันทึก VIS |
| `src/pages/reports/` | ใบคะแนนและการตรวจรายชื่อ |
| `src/pages/matches/`, `src/pages/competitions/` | รายละเอียดแมตช์และการแข่งขัน |
| `src/pages/public/` | หน้าผู้ชมและ Livescore |
| `src/components/` | แท็บ ฟอร์ม modal และองค์ประกอบ แยกตามกลุ่มงาน |
| `src/components/reports/` | แบบฟอร์มและองค์ประกอบเอกสาร PDF |
| `src/components/layout/`, `src/components/shared/`, `src/components/ui/` | โครงหน้า ส่วนประกอบร่วม และ UI พื้นฐาน |
| `src/offline/` | IndexedDB, PIN, routing และ sync |
| `src/utils/` | formatters และเครื่องมือตามกลุ่มงาน |
| `src/hooks/`, `src/context/` | Hooks และ context ร่วม |
| `src/assets/` | รูปภาพและเสียงที่ import จาก source |
| `public/` | ไฟล์ที่เรียกด้วย URL คงที่ |
| `scripts/` | สร้าง engine และตรวจ PWA |

แท็บใน AdminDashboard อยู่ใน `components/admin/` ส่วนหน้าที่ใช้ route อยู่ใน `pages/` และ tests ของ client อยู่ข้างโมดูลที่ทดสอบ

เครื่องมือใน `utils/` แยกเป็น `scorer/`, `vis/`, `reports/`, `navigation/`, `i18n/` และ `common/` ส่วนการจัดรูปแบบทั่วไปอยู่ที่ `utils/formatters.js`

`offline/visEngine.js` เป็นไฟล์สร้างอัตโนมัติ แก้กฎที่ backend แล้วใช้ `npm.cmd run generate:vis-engine` จาก `client/`

## Backend: backend

| โฟลเดอร์ / ไฟล์ | หน้าที่ |
| --- | --- |
| `server.js` | จุดเริ่มต้น Express |
| `routes/` | เส้นทาง API |
| `controllers/` | การประมวลผลคำขอ |
| `middleware/` | ตรวจสิทธิ์ ตรวจข้อมูล และ rate limit |
| `config/` | MySQL และการตั้งค่าระบบ |
| `utils/` | กฎการแข่งขันและเครื่องมือร่วม |
| `migrations/`, `seeds/` | SQL ตามลำดับเวอร์ชัน |
| `scripts/` | Migration และ seed runners |
| `scripts/debug/` | สคริปต์ตรวจข้อมูลสำหรับพัฒนา |
| `tests/` | Backend tests และ MySQL integration tests |

SQL เข้าผ่าน `config/db.js` และคงลำดับ migrations เดิมเพื่อรักษาประวัติการติดตั้ง

## เอกสารและไฟล์ประกอบ

- `docs/guides/`: คู่มือผู้ใช้งาน
- `docs/technical/`: เอกสารสำหรับผู้พัฒนา
- `legacy/`: โค้ดเก่าสำหรับอ้างอิง ไม่ใช่ entry ของแอป
- `tmp/`: ไฟล์ทำงานชั่วคราวที่ไม่เข้า Git
- `.env`: อยู่ที่รากของแต่ละแอปตามเดิม

## ตรวจสอบหลังย้ายหรือเพิ่มไฟล์

จาก `client/` รัน `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` และ `npm.cmd run test:pwa`

จาก `backend/` รัน `npm.cmd test` และ `node --check` สำหรับไฟล์ JavaScript ที่แก้ไข
