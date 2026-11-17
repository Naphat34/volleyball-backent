# ตรวจยืนยันการย้ายฐานข้อมูล — 16 พฤศจิกายน 2026

> อัปเดตล่าสุด: ผู้ใช้เลือก PostgreSQL ในเครื่องและอนุมัติสร้าง `Volley_db2026` โดยคัดลอก schema จากฐาน `postgres` ในเครื่อง ดำเนินการแล้วและตรวจผ่าน ดู [ผลตรวจฐานในเครื่อง](local-postgres-master-data-2026-11-16.md) ผล Supabase ด้านล่างเป็นหลักฐานแยกของ Online ไม่ใช่ฐานหลักที่ผู้ใช้เลือกในปัจจุบัน

## ข้อสรุปที่ยืนยันจากไฟล์และประวัติ

เคยย้ายโค้ดและข้อมูลจาก MySQL ไป Supabase PostgreSQL จริง ไม่ใช่เพียงแผนงาน

- Git commit `aedaf5d` วันที่ 13 พฤศจิกายน 2026 เพิ่ม PostgreSQL adapter, schema migrations, เครื่องมือย้ายข้อมูล และการตรวจสอบ
- `docs/technical/supabase-data-migration.md` ระบุโอน 24 application tables รวม 119 แถว และตรวจข้อมูลหลัง commit แล้ว
- รายงานภายใน `tmp/data-migration/latest-report.json` มีสถานะ `committed`, 24 ตาราง, sourceRows รวม 119 และ targetRows รวม 119 สอดคล้องกับเอกสาร
- `backend/render-supabase.env` กับ `Connection postgres Online.txt` เลือก `DB_PROVIDER=postgres`, schema `volley`, preview mode และตรวจสอบ TLS โดยอ้างอิง CA ที่มีอยู่
- host/port/database ใน URL ของไฟล์ทั้งสองตรงกัน; URL หลักและ staging ในไฟล์ Online ก็ชี้ฐานเดียวกัน จึงไม่ควรถือว่าชื่อ STAGING รับประกันการแยกฐาน

## ความขัดแย้งของ local environment ปัจจุบัน

`backend/.env` ที่ตรวจ ณ วันนี้ไม่มี `DB_PROVIDER`, `DATABASE_URL`, `DB_POSTGRES_PREVIEW` หรือ `DB_PG_SCHEMA` แต่มีตัวแปร MySQL และพอร์ต 5432

`backend/config/db.js` ใช้ `process.env.DB_PROVIDER || 'mysql'` และ `backend/server.js` โหลด `.env` ดังนั้นหากเริ่ม backend ใหม่โดยไม่มี environment ภายนอก override จะเลือก MySQL ตามค่าเริ่มต้น ค่าตั้งนี้ไม่ตรงกับเอกสารวันที่ 13 พฤศจิกายนที่ระบุว่า local environment ถูกตั้งเป็น PostgreSQL แล้ว ไม่ทราบว่าไฟล์ถูกแทนที่เมื่อใดหรือด้วยเหตุใด

ข้อสรุปนี้อธิบายการเลือก provider จากไฟล์ ไม่ได้ยืนยัน environment ที่ process backend ซึ่งเปิดค้างอยู่โหลดไปก่อนหน้านี้ หรือ environment ของ deployment จริง

`backend/mysql-source.env` ยังเก็บการเชื่อมต่อ MySQL พอร์ต 3306 สำหรับต้นทางเดิม ส่วนบริการ MySQL ในเครื่องก็ตรวจพบพอร์ต 3306 พอร์ต 5432 เคยตรวจพบ process PostgreSQL อยู่ การมีบริการทั้งสองในเครื่องไม่ได้แปลว่าแอปใช้ทั้งสองฐาน

## ผลต่อการตรวจ Master Data

การตรวจ MySQL ในรอบก่อนยังไม่ได้อ่านข้อมูลสำเร็จ จึงไม่ควรใช้เป็นฐานสรุปคุณภาพข้อมูลปัจจุบัน ควรตรวจ PostgreSQL ปลายทางที่ย้ายแล้วก่อน และถ้าจะเปรียบเทียบต้นทาง ให้กำหนดเป็นงานเปรียบเทียบแยกต่างหาก

ยังไม่ได้แก้ `.env`, restart backend, เปลี่ยน provider, รัน migration/import หรือแก้ข้อมูลใด การย้ายข้อมูลเดิมถูกบันทึกเป็น Supabase staging; เอกสารระบุ production cutover ยังไม่ได้ทำ จึงห้ามสรุปว่าระบบ production ทั้งหมดสลับแล้วจากหลักฐานนี้เพียงอย่างเดียว

## ผลตรวจ PostgreSQL ปลายทางจริง

เชื่อมต่อโดยใช้ `Connection postgres Online.txt` สำเร็จผ่าน TLS พร้อมตรวจสอบใบรับรอง ใช้ transaction `REPEATABLE READ READ ONLY` และจบด้วย rollback ไม่ import ข้อมูลหรือรัน migration

- เวลาบันทึก snapshot ของการตรวจ: 16 พฤศจิกายน 2026 เวลา 11:22 น. ตามเวลาไทย
- พบ 24 application tables รวม 160 แถวใน schema ที่ตั้งไว้
- พบประวัติ `001_baseline.sql`, `002_json_helpers.sql`, `003_public_uuid_identifiers.sql` และ seed `01_default_age_groups.sql`
- ไม่พบตาราง/คอลัมน์ที่ขาดเมื่อเทียบกับ baseline; ผลนี้ไม่ใช่การตรวจชนิดข้อมูล/constraint ทุกตัวเทียบ migration ทั้งหมด
- ชุดตรวจเบื้องต้น 36 กฎ: ไม่พบรายการที่ถูก flag และไม่มี query ที่ข้ามหรือผิดพลาด ขอบเขตกฎมีอธิบายใน `master-data-audit.md`
- จำนวนปัจจุบันต่างจากรายงานย้ายเดิม 119 แถว จึงไม่ควรนำ snapshot เก่ามาทับฐานนี้ หรือสลับกลับ MySQL โดยไม่ reconcile ข้อมูล
- รายงานเครื่องอยู่ที่ `tmp/master-data-audit/postgres.json` (ignored, ภายในเครื่อง)

| กลุ่ม | จำนวนปัจจุบัน |
|---|---:|
| ผู้ใช้ | 6 |
| ทีม | 2 |
| นักกีฬา | 24 |
| การแข่งขัน | 2 |
| แมตช์ | 1 |
| รุ่นอายุ | 5 |
| สนาม | 3 |
| ผู้ตัดสิน | 6 |
| บุคลากร Scorer | 2 |
| บุคลากรทีม | 4 |
| รายการลงทะเบียน team_entries | 2 |
| รายชื่อนักกีฬาประจำรายการ | 20 |

บัญชีทั้งหมด 6 บัญชีเป็น active: admin 1, score 1, statistician 1, referee 1, team_staff 2 โดยยังไม่มี role super_admin ทั้งสามแบบที่เสนอไว้ score/statistician ยังถูก normalize เป็น scorer ตามโค้ดปัจจุบัน

สิ่งที่ต้องทบทวนต่อ: ทีม 2 ทีมเป็น pending ขณะที่รายการลงทะเบียน 2 รายการเป็น approved ซึ่งเป็นสถานะคนละมิติ ต้องยืนยันนโยบายก่อนตัดสินว่าเป็นข้อมูลผิด; แมตช์ 1 รายการมีสถานะ live จึงต้องวางแผนก่อน restart หรือย้ายค่าการเชื่อมต่อ แมตช์ live ที่เก็บไว้ไม่ยืนยันว่ามีการแข่งขันจริงในเวลานี้

ตาราง custom_vis_matches, custom_vis_player_links, line_judges และ scorer_offline_sessions ไม่มีแถว แต่ยังไม่ใช่หลักฐานว่าฟีเจอร์เลิกใช้ ห้ามลบตารางจากเหตุผลนี้เพียงอย่างเดียว

## แนวทางแก้ค่าตั้งที่พร้อมใช้ตรวจทาน

เมื่อได้รับคำสั่งให้แก้ ให้ใช้ provider, URL, schema, preview guard และ TLS/CA จากชุด PostgreSQL ที่ตรวจเชื่อมต่อสำเร็จ ปรับเฉพาะตัวแปรฐานข้อมูลใน `backend/.env` โดยรักษา JWT/port/frontend และค่าที่ไม่เกี่ยวข้องเดิม ไม่คัดลอกไฟล์เชื่อมต่อทั้งไฟล์ทับโดยอัตโนมัติ ไม่แสดง URL/secret ใน log และไม่ commit `.env`

ก่อน restart ต้องตรวจว่า process ที่ให้บริการอยู่ใช้ environment ใดและมีผู้บันทึก/งาน Offline ค้างหรือไม่ การแก้ค่าครั้งนี้ไม่ต้องรัน importer หรือสร้างตารางใหม่

## หลักฐานที่ใช้อ้างอิง

- `backend/config/db.js`
- `backend/config/postgres.js`
- `backend/server.js`
- `docs/technical/supabase-data-migration.md`
- `docs/technical/supabase-migration-validation.md`
- `docs/technical/postgres-api-review-2026-11-13.md`
- `backend/SUPABASE_MIGRATION.md`

ไฟล์เชื่อมต่อและรายงานข้อมูลภายในไม่ได้คัดลอก secret หรือข้อมูลส่วนตัวลงเอกสารนี้
