# Volley eScore

ระบบจัดการแข่งขันวอลเลย์บอลพร้อม e-score, live scorer, roster, team registration, match management และรายงานสำหรับผู้ดูแลระบบ

คู่มือผู้ใช้งาน: [คู่มือ VOLLEY VIS ภาษาไทยฉบับละเอียด](./docs/guides/vis-user-manual-th.md)

ScorerControl: [คู่มือ Offline และการซิงค์คะแนนทางการ](./docs/guides/scorer-offline-th.md)

## Project Structure

- `client/` React/Vite frontend
- `backend/` Express backend รองรับ PostgreSQL และ MySQL เดิม
- `backend/migrations/` SQL migrations
- `backend/seeds/` SQL seed files
- `client/src/pages/` หน้าตามกลุ่ม auth, admin, team, scorer, vis, reports, matches และ public
- `client/src/components/` ส่วนประกอบหน้าจอตามหน้าที่
- `client/src/auth/` เซสชันและการยืนยันตัวตน
- `client/src/offline/` แมตช์ในเครื่อง สิทธิ์ PIN และการซิงค์
- `client/src/utils/` เครื่องมือแยกตามกลุ่มงาน
- `docs/guides/` คู่มือผู้ใช้งาน
- `docs/technical/` เอกสารการทำงานและโครงสร้างระบบ
- `legacy/` โค้ดอ้างอิงเก่าที่ไม่ได้ใช้ในแอป

ดู [ผังโครงสร้างและหลักการวางไฟล์](docs/technical/project-structure.md) และ [สารบัญเอกสาร](docs/README.md)

งานสิทธิ์ Admin/Scorer/VIMS รุ่นใหม่: [สถานะพัฒนาและ migration local](docs/technical/access-control-implementation-2026-11-16.md) ใช้ PostgreSQL และยังมีข้อที่รอการยืนยันก่อนเปิดใช้จริง ส่วน MySQL adapter เป็นเส้นทางเดิมที่ยังไม่ได้เพิ่ม migration สิทธิ์รุ่นนี้

## Requirements

- Node.js 20+
- PostgreSQL สำหรับการพัฒนาในเครื่องปัจจุบัน (ยังรองรับ MySQL เดิม)
- ใช้ `npm.cmd` บน Windows PowerShell ถ้า `npm` ถูกบล็อกด้วย Execution Policy

## Environment

สร้าง `backend/.env`:

```env
NODE_ENV=development
PORT=5000
DB_PROVIDER=postgres
DB_POSTGRES_PREVIEW=true
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=Volley_db2026
DB_PG_SCHEMA=volley
DB_SSL=false
JWT_SECRET=change-me-in-production
CORS_ORIGINS=http://localhost:5173
```

สร้าง `client/.env`:

```env
VITE_API_URL=http://localhost:5000
```

Production ต้องตั้ง `JWT_SECRET` เป็นค่าที่แข็งแรง และตั้ง `CORS_ORIGINS` เป็น domain จริงเท่านั้น

กรอกรหัสผ่าน PostgreSQL ใน `.env` ภายในเครื่อง โค้ดรองรับทั้ง `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` และ `DATABASE_URL`; ถ้าตั้ง `DATABASE_URL` จะใช้ URL ก่อน สำหรับ Supabase ให้ใช้ TLS พร้อม CA ตาม [คู่มือย้าย PostgreSQL](backend/SUPABASE_MIGRATION.md) ค่า `DB_SSL=false` ข้างต้นใช้กับบริการ loopback ในเครื่องนี้ที่ไม่รองรับ SSL ส่วน preview guard ยังคงเปิดใช้งาน ไม่ใช่การรับรอง production cutover

ดู [ผลตั้งค่าฐานในเครื่องและตรวจ Master Data](docs/technical/local-postgres-master-data-2026-11-16.md) ฐานในเครื่องที่คัดลอกมีโครงสร้างแล้วแต่ยังไม่มีข้อมูล รวมถึงยังไม่มีบัญชีเข้าสู่ระบบ

สำหรับ frontend บน Vercel และ API บน Render ให้ตั้ง Environment ของบริการ API แล้ว redeploy:

```env
CORS_ORIGINS=https://volleyball-backent.vercel.app
FRONTEND_URL=https://volleyball-backent.vercel.app
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
```

Backend รวมโดเมนจาก `CORS_ORIGINS` และ `FRONTEND_URL` เป็นรายการที่อนุญาตสำหรับทั้ง CORS และ POST/PUT/PATCH/DELETE หากมีหลายโดเมนให้คั่นด้วย comma ตรวจสอบว่า OPTIONS `/api/auth/login` ตอบ 204 พร้อม `Access-Control-Allow-Origin` ตรงกับ frontend หาก API ไม่ทำงานหรือแพลตฟอร์มตอบ error ต้องแก้ deployment ของ API ก่อน

## Install

```bash
cd backend
npm.cmd install

cd ../client
npm.cmd install
```

## Database

ฐาน PostgreSQL ในเครื่องปัจจุบันถูกคัดลอกโครงสร้างไว้แล้ว ไม่ต้องรัน importer หรือ baseline ซ้ำ ยังไม่ได้บันทึก migration history ของต้นทาง ต้องทบทวนการ adopt schema ก่อนใช้ migration runner สำหรับ PostgreSQL

คำสั่งด้านล่างเป็นของ **MySQL เดิม** ใช้เมื่อเลือก `DB_PROVIDER=mysql` เท่านั้น สำหรับ PostgreSQL ดู [คู่มือ](backend/SUPABASE_MIGRATION.md); runner PostgreSQL ที่มีอยู่ใช้ `STAGING_DATABASE_URL` จึงไม่ควรรันกับค่าของ Online โดยเข้าใจว่าเป็นฐานในเครื่อง

```bash
cd backend
npm.cmd run migrate:status
npm.cmd run migrate
npm.cmd run seed:status
npm.cmd run seed
```

Migration runner ใช้ตาราง `schema_migrations` และ seed runner ใช้ตาราง `seed_migrations` เพื่อกันการรันซ้ำโดยไม่ตั้งใจ

## Development

Backend:

```bash
cd backend
npm.cmd run dev
```

Client:

```bash
cd client
npm.cmd run dev
```

## Verification

Backend:

```bash
cd backend
npm.cmd test
node --check server.js
```

Client:

```bash
cd client
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Roles

- `admin`: สิทธิ์ทั้งหมด
- `organizer`: จัดการแข่งขัน ทีม แมตช์ official รายงาน และ monitor socket
- `scorer` หรือ legacy `score`: บันทึกผลและ live scoring
- `team_staff`: จัดการทีมของตัวเองและดูแมตช์ที่เกี่ยวข้อง

## Reports

รายงาน backend รองรับ:

- `/api/reports/competitions.pdf`
- `/api/reports/competitions.xls`
- `/api/reports/teams.xls`
- `/api/reports/matches.pdf`
- `/api/reports/audit.csv`

ต้อง login และมี permission `report.export`

## More Docs

- [คู่มือการใช้งานระบบทั่วไป](docs/guides/user-manual-th.md)
- [โครงสร้างโครงการ](docs/technical/project-structure.md)
- [แมตช์ VIS สร้างเอง](docs/technical/custom-vis-matches.md)
- [สิทธิ์ Offline และเส้นทางเข้าสู่ระบบ](docs/technical/offline-auth-flow.md)
