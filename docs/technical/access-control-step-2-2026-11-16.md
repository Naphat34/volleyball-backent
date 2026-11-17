# ขั้นที่ 2 — ตรวจและออกแบบสิทธิ์ Volley

อัปเดตการพัฒนา: ดู [สถานะโค้ดและ migration](access-control-implementation-2026-11-16.md) โครงสร้างและ API/หน้าจอได้เตรียมแล้ว แต่ยังรัน 004 กับ schema แอปไม่ได้จนกว่าจะได้คำตอบเรื่อง schema และยังมีประเด็น UUID/การแก้หลังจบที่รอการตัดสินใจ

วันที่: 16 พฤศจิกายน 2026

สถานะ: ตรวจโค้ดและจัดทำแบบสิทธิ์ตามคำตอบผู้ใช้แล้ว ยังไม่ได้แก้ permission ที่ใช้งานจริง สร้างบัญชี รัน migration หรือเปลี่ยนข้อมูลในฐานใด

ฐานหลักสำหรับพัฒนาต่อคือ PostgreSQL ในเครื่อง `Volley_db2026` / schema `volley` ผลขั้นที่ 1 พบ 24 ตารางและ 0 แถว ข้อสรุปครั้งนี้จึงมาจากการตรวจโค้ดและ tests ไม่ใช่การทดสอบกับบัญชีจริง

## 1. นโยบายที่ผู้ใช้ยืนยัน

| เรื่อง | ข้อกำหนด |
|---|---|
| ผู้ดูแล | super_admin, super_admin_scorer และ super_admin_vims บันทึกคะแนนหรือสถิติไม่ได้ |
| บทบาทต่อบัญชี | หนึ่งบัญชีมีบทบาทเดียว ไม่มีการสลับบทบาทหรือเพิ่ม role ผู้บันทึกให้บัญชีผู้ดูแล |
| ผู้บันทึกแมตช์ทางการ | เข้าถึงทุกแมตช์ในรายการที่ได้รับสิทธิ์ ไม่บังคับ assignment รายแมตช์ |
| ผู้ดูแล Scorer/VIMS | ดูแลเฉพาะรายการที่ได้รับสิทธิ์ |
| ตรวจรับผล | super_admin_scorer ยืนยันคะแนน; super_admin_vims ยืนยันสถิติ ไม่เพิ่มบทบาท reviewer แยก |
| บุคคลทั่วไป | ดูคะแนนสด รายชื่อแข่งขัน และใบบันทึกผลทุกแมตช์ทางการตามรูปแบบเดิม |
| แมตช์สร้างเอง | ต้องผูกกับรายการแข่งขันก่อนส่งตรวจ; คงฉบับร่างของเจ้าของก่อนผูกได้ |
| ระงับบัญชี | เพิ่ม banned แยกจาก inactive ในฐานข้อมูล |
| Role ที่ไม่มีหน้าที่ | เลิกสร้าง staff และ user; ให้เลือกบทบาทที่กำหนดสิทธิ์ชัดเจน |

นโยบายนี้แทนข้อเสนอเดิมเรื่องหลายบทบาท ผู้ตรวจแยก การมอบหมายแมตช์เป็นเงื่อนไขสิทธิ์ และการเปิดเผยแมตช์ทางการเฉพาะหลังเผยแพร่ ในเอกสารร่างรอบแรก

## 2. ผลตรวจสภาพปัจจุบัน

| ID | ช่องว่าง/ปัญหา | หลักฐาน | แนวทางที่ต้องพัฒนา |
|---|---|---|---|
| ACL-01 | score และ statistician เป็น scorer ใน backend เหมือนกัน | config/permissions.js: roleAliases | แยก score.record กับ vims.record และถอน alias statistician → scorer หลังปรับทุกทางเข้า |
| ACL-02 | ยังไม่มีบทบาทผู้ดูแลใหม่ทั้งสาม | permissions.js, authController.js | เพิ่ม role ที่อนุญาตและ permission ที่ระบุชัด หลีกเลี่ยง wildcard ให้สิทธิ์บันทึกโดยไม่ตั้งใจ |
| ACL-03 | ไม่มีทะเบียนสิทธิ์ตามรายการในโครงสร้างปัจจุบัน | baseline และ middleware/authMiddleware.js | เพิ่ม user_competition_access และตรวจ resource ว่าอยู่ในรายการที่บัญชีได้รับสิทธิ์ |
| ACL-04 | สิทธิ์จัดการเจ้าหน้าที่ใช้ competition.manage แทน official.manage | routes/api.js: mount officialRoutes | เปลี่ยนเป็นสิทธิ์บุคลากรโดยตรงและแยก master identity กับการมอบหมายประจำรายการ |
| ACL-05 | helper บุคลากรใน scorerRoutes ตรวจเพียง token ไม่ reload active status | scorerRoutes.js: /referees, /scorers, /line-judges | ใช้ active-account check และ official.read ตามขอบเขต |
| ACL-06 | Socket ใช้ socket.user ที่ cache และยังไม่ตรวจ scope ตามรายการ | server.js: getSocketUser, canJoinMatchRoom | ตรวจ account/role/scope ปัจจุบันสำหรับสมาชิกที่มีสิทธิ์ภายใน และถอดสมาชิกเมื่อถอนสิทธิ์ |
| ACL-07 | หน้า /admin รับ admin เท่านั้น แต่ organizer มี permission บริหารอยู่ | client/src/App.jsx, permissions.js | ใช้ permission/scope กลางเปิดหน้าบริหารตามบทบาท ไม่ใช้ชื่อ role เดิมกระจาย |
| ACL-08 | Offline grant/ทางเข้าอิง role เดิมและ match.score ร่วมกัน | offlineAuth.js, entryRouting.js, scorerOfflineController.js, customVisController.js | grant แยก domain และตรวจ permission/scope ปัจจุบันเมื่อ checkout/sync |
| ACL-09 | ผู้บันทึกแมตช์สร้างเองยืนยันผลเองได้ | manualScorerController.js: action confirm | แยก submit ออกจาก confirm และบังคับ competition link + domain administrator |
| ACL-10 | custom VIS ใช้ match.score ในการสร้าง/แก้/เผยแพร่/เปิดแก้ | customVisRoutes.js | แยก vims.record, submit, confirm, publish, reopen; เจ้าของไม่ยืนยันตนเอง |
| ACL-11 | API รองรับ banned แต่ schema users.status ไม่มี banned | authController.js: ADMIN_MANAGED_STATUSES, baseline users CHECK | migration เพิ่ม banned และตรวจให้ HTTP/Socket/Offline ปฏิเสธตามสถานะ |
| ACL-12 | staff/user สร้างผ่าน API ได้แต่ไม่มี permission map | authController.js: ADMIN_MANAGED_ROLES | ปฏิเสธบทบาทกำกวมและกำหนดบทบาทชัดเจนตามที่ผู้ใช้ยืนยัน |
| ACL-13 | public match/roster/state ใช้ข้อมูลร่วมกับหน้าปฏิบัติงาน และบางจุด SELECT m.* | scorerRoutes.js, scorerController.js | คงสิทธิ์อ่านแมตช์ทางการเดิม แต่แยก public projection ออกจาก field ภายใน/ข้อมูลเอกสารส่วนตัว |
| ACL-14 | public กับเจ้าหน้าที่รับ event จากห้อง match เดียวกันหลายชนิด | server.js และ matchController.createRequest | คงคะแนน/รายชื่อสาธารณะ แยก event ภายใน เช่นคำขอที่รออนุมัติจาก public room |
| ACL-15 | /api/debug/uploads อยู่นอก router และไม่มี guard ที่ประกาศ | server.js: app.get | จัดไว้เป็น system.diagnostics สำหรับผู้ดูแลระบบ ไม่ให้เป็นช่องทางข้ามสิทธิ์รายชื่อไฟล์ |

ACL-06/13/14 เป็นข้อสังเกตจากโค้ด ยังไม่ได้ทำ penetration test หรือสรุปว่าข้อมูลลับถูกเปิดเผยจริง ห้ามตีความว่าทุก field หรือทุก event เป็นความลับ ต้องกำหนด response schema ตามหน้าที่

ทุกข้อในตารางยังไม่ได้แก้ runtime รอบนี้ ประเด็นที่เกี่ยวข้องกับนโยบายได้ถามก่อนและบันทึกคำตอบแล้ว ปัญหาทางเทคนิคที่เหลือแสดงไว้สำหรับตรวจทานก่อนลงมือแก้

## 3. บทบาทเป้าหมายและขอบเขต

ใช้หนึ่งค่าใน users.role ต่อบัญชี ไม่สร้าง user_role_assignments แบบหลายบทบาท

| Role | หน้าที่/ขอบเขต | เขียนคะแนน | เขียน VIMS | ตรวจรับ |
|---|---|---|---|---|
| super_admin | ดูแลระบบ บัญชี ข้อมูลอ้างอิง และมอบสิทธิ์รายการทั้งระบบ | ไม่ได้ | ไม่ได้ | ไม่ให้ข้ามผู้ดูแลส่วนงานโดยอัตโนมัติ |
| super_admin_scorer | จัดบุคลากร/ติดตาม/ตรวจผล เฉพาะรายการที่ได้รับสิทธิ์ | ไม่ได้ | ไม่ได้ | คะแนนในรายการที่ได้รับสิทธิ์ |
| super_admin_vims | จัดบุคลากร/ติดตาม/ตรวจสถิติ เฉพาะรายการที่ได้รับสิทธิ์ | ไม่ได้ | ไม่ได้ | VIMS ในรายการที่ได้รับสิทธิ์ |
| organizer | จัดรายการ การสมัคร และตารางแข่งที่ได้รับสิทธิ์ | ไม่ได้ | ไม่ได้ | ไม่มี |
| scorer | เตรียมและบันทึกคะแนนทุกแมตช์ทางการในรายการที่ได้รับสิทธิ์ | ได้ตามขอบเขต | ไม่ได้ | ส่งตรวจเท่านั้น |
| vims_operator | บันทึกสถิติทุกแมตช์ทางการในรายการที่ได้รับสิทธิ์ | ไม่ได้ | ได้ตามขอบเขต | ส่งตรวจเท่านั้น |
| team_staff | จัดการทีมตนและส่งรายชื่อ/คำขอตาม workflow | ไม่ได้ | ไม่ได้ | ยืนยันส่งรายชื่อทีม ไม่ใช่รับรองผล |
| referee | อ่านงานผู้ตัดสินที่อนุญาต ไม่ได้รับสิทธิ์บันทึกจากชื่อตำแหน่ง | ไม่ได้ | ไม่ได้ | ไม่มีตามขอบเขตรอบนี้ |
| guest | ไม่ใช่บัญชีหรือ role ใน users; ดูข้อมูลสาธารณะแมตช์ทางการ | ไม่ได้ | ไม่ได้ | ไม่มี |

ชื่อ organizer/team_staff/referee คงชื่อเดิมที่มี permission ชัดเจนเพื่อลดการเปลี่ยนที่ไม่จำเป็น ชื่อ scorer/vims_operator เป็นชื่อเป้าหมายสำหรับแยกงาน ส่วน score/statistician/admin เดิมต้องมี mapping ที่ชัดเจนระหว่างเปลี่ยนระบบ ไม่เพิ่ม alias ที่ทำให้ผู้บันทึกข้ามส่วนได้

### กติกาการให้สิทธิ์

1. super_admin ให้/ถอนขอบเขตของผู้ดูแลส่วนงานและบัญชีปฏิบัติงาน
2. ผู้ดูแลส่วนงานให้สิทธิ์ผู้บันทึกใน domain ของตนได้เฉพาะรายการที่ตนมีสิทธิ์ ห้ามให้ role ผู้ดูแลระดับสูงหรือข้าม domain
3. บัญชี scorer/vims_operator ทุกคนในรายการเดียวกันเข้าถึงแมตช์ทางการได้ตามหน้าที่ ไม่ตรวจ match.scorer_id เป็นเงื่อนไขสิทธิ์
4. match assignments หากใช้ต่อ มีหน้าที่จัดตารางคน/แสดงผู้รับผิดชอบ ไม่เป็น ACL ของแมตช์ทางการ
5. การถือสิทธิ์เขียน Online/Offline ป้องกันคนแก้งานชนกัน แยกจากสิทธิ์เข้าถึงรายการ: role และ scope ผ่านก็ยังต้องผ่าน lease/revision/state
6. บัญชี pending/inactive/banned ไม่เข้าถึงงานภายใน แม้มี JWT เก่าหรือเคยได้รับ scope; Offline ที่ขาดเครือข่ายตรวจการถอนสิทธิ์ทันทีไม่ได้ ต้องแสดงข้อจำกัดและตรวจซ้ำเมื่อ sync
7. การเปลี่ยน role ต้องตรวจใหม่ว่าขอบเขตเดิมยังเหมาะสม ห้ามยก scope เดิมข้าม domain อัตโนมัติ
8. ห้ามยืนยันงานตนเองจาก submitted_by แม้บัญชีเปลี่ยน role ภายหลัง

## 4. Permission registry ที่ต้องจัดทำ

| กลุ่ม | Permission หลัก | ผู้ใช้งานหลัก |
|---|---|---|
| ระบบ | system.manage, system.monitor, system.diagnostics, audit.read | super_admin |
| บัญชี | identity.read, identity.manage; จำกัด role/domain/scope ที่มอบได้ | super_admin และผู้ดูแลส่วนงานตามขอบเขต |
| ข้อมูลหลัก | team.manage, athlete.identity.link, official.manage, stadium.manage | super_admin; งานทีมตนแยก team.self.manage |
| รายการ | competition.read/manage, registration.read/manage, match.read/manage | super_admin, organizer ตามขอบเขต |
| ทีม | team.self.read/manage, athlete.document.read/upload, match.request.create | team_staff ของทีมนั้น; admin ต้องมีสิทธิ์เอกสารโดยตรง |
| Scorer | score.read/prepare/record/submit, match.request.process | scorer ตามรายการ |
| ตรวจผล | score.confirm/return/reopen/publish, score.monitor | super_admin_scorer ตามรายการ |
| VIMS | vims.read/record/submit | vims_operator ตามรายการ |
| ตรวจสถิติ | vims.confirm/return/reopen/publish/monitor | super_admin_vims ตามรายการ |
| Offline | score.offline.prepare/checkout/sync/release และ vims.offline.* | ผู้บันทึกใน domain นั้น; ผู้ดูแลไม่มี recording permit |
| รายงาน | report.export + report domain + scope | ตาม role และรายการ/ทีมที่อนุญาต |
| สาธารณะ | public.read ผ่าน response ที่กำหนด | guest และผู้ใช้ทุกประเภท |

การยืนยัน/เผยแพร่เป็นการจัดการ workflow ไม่ใช่การอนุญาตให้ผู้ดูแลแก้แต้ม เหตุการณ์ ไลน์อัป หรือรายการสถิติแทนผู้บันทึก

ผู้ดูแล Scorer/VIMS อ่านข้อมูลข้าม domain ได้เท่าที่เป็นข้อมูลสาธารณะหรือข้อมูลที่จำเป็นประกอบการตรวจ แต่ไม่ใช้สิทธิ์นี้อ่านเอกสารนักกีฬา หรือแก้ข้อมูลหลักทั้งระบบ

## 5. ขอบเขตตามทรัพยากร

| Resource | วิธีหาขอบเขตที่ต้องตรวจบน server |
|---|---|
| competition | ตรวจ user_competition_access กับ competition.id |
| official match | อ่าน matches.competition_id จาก DB ไม่เชื่อ competition_id ที่ส่งมาแยกจาก match_id |
| entry/entry player | ไล่ entry_id → team_entries.competition_id/team_id และตรวจทีม/รายการ |
| own team | users.team_id และความสัมพันธ์เจ้าของทีมที่ controller ตรวจอยู่ |
| manual scorer match | เจ้าของทำ draft ได้; ก่อน submit ต้องมี competition_id และผู้ส่งมีสิทธิ์รายการนั้น; admin ตรวจรับต้องมีสิทธิ์รายการเดียวกัน |
| custom VIS match | owner_id สำหรับร่าง; เพิ่ม competition link ที่เชื่อถือได้ก่อน submit; อย่าใช้ชื่อรายการใน JSON เป็น ACL |
| report/export | กรอง query และทุกแถวตามขอบเขต ไม่ตรวจแค่ปุ่มดาวน์โหลด |
| websocket | public projection เปิดตามนโยบายเดิม; subscription ภายในตรวจ active role/scope และจัดการถอนสิทธิ์ |
| offline sync | user + domain + competition + match + device/lease + revision + สถานะปัจจุบัน |

## 6. โครงสร้างข้อมูลที่เสนอ (ยังไม่รัน migration)

- roles: code เป็น key; users.role เป็นค่าเดียวและอ้างอิง role ที่อนุญาต
- permissions และ role_permissions: catalog สำหรับตรวจสอบ อ้างอิงจาก registry ในโค้ดชุดเดียวที่เป็นต้นทางการบังคับใช้ ให้ seed/catalog sync จาก registry เดียวกัน ไม่เปิดให้แก้ permission อิสระจากหลายจุด ผู้ดูแลมอบบทบาทและขอบเขตที่กำหนดไว้ ส่วน UI ใช้ capabilities จาก session/API กลาง
- user_competition_access: user_id, competition_id, granted_by, granted_at, revoked_at; บังคับสิทธิ์ active ไม่ซ้ำ และเก็บผู้ให้/ถอนสิทธิ์ใน audit
- users: รองรับ banned, อาจเพิ่ม authorization_version สำหรับเพิกถอนเซสชัน/สิทธิ์ที่ cache
- review records แยก score/vims: match kind/id, competition_id, revision, submitted_by/at, confirmed_by/at, decision, reason; บังคับ confirm revision ที่ส่งมาตรวจจริง
- custom_vis_matches: เพิ่ม competition_id แบบ FK แยกจาก payload เพื่อใช้สิทธิ์ก่อนส่งตรวจ
- matches ที่สร้างเอง: ใช้ competition_id เดิมได้ แต่ต้องทดสอบ query ที่เดิมถือว่า manual ไม่มีรายการ และห้ามทำให้แมตช์ส่วนตัวถูกเปิดเป็นสาธารณะเพียงเพราะผูกรายการ
- ใช้ audit_logs เดิมต่อ เก็บ role/scope/value ก่อนหลังที่จำเป็น โดยไม่เก็บ password/token/เอกสารส่วนตัว

การมอบหมายรายแมตช์ไม่จำเป็นต้องเพิ่มเป็นตาราง ACL ตามนโยบายที่ผู้ใช้เลือก

ฐานในเครื่องไม่มี users จึงยังไม่มีบัญชีให้ migrate รอบนี้ แต่โค้ด UI และ API ยังอ้างชื่อ role เดิม ต้องปรับทั้งหมดพร้อมแผน compatibility ไม่เปลี่ยนเฉพาะ users.role

ฐานที่คัดลอกยังไม่มี migration history ที่ audit พบ ก่อนใช้ `004_access_control.sql` ต้องตรวจและ adopt baseline ที่มีอยู่ให้ถูกต้อง ห้ามรัน CREATE SCHEMA volley/CREATE TABLE เดิมซ้ำ และห้ามใช้ STAGING_DATABASE_URL ของ Supabase ในการแก้ฐานในเครื่อง

## 7. ทะเบียน API / UI / Socket / Offline

ไฟล์ [access-surface-inventory-2026-11-16.csv](access-surface-inventory-2026-11-16.csv) มี **170 จุดประกาศ route**: api.js 96, scorerRoutes.js 43, adminRoutes.js 4, customVisRoutes.js 14, officialRoutes.js 12 และ app-level debug 1

แต่ละแถวมี method, path, file/line, guard ปัจจุบัน, handlers, permission เป้าหมาย, scope และข้อควรตรวจ แถวที่ path/method ซ้ำกันเป็นคนละเงื่อนไขของ router เช่น upload-image จึงไม่ใช่จำนวน unique URL ทั้งหมด

ทะเบียนนี้ได้จาก static AST ของ route declarations ไม่ execute server และไม่จำลองการอนุญาตทั้งหมด ตัวแปร guard แบบ function บางตัวคงชื่อไว้เพื่อเปิดอ่าน definition; controller-level ownership/state checks ต้องอ่านร่วมด้วย โดยเฉพาะ:

- server mount manualScorerAccess อยู่ก่อน route กลุ่ม API และมีข้อจำกัดเฉพาะแมตช์สร้างเอง
- scorerRoutes ถูก mount โดยตรงและผ่าน api.js อีกทาง โดยทางตรงอยู่ก่อน จึงห้ามสรุปว่าทุก scorer read endpoint ได้รับ verifyApprovedToken ของ api.js
- parent ของ officialRoutes มี verifyApprovedToken และ canManageCompetitions ซึ่งใส่ไว้ในทะเบียน
- generic `/:action`, body.command และ offline operation ต้อง dispatch permission ตาม action จริง ตัวอย่าง confirm/publish ใช้สิทธิ์ผู้ดูแล ส่วน draft/ready/record ใช้สิทธิ์ผู้บันทึก ไม่ใช้ permission รวมเพียงตัวเดียว
- ยกเว้นชื่อ `offline-confirm` เดิม: controller ใช้จบแมตช์จากข้อมูลหลังซิงค์ ไม่ใช่การตรวจรับโดยผู้ดูแล ให้ใช้ความหมาย score.offline.finalize ของผู้บันทึก และเพิ่ม score.confirm เป็นขั้นตรวจรับแยก อย่าเปลี่ยนสิทธิ์จากชื่อ endpoint อย่างเดียว
- public manual/custom ยังต้องผ่าน owner/sharing/publication controls เดิม นโยบายเปิดดูทุกแมตช์ใช้กับแมตช์ทางการ

### หน้าจอและทางเข้าเป้าหมาย

| หน้า | การตรวจสิทธิ์เป้าหมาย |
|---|---|
| /admin | super_admin และ organizer ตามเมนูที่มี permission; ข้อมูลตาม scope |
| หน้าบริหาร Scorer (เพิ่มแยกจากหน้าบันทึก) | super_admin_scorer: งานค้าง/รายการ/ตรวจผล/บุคลากร ไม่มีปุ่มบันทึก |
| หน้าบริหาร VIMS (เพิ่มแยกจากหน้าบันทึก) | super_admin_vims: งานค้าง/รายการ/ตรวจสถิติ/บุคลากร ไม่มีปุ่มบันทึก |
| /adminscorer, /scorer/:matchId | scorer และ scope ตามรายการ; referee อ่านได้เฉพาะหน้าที่กำหนดแต่เข้าคอนโซลบันทึกไม่ได้ |
| /adminvis และหน้าบันทึก VIMS | vims_operator และ scope ตามรายการ |
| /team-dashboard, /staff/:matchId | team_staff และทีมตน/แมตช์ที่ทีมเข้าร่วม |
| หน้า public/viewer/scoresheet | แมตช์ทางการเปิดอ่านตามเดิม; แยกข้อมูลภายในและความเป็นส่วนตัวของ manual/custom |
| Login / returnTo / offline entry | ใช้ role เดียวที่ได้รับอนุญาต ไม่มี fallback บัญชีอื่นหรือสลับ role ผู้ดูแลเป็นผู้บันทึก |

รายการที่ได้รับสิทธิ์แสดงในตัวเลือกด้านบน ผู้มีสิทธิ์หลายรายการเลือกดูได้ แต่การเปลี่ยนตัวกรองหน้าเว็บไม่เปลี่ยนสิทธิ์ server

### Socket และ Offline

แยก public match events ออกจาก domain/private request events; อย่าใช้ role ที่ browser ส่งมารับรองตัวตน ตรวจสถานะบัญชีและ scope ใหม่สำหรับห้องภายในเมื่อ join/เปลี่ยนสิทธิ์ และถอดสมาชิกที่หมดสิทธิ์ออก Public viewer ยังดูแมตช์ทางการได้

Offline permit เป็นสิทธิ์เตรียมการของบัญชี ไม่ใช่สิทธิ์ทุกแมตช์ ใน checkout ต้องตรวจรายการที่อนุญาตอีกครั้ง และบังคับ lease ตาม user/device/domain ตาม workflow ที่มีอยู่ เมื่อ revoke/ban ขณะ offline ให้เก็บงานไว้ตรวจความขัดแย้งและตรวจปัจจุบันตอน sync ไม่ทิ้งข้อมูลหรือรับเข้าเงียบ ๆ

## 8. ลำดับพัฒนาถัดไปและเกณฑ์ตรวจรับ

1. ตรวจ/adopt schema history ของฐาน local แล้วเตรียม migration สำหรับ roles, competition access, banned และ review metadata โดยไม่รันกับ Online
2. สร้าง permission registry กลางและตัวตรวจ account/permission/scope; ทดสอบ allow/deny ทุกบทบาทก่อนเปลี่ยน router
3. แยก score/vims ใน API รวม legacy action และ generic action; เพิ่ม submit/confirm/reopen ตาม domain; ไม่ให้ admin บันทึกผ่าน match metadata
4. ปรับ UI/การเข้าสู่ระบบ/เมนูให้ตรง role เดียว พร้อมหน้าบริหารส่วนงานและตัวกรองรายการ
5. ปรับ Socket และ Offline permissions/leases และทดสอบถอนสิทธิ์/ban/ข้อมูลค้าง
6. สร้างบัญชีเริ่มต้นและข้อมูลอ้างอิงตามขอบเขตที่ตกลง แล้วทดสอบ flow จริงตั้งแต่สร้างรายการจนตรวจรับผล

กรณีทดสอบสำคัญ: ผู้ดูแลทั้งสามเรียก score/vims write โดยตรงไม่ได้; scorer เขียน VIMS ไม่ได้และกลับกัน; ผู้บันทึกสองคนในรายการเดียวกันเข้าถึงแมตช์ได้แต่ lease ชนต้องได้ conflict; ข้ามรายการถูกปฏิเสธ; ส่งตรวจ manual ที่ไม่ผูกรายการไม่ได้; ผู้ดูแลผิด domain/ผิดรายการยืนยันไม่ได้; banned/inactive/pending ใช้งานภายในไม่ได้; staff/user สร้างไม่ได้; public official ยังอ่านได้; private manual/custom ไม่เปิดเพิ่ม; export ไม่มีแถวเกิน scope; role/revision ถูกเปลี่ยนระหว่าง request ต้องไม่ผ่านการตรวจจาก cache เก่า

## 9. ผลตรวจที่รันในขั้นนี้

- Backend `npm.cmd run test:recording-policy`: ผ่าน 11 ไม่ผ่าน 0
- Client `node --test src/offline/entryRouting.test.js src/offline/accessRouting.test.js`: ผ่าน 15 ไม่ผ่าน 0
- สร้างทะเบียน 170 จุดประกาศ route และตรวจว่าทุกแถวมี permission/scope ข้อเสนอ ไม่มีแถว REVIEW_REQUIRED

Tests ที่ผ่านยืนยันพฤติกรรมเดิม รวมถึง alias statistician → scorer ซึ่งเป็นสิ่งที่ต้องเปลี่ยน ไม่ใช่หลักฐานว่าสิทธิ์เป้าหมายพร้อมใช้งานแล้ว ไม่มี frontend runtime change จึงไม่ได้รัน lint/build รอบเอกสารนี้
