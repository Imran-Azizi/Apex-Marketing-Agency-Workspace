# APEX Workspace

سیستم عملیاتی یکپارچه شرکت **Apex Smart Marketing** برای مدیریت CRM، پورتال مشتری، پروژه‌های تولید ویدیو، اجنت‌های هوش مصنوعی، مالی، تحویل امن و نمونه کارها.

**نسخه محصول:** هم‌تراز با مشخصات v3.0  
**زبان اصلی رابط:** فارسی دری (راست‌چین)  
**منطقه زمانی:** Asia/Kabul  
**واحد پول پیش‌فرض:** افغانی (AFN)

---

## معرفی سیستم

APEX Workspace مسیر کامل کسب‌وکار را پوشش می‌دهد:

```
سرنخ → CRM → سفارش تأییدشده → بیعانه → دعوت پورتال → ثبت‌نام مشتری
→ فرم پروژه → تولید محتوا با AI → تأیید مدیر/مشتری → نریشن → ادیت
→ کنترل کیفیت → تأیید نهایی → تسویه → دانلود امن → نمونه کار
```

اصول غیرقابل تغییر (P-01 تا P-10) در کد و `DEPLOYMENT.md` رعایت می‌شوند.

---

## قابلیت‌ها

- مدیریت سرنخ و مشتری (CRM)
- پورتال امن مشتری با دعوت‌نامه، OTP و نشست‌ها
- مدیریت پروژه با تب‌های Overview تا Portfolio
- اجنت‌های AI نسخه‌دار (بدون انتشار مستقیم)
- جریان نریتور و ادیتور با فایل لوگودار و پاک
- مالی: فاکتور، پرداخت چندمرحله‌ای، هزینه، سود، Payables
- دروازه دانلود امن با لینک امضاشده و Revoke
- نمونه کار خودکار پس از تکمیل پروژه
- RBAC واقعی در Backend + Audit Log
- وب‌سایت عمومی خدمات و Portfolio با CTA واتساپ

---

## معماری

| لایه        | فناوری                                                   |
| ----------- | -------------------------------------------------------- |
| Frontend    | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend     | Node.js + Express (ESM) + JavaScript                     |
| Database    | PostgreSQL + Prisma ORM                                  |
| Auth        | JWT در HTTP-only Cookie + Refresh Rotation               |
| Storage     | Bunny.net CDN/Storage + Signed URL                       |
| رابط کاربری | فقط دری (افغانستان) — راست‌چین                           |

ساختار Monorepo:

```
apps/api     → REST API (+ deploy: PM2, backup scripts)
apps/web     → Frontend (+ deploy: Nginx)
DEPLOYMENT.md → راهنمای استقرار Hostinger
```

---

## نصب و راه‌اندازی

### پیش‌نیازها

- Node.js 20+
- npm 10+
- PostgreSQL 14+ (نصب محلی یا روی VPS)
- Git

### ۱) کلون و وابستگی‌ها

```bash
cd APEX_SYSTEM_PROJECT
npm install
```

### ۲) متغیرهای محیطی

فایل نمونه را کپی کنید:

```bash
copy .env.example apps\api\.env
```

`DATABASE_URL` را مطابق PostgreSQL محلی/VPS خود تنظیم کنید، مثلاً:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/apex_workspace?schema=public
```

متغیرهای مهم:

| متغیر                                      | توضیح                                  |
| ------------------------------------------ | -------------------------------------- |
| `DATABASE_URL`                             | اتصال PostgreSQL                       |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | اسرار JWT (حداقل ۳۲ کاراکتر)           |
| `CSRF_SECRET`                              | محافظت CSRF                            |
| `WEB_URL` / `API_URL`                      | آدرس‌های سرویس                         |
| `WHATSAPP_NUMBER`                          | شماره واتساپ از Settings (هاردکد نشود) |
| `AI_PROVIDER`                              | `mock` یا `openai`                     |
| `STORAGE_DRIVER`                           | `bunny` (Bunny.net)                    |

Frontend: `apps/web/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

### ۳) دیتابیس

۱. سرویس PostgreSQL را روشن نگه دارید.  
۲. دیتابیس را بسازید (یک‌بار):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE apex_workspace;"
```

۳. اسکما و Seed:

```bash
cd apps/api
npx prisma generate
npx prisma db push
npm run db:seed
cd ../..
```

از ریشه:

```bash
npm run db:generate -w apps/api
npm run db:seed -w apps/api
```

### ۴) اجرای توسعه

ترمینال ۱:

```bash
npm run dev:api
```

ترمینال ۲:

```bash
npm run dev:web
```

- وب: http://localhost:3000
- API: http://localhost:4000/health

---

## حساب‌های Seed

| نقش      | ایمیل            | رمز               |
| -------- | ---------------- | ----------------- |
| Manager  | manager@apex.af  | ApexManager!2026  |
| Sales    | sales@apex.af    | ApexSales!2026    |
| Finance  | finance@apex.af  | ApexFinance!2026  |
| Editor   | editor@apex.af   | ApexEditor!2026   |
| Narrator | narrator@apex.af | ApexNarrator!2026 |

رمز مدیر از `DEFAULT_MANAGER_PASSWORD` قابل تغییر است.

---

## نقش‌های کاربری

| نقش           | دسترسی اصلی                                          |
| ------------- | ---------------------------------------------------- |
| CEO / Manager | کامل؛ تأیید و Override                               |
| Sales         | CRM، قیمت، فاکتور بیعانه، دعوت پورتال                |
| Editor        | فقط پروژه‌های ارجاع‌شده؛ Production                  |
| Narrator      | متن نریشن ارجاع‌شده و آپلود صدا                      |
| Finance       | فاکتور، پرداخت، هزینه، Payables، Allow Download      |
| Customer      | وضعیت ساده، تأیید، فاکتور، دانلود پس از Unlock       |
| AI Service    | خواندن Context و خروجی نسخه‌دار؛ بدون تأیید/حذف/مالی |

پنهان کردن دکمه در Frontend کافی نیست؛ هر API با Middleware دسترسی چک می‌شود.

---

## Migration و Seed

```bash
# تولید کلاینت Prisma
npx prisma generate

# اعمال اسکما (توسعه)
npx prisma db push

# یا Migration رسمی
npx prisma migrate dev --name init

# داده اولیه
node prisma/seed.js
```

---

## استقرار (Deployment) — Hostinger KVM 2 VPS

راهنمای کامل (قدم‌به‌قدم، ویندوز + VPS): **`DEPLOYMENT.md`**

خلاصه معماری production:

1. Node.js 20 + PostgreSQL + Nginx + PM2 روی Hostinger KVM 2  
2. دامنه (مثلاً `smartapex.tech`) با HTTPS (Let's Encrypt)  
3. Nginx: فرانت Next.js روی `:3000` و API روی `:4000` (فقط localhost)  
4. رسانه همچنان روی **Bunny.net** (لوکال دیسک جایگزین نشود)

فایل‌های آماده:

- `apps/api/deploy/` — PM2، نمونه `.env` API، بکاپ
- `apps/web/deploy/` — Nginx، نمونه `.env` وب

### نکات Production

1. `NODE_ENV=production` و `COOKIE_SECURE=true` و `COOKIE_SAME_SITE=lax` (same-origin)  
2. اسرار JWT/CSRF را عوض کنید  
3. پورت‌های `3000` / `4000` / `5432` را در فایروال باز نکنید  
4. دیتابیس Railway را تا تأیید کامل VPS حذف نکنید  
5. `STORAGE_DRIVER=bunny` با Zone/Pull Zone فعلی

---

## جریان توسعه

1. تغییرات Backend در `apps/api/src/modules/<name>/`
2. تغییرات Frontend در `apps/web/app` و `components`
3. برای داده حساس همیشه Audit بنویسید
4. تست پذیرش: `npm run test:acceptance -w apps/api`

---

## امنیت

- پسورد با bcrypt
- توکن احراز هویت فقط در HTTP-only Cookie (نه localStorage)
- Refresh Token Rotation و Session Revoke
- Helmet + Rate Limit + CSRF
- OTP با expiry و محدودیت تلاش
- فایل پاک فقط با Balance=0 و Allow Download
- Soft Delete برای داده اصلی؛ Invoice/Payment/Approval/Audit حذف نمی‌شوند
- مشتری با تغییر URL به پروژه دیگران دسترسی ندارد

---

## بک اپ گیری (Backup)

پیشنهاد روزانه:

```bash
# Backup (PostgreSQL محلی / VPS)
pg_dump -U postgres -h localhost -d apex_workspace > backup_%DATE%.sql

# Restore (تست دوره‌ای الزامی)
psql -U postgres -h localhost -d apex_workspace < backup_YYYY-MM-DD.sql
```

رسانه‌ها در Bunny.net Storage نگهداری می‌شوند — پوشه `uploads` محلی دیگر استفاده نمی‌شود.

---

## نگهداری (Maintenance)

- مانیتور دیسک Upload و حجم دیتابیس
- بررسی Audit برای ورود مشکوک و Override دانلود
- تمدید/چرخش اسرار در صورت نشت
- به‌روزرسانی وابستگی‌ها با تست پذیرش AC-01 تا AC-28
- لاگ‌های API و سلامت `/health`

---

## تست پذیرش

```bash
npm run test:acceptance -w apps/api
```

---

## استقرار

جزئیات کامل: `DEPLOYMENT.md`

---

## مالکیت

دامنه، Hosting، Database، Storage، واتساپ، Repository و Backup باید تحت مالکیت اپیکس باشند. برنامه‌نویس دسترسی فنی دارد، نه مالکیت دائمی.

© Apex Smart Marketing — APEX Workspace
