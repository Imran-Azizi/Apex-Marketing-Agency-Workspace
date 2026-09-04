# Deploy APEX Workspace — Railway (API) + Vercel (Web)

Recommended split:

| Service | Host | Root / path |
| ------- | ---- | ----------- |
| PostgreSQL + API | **Railway** | repo root or `apps/api` |
| Next.js frontend | **Vercel** | `apps/web` |

Node.js **20+** is required.

---

## Pre-flight (local)

```bash
# from repo root
npm install
npm run test:unit -w @apex/api
npm run build -w @apex/web
```

API `prisma generate` may fail on Windows if the API process locks the Prisma engine file — stop `npm run dev:api` first, or rely on Railway to generate during deploy.

---

## Part A — Railway (database + API)

### 1) Create project

1. Go to [railway.app](https://railway.app) → **New Project**.
2. Add **PostgreSQL**.
3. Add a second service: **GitHub Repo** → select this monorepo.

### 2) Configure the API service

Use either:

**Option A — Root directory = repository root** (uses root `railway.toml`):

- Build: `npm install && npm run build -w @apex/api`
- Start: `npm run start:node -w @apex/api`
- Or enable migrate-on-start via `apps/api` service settings (Option B is simpler).

**Option B — Root Directory = `apps/api`** (recommended; uses `apps/api/railway.toml`):

| Setting | Value |
| ------- | ----- |
| Root Directory | `apps/api` |
| Build Command | `npm ci \|\| npm install; npx prisma generate` |
| Start Command | `npx prisma migrate deploy && node src/index.js` |
| Healthcheck Path | `/health` |

If Root Directory is `apps/api`, Railway installs only that package’s deps. For npm workspaces, prefer deploying from **repo root** with:

- **Root Directory:** `/` (empty / repo root)
- **Build Command:** `npm install && npm run build -w @apex/api`
- **Start Command:** `cd apps/api && npx prisma migrate deploy && node src/index.js`
- **Healthcheck:** `/health`

### 3) Railway variables (API service)

Copy from `apps/api/.env.example`. Minimum production set:

```env
NODE_ENV=production

# Railway Postgres — use the private DATABASE_URL Railway injects,
# or the public URL with sslmode=require
DATABASE_URL=${{Postgres.DATABASE_URL}}

API_URL=https://YOUR-API.up.railway.app
WEB_URL=https://YOUR-APP.vercel.app
CORS_ORIGINS=https://YOUR-APP.vercel.app,https://YOUR-APP-git-main-YOURTEAM.vercel.app

JWT_ACCESS_SECRET=<random-32+-chars>
JWT_REFRESH_SECRET=<random-32+-chars>
CSRF_SECRET=<random-32+-chars>
SIGNED_URL_SECRET=<random-32+-chars>

COOKIE_SECURE=true
COOKIE_SAME_SITE=none

STORAGE_DRIVER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER_PREFIX=apex
STORAGE_PUBLIC_BASE=https://res.cloudinary.com/YOUR_CLOUD_NAME

AI_PROVIDER=mock
# or openrouter / openai / gemini with keys

DEFAULT_MANAGER_EMAIL=manager@apex.af
DEFAULT_MANAGER_PASSWORD=<strong-password>
WHATSAPP_NUMBER=93700000000
TZ=Asia/Kabul
```

Notes:

- Generate secrets with a password manager (min 32 characters; no `change-me` / `dev-` prefixes — production boot rejects weak secrets).
- After the first Vercel deploy, set `WEB_URL` / `CORS_ORIGINS` / `API_URL` to the real URLs and **redeploy** the API.
- For Cloudflare R2 instead of Cloudinary: `STORAGE_DRIVER=r2` plus `S3_*` and `STORAGE_PUBLIC_BASE`.

### 4) Seed (one time)

After the first successful migrate + start:

```bash
# Railway CLI or one-off shell on the API service
cd apps/api   # if at monorepo root
npm run db:seed
```

Or open Railway → API service → **Shell** and run `npx prisma db seed` (from `apps/api`).

### 5) Verify API

Open `https://YOUR-API.up.railway.app/health` — expect a healthy JSON response.

---

## Part B — Vercel (Next.js web)

### 1) Import project

1. [vercel.com](https://vercel.com) → **Add New Project** → import the same GitHub repo.
2. Configure:

| Setting | Value |
| ------- | ----- |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Install Command | `cd ../.. && npm install` (already in `apps/web/vercel.json`) |
| Build Command | `npm run build` |
| Output | default (Next.js) |

### 2) Vercel environment variables

```env
NEXT_PUBLIC_API_URL=https://YOUR-API.up.railway.app/api/v1
NEXT_PUBLIC_STORAGE_PUBLIC_BASE=https://YOUR-API.up.railway.app/files
```

For R2/CDN public assets, set `NEXT_PUBLIC_STORAGE_PUBLIC_BASE` to your CDN URL instead.

Redeploy after changing env vars.

### 3) Verify web

1. Open the Vercel URL.
2. Log in with the seeded manager account.
3. If login fails with cookies: confirm Railway has `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, and `WEB_URL` matches the Vercel origin exactly (no trailing slash).

---

## Part C — Wire the two together

1. Deploy Railway API first → copy public URL.
2. Deploy Vercel with `NEXT_PUBLIC_API_URL`.
3. Update Railway `WEB_URL`, `API_URL`, `CORS_ORIGINS` → redeploy API.
4. Confirm:
   - `/health` on Railway
   - Login works from Vercel
   - File upload / Cloudinary or R2 works
   - Chat (Socket.IO) connects to the same API host

---

## Common failures

| Symptom | Fix |
| ------- | --- |
| API crash on boot: missing / weak secret | Set strong `JWT_*`, `CSRF_SECRET`, `SIGNED_URL_SECRET` |
| Login works then immediately logs out | Cross-origin cookies: `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true` |
| CORS errors in browser | Add exact Vercel URL to `WEB_URL` and `CORS_ORIGINS` |
| Prisma migrate fails | Ensure `DATABASE_URL` points at Railway Postgres; check migration history |
| Vercel build “Cannot find module” | Root Directory must be `apps/web`; install from monorepo root |
| 402 / AI quota | Set `AI_PROVIDER` and valid keys, or keep `mock` |

---

## Suggested order checklist

- [ ] Push latest code to GitHub
- [ ] Railway: Postgres + API service
- [ ] Railway: env vars + deploy + `/health` OK
- [ ] Railway: seed database once
- [ ] Vercel: `apps/web` + `NEXT_PUBLIC_API_URL`
- [ ] Railway: set final `WEB_URL` / `CORS_ORIGINS` / `API_URL`
- [ ] Test manager login, CRM, project open, file upload
