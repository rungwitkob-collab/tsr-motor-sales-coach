# TSR Motor Sales Coach

เว็บแอปให้ TSR (Telesales Representative) ขายประกันรถยนต์ภาคสมัครใจและ พ.ร.บ. **ฝึกพูดจริง** กับลูกค้าจำลองที่ AI สวมบท
แล้วได้ **คะแนนและ feedback ทันที** ตาม rubric 6 ด้าน ทำงานบน Cloudflare Workers (free plan) และใช้ Gemini API (free tier) เป็น AI

URL ที่ใช้งานจริง: **https://coach.fpc-tool.workers.dev** (ฟรี ไม่ต้องซื้อโดเมน)

> บัญชี Cloudflare ที่ใช้ deploy มี workers.dev subdomain ชื่อ `fpc-tool` อยู่ก่อนแล้ว และ Cloudflare ให้บัญชีละ 1 ชื่อ URL จึงเป็น `coach.fpc-tool.workers.dev` แทน `coach.sales-tool.workers.dev` ที่วางแผนไว้ ถ้าต้องการชื่ออื่นให้ใช้ custom domain (ดูข้อ 11) ไม่ควรเปลี่ยน subdomain ของบัญชีเพราะจะกระทบ Worker อื่นที่ใช้ชื่อเดิมอยู่

---

## สิ่งที่ต้องทำเป็นอันดับแรก: ใส่ชื่อบริษัทจริง

ชื่อบริษัทตั้งเป็น **"InsureX"** แล้ว แต่เลขที่ใบอนุญาต เบอร์ติดต่อ ช่องทางชำระเงิน และนโยบายยกเลิกยังเป็นค่าตัวอย่าง ให้แก้ไฟล์ `data/company.json` ก่อนใช้งาน

```json
{
  "name": "บริษัทของคุณ",            ← เปลี่ยนเป็นชื่อบริษัท/โบรกเกอร์จริง
  "licenseLabel": "ใบอนุญาตนายหน้าประกันวินาศภัยเลขที่",
  "licenseNumber": "ว00000/2569",    ← เลขที่ใบอนุญาตจริง
  "hotline": "02-000-0000",          ← เบอร์ติดต่อจริง
  "paymentChannels": [...],          ← ช่องทางชำระเงินจริง
  "cancellationPolicy": "...",       ← นโยบายการยกเลิก/คืนเบี้ย (ให้ฝ่าย compliance เขียน)
  ...
}
```

ชื่อบริษัทในไฟล์นี้ถูกใช้ทุกที่: หัวเว็บ, หน้ากรอกรหัส, คลังสคริปต์ และ prompt ของ AI ทุกโมดูล (ลูกค้าจำลอง, การประเมิน, Pitch Builder, ควิซ) ไม่ต้องแก้โค้ด

> **ข้อมูลแผนประกันใน `data/products.json` เป็นชุดตัวอย่างทั่วไปของตลาดไทย** (ชั้น 1, 2+, 3+, 3, พ.ร.บ.)
> ทุนประกัน ช่วงราคา และเงื่อนไขเป็นตัวเลขตัวอย่างเพื่อการฝึกเท่านั้น **ต้องแก้ให้ตรงกับแผนจริงของบริษัทก่อนใช้กับทีม**

---

## สารบัญ

1. [ตารางตัวแปรของโปรเจกต์](#1-ตารางตัวแปรของโปรเจกต์)
2. [ฟีเจอร์ 6 โมดูล](#2-ฟีเจอร์-6-โมดูล)
3. [โครงสร้างโปรเจกต์](#3-โครงสร้างโปรเจกต์)
4. [ติดตั้งและ deploy ทีละขั้น (สำหรับคนไม่เคยใช้ Cloudflare)](#4-ติดตั้งและ-deploy-ทีละขั้น)
5. [แก้เนื้อหา (products / personas / objections) และ deploy ใหม่](#5-แก้เนื้อหาและ-deploy-ใหม่)
6. [ค่าใช้จ่าย](#6-ค่าใช้จ่าย)
7. [Troubleshooting](#7-troubleshooting)
8. [Checklist ทดสอบก่อนใช้งานจริง (10 ข้อ)](#8-checklist-ทดสอบก่อนใช้งานจริง-10-ข้อ)
9. [ความปลอดภัยและ compliance](#9-ความปลอดภัยและ-compliance)
10. [ดีไซน์และ design tokens](#10-ดีไซน์และ-design-tokens)
11. [คำสั่งทั้งหมดและการต่อยอด](#11-คำสั่งทั้งหมดและการต่อยอด)

---

## 1. ตารางตัวแปรของโปรเจกต์

| ตัวแปร | ค่า | ตั้งที่ไหน |
|---|---|---|
| `WORKER_NAME` | `coach` | `wrangler.jsonc` → `"name"` |
| `ACCOUNT_SUBDOMAIN` | `fpc-tool` (ค่าที่บัญชีนี้มีอยู่แล้ว ตั้งใจไว้เดิมคือ `sales-tool`) | Cloudflare Dashboard (ค่าระดับบัญชี ตั้งได้ครั้งเดียว) |
| URL ที่ได้ | `https://coach.fpc-tool.workers.dev` | ได้อัตโนมัติจากสองค่าบน |
| `COMPANY_NAME` | `บริษัทของคุณ` (ค่าชั่วคราว) | `data/company.json` → `"name"` **ต้องแก้** |
| `PRODUCTS` | ชั้น 1, 2+, 3+, 3, พ.ร.บ. (ข้อมูลตัวอย่าง) | `data/products.json` **ต้องแก้ให้ตรงแผนจริง** |
| `UI_LANGUAGE` | ไทย | หน้าเว็บและคำตอบของ AI |
| `GEMINI_MODEL` | `gemini-2.5-flash` | `wrangler.jsonc` → `vars.GEMINI_MODEL` |

### ชื่อ subdomain สำรอง (ใช้เฉพาะกรณี deploy ด้วยบัญชี Cloudflare ใหม่ที่ยังไม่มี subdomain)

บัญชีปัจจุบันมี subdomain `fpc-tool` อยู่แล้ว ข้อนี้จึงไม่ต้องทำ workers.dev subdomain ต้องไม่ซ้ำกับบัญชีอื่นทั่วโลก ถ้าใช้บัญชีใหม่และ `sales-tool` ถูกจองแล้ว ให้เลือกชื่อสำรองตามลำดับ:

| ลำดับ | subdomain สำรอง | URL ที่จะได้ |
|---|---|---|
| 1 | `tsr-sales-tool` | `https://coach.tsr-sales-tool.workers.dev` |
| 2 | `sales-coach-th` | `https://coach.sales-coach-th.workers.dev` |
| 3 | `motor-sales-lab` | `https://coach.motor-sales-lab.workers.dev` |

ไม่ต้องแก้โค้ดใด ๆ เมื่อเปลี่ยน subdomain เพราะหน้าเว็บเรียก API แบบ relative path (`/api/...`) ส่วนหน้าของ URL (`coach`) มาจาก `"name"` ใน `wrangler.jsonc`

---

## 2. ฟีเจอร์ 6 โมดูล

| เมนู | โมดูล | สิ่งที่ทำได้ |
|---|---|---|
| ฝึกโทร | 1. Roleplay Simulator | เลือกลูกค้าจำลอง 10 แบบ × ความยาก 3 ระดับ พูดผ่านไมค์ (th-TH) หรือพิมพ์ ลูกค้าตอบแบบ streaming และอ่านออกเสียง แสดงเวลาและรอบ (สูงสุด 25 รอบ) ลูกค้าระดับยากวางสายได้ |
| (หลังจบสาย) | 2. Call Evaluation | คะแนนรวม 0-100 + 6 ด้าน (0-10) จุดดี/จุดควรปรับ/ประโยคที่ควรพูดแทน ธง Compliance risk สีแดง เฉลยข้อมูลซ่อน ปุ่ม "ลองใหม่กับ persona เดิม" และ "ฝึกจุดอ่อน" |
| ข้ออ้าง | 3. Objection Drill | คลัง 32 ข้ออ้าง 8 หมวด สุ่มแล้วจับเวลา (30-90 วินาที) AI ให้คะแนน 1-5 พร้อมคำตอบต้นแบบแบบนุ่มนวล/ตรงประเด็น ข้อที่ได้ต่ำกว่า 3 เข้า "ข้ออ้างที่ต้องทวน" |
| สคริปต์ | 4. Script Library & Pitch Builder | โครงสคริปต์ 6 ขั้น (เปิดสาย → ขออนุญาต → ค้นหาความต้องการ → เสนอแผน → ปิดการขาย → นัดโทรกลับ) แทนชื่ออัตโนมัติ และให้ AI เขียนบทพูด 30 วินาที + เวอร์ชันสั้น/ยาว ทุกสคริปต์คัดลอกคลิกเดียว |
| ควิซ | 5. Product Knowledge Quiz | ชุดโจทย์ตั้งต้น 24 ข้อ (ใช้ได้แม้โควตา AI หมด) และให้ AI สร้างโจทย์ใหม่จาก `products.json` |
| สถิติ | 6. Progress Dashboard | กราฟคะแนนย้อนหลัง, คะแนนเฉลี่ยรายด้าน, จำนวนสาย, streak รายวัน เก็บใน localStorage พร้อม Export/Import JSON |

---

## 3. โครงสร้างโปรเจกต์

```
tsr-motor-sales-coach/
├── data/                      เนื้อหาที่หัวหน้าทีมแก้ได้โดยไม่แตะโค้ด
│   ├── company.json           ชื่อบริษัท เลขที่ใบอนุญาต ช่องทางชำระเงิน (แก้เป็นอันดับแรก)
│   ├── products.json          แผนประกันและความรู้พื้นฐาน (ใช้ใน prompt และควิซ)
│   ├── personas.json          ลูกค้าจำลอง 10 แบบ + ข้อมูลซ่อน (อยู่ฝั่ง Worker เท่านั้น)
│   ├── objections.json        คลังข้ออ้าง 32 ข้อ 8 หมวด
│   └── scripts.json           โครงสคริปต์มาตรฐาน 6 ขั้น
├── prompts/                   systemInstruction แยกตามโมดูล แก้สำนวน AI ได้ที่นี่
│   ├── context.ts             บริบทบริษัท/สินค้าที่แนบทุก prompt
│   ├── roleplay.ts            กติกาลูกค้าจำลอง (ภาษาไทยธรรมชาติ ตอบ 1-3 ประโยค ไม่หลุดบท)
│   ├── evaluation.ts          rubric และกติกาการประเมินสาย
│   ├── objection.ts           เกณฑ์ให้คะแนนข้ออ้าง 1-5
│   ├── pitch.ts               กติกาการเขียนบทพูด
│   ├── quiz.ts                กติกาการออกข้อสอบ
│   └── repair.ts              prompt ซ่อม JSON เมื่อ AI ตอบผิด schema
├── src/
│   ├── shared/                type/schema ที่ Worker และหน้าเว็บใช้ร่วมกัน
│   │   ├── schemas.ts         zod schema ของ request/response/progress
│   │   ├── api.ts             สัญญา API และรหัส error
│   │   ├── rubric.ts          เกณฑ์ 6 ด้าน ระดับความยาก ผลลัพธ์การโทร
│   │   ├── limits.ts          ข้อจำกัด (25 รอบ, ความยาวข้อความ, ฯลฯ)
│   │   ├── content.ts         โหลด data/*.json ที่ไม่เป็นความลับ
│   │   └── types.ts           type ของข้อมูลใน data/
│   ├── worker/                Backend (Hono บน Cloudflare Workers)
│   │   ├── index.ts           router /api/* + middleware
│   │   ├── env.ts             bindings/secrets
│   │   ├── middleware/        ตรวจ passcode และ rate limit ต่อ IP
│   │   ├── routes/            roleplay (SSE), evaluate, objection, pitch, quiz, personas, progress (KV)
│   │   └── lib/               Gemini REST client, responseSchema, error ภาษาไทย, validation
│   └── app/                   Frontend (React + Tailwind)
│       ├── pages/             6 หน้าตามโมดูล
│       ├── components/        UI ที่ใช้ซ้ำ (ปุ่มไมค์, กราฟ, การ์ด, error) + ui.ts (คลาสจาก design tokens)
│       ├── lib/               API client, เสียง (Web Speech), localStorage, router, สถิติ
│       ├── data/seedQuiz.ts   ชุดโจทย์ตั้งต้น 24 ข้อ
│       └── index.css          design tokens (สี ฟอนต์ มุมโค้ง เงา)
├── public/favicon.svg
├── index.html
├── wrangler.jsonc             ตั้งค่า Worker: name = coach, static assets, vars
├── vite.config.ts             Vite + React + Tailwind + @cloudflare/vite-plugin
├── tsconfig*.json             แยก app / worker / node (TypeScript strict)
├── .dev.vars.example          ตัวอย่าง secret สำหรับรันบนเครื่อง
└── .gitignore                 กัน .dev.vars, node_modules, dist ไม่ให้ขึ้น git
```

สถาปัตยกรรมโดยย่อ: Worker ตัวเดียวเสิร์ฟทั้งหน้าเว็บ (Static Assets ซึ่งไม่กิน CPU ของ Worker) และ `/api/*`
Worker ทำหน้าที่เป็น proxy บาง ๆ ไป Gemini เท่านั้น บทสนทนา roleplay ส่ง SSE ดิบจาก Gemini กลับ browser โดยไม่ parse ใน Worker
เพื่อให้ CPU ต่ำกว่า 10 ms ต่อ request ตาม free plan

---

## 4. ติดตั้งและ deploy ทีละขั้น

### สิ่งที่ต้องมี

- คอมพิวเตอร์ที่ติดตั้ง **Node.js 22.12 ขึ้นไป** (ดาวน์โหลดรุ่น LTS ที่ https://nodejs.org) ตรวจด้วย `node -v`
- บัญชีอีเมลสำหรับสมัคร Cloudflare และบัญชี Google
- เบราว์เซอร์ Chrome / Edge (รองรับไมค์ดีที่สุด) หรือ Safari

### ขั้นที่ 1: สมัคร Cloudflare (ฟรี) และตั้ง workers.dev subdomain

1. ไปที่ https://dash.cloudflare.com/sign-up สมัครด้วยอีเมล แล้วยืนยันอีเมล (ไม่ต้องผูกบัตร ใช้ Free plan)
2. เข้า Dashboard แล้วเปิดเมนู **Workers & Pages** (บางบัญชีแสดงเป็น **Compute (Workers)**)
3. หาส่วน **Subdomain** (มักอยู่แถบขวาของหน้า Overview) กด **Set up** หรือ **Change**
4. พิมพ์ `sales-tool` แล้วยืนยัน (บัญชีปัจจุบันมี `fpc-tool` อยู่แล้ว wrangler จะไม่ถามและใช้ชื่อเดิมอัตโนมัติ)
   - ถ้าระบบแจ้งว่าชื่อถูกใช้แล้ว ให้ใช้ชื่อสำรองตามลำดับ: `tsr-sales-tool` → `sales-coach-th` → `motor-sales-lab`
   - URL จะเปลี่ยนตาม เช่น ใช้ `tsr-sales-tool` จะได้ `https://coach.tsr-sales-tool.workers.dev` (ไม่ต้องแก้โค้ด)
   - subdomain เป็นค่าระดับบัญชีที่ทุก Worker ในบัญชีใช้ร่วมกัน ควรตั้งให้ถูกตั้งแต่ครั้งแรก
5. ถ้ายังไม่ได้ตั้ง subdomain ตอนสั่ง deploy ครั้งแรก `wrangler` จะถามให้ตั้งในหน้าจอ terminal ได้เช่นกัน

### ขั้นที่ 2: ขอ Gemini API key (free tier)

1. ไปที่ **Google AI Studio** https://aistudio.google.com แล้วเข้าสู่ระบบด้วยบัญชี Google
2. กด **Get API key** → **Create API key** (เลือกหรือสร้าง Google Cloud project ตามที่ระบบเสนอ)
3. คัดลอก key เก็บไว้ (ขึ้นต้นด้วย `AIza...`) **ห้ามส่งในแชท ห้ามใส่ในโค้ด ห้าม commit ลง git**
4. free tier ใช้ได้โดยไม่ผูกบัตร แต่มี rate limit ต่อนาทีและต่อวันที่ Google ปรับบ่อย
   ตรวจตัวเลขล่าสุดได้ที่ **https://ai.google.dev/gemini-api/docs/rate-limits** ก่อนเปิดใช้กับทีม

### ขั้นที่ 3: ติดตั้งและทดลองบนเครื่อง

เปิด Terminal (Windows ใช้ PowerShell) ในโฟลเดอร์โปรเจกต์ แล้วรันทีละบรรทัด:

```bash
npm install
```

```bash
npx wrangler login
```
(เบราว์เซอร์จะเปิดหน้าให้กด Allow เพื่อเชื่อม wrangler กับบัญชี Cloudflare)

```bash
npx wrangler secret put GEMINI_API_KEY
```
(วาง API key จากขั้นที่ 2 แล้วกด Enter ถ้าระบบถามว่ายังไม่มี Worker ชื่อ `coach` จะสร้างใหม่ไหม ให้ตอบ `Y`)

```bash
npx wrangler secret put APP_PASSCODE
```
(รหัสผ่านทีมเป็นด่านเดียวที่กันคนนอกใช้โควตา Gemini ของทีม ให้ตั้งยาวอย่างน้อย 12-16 ตัวอักษรที่เดาไม่ได้ ห้ามใช้ชื่อทีม/บริษัท/ปี เช่น `tsr2026` จะใช้วลีภาษาไทยหลายคำก็ได้ หรือสร้างแบบสุ่มด้วย `openssl rand -base64 12` แจกให้ TSR ในทีมเท่านั้น และเปลี่ยนรหัสใหม่ด้วยคำสั่งเดิมทุกครั้งที่มีสมาชิกออกจากทีม)

ก่อนรันบนเครื่อง ให้สร้างไฟล์ `.dev.vars` (secret สำหรับเครื่องตัวเองเท่านั้น):

```bash
cp .dev.vars.example .dev.vars
```
แล้วเปิด `.dev.vars` ใส่ `GEMINI_API_KEY` และ `APP_PASSCODE` (Windows ที่ไม่มีคำสั่ง `cp` ให้คัดลอกไฟล์แล้วเปลี่ยนชื่อเอง)

```bash
npm run dev
```
เปิด http://localhost:5173 กรอกรหัสผ่านทีม แล้วลองโทรหาลูกค้าจำลอง (`npm run dev` รัน Worker จริงในเครื่องผ่าน workerd)

### ขั้นที่ 4: deploy ขึ้นอินเทอร์เน็ต

```bash
npm run deploy
```

คำสั่งนี้จะ typecheck → build หน้าเว็บและ Worker → อัปโหลดขึ้น Cloudflare เมื่อเสร็จจะแสดง URL
`https://coach.fpc-tool.workers.dev` เปิดบนมือถือหรือคอมพิวเตอร์ กรอกรหัสผ่านทีมครั้งแรกครั้งเดียว (ระบบจำไว้ในเบราว์เซอร์)

> การเปลี่ยนรหัสผ่านทีม: รัน `npx wrangler secret put APP_PASSCODE` ใหม่ ทุกคนจะถูกให้กรอกรหัสใหม่อัตโนมัติ (ไม่ต้อง deploy ใหม่)

---

## 5. แก้เนื้อหาและ deploy ใหม่

ทุกไฟล์ใน `data/` เป็น JSON แก้ด้วย VS Code หรือ Notepad ได้ (ระวังเครื่องหมาย `,` `"` `[ ]` `{ }` ให้ครบ)
แก้เสร็จให้รัน `npm run dev` เพื่อลองบนเครื่อง แล้วรัน `npm run deploy` เพื่ออัปเดตเว็บจริง

| ไฟล์ | ใช้ทำอะไร | ข้อควรระวัง |
|---|---|---|
| `data/company.json` | ชื่อบริษัท เลขที่ใบอนุญาต ช่องทางชำระ นโยบายยกเลิก | ใช้ทั้งใน UI และ prompt AI |
| `data/products.json` | `plans[]` แผนประกัน (id, name, coverage, ทุน, ค่าเสียหายส่วนแรก, การซ่อม, ราคา, เหมาะกับใคร) และ `knowledge[]` ความรู้พื้นฐาน | `type` ต้องเป็น `voluntary` หรือ `compulsory` ถ้าเปลี่ยน `id` ของแผน Pitch Builder จะใช้ id ใหม่อัตโนมัติ ตัวเลขทุกตัวควรผ่านการตรวจของฝ่ายผลิตภัณฑ์ |
| `data/personas.json` | ลูกค้าจำลอง: `name`, `title`, `gender` (`male`/`female`), `age`, `occupation`, `summary`, `personality`, `speakingStyle`, `greeting` (ประโยครับสาย) และ `hiddenProfile` (รถ ปีรถ ประกันเดิม งบ การใช้รถ painPoints decisionFactors willBuyIf hangUpIf) | `id` ห้ามซ้ำ ข้อมูลใน `hiddenProfile` จะไม่ถูกส่งไปหน้าเว็บจนกว่าจะจบสาย |
| `data/objections.json` | `groups[]` หมวด และ `objections[]` ข้ออ้าง (`id`, `group`, `text`, `hint`) | `group` ต้องตรงกับ id ใน `groups` ส่วน `hint` คือแนวทางจากหัวหน้าทีมที่ AI ใช้ประกอบการให้คะแนน **อย่าเปลี่ยน `id` ของหมวดเดิม** (price, has-insurance, distrust, no-time, think-first, ask-others, bad-claim, no-need) เพราะโหมด "ฝึกจุดอ่อน" อ้างถึง id เหล่านี้ใน `src/shared/rubric.ts` เพิ่มหมวดใหม่ได้ แต่ถ้าเปลี่ยนชื่อ id ต้องแก้ `SKILL_TO_OBJECTION_GROUPS` ด้วย |
| `data/scripts.json` | สคริปต์มาตรฐาน ใช้ตัวแปร `{{company}}` `{{licenseNumber}}` `{{agentName}}` `{{customerName}}` ฯลฯ | ข้อความใน `[ ]` คือส่วนที่ TSR ต้องปรับเอง |
| `prompts/*.ts` | สำนวนและกติกาของ AI แต่ละโมดูล | แก้ได้ แต่ควรคงกติกาเรื่องไม่หลุดบทและห้ามแต่งตัวเลขทางกฎหมาย |
| `src/shared/rubric.ts` | คำอธิบายเกณฑ์ 6 ด้าน | `key` ห้ามเปลี่ยน (ผูกกับ schema และสถิติ) |

เปลี่ยนรุ่น AI: ผู้ใช้สลับได้เองจากเมนู **ตั้งค่า → ประเมินการทดสอบ** (Gemini 3.5 หรือ Gemini 3.8 จำไว้ในเครื่องนั้น ไม่ต้อง deploy) และเลือกเสียงลูกค้าได้ที่ **ตั้งค่า → เสียงลูกค้า** (Gemini 3.8 หรือเสียงของเครื่อง) รายการรุ่นที่ Worker ยอมรับอยู่ใน `src/shared/models.ts`
(ปัจจุบัน `gemini-3.5-flash-lite` ประหยัดโควตา, `gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-2.5-flash`) Worker รับเฉพาะรุ่นในรายการนี้
ค่าเริ่มต้นเมื่อผู้ใช้ไม่ได้เลือกคือ `"GEMINI_MODEL"` ใน `wrangler.jsonc` (ตอนนี้ `gemini-3.5-flash-lite`) เปลี่ยนแล้วต้อง `npm run deploy`
รุ่นเสียงลูกค้า (TTS) เป็นเมนูแยกในหน้าเดียวกัน รายการอยู่ใน `TTS_MODEL_OPTIONS` ค่าเริ่มต้นคือ `"GEMINI_TTS_MODEL"`
หมายเหตุ: `gemini-2.5-flash-lite` ถูก Google ปิดสำหรับผู้ใช้ใหม่แล้ว (404) ให้ใช้ `gemini-3.5-flash-lite` แทน

---

## 6. ค่าใช้จ่าย

### ใช้ฟรีทั้งหมดในขนาดทีมเล็ก

| ส่วนประกอบ | แผนที่ใช้ | โควตาฟรี | หมายเหตุ |
|---|---|---|---|
| Cloudflare Workers (API) | Free | 100,000 requests/วัน, CPU 10 ms/request | Worker เป็นแค่ proxy จึงใช้ CPU ต่ำ |
| Cloudflare Static Assets (หน้าเว็บ) | Free | ไม่จำกัด ไม่นับรวม 100,000 requests | ไฟล์หน้าเว็บไม่ผ่าน Worker |
| URL `*.workers.dev` | Free | - | ไม่ต้องซื้อโดเมน |
| Workers Logs (observability) | Free | มีโควตารายวัน | ดู log error ใน Dashboard |
| Gemini API (ค่าเริ่มต้น `gemini-3.5-flash-lite`) | Free tier | จำกัดต่อนาที (RPM) และต่อวัน (RPD) แยกต่อรุ่น | ตัวเลขจริงของโปรเจกต์ดูที่ https://ai.dev/rate-limit ถ้ารุ่นหนึ่งเต็มสลับรุ่นได้จากเมนู ตั้งค่า |
| เสียงลูกค้า/ข้ออ้าง (อ่านออกเสียง) | Gemini TTS (ค่าเริ่มต้น `gemini-3.8-flash-tts` ผู้ใช้เลือกได้ในเมนู ตั้งค่า ว่าจะใช้เสียง Gemini หรือเสียงของเครื่อง) | ตามโควตา free tier ของรุ่น TTS | ประโยคเดิมถูก cache 1 วัน ถ้า AI ใช้ไม่ได้หน้าเว็บจะใช้เสียงอ่านของเบราว์เซอร์แทนอัตโนมัติ ปิดทั้งระบบได้ด้วย `"GEMINI_TTS_MODEL": "off"` |
| ไมค์ (พูดเป็นข้อความ) | Web Speech API ของเบราว์เซอร์ | ฟรี | ไม่ผ่าน Gemini |
| ฟอนต์ Noto Sans Thai | Google Fonts | ฟรี | |
| เก็บสถิติ | localStorage ในเบราว์เซอร์ | ฟรี | ไม่มี database |

### ประเมินการใช้ Gemini ต่อการฝึก

| กิจกรรม | จำนวน request ไป Gemini |
|---|---|
| โทรฝึก 1 สาย | เท่ากับจำนวนรอบที่คุย (สูงสุด 25) + 1 ครั้งสำหรับการประเมิน (+1 ถ้าต้องซ่อม JSON) + 1 ครั้งต่อประโยคลูกค้าสำหรับเสียง TTS (ถ้าเปิด "เสียงลูกค้า") |
| ตอบข้ออ้าง 1 ข้อ | 1 (+1 ถ้าต้องซ่อม JSON) |
| Pitch Builder 1 ครั้ง | 1 |
| ควิซจาก AI 1 ชุด | 1 (ชุดตั้งต้นไม่ใช้ AI) |

ตัวอย่างวิธีคิด: ถ้าหน้า rate limits ระบุว่ารุ่นที่ใช้ได้ RPD = N ครั้ง/วัน ทีมจะโทรฝึกเต็ม 25 รอบได้ราว N ÷ 26 สายต่อวัน (ทั้งทีมรวมกัน เพราะใช้ key เดียว)

### อะไรจะเริ่มมีค่าใช้จ่ายเมื่อผู้ใช้เยอะขึ้น

| สถานการณ์ | ทางแก้ | ค่าใช้จ่าย |
|---|---|---|
| TSR หลายคนฝึกพร้อมกันแล้วเจอ "โควตา AI เต็ม" (429) บ่อย | เปิด billing ของ Gemini ใน Google AI Studio (จ่ายตามใช้) ไม่ต้องแก้โค้ด | รุ่น Flash ราคาต่อโทเค็นต่ำ ดูราคาล่าสุดที่ ai.google.dev/pricing |
| เกิน 100,000 API requests/วัน | อัปเกรด Workers Paid | เริ่มต้นประมาณ 5 USD/เดือน (ตรวจราคาล่าสุดที่หน้า Cloudflare pricing) |
| ต้องการให้หัวหน้าดูสถิติทุกคนรวมศูนย์ | เปิดใช้ Cloudflare KV (ดูข้อ 11) | KV free tier ให้เขียน 1,000 ครั้ง/วัน เกินนั้นต้องใช้ Workers Paid |
| ต้องการโดเมนของบริษัทเอง | ผูก Custom Domain กับ Worker | ค่าโดเมนรายปี (Worker ยังใช้ free plan ได้) |

> ข้อควรรู้: ตามเงื่อนไขของ Gemini API บริการแบบไม่เสียเงิน (free tier) อาจนำข้อมูลที่ส่งไปใช้ปรับปรุงบริการของ Google
> ตรวจเงื่อนไขล่าสุดก่อนใช้ และ **ห้ามพิมพ์ข้อมูลส่วนบุคคลของลูกค้าจริงลงในการฝึก**

---

## 7. Troubleshooting

### 401 "รหัสผ่านทีมไม่ถูกต้อง"
- กรอกรหัสผิด หรือหัวหน้าทีมเพิ่งเปลี่ยน `APP_PASSCODE` ระบบจะเด้งกลับหน้ากรอกรหัสอัตโนมัติ ให้ขอรหัสใหม่
- ถ้าขึ้นว่า "ยังไม่ได้ตั้งค่า APP_PASSCODE" ให้รัน `npx wrangler secret put APP_PASSCODE`
- ตอนรันบนเครื่อง ตรวจว่าไฟล์ `.dev.vars` มี `APP_PASSCODE=...` แล้วหยุด `npm run dev` และรันใหม่

### 429 "โควตา AI เต็ม" หรือ "ส่งคำขอถี่เกินไป"
มี 2 แบบ หน้าเว็บแสดงข้อความไทยและนับถอยหลังเวลาที่ควรลองใหม่ให้อัตโนมัติ
- **QUOTA_EXCEEDED (จาก Gemini)**
  - แบบต่อนาที: รอตามเวลาที่แสดง (มักไม่เกิน 1 นาที) แล้วกดลองใหม่
  - แบบรายวัน: โควตารีเซ็ตทุกเที่ยงคืนเวลาแปซิฟิก (ประมาณ 14:00-15:00 น. เวลาไทย) ระหว่างนี้ใช้ควิซชุดตั้งต้นและคลังสคริปต์ได้
  - ถ้าเจอบ่อย: สลับรุ่นจากเมนู ตั้งค่า (โควตาแยกต่อรุ่น เช่น `gemini-3.5-flash-lite` มักเหลือมากกว่า) หรือเปิด billing ของ Gemini
- **RATE_LIMITED (จาก Worker ของเราเอง)**: IP เดียวกันส่งเกิน `RATE_LIMIT_PER_MINUTE` (ค่าเริ่มต้น 20/นาที) ถ้าทั้งทีมใช้ Wi-Fi ออฟฟิศเดียวกัน (IP เดียวกัน) ให้เพิ่มค่าใน `wrangler.jsonc` แล้ว deploy ใหม่

### ไมค์ไม่ทำงานบน iOS Safari
1. ต้องเปิดผ่าน **Safari** โดยตรง ไม่ใช่เบราว์เซอร์ในแอป (LINE, Facebook, Messenger) ให้กด "เปิดใน Safari"
2. เปิด **ตั้งค่า → ทั่วไป → แป้นพิมพ์ → เปิดใช้การป้อนตามคำบอก (Dictation)** และเปิด **Siri** (iOS ใช้ระบบนี้แปลงเสียงเป็นข้อความ)
3. **ตั้งค่า → Safari → ไมโครโฟน** เลือก "ถาม" หรือ "อนุญาต" แล้วกด "อนุญาต" เมื่อเว็บขอใช้ไมค์
4. iOS ฟังได้ทีละประโยค (ไม่ฟังต่อเนื่อง) ให้แตะไมค์ พูด แล้วรอให้ข้อความขึ้น
5. ถ้ายังไม่ได้ ให้ **พิมพ์แทน** ได้เสมอ ทุกโมดูลใช้งานด้วยการพิมพ์ได้ครบ
6. ลูกค้าไม่ออกเสียง: กดปุ่มเริ่มโทรด้วยนิ้ว (iOS อนุญาตเสียงหลังผู้ใช้แตะหน้าจอ) ตรวจระดับเสียง แล้วแตะ "ฟังอีกครั้ง" ใต้ข้อความลูกค้า
   เสียงลูกค้ามาจาก Gemini TTS (เหมือนกันทุกเครื่อง) ถ้าขึ้นข้อความว่าใช้เสียงเบราว์เซอร์แทน แปลว่า AI TTS ใช้ไม่ได้ชั่วคราว (โควตา/ขัดข้อง)
   เสียงเบราว์เซอร์ภาษาไทยไม่น่าเชื่อถือ (Chrome บน Mac มักเงียบ, iOS เงียบหลังใช้ไมค์) จึงไม่ควรปิด `GEMINI_TTS_MODEL`

### subdomain `sales-tool` ถูกใช้แล้ว
ใช้ชื่อสำรองในข้อ 1 (`tsr-sales-tool`, `sales-coach-th`, `motor-sales-lab`) URL จะเป็น `https://coach.<ชื่อที่ได้>.workers.dev` ไม่ต้องแก้โค้ด
แจ้ง URL ใหม่ให้ทีม (ทางเลือกอื่น: ผูก Custom Domain ของบริษัท)

### ปัญหาอื่นที่อาจเจอ
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" หรือ "GEMINI_API_KEY ไม่ถูกต้อง" | รัน `npx wrangler secret put GEMINI_API_KEY` ใหม่ (ตอน dev แก้ `.dev.vars`) |
| "ไม่พบ model ..." | ค่า `GEMINI_MODEL` สะกดผิดหรือ Google ปลดรุ่นนั้นแล้ว เปลี่ยนเป็นรุ่นที่มีในหน้า rate limits |
| "Gemini API ยังไม่รองรับภูมิภาค..." | Gemini API ไม่เปิดให้บางประเทศ Worker ทำงานที่ data center ใกล้ผู้ใช้ ถ้าผู้ใช้อยู่ไทยปกติใช้ได้ ตรวจว่าไม่ได้ใช้ VPN ผ่านประเทศที่ไม่รองรับ |
| "ข้อความติดตัวกรองความปลอดภัย" | AI ปฏิเสธข้อความที่หยาบหรือไม่เหมาะสม ให้เรียบเรียงใหม่ |
| "AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง" | ระบบลองซ่อม JSON ให้แล้ว 1 ครั้ง กดลองใหม่อีกครั้ง |
| `npm run dev` แจ้ง "requires compatibility date ..." | `compatibility_date` ใน `wrangler.jsonc` ใหม่กว่าที่ wrangler ในเครื่องรองรับ ให้รัน `npm i -D wrangler@latest @cloudflare/vite-plugin@latest` หรือลดวันที่ลง |
| `npm install` แจ้งเรื่อง Node version | ติดตั้ง Node.js 22.12 ขึ้นไป (Vite 8 และ wrangler 4 ต้องการรุ่นนี้) |

---

## 8. Checklist ทดสอบก่อนใช้งานจริง (10 ข้อ)

| # | ทดสอบ | วิธีตรวจ | ผ่านเมื่อ |
|---|---|---|---|
| 1 | API key ไม่โผล่ฝั่ง browser | เปิด DevTools → แท็บ Network ฝึกโทร 1 สาย แล้วค้นคำว่า `AIza` และ `generativelanguage` ใน request/response ทั้งหมด และใน Sources | ไม่พบเลย (browser คุยกับ `/api/*` เท่านั้น) |
| 2 | Passcode ป้องกันคนนอก | เปิดเว็บในโหมดไม่ระบุตัวตน กรอกรหัสผิด และลอง `curl -X POST https://coach.fpc-tool.workers.dev/api/auth/check` โดยไม่ใส่ header | ได้ 401 และข้อความไทย |
| 3 | ลูกค้าระดับยากไม่หลุดบท | ฝึก persona "กลัวมิจฉาชีพ" ระดับยาก ลองถามว่า "คุณเป็น AI ใช่ไหม" และขอให้ลูกค้าช่วยสรุปแผนให้ | ลูกค้าตอบแบบคนจริง ไม่ยอมรับว่าเป็น AI ไม่ช่วยขาย ตอบ 1-3 ประโยค |
| 4 | ลูกค้าวางสายเมื่อทำผิดกติกา | ระดับยาก เริ่มขายทันทีโดยไม่แนะนำตัว | ลูกค้าวางสาย และระบบพาไปหน้าประเมินอัตโนมัติ |
| 5 | Evaluation ตรง schema ทุกครั้ง | จบสาย 5 สายต่างกัน (สั้นมาก, ยาว, ลูกค้าวางสาย) | ทุกครั้งได้ครบ 6 ด้าน คะแนน 0-10 มีประโยคที่ควรพูดแทน ไม่มี error (ถ้า AI ตอบผิดรูปแบบ ระบบซ่อมเองหรือแสดงปุ่มลองใหม่) |
| 6 | ธง Compliance risk | ในสายทดสอบ พูดว่า "รับรองเคลมได้ทุกกรณีครับ" และไม่บอกเลขที่ใบอนุญาต | หน้าประเมินแสดงกรอบแดง Compliance risk พร้อมเหตุผล |
| 7 | ข้อมูลซ่อนเปิดเผยเฉพาะเมื่อถาม | ระดับปกติ ไม่ถามเรื่องงบ แล้วดูว่าลูกค้าบอกงบเองไหม จากนั้นถามตรง ๆ | ลูกค้าบอกงบเฉพาะเมื่อถูกถาม และ DevTools → Network → `/api/personas` ไม่มีข้อมูลซ่อน |
| 8 | ไมค์และเสียงบนมือถือจริง | ทดสอบบน iPhone (Safari) และ Android (Chrome) | พูดแล้วเป็นข้อความไทย ลูกค้าอ่านออกเสียงได้ ถ้าไมค์ใช้ไม่ได้ยังพิมพ์ได้ |
| 9 | การจัดการ error | ตั้ง `GEMINI_MODEL` ผิดชั่วคราวบน dev หรือกดถี่ ๆ เกิน rate limit, ปิด Wi-Fi ระหว่างคุย | ทุกกรณีแสดงข้อความไทยที่เข้าใจได้ ไม่มีหน้าว่าง และกดลองใหม่ได้ |
| 10 | สถิติ, streak และ Export/Import | ฝึกครบทุกโมดูลอย่างละ 1 ครั้ง → Export JSON → เปิดอีกเบราว์เซอร์ → Import | กราฟ/คะแนนเฉลี่ย/streak ตรงกันทั้งสองเครื่อง ข้ออ้างที่ได้ต่ำกว่า 3 อยู่ใน "ต้องทวน" |

---

## 9. ความปลอดภัยและ compliance

- **Gemini API key อยู่ฝั่ง Worker เท่านั้น** ตั้งผ่าน `wrangler secret put` ไม่มีในโค้ดหน้าเว็บ ไฟล์ `.dev.vars` ถูกกันด้วย `.gitignore`
- **APP_PASSCODE**: ทุก request ไป `/api/*` ต้องมี header `X-App-Passcode` (ตรวจแบบ constant-time) ไม่ตรงตอบ 401
- **Rate limit ต่อ IP** (in-memory ต่อ isolate) จำกัดความยาวข้อความ (TSR 600 ตัวอักษร/ครั้ง) ขนาด body และ **25 รอบต่อสาย** เพื่อคุมโทเค็น
- ข้อมูลซ่อนของลูกค้าจำลองอยู่ฝั่ง Worker และเปิดเผยหลังจบสายเท่านั้น
- JSON จาก Gemini ถูก validate ด้วย zod ใน Worker ก่อนส่งกลับทุกครั้ง (ถ้าผิดจะ retry 1 ครั้งด้วย prompt ซ่อม)
- สถิติการฝึกเก็บใน localStorage ของเครื่องผู้ฝึก ไม่มีการส่งไปเซิร์ฟเวอร์ (ยกเว้นเปิดโหมด KV เอง)

**เรื่องแนวปฏิบัติการขายทางโทรศัพท์ของ คปภ.**
เกณฑ์ใน rubric (แนะนำชื่อ บริษัท เลขที่ใบอนุญาต วัตถุประสงค์ ขออนุญาตสนทนา ไม่ให้ข้อมูลเท็จ ไม่รับรองผลเคลม ไม่กดดัน สรุปความคุ้มครอง ราคา ช่องทางชำระ และสิทธิ์ยกเลิก)
เป็น **แนวปฏิบัติทั่วไปที่ควรให้ฝ่าย compliance ของบริษัทของคุณ (ตามชื่อใน `data/company.json`) ตรวจทานอีกครั้ง** ก่อนใช้เป็นมาตรฐานของทีม
ระบบตั้งใจไม่อ้างเลขที่ประกาศหรือมาตรา และสั่งให้ AI ห้ามแต่งตัวเลขทางกฎหมาย วงเงินคุ้มครอง พ.ร.บ. ให้ตรวจตัวเลขล่าสุดจากประกาศ คปภ. ก่อนนำไปพูดกับลูกค้า
ผลคะแนนจาก AI เป็นเครื่องมือช่วยฝึก ไม่ใช่การประเมินผลงานอย่างเป็นทางการ

---

## 10. ดีไซน์และ design tokens

โทนม่วง + ทองแบบอ่อน นุ่มนวล (เครื่องมือฝึก ไม่ใช่แอปธนาคาร และไม่เกี่ยวข้องกับสถาบันการเงินใด) ฟอนต์ Noto Sans Thai, mobile-first, ปุ่มไมค์ขนาดใหญ่

สีทั้งหมดกำหนดเป็น token ใน `src/app/index.css` (`@theme` ของ Tailwind v4) และ **ปิดพาเลตสีเริ่มต้นของ Tailwind** (`--color-*: initial`) จึงใช้ได้เฉพาะ token เหล่านี้
คลาสปุ่ม/ช่องกรอก/การ์ดที่ใช้ซ้ำอยู่ใน `src/app/components/ui.ts`

| Token | ค่า | ใช้กับ |
|---|---|---|
| `brand-900` | `#3B1F6B` | หัวเรื่องเข้ม, hover ปุ่มหลัก |
| `brand-700` | `#5B3A9B` | ปุ่มหลัก, active nav |
| `brand-500` | `#7E5FC0` | ลิงก์, ไอคอน, progress bar, คะแนน 5-7 |
| `brand-300` | `#B9A6DF` | border เน้น, chip, focus ring, ขอบ bubble ของ TSR |
| `brand-100` | `#EDE6F7` | card เน้น, bubble ลูกค้า AI |
| `brand-50` | `#F7F3FC` | พื้นหลังหน้าเว็บ |
| `gold-500` | `#CBA64A` | คะแนนสูง 8-10 (แถบ/จุด/วง), badge, streak |
| `gold-100` | `#F6EEDA` | พื้นหลัง badge ทอง |
| `gold-700` | `#7E672E` | **ตัวอักษร** สีทอง (เพิ่มเพื่อให้ผ่าน contrast) |
| `success` / `warning` / `danger` | `#2E8B6E` / `#D9962B` / `#C8463F` | สีสถานะ (เส้นขอบ, พื้นปุ่ม, ธง compliance, ไมค์ตอนฟัง) |
| `*-soft` | `#E6F4EF` / `#FBF0DF` / `#FBE7E6` | พื้นหลังสถานะแบบอ่อน |
| `success-700` / `warning-700` / `danger-700` | `#287960` / `#91641D` / `#B8403A` | **ตัวอักษร** สีสถานะบนพื้นอ่อน (เพิ่มเพื่อให้ผ่าน contrast) |
| `ink` / `ink-muted` | `#2B2340` / `#6E6584` | ตัวอักษรหลัก / รอง |
| `line` | `#E6E0F0` | ขอบ card |

**Contrast (WCAG AA 4.5:1)**: ตรวจทุกคู่ที่ใช้จริงแล้ว เช่น ขาวบน `brand-700` = 8.3:1, `ink` บนขาว = 14.8:1, `ink-muted` บนขาว = 5.4:1
`gold-500` บนขาวได้แค่ 2.3:1 และ `warning` บนขาวได้ 2.5:1 จึงใช้เป็นสีพื้น/แถบเท่านั้น ตัวอักษรใช้ `gold-700` (5.4:1) และ `warning-700` (5.2:1) แทน
`ink-muted` ไม่ใช้บนพื้น `brand-100` (4.47:1) และ `brand-500` เป็นตัวอักษรได้เฉพาะบนพื้นขาว (4.9:1)

---

## 11. คำสั่งทั้งหมดและการต่อยอด

| คำสั่ง | ทำอะไร |
|---|---|
| `npm install` | ติดตั้ง dependency |
| `npm run dev` | รันบนเครื่อง (หน้าเว็บ + Worker จริงใน workerd) ที่ http://localhost:5173 |
| `npm run typecheck` | ตรวจ TypeScript ทั้ง 3 ส่วน (app, worker, vite config) |
| `npm run build` | typecheck + build ไป `dist/` |
| `npm run preview` | build แล้วรันแบบ production บนเครื่อง |
| `npm run deploy` | build + deploy ขึ้น Cloudflare |
| `npx wrangler secret put <NAME>` | ตั้ง secret (`GEMINI_API_KEY`, `APP_PASSCODE`) |
| `npx wrangler tail` | ดู log ของ Worker แบบ real-time |

> `tsconfig.json` ที่ root เป็นแบบ solution (มีแต่ references) คำสั่ง `npx tsc --noEmit` ที่ root จึงไม่ได้ตรวจไฟล์ใด ให้ใช้ `npm run typecheck` (หรือ `npx tsc -b`) แทน

### (ทางเลือก) เก็บสถิติรวมศูนย์บน Cloudflare KV

MVP เก็บสถิติใน localStorage แต่เตรียม interface ไว้แล้ว (`ProgressStore` ใน `src/app/lib/storage.ts` และ route `/api/progress`)

1. `npx wrangler kv namespace create PROGRESS_KV` แล้วคัดลอก id
2. เพิ่มใน `wrangler.jsonc`: `"kv_namespaces": [{ "binding": "PROGRESS_KV", "id": "<id>" }]`
3. สร้างไฟล์ `.env` ที่ root ของโปรเจกต์ ใส่บรรทัด `VITE_PROGRESS_BACKEND=kv` แล้วรัน `npm run deploy` ตามปกติ (Vite อ่าน `.env` ตอน build อัตโนมัติ และ `.gitignore` กันไฟล์นี้ไว้แล้ว ใช้ได้ทุกระบบปฏิบัติการ) ถ้าอยากตั้งแบบครั้งเดียวแทนไฟล์: macOS/Linux ใช้ `VITE_PROGRESS_BACKEND=kv npm run deploy`, PowerShell ใช้ `$env:VITE_PROGRESS_BACKEND="kv"; npm run deploy`, CMD ใช้ `set VITE_PROGRESS_BACKEND=kv && npm run deploy`
4. ผู้ฝึกต้องกรอก "ชื่อเล่น / รหัสพนักงาน" สถิติจะซิงก์ตามชื่อนั้น (ไม่มีระบบ login จริง ใครรู้รหัสทีมและชื่อก็ดูได้)

KV free tier เขียนได้ 1,000 ครั้ง/วัน (ระบบหน่วงการเขียน 5 วินาทีเพื่อประหยัด) ถ้าทีมใหญ่ควรใช้ Workers Paid

### (ทางเลือก) ใช้ผ่าน Cloudflare AI Gateway

ตั้งค่า `GEMINI_API_BASE` (ใน `vars` หรือ secret) เป็น
`https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY_NAME>/google-ai-studio/v1beta/models`
เพื่อดูสถิติการใช้งานและ cache คำตอบ โดยไม่ต้องแก้โค้ด
