# ขั้นตอนที่ 5 — ตรวจการแยก Scorer / VIMS

วันที่ 16 พฤศจิกายน 2026

ตรวจ HTTP, Socket, ขอบเขตรายการแข่งขัน, การรับ/คืนงานของแมตช์ส่วนตัว และ Offline โดยใช้ข้อมูลสังเคราะห์ใน schema local แยก ผลตรวจพบช่องโหว่ 2 จุด ทดสอบยืนยันก่อนแก้และแก้ตามคำอนุญาตของผู้ใช้แล้ว ไม่มี migration หรือการเปลี่ยน role catalog เพิ่ม

## ช่องโหว่ที่ยืนยันและแก้แล้ว

| จุดตรวจ | ผลก่อนแก้ในฐานทดสอบ | การแก้และผลหลังแก้ |
|---|---|---|
| ID ที่เข้ารหัสบางส่วนใน URL | ตัวตรวจสิทธิ์อ่าน ID จากช่วงตัวเลขต้น URL แต่ Express decode parameter เป็นอีก ID ได้ คำขอธรรมดาถูกปฏิเสธ 403 แต่รูปแบบเข้ารหัสเขียนแมตช์นอกสิทธิ์ได้ 200 | ใช้การ decode แต่ละส่วนของ path หนึ่งครั้งเหมือน Express, จับ ID จนจบส่วน, ปฏิเสธ slash/backslash/NUL ที่ซ่อนใน parameter และไม่ decode ซ้ำ ทดสอบ Online/Offline ที่ข้ามรายการได้ 403/400 และข้อมูลปลายทางไม่เปลี่ยน UUID เดิมยังใช้ได้ |
| รับ/คืนงาน VIMS ระหว่างถอนสิทธิ์ | การรับงานที่รอ row lock ยังสำเร็จ 200 หลังถอนสิทธิ์รายการแล้ว | ใช้ resource advisory lock และตรวจ active account/role/authorization_version อีกครั้งพร้อม shared user lock เหมือนเส้นทางบันทึก การรับและคืนงานที่รอแล้วถูกถอนสิทธิ์ถูกปฏิเสธ 403 และไม่เปลี่ยน assignment |

เลข ID ที่มีศูนย์นำหน้าใช้ advisory lock เดียวกับเลข ID ปกติ เพราะอ้างอิงแถว integer เดียวกัน ไม่เปิดช่องให้การตรวจรับกับการบันทึกล็อกคนละชื่อ ทดสอบร่วมกับ path ที่ encode แล้วใน native integration test

จุดแก้: `backend/utils/accessPath.js`, `middleware/accessBoundary.js`, `middleware/manualScorerAccess.js`, `middleware/recordingLock.js`

## สิทธิ์ที่ตรวจยืนยัน

| บทบาท | คะแนนทางการ | สถิติ VIMS | Offline |
|---|---|---|---|
| super_admin / super_admin_scorer / super_admin_vims | บันทึกไม่ได้ | บันทึกไม่ได้ | ขอสิทธิ์บันทึกไม่ได้ |
| scorer | บันทึกในรายการที่ได้รับสิทธิ์ | บันทึกไม่ได้ | ใช้ Scorer Offline |
| vims_operator | บันทึกไม่ได้ | บันทึกในรายการที่ได้รับสิทธิ์ | ใช้ VIMS Offline |
| organizer / team_staff / referee | บันทึกไม่ได้ | บันทึกไม่ได้ | บันทึกไม่ได้ |

Native HTTP test ตรวจ 8 บทบาทกับ 4 กลุ่ม endpoint (Online คะแนน, Online VIMS, Scorer sync, VIMS sync) รวม 32 กรณี คำขอที่ไม่มีสิทธิ์ถูกปฏิเสธ 403; คำขอที่บทบาทถูกแต่จงใจส่ง body ไม่ครบจึงได้ 400/409 ซึ่งไม่ได้ถือเป็นหลักฐานว่าบันทึกสำเร็จ มีกรณีบันทึกและซิงค์ด้วย payload สมบูรณ์แยกต่างหาก

- แมตช์ทางการยังเข้าถึงทุกแมตช์ในรายการที่ได้รับสิทธิ์ ไม่เพิ่มการบังคับมอบหมายรายแมตช์
- แมตช์ส่วนตัวที่เปิดให้ VIMS ยังคงต้องรับงานตาม assignment เดิม การตรวจใหม่ไม่ได้อนุญาตให้รับงานนอกขอบเขตรายการ
- VIMS Online และ Offline ที่บันทึกจริงไม่เปลี่ยน `live_state` หรือคะแนนทางการ; Scorer Offline ที่ซิงค์จริงไม่เปลี่ยน `vis_state`
- ส่งซิงค์ทั้งสองส่วนซ้ำไม่เพิ่มเหตุการณ์ซ้ำ การปฏิเสธ/ขัดแย้งไม่ทิ้ง journal ในเครื่องตามชุดทดสอบเดิม
- คงข้อจำกัดเดิมว่า lease Offline ของ Scorer กับ VIMS ในแมตช์ทางการเดียวกันชนกัน ต้องคืนสิทธิ์ก่อนสลับ ไม่ได้เปิดสอง Offline พร้อมกัน
- Socket ยังคงตรวจ role/status/version/scope ปัจจุบัน แยกห้องคำขอภายใน และไม่ส่งข้อมูลลับให้ผู้ชมทั่วไป ชุด regression Socket ผ่าน
- `/offline-confirm` ของ Scorer เป็นการจบสถานะการแข่งขันหลังซิงค์ ไม่ได้เขียนสถานะยืนยันใน `match_reviews`; การตรวจรับยังเป็นสิทธิ์ผู้ดูแลส่วนงาน

## ปรับเทสต์เก่าตามคำอนุญาต

1. `officialVisOffline.test.js`: ทำให้ controller ที่ replay ใน VM ใช้ mock roster เดียวกับ fixture รวมถึง nested require และปรับคำที่คาดจาก VIS Offline เป็น VIMS Offline ไม่ลดการตรวจ rollback/retry/ตัวตนผู้เล่น
2. `client/src/offline/scorerOffline.test.js`: เพิ่ม `policyVersion: 2` และ `domain: score` ให้สิทธิ์จำลองปัจจุบัน เทสต์ที่ห้ามสิทธิ์รุ่นเก่าบันทึกใน `accessRouting.test.js` ยังอยู่และผ่าน

ไม่เปลี่ยนกติกาคะแนน ไม่แก้ข้อมูลนักกีฬาจริง และไม่ผ่อนการตรวจสิทธิ์เพื่อให้เทสต์ผ่าน

## ผลทดสอบ

| ชุด | ผล |
|---|---|
| Access control / HTTP / Socket / review / UUID / path | ผ่าน 27 |
| Native PostgreSQL integration | ผ่าน 2 (รวมกรณี HTTP ย่อยและ race/retry) |
| Recording policy | ผ่าน 11 |
| Official VIMS Offline / VIS Offline / Scorer rules | ผ่าน 16 |
| Client Scorer Offline / access routing / entry routing / VIMS engine | ผ่าน 34 |
| Client ESLint และ backend syntax checks | ผ่าน |

```powershell
# backend
npm.cmd run test:access-control
npm.cmd run test:recording-policy
node --test tests/officialVisOffline.test.js tests/visOffline.test.js tests/scorerOfflineRules.test.js
$env:RUN_LOCAL_ACCESS_TESTS='1'
npm.cmd run test:recording-isolation:local

# client
node --test src/offline/scorerOffline.test.js src/offline/accessRouting.test.js src/offline/entryRouting.test.js src/offline/visEngine.test.js
npm.cmd run lint
```

Native tests ยอมรับเฉพาะ PostgreSQL local `Volley_db2026` และสร้าง schema สุ่มแยกจาก `volley` พร้อมล้างหลังจบ ไม่ได้เติมบัญชีหรือข้อมูลแข่งขันลงฐานแอป และไม่ได้เปลี่ยนฐาน Online การตรวจนี้ใช้ automated integration tests ไม่ใช่การจำลองเครื่อง Offline จริงหลายเครื่องผ่าน browser

หลังจบตรวจจริงพบ users 1, matches 0, competitions 0 และไม่มี schema ทดสอบ recording/access ค้างอยู่ รีโหลด backend local พอร์ต 5000 แล้ว และยืนยันว่าตัวตรวจ path รุ่นใหม่ปฏิเสธ parameter ที่ซ่อน slash ด้วย 400

ข้อจำกัด Offline เดิมยังมี: เมื่อเครื่องไม่เชื่อมต่อ ระบบไม่สามารถรับรู้การถอนสิทธิ์ทันที แต่ API จะตรวจสิทธิ์ปัจจุบันอีกครั้งตอนซิงค์ งานที่ถูกปฏิเสธต้องเก็บไว้สำรอง/ตรวจสอบ ไม่รับเข้าหรือลบทิ้งโดยอัตโนมัติ
