# การพัฒนาสิทธิ์และ migration — ฐาน local

วันที่: 16 พฤศจิกายน 2026

หน้าจอผู้ดูแลได้รับการพัฒนาต่อใน [ขั้นตอนที่ 4 — หน้าจอผู้ดูแลสามส่วน](admin-workspaces-step-4-2026-11-16.md) ใช้เอกสารนั้นสำหรับเส้นทาง Dashboard และผลทดสอบหน้าจอล่าสุด

ตรวจและแก้การแยกการบันทึกต่อใน [ขั้นตอนที่ 5 — Scorer / VIMS](recording-isolation-step-5-2026-11-16.md) รวมช่องโหว่ encoded ID และการรับ/คืนงานระหว่างถอนสิทธิ์

สถานะ: ผู้ใช้ยืนยันให้ adopt ประวัติ 001–003 และรัน 004 ใน `Volley_db2026` แล้ว สำรอง schema ก่อนรันและ commit สำเร็จ สร้างบัญชีเริ่มต้น `super_admin` แล้ว ทดสอบ HTTP แยกกับฐานจริงได้ login/session 200 และ admin recording 403 รีสตาร์ต backend local พอร์ต 5000 ตามคำอนุญาตและทดสอบ browser ล็อกอินเข้าหน้า Admin/Access Center สำเร็จแล้ว ไม่ได้แก้ฐาน Online

## ขอบเขตที่พัฒนาแล้ว

- Registry กลาง `backend/config/permissions.js`: 8 บทบาท, 33 permission และ 56 role-permission pairs ไม่มี wildcard ผู้ดูแลทั้งสามบันทึกคะแนน/สถิติหรือขอ recording permit ไม่ได้
- แยก alias เดิม: admin → super_admin, score → scorer, statistician → vims_operator โดย statistician ไม่ได้รับ match.score อีก
- `004_access_control.sql`: roles, permissions, role_permissions, user_competition_access, match_reviews; รองรับ banned, role FK หนึ่งค่าต่อบัญชี, authorization_version และ competition link ของ custom VIS
- Catalog ใน SQL เป็น snapshot จาก registry; tests ตรวจให้ตรงกับ source of truth ในโค้ด ผู้ใช้ไม่แก้ permission catalog อิสระผ่านหน้าจอ
- HTTP access boundary ตรวจบัญชี active/permission/competition จริงจาก DB รองรับรายการที่ได้รับสิทธิ์โดยไม่ต้องมอบหมายแมตช์ทางการเป็นรายตัว กรอง list/export และแยกข้อมูลภายในจาก public projection
- ส่วนงานจัดการได้เฉพาะ operator ของ domain และรายการของตน เปลี่ยนบทบาท/ระงับทั้งบัญชี/รีเซ็ตรหัสผ่านได้เฉพาะ super_admin ตามคำตอบเพิ่มเติมของผู้ใช้
- API ใหม่ `/api/access/*` สำหรับ session/capabilities, catalog, รายการ, แมตช์, บัญชี, การให้สิทธิ์รายการ, การผูกแมตช์อิสระ, คิวและการส่ง/ตรวจรับผล
- Submit ต้องผูกรายการและผ่านความพร้อมของข้อมูล; score ตรวจเซต/ผู้ชนะ; custom VIMS replay ต้องจบจริง ไม่รับแค่ lifecycle ที่ตั้งว่า review
- ผู้ตรวจต้องเป็น domain administrator ในรายการเดียวกัน ห้ามตรวจงานที่ submitted_by เป็นบัญชีตนเอง แม้เปลี่ยน role ภายหลัง ตรวจ revision/fingerprint ก่อน confirm และเก็บ audit ใน transaction เดียวกัน
- ปิดทางยืนยัน/เผยแพร่โดยผู้บันทึกผ่าน legacy manual action และ CONFIRM ของ custom engine รวมเส้นทาง action ที่ encode ตัวอักษร ส่งไป workflow ผู้ดูแลแทน
- Recording/review ใช้ advisory lock แยก schema/resource; บัญชีถือ shared lock ระหว่างเขียน เพื่อให้การถอนสิทธิ์/เปลี่ยน role/status ไม่แทรกผ่านการตรวจต้นคำขอ
- Socket อ่าน role/status/scope ใหม่ แยกคำขอภายในเป็นห้อง Scorer/operations และตรวจสิทธิ์อีกครั้งก่อนส่ง event ภายใน Public official scores ยังคงอ่านได้ตามนโยบาย
- Offline permit รุ่น policyVersion=2 แยก score/vims; permit เก่าใช้ดู/สำรองได้ แต่ต้องต่ออายุออนไลน์ก่อนบันทึก ไม่ลบข้อมูลค้าง
- Scorer แก้ทะเบียนนักกีฬาของทีมในแมตช์/รายการที่มีสิทธิ์ได้ตามคำตอบผู้ใช้ ผ่าน transaction/การ sync roster เดิมที่คง snapshot ที่ล็อกไว้ ตรวจทีมและ offline lease ก่อนแก้
- `/api/debug/uploads` ตรวจ super_admin; helper บุคลากรตรวจ active account และ official.view
- หน้าจอใหม่ `/access-center`: แยกงานตามบทบาทเดียว เลือกรายการ มอบสิทธิ์ สร้างผู้ใช้ ผูกแมตช์ ส่งตรวจ ดูเซต/สถิติ และตรวจรับประวัติ revision ผู้ดูแลไม่มีปุ่มเข้าคอนโซลบันทึก
- ปรับทางเข้า Admin/Scorer/VIMS/ทีม และเมนู organizer ให้ตรงหน้าที่ เพิ่มลิงก์จากแดชบอร์ดเดิมไปศูนย์สิทธิ์/ตรวจรับ

รายการทางการยังเปิดคะแนน รายชื่อ และใบบันทึกผลตามเดิม การตรวจรับไม่ใช่เงื่อนไขเปิดดูแมตช์ทางการ การเผยแพร่แมตช์ส่วนตัวของ Scorer ใช้ผู้ดูแล Scorer; custom VIMS ใช้ผู้ดูแล VIMS การยืนยัน VIMS ของ manual scorer ไม่ได้ให้สิทธิ์เปิดเผยคะแนนส่วนตัวโดยอัตโนมัติ

## เรื่องที่ยืนยันและดำเนินการแล้ว

1. **Adopt schema / apply 004:** อนุญาตข้อยกเว้น cast ของ `team_entry_players.chk_entry_libero` ที่ทดสอบเทียบ 250 กรณี และอนุญาต normalize CRLF/LF ในตัวตรวจ SQL function เท่านั้น ไม่แก้ function/constraint เดิม รัน migration สำเร็จ
2. **บัญชีแรก:** ใช้ชื่อ `super_admin` สร้าง bcrypt hash และ audit ในฐาน local แล้ว ไม่มีรหัสผ่าน/token ในเอกสารหรือ output การทดสอบ
3. **แก้แมตช์หลังจบ:** คง completed แก้เหตุการณ์และคำนวณใหม่ พร้อมเหตุผล/ข้อมูลก่อน–หลังใน audit และส่งตรวจ revision ใหม่ หาก VIMS กำลังตรวจหรือยืนยันแล้ว ต้องให้ผู้ดูแล VIMS เปิดแก้ก่อนแก้คะแนนตามคำยืนยัน
4. **UUID / private ACL:** คง UUID และ resolve ก่อนตรวจสิทธิ์ทีม/นักกีฬา รวม numeric ID ที่ encode ใน URL ทดสอบ HTTP anonymous/owner/outsider ผ่าน

เครื่องมือแก้ย้อนหลัง `/api/access/matches/:kind/:id/:domain/correction` แยก GET/PUT จากคอนโซล Live ใช้ resource lock, active account/version, competition, private owner/assigned writer, latest returned/reopened review, revision/fingerprint, offline lease และเหตุผลบังคับ ทุกการเขียนกับ audit อยู่ใน transaction เดียว

ขอบเขตปัจจุบัน: Scorer เปลี่ยนทีมที่ได้คะแนนของ POINT เดิมและ replay คะแนน/การหมุนตำแหน่ง/การเปลี่ยนตัว/ผลเซต/ผลรวม/สถานะที่ใช้รายงาน; VIMS เปลี่ยนทีม/นักกีฬา/ทักษะ/ผลของสถิติเดิมแล้ว replay ทุกแรลลีผ่าน engine และคำนวณรหัส/คะแนน/บริบทใหม่ คง ID เหตุการณ์และเวลาบันทึก ไม่รองรับเพิ่มหรือลบเหตุการณ์ และไม่ย้ายขอบเขตเซตอัตโนมัติ หากข้อมูลไม่ครบ ไลน์อัปขัดกัน หรือผลไม่จบจริงจะ rollback ทั้งรายการ

ผู้ใช้ยืนยันคงลายเซ็นเดิมพร้อมระบุว่ามีการแก้ไข: correction เก็บ `matchSignatures` เดิมครบ เพิ่ม `live_state.resultCorrection` พร้อมฉบับและเวลา และแสดงข้อความ Result corrected retrospectively / Original signatures retained ใน Score Sheet และ O-4 เก็บข้อมูลก่อน–หลังใน audit เดิม ชุดทดสอบตรวจลายเซ็นที่คงอยู่และหลักฐานก่อนแก้ผ่านแล้ว คอนโซล Live ปกติถูกบล็อกเมื่อ review returned/reopened และแมตช์จบแล้ว เพื่อบังคับใช้ correction center และไม่เปิด Live ใหม่

## การรัน migration เมื่อได้รับคำยืนยัน

เครื่องมือ `backend/scripts/migrateLocalAccess.js` ยอมรับเฉพาะ PostgreSQL loopback:5432 ฐาน Volley_db2026/schema volley และปฏิเสธ DATABASE_URL, host อื่น, ฐานอื่น หรือ provider อื่น ไม่มี fallback ไป STAGING_DATABASE_URL

```powershell
cd backend
npm.cmd run migrate:local:access:check
```

ค่าปกติจะหยุดเมื่อพบความต่างของ constraint ไม่ข้ามโดยอัตโนมัติ หลังผู้ใช้อนุญาตข้อ 1 จึงใช้:

```powershell
npm.cmd run migrate:local:access:check -- --accept-equivalent-libero
npm.cmd run migrate:local:access -- --accept-equivalent-libero
```

เครื่องมือเทียบ columns/constraints/indexes/triggers/functions กับ reference 001–003 ใน transaction ที่ rollback ถ้า check-only; ข้อยกเว้นตรวจได้เฉพาะ constraint ลิเบอโร่ที่ระบุ หากมีความต่างอื่นจะหยุด ไม่ลดระดับเป็นการเทียบชื่ออย่างเดียว

ก่อน apply จะใช้ pg_dump สำรอง schema แอปลง tmp/master-data-audit แล้วบันทึกประวัติและใช้ 004 ใน transaction เดียว หลังสำเร็จคาดว่าจะมี 29 application tables รวม catalog ไม่ได้เติมทีม/นักกีฬา/รุ่นอายุหรือข้อมูลแข่งขันโดยอัตโนมัติ

อย่าใช้ runner ของ staging กับฐานในเครื่องโดยอาศัยชื่อ environment และอย่ารัน importer MySQL/Supabase ทับฐานนี้ การทดสอบหรือแก้โครงสร้างรอบนี้ไม่ได้อนุญาตการเปลี่ยนฐาน Online

## บัญชีเริ่มต้นหลัง migration

เมื่อผู้ใช้กำหนดข้อมูลแล้ว เพิ่มสองค่านี้ใน backend/.env ภายในเครื่อง:

```env
BOOTSTRAP_ADMIN_USERNAME=ชื่อบัญชีที่เลือก
BOOTSTRAP_ADMIN_PASSWORD=กรอกรหัสผ่านภายในเครื่อง
```

จาก backend รัน `npm.cmd run bootstrap:local:admin` เครื่องมือยอมรับเฉพาะฐานในเครื่อง สร้างได้เมื่อ users ว่างเท่านั้น เก็บ bcrypt hash และ audit record ใน transaction เดียว ไม่พิมพ์รหัสผ่านและไม่ reset บัญชีเดิม ถ้ามี users อยู่แล้วจะหยุดให้ตรวจทาน

## ผลการตรวจ

| การตรวจ | ผล |
|---|---|
| ชุดสิทธิ์ HTTP/Socket/migration guard/corrections/path | ผ่าน 27 ไม่ผ่าน 0 |
| PostgreSQL regression suite | ผ่าน 62 ข้าม 2 ไม่ผ่าน 0; วางแผน static SQL 460 คำสั่ง |
| Recording policy | ผ่าน 11 ไม่ผ่าน 0 |
| Client access/offline routing + shared VIMS engine | ผ่าน 18 ไม่ผ่าน 0 |
| Custom VIS / Offline และ review เพิ่มเติม | ผ่านชุดที่เกี่ยวข้อง |
| Native PostgreSQL local | ผ่าน integration test ใช้ schema สุ่มแยก ทดสอบการเขียน/ตรวจรับ/lease/ถอนสิทธิ์ระหว่างรอ และล้างหลังจบ |
| Client lint/build | ผ่าน |

Native test ใช้ schema สุ่มแยกและล้างหลังจบ หลัง apply ฐานแอป `Volley_db2026/volley` ตรวจจริงพบ 29 ตาราง, users 1, roles 8, permissions 33, role_permissions 56 และ migration history 001–004 ครบ ไม่เติมข้อมูลแข่งขันสังเคราะห์ลง schema แอป

คำสั่ง:

```powershell
# backend
npm.cmd run test:access-control
npm.cmd run test:postgres
npm.cmd run test:recording-policy
$env:RUN_LOCAL_ACCESS_TESTS='1'
node --test tests/accessNative.test.js

# client
node --test src/offline/entryRouting.test.js src/offline/accessRouting.test.js
npm.cmd run lint
npm.cmd run build
```

ทดสอบ HTTP/Socket บน loopback ต้องมีสิทธิ์ network ในสภาพแวดล้อมที่จำกัดการเชื่อมต่อ Tests ที่เป็น PGlite ใช้ข้อมูลสังเคราะห์ในหน่วยความจำ ส่วน native test สร้างเฉพาะ schema ชื่อสุ่มตาม prefix ที่ตรวจสอบก่อนล้าง

ทดสอบบัญชีจริงผ่าน HTTP และ browser local หลังรีสตาร์ต backend พอร์ต 5000 แล้ว เข้า Admin และ Access Center สำเร็จ แสดง super_admin บัญชีเดียวและ role catalog ครบ ไม่สร้างทีม/แมตช์/บัญชีทดสอบลง schema แอป หลักฐานหน้าจออยู่ tmp/access-qa/super-admin-access-center.jpg ส่วนหน้าการแก้ผลและการพิมพ์รายงานที่มีแมตช์ยังไม่ได้ตรวจด้วย browser เพราะฐานแอปไม่มีข้อมูลแข่งขัน ใช้ automated replay/transaction tests และ lint/build ตรวจในรอบนี้ ไม่ได้ deploy ระบบ Online ไฟล์ `.env.production` ของ client ยังเป็นปลายทางเดิม; build เป็นการตรวจ compilation

ส่วนสิทธิ์รุ่นใหม่นี้พัฒนาและทดสอบสำหรับ PostgreSQL ไฟล์ adapter/migrations ของ MySQL เดิมยังเก็บไว้ แต่ไม่มี migration สิทธิ์รุ่นใหม่ของ MySQL และไม่ถือว่าใช้โค้ดชุดนี้กับ MySQL ได้โดยไม่ปรับเพิ่ม
