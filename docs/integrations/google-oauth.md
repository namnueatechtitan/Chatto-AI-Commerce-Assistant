# Google OAuth 2.0 — Phase 2

## 1. สิ่งที่เพิ่ม

- Sign in ด้วย Google ผ่าน Authorization Code + PKCE และ OpenID Connect
- ตรวจ state ที่ผูกกับ cookie ของเบราว์เซอร์, nonce และ Google ID token ด้วย `google-auth-library`
- ใช้ Google `sub` เป็นรหัสบัญชี ไม่ใช้ email เป็นรหัส Google
- สร้างผู้ใช้ใหม่โดยไม่สร้างร้านค้า/สิทธิ์ merchant เพิ่มให้เอง
- ไม่ผูกบัญชีรหัสผ่านเดิมโดยอัตโนมัติเมื่อ email ตรงกัน ให้ใช้รหัสผ่านเดิมก่อน
- session อายุ 7 วัน เก็บเฉพาะ SHA-256 hash ใน PostgreSQL; cookie เป็น HttpOnly และ SameSite=Lax
- session cookie ใช้ Secure เมื่อ WEB_URL เป็น HTTPS; HTTP อนุญาตเฉพาะ localhost/loopback
- หน้า Dashboard ตรวจ session; logout เพิกถอน session ในฐานข้อมูล

## 2. ตั้งค่า Google Cloud

1. เลือกหรือสร้าง project ใน [Google Cloud Console](https://console.cloud.google.com/).
2. ไปที่ Google Auth Platform ตั้งค่า Branding และ Audience ให้เหมาะกับบัญชีที่จะทดสอบ.
3. หากใช้สถานะ Testing ให้เพิ่มบัญชีทดสอบใน Audience ตามการตั้งค่าของ project.
4. ไปที่ Clients → Create client → Web application.
5. เพิ่ม Authorized redirect URI ให้ตรง **ทุกตัวอักษร**:
   `http://localhost:3000/api/auth/google/callback`
6. เก็บ Client ID และ Client Secret ใส่ `.env` เอง. Flow นี้ใช้ server redirect จึงไม่ต้องใช้ JavaScript SDK.

อ้างอิง: [Google web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
และ [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## 3. กรอก `.env` ที่ root

ไฟล์ `.env.example` มีช่อง Google เว้นว่างไว้ ไม่มี credentials จริง.
ถ้ายังไม่มี `.env` ให้คัดลอก `.env.example` เป็น `.env` แล้วกรอก:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
WEB_URL=http://localhost:3000
```

แต่ละตัวแปรต้องอยู่คนละบรรทัด URL เป็น plain text ไม่มี Markdown link หรือ backslash
หน้า underscore. ใช้ `WEB_URL` ไม่ใช่ `WEB_BASE_URL`.
ใช้ `DATABASE_URL` ของ PostgreSQL ที่ต้องการ. สำหรับรันบนเครื่องค่าเริ่มต้นใน example
คือ `postgresql://postgres:postgres@localhost:5432/chatto_phase2?schema=public`.

API อ่าน `.env` ที่ root. เว็บใช้ `/api/auth/*` บน origin เดียวกันและ proxy ไป API.
จึงต้องลงทะเบียน callback ที่พอร์ต **3000** แทนพอร์ต 4000.
ถ้า API ไม่ได้อยู่ `http://localhost:4000` ให้คัดลอก `apps/web/.env.example`
เป็น `apps/web/.env.local` และตั้ง `API_INTERNAL_BASE_URL` เป็น URL ภายในของ API.
ต้องตั้งค่านี้ก่อน build เว็บและตอน runtime ให้ตรงกัน.
Google Client Secret อยู่เฉพาะ API ไม่ใช้ตัวแปร `NEXT_PUBLIC_*`.
ค่า `JWT_SECRET` เดิมไม่ถูกใช้ใน session แบบ opaque นี้.

## 4. ติดตั้งและอัปเดตฐานข้อมูล

รันจาก root โดยใช้ Node.js 22+ และ pnpm 9.12.0 (google-auth-library 11 ต้องใช้ Node 22+):

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm --filter @chatto/api prisma migrate deploy
```

Migration `20260923000000_google_oauth` เพิ่ม `users.google_id`, อนุญาต
`password_hash` เป็น null และสร้างตาราง session/OAuth attempt โดยไม่ลบผู้ใช้เดิม.

## 5. เปิด API และเว็บ

รันสอง terminal:

```sh
pnpm dev:api
```

```sh
pnpm dev:web
```

หรือใช้ `docker compose up --build`: Compose ส่งค่า Google จาก root `.env` ไป API,
ใช้ URL ภายใน `http://api:4000` สำหรับ auth proxy และทำ migration ตอนเริ่มระบบ.
ค่า public callback ยังเป็น `http://localhost:3000/api/auth/google/callback`.
สำหรับ deploy จริง ตั้ง WEB_URL เป็น HTTPS origin และเปลี่ยน callback ในทั้ง .env และ Google Cloud.

## 6. ตรวจการทำงาน

ทดสอบอัตโนมัติโดยไม่ใช้ Google credentials (mock เฉพาะฐานข้อมูลและ Google transport):

```sh
pnpm --filter @chatto/api test:auth
pnpm --filter @chatto/web build
```

ครอบคลุม PKCE/state/nonce, callback ซ้ำหรือหมดอายุ, consent ถูกยกเลิก,
บัญชีซ้ำ/ถูกระงับ, session rotation/expiry/logout และ Origin check.
การตรวจลายเซ็น Google จริงและ flow ในเบราว์เซอร์ยังต้องทดสอบกับ Google credentials.

1. เปิด `http://localhost:3000/auth` → กดเข้าสู่ระบบด้วย Google.
2. เลือกบัญชี → กลับ Dashboard และเห็นชื่อ/email จริง.
3. รีเฟรชหน้าแล้วยังอยู่ในระบบ.
4. ออกจากระบบ → เข้า Dashboard อีกครั้งต้องกลับหน้า auth.
5. ยกเลิก consent → มีข้อความแจ้งและลองใหม่ได้.
6. เปิด callback โดยไม่มี state/cookie หรือใช้ callback ซ้ำ → ไม่สร้าง session.
7. ใช้อีเมลที่มีบัญชี password เดิม → แจ้งให้ใช้รหัสผ่านเดิม.
8. บัญชีที่ไม่ ACTIVE หรือ session หมดอายุ → ถูกปฏิเสธ.

## API และขอบเขต

Browser เรียก prefix `/api/auth`; เส้นทางจริงบน NestJS คือ `/auth`:

| Method | API route | ผลลัพธ์ |
| --- | --- | --- |
| GET | `/auth/google` | ตั้ง flow cookie และ redirect ไป Google |
| GET | `/auth/google/callback` | ตรวจ identity, ตั้ง session cookie และ redirect |
| POST | `/auth/login` | ตรวจ password และตั้ง session cookie |
| POST | `/auth/register` | สมัครบัญชี password ตาม contract เดิม ไม่มี auto-login |
| GET | `/auth/profile` | ผู้ใช้จริงจาก session หรือ 401 |
| POST | `/auth/logout` | ลบ session และ clear cookie |

POST auth ต้องมี `Origin` ตรง WEB_URL เพื่อป้องกัน CSRF; เมื่อใช้ curl/Postman
ให้เพิ่ม `Origin: http://localhost:3000`. Google callback ใช้ state/PKCE แทน Origin check.
Flow อายุ 10 นาที ใช้ครั้งเดียว เก็บใน DB จึงรองรับหลาย API instances.
ข้อมูล flow/session ที่หมดอายุจะถูกล้างเมื่อมี flow/session ใหม่.

งานนี้เพิ่มการยืนยันตัวตนและการตรวจหน้า Dashboard เท่านั้น.
API โมดูลอื่นยังเป็นขอบเขตเดิมและยังไม่ได้เพิ่ม session guard/RBAC/merchant isolation ให้ทุก endpoint.
ต้องทำ authorization ของแต่ละโมดูลก่อนนำข้อมูลจริงมาเปิดให้ใช้งาน.
ไม่มีการเพิ่ม commerce, LINE webhook หรือ AI/RAG logic ในงานนี้.
