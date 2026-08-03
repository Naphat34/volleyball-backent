# Volley eScore

ระบบจัดการแข่งขันวอลเลย์บอลพร้อม e-score, live scorer, roster, team registration, match management และรายงานสำหรับผู้ดูแลระบบ

## Project Structure

- `client/` React/Vite frontend
- `backend/` Express/MySQL backend
- `backend/migrations/` SQL migrations
- `backend/seeds/` SQL seed files
- `docs/` เอกสารประกอบด้าน encoding และ database compatibility

## Requirements

- Node.js 20+
- MySQL
- ใช้ `npm.cmd` บน Windows PowerShell ถ้า `npm` ถูกบล็อกด้วย Execution Policy

## Environment

สร้าง `backend/.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=volley
JWT_SECRET=change-me-in-production
CORS_ORIGINS=http://localhost:5173
```

สร้าง `client/.env`:

```env
VITE_API_URL=http://localhost:3000
```

Production ต้องตั้ง `JWT_SECRET` เป็นค่าที่แข็งแรง และตั้ง `CORS_ORIGINS` เป็น domain จริงเท่านั้น

## Install

```bash
cd backend
npm.cmd install

cd ../client
npm.cmd install
```

## Database

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

- [เอกสารระบบภาษาไทย](PROJECT_DOCUMENTATION_TH.md)
- [การอ่านไฟล์ภาษาไทย/UTF-8](docs/ENCODING_TH.md)
- [แนวทาง database schema compatibility](docs/DATABASE_SCHEMA_COMPATIBILITY_TH.md)
