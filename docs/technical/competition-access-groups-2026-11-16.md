# รวมชื่อรายการในหน้าสิทธิ์ Male/Female

วันที่ 16 พฤศจิกายน 2026

ผู้ใช้ขอให้รายการชื่อเดียวกันแสดงครั้งเดียวและมอบสิทธิ์ครอบคลุม Male/Female พร้อมยืนยันให้ขยายสิทธิ์เดิมด้วย

## ผลตรวจฐาน local

พบ competition ID 1 และ 2 เป็น “การแข่งขันกีฬานักเรียน นักศึกษา แห่งชาติ ครั้งที่ 42 ประจำปี 2570” ชื่อไทย/อังกฤษ กีฬา รุ่นอายุ วันที่ และสนามตรงกัน ต่างกันเฉพาะ Male/Female ชื่อในฐานเดิมไม่มี suffix แล้ว แต่หน้าเดิมยังแสดงหนึ่ง option ต่อ ID จึงเห็นชื่อซ้ำ

## การเปลี่ยนแปลง

- หน้าตัวกรอง ผู้ใช้/สิทธิ์ และเพิ่มบัญชี แสดงชื่อรายการเพียงครั้งเดียว ไม่มีคำต่อท้ายเพศ เลือกแล้วครอบคลุม ID ทั้งสอง
- ตัวกรองแมตช์ คิวตรวจรับ และตัวเลข Dashboard นับข้อมูลของทั้งสองประเภทเมื่อเลือกกลุ่มรายการนั้น
- API สร้างผู้ใช้และมอบสิทธิ์ขยาย IDs ให้ครบ Male/Female ของกลุ่มเดียวกันด้วย ไม่อาศัย frontend เพียงอย่างเดียว และตรวจสิทธิ์ผู้มอบทีละ ID ก่อนเขียนเสมอ
- ใช้ชื่อที่ตัด suffix เพศแล้วร่วมกับชื่ออังกฤษ กีฬา รุ่นอายุ วันที่ และสนามเป็นตัวตรวจกลุ่ม เพื่อป้องกันรวมรายการคนละงาน หากมีแถวเพศเดียวกันซ้ำในกลุ่ม จะไม่ขยายสิทธิ์อัตโนมัติ
- ข้อมูลรายการแข่งขันและแมตช์ยังแยก Male/Female ตาม ID เดิม ไม่มีการรวม/ลบตารางหรือเปลี่ยนการแข่งขันเป็น Mixed

## ขยายสิทธิ์เดิมตามคำยืนยัน

ใช้ `backend/scripts/reconcileCompetitionAccessGroups.js` ตรวจแผนก่อนและ apply เฉพาะ `Volley_db2026` ในเครื่อง พบ active grant เดิมเพียง user_id 1 / competition_id 1 จึงเพิ่ม competition_id 2 ให้บัญชีนั้นอีกหนึ่งแถว บัญชีที่ยังไม่มีสิทธิ์รายการไม่ถูกมอบสิทธิ์ใหม่โดยอัตโนมัติ

สำรองข้อมูลก่อนแก้ใน `tmp/master-data-audit/competition-access-before-grouping-1794816182063.json` และบันทึก `identity.expand_competition_groups` ใน audit ภายใน transaction เดียวกัน หากพบสิทธิ์หมวดคู่ที่เคยถูกถอน เครื่องมือจะหยุดให้ตรวจทานก่อน ไม่เปิดสิทธิ์ที่ถูกถอนกลับเงียบ ๆ

การเปลี่ยน grant เพิ่ม authorization_version ตามกลไกเดิม บัญชีที่ได้รับการขยายสิทธิ์ต้องเข้าสู่ระบบใหม่เพื่อใช้ session ล่าสุด

## การตรวจยืนยัน

- Backend access regression ผ่าน 27 รายการ และชุด competition-access-groups ผ่าน 2 รายการ
- Client admin-workspace ผ่าน 20 รายการ รวมการเลือกชื่อเดียวได้ทั้งสอง ID และไม่ขยายตัวเลือกเกินข้อมูลที่ผู้ดูแลมองเห็น
- Client lint/build และ backend syntax checks ผ่าน
- Browser local: ตัวกรองมีชื่อรายการหนึ่ง option; ช่องสิทธิ์ของแต่ละบัญชีและแบบฟอร์มเพิ่มบัญชีมีชื่อรายการเพียงหนึ่ง option เลือกตัวกรองได้ตามชื่อเดียว ภาพยืนยัน `tmp/access-qa/competition-groups.jpg`
- รีโหลด backend local พอร์ต 5000 แล้ว ไม่แก้ฐาน Online

คำสั่งตรวจเพิ่มเติม:

```powershell
# backend — check-only จะ rollback
node scripts/reconcileCompetitionAccessGroups.js
npm.cmd run test:competition-access-groups
npm.cmd run test:access-control

# client
npm.cmd run test:admin-workspace
npm.cmd run lint
npm.cmd run build
```
