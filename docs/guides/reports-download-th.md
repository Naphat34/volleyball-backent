# Workflow ดาวน์โหลด Reports & Documents

1. AdminReportCenter เรียก `api.downloadReport(type, format)` ผ่าน Axios instance กลาง โดยส่ง Bearer token ของ session ปัจจุบันและรับ `responseType: blob`
2. Backend ตรวจ token บัญชี active และ permission `report.export` ก่อนเข้า `/api/reports/:type.:format` โดย admin มีสิทธิ์ผ่าน wildcard และ organizer มีสิทธิ์ export ส่วน role อื่นยังถูกจำกัดตามเดิม
3. Report controller อ่านข้อมูลและส่ง CSV หรือ Excel พร้อม Content-Disposition เป็น attachment
4. Frontend ต้องคง Blob เดิม สร้าง object URL กดลิงก์ดาวน์โหลด แล้วคืน object URL

สาเหตุที่ดาวน์โหลดไม่สำเร็จ: response interceptor เดิมวนแปลงทุก object เพื่อแก้ URL ของรูปภาพ ทำให้ Blob ซึ่งไม่มี enumerable properties กลายเป็น `{}` และ `URL.createObjectURL` ล้มเหลว แก้ให้แปลงเฉพาะ JSON object/array/string พร้อมรักษา Blob, ArrayBuffer และ typed array

เมื่อ API ตอบข้อผิดพลาดเป็น JSON Blob หน้ารายงานจะอ่านรายละเอียดและแยกข้อความ 401/403 จากข้อผิดพลาดทั่วไป

## Team composition

เปิด Reports & Documents > Team composition แล้วเลือกรายการ รุ่น/ประเภท และทีมที่ลงทะเบียน ตั้ง Leg ฉบับแก้ไข และวันที่อ้างอิง จากนั้นดาวน์โหลดหรือดูตัวอย่าง PDF A4 แนวนอน ใช้แบบฟอร์มเดียวกับฝั่งทีม โดยชื่อสองภาษายังคงแสดงคู่กันตามแบบ

เจ้าหน้าที่ทีมกำหนดรายชื่อได้ที่ **Team dashboard > เจ้าหน้าที่ทีม > กำหนดเจ้าหน้าที่ประจำรายการ** เลือกรายการ/รุ่น/ประเภท เลือกบุคคลจากทะเบียนทีม แล้วกด **บันทึกเจ้าหน้าที่ประจำรายการ** ใช้ API `/my-team/entries/:entryId/staff` ที่ตรวจทั้ง role `team_staff` และความเป็นเจ้าของทีม บันทึกใน transaction และเก็บ audit log ส่วน admin ใช้รายชื่อที่ทีมกำหนดเพื่อดูและดาวน์โหลดรายงาน ไม่มีปุ่มหรือ endpoint กำหนดเจ้าหน้าที่ฝั่ง admin

ใช้ `/api/reports/team-composition/entries` สำหรับตัวเลือก และ `/api/reports/team-composition/:entryId` สำหรับข้อมูล ทั้งสอง endpoint ตรวจ `report.export` นักกีฬาใช้เฉพาะที่ผูกกับ entry เจ้าหน้าที่ใช้รายชื่อประจำ entry ก่อน หากยังไม่มี ใช้เฉพาะเจ้าหน้าที่ของทีมเดียวกันที่ยังไม่ได้ผูกกับรายการใด พร้อมแจ้งแหล่งข้อมูลบนหน้าจอ โดยไม่เปลี่ยนการลงทะเบียนและไม่ดึงเจ้าหน้าที่ของทีมอื่น การดาวน์โหลดแต่ละครั้งดึงข้อมูลใหม่ รองรับรายการที่ปิดรับสมัครแล้ว

ตรวจ workflow ด้วย `node scripts/checkTeamCompositionReport.mjs` และ `node --test tests/teamCompositionReport.test.js` ส่วน MySQL test ด้านล่างตรวจ SQL ของรายงานนี้ร่วมด้วย

## ตรวจสอบ

```powershell
cd client
node --test src/utils/common/apiResponse.test.js
node scripts/checkReportDownloads.mjs
npm.cmd run lint
npm.cmd run build
cd ../backend
$env:RUN_REPORT_DB_TESTS='1'
node --test tests/reportDownloads.mysql.test.js tests/adminReports.test.js tests/permissions.test.js
```

Browser test ต้องมี Playwright หรือกำหนด `PLAYWRIGHT_MODULE_PATH` และ `CHROME_BIN` โดยใช้ fixture ไม่เรียก API จริง ทดสอบปุ่ม CSV/XLS ครบ 4 ประเภท การแนบ token และเนื้อหาไฟล์ ส่วน MySQL test อ่านรายงานจาก schema จริงโดยไม่แก้ข้อมูลและไม่เขียนไฟล์รายงานจริงลงดิสก์
