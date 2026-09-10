# Deploy APEX Workspace — Hostinger KVM 2 VPS

This guide migrates APEX from **Vercel (web) + Railway (API/Postgres)** to a single **Hostinger KVM 2** Ubuntu VPS.

| Your Hostinger details (from panel) | Value |
| ----------------------------------- | ----- |
| Plan | **KVM 2** — 2 vCPU, **8 GB RAM**, **100 GB NVMe**, 8 TB bandwidth |
| VPS hostname | `srv1970686.hstgr.cloud` |
| Public IP | `200.234.47.162` |
| Domain | `smartapex.tech` |
| OS | Ubuntu |

**Target architecture (same domain, production):**

```text
Internet
   ↓
smartapex.tech  (DNS A → 200.234.47.162)
   ↓
HTTPS (Let's Encrypt)
   ↓
Nginx
   ├── /              → Next.js (PM2, 127.0.0.1:3000)
   ├── /api/          → Express API (PM2, 127.0.0.1:4000)
   ├── /files/        → Express API
   ├── /health        → Express API
   └── /socket.io/    → Express API (WebSocket)
           ↓
     PostgreSQL (localhost only)
           ↓
     Bunny.net (media — unchanged)
```

> **Important:** This app is **Next.js App Router**, not a static SPA. Do **not** serve only an `out/` folder. Run `next start` behind Nginx.

Configs live under the apps:

- `apps/api/deploy/` — PM2, API production `.env` example, backup/bootstrap scripts
- `apps/web/deploy/` — Nginx site config, web production `.env` example

---

## What was removed from the repo

Obsolete platform files (safe to delete; app code unchanged):

- `railway.toml`, `apps/api/railway.toml`
- `nixpacks.toml`, `apps/api/nixpacks.toml`
- `apps/web/vercel.json`

Bunny.net storage, Prisma, auth, and all business modules are **kept**.

**Do not delete the Railway Postgres instance until VPS cutover is fully verified.**

---

## Environment variable classification

| Variable | Required prod | Notes |
| -------- | ------------- | ----- |
| `DATABASE_URL` | Yes | Local Postgres on VPS |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Yes | ≥32 chars, not `change-me` / `dev-` |
| `CSRF_SECRET` / `SIGNED_URL_SECRET` | Yes | ≥32 chars |
| `API_URL` / `WEB_URL` | Yes | `https://smartapex.tech` (same host) |
| `COOKIE_SECURE` / `COOKIE_SAME_SITE` | Yes | `true` / `lax` for same-origin HTTPS |
| `STORAGE_DRIVER` + `BUNNY_*` | Yes | Keep existing Bunny account |
| `NEXT_PUBLIC_API_URL` | Yes (web build) | `https://smartapex.tech/api/v1` |
| `AI_*` / provider keys | Optional | `mock` until keys are ready |
| `SMTP_*` / `BACKUP_EMAIL_*` | Optional | Backup emails |
| `PORT` (Railway) | Removed | Use `API_PORT=4000` |
| Vercel preview URLs in `CORS_ORIGINS` | Removed | Not needed on same domain |

Templates:

- `apps/api/deploy/.env.production.example`
- `apps/web/deploy/.env.production.example`

---

# Part A — Commands on your **Windows PC**

Use **PowerShell** or **Windows Terminal**.

### A1) Install tools (once)

- [Git for Windows](https://git-scm.com/download/win)
- [OpenSSH Client](https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse) (usually built-in)
- Optional: [PuTTY](https://www.putty.org/) if you prefer a GUI

Check:

```powershell
git --version
ssh -V
```

### A2) Create an SSH key (recommended)

```powershell
# Generates a key pair (press Enter for defaults; set a passphrase)
ssh-keygen -t ed25519 -C "apex-vps"

# Show the public key — paste this into Hostinger → VPS → SSH keys
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

In **hPanel → VPS → Manage → SSH keys**, add the public key, then disable password login later (Part B).

### A3) Connect to the VPS

```powershell
# Replace with your Hostinger root/user if different
ssh root@200.234.47.162
```

First connect: type `yes` to trust the host fingerprint.

### A4) Point DNS at the VPS (can do anytime before SSL)

In Hostinger → **Domains → smartapex.tech → DNS**:

| Type | Name | Points to | TTL |
| ---- | ---- | --------- | --- |
| A | `@` | `200.234.47.162` | 300 |
| A | `www` | `200.234.47.162` | 300 |

Remove conflicting A/CNAME records that still point at Vercel.

Check from Windows:

```powershell
nslookup smartapex.tech
```

You want the answer `200.234.47.162`.

### A5) Export the current Railway database (keep Railway alive)

You need the Railway **public** Postgres URL once (from Railway → Postgres → Variables → `DATABASE_URL` / public proxy URL).

On Windows, if you have `pg_dump` (PostgreSQL client tools):

```powershell
# Create a folder for the dump
mkdir $env:USERPROFILE\apex-db-migration -Force
cd $env:USERPROFILE\apex-db-migration

# Paste your Railway PUBLIC URL carefully (keep sslmode=require)
$env:PGPASSWORD = "YOUR_RAILWAY_DB_PASSWORD"

pg_dump "postgresql://USER:PASSWORD@HOST:PORT/railway?sslmode=require" `
  --no-owner --no-acl -F c -f apex_railway.dump
```

If `pg_dump` is not installed, either:

1. Install [PostgreSQL Windows](https://www.postgresql.org/download/windows/) (command-line tools only), or  
2. Dump from a one-off shell **on Railway** and download the file, or  
3. Use WSL Ubuntu and run the Linux `pg_dump` commands from Part B’s migration section.

**Do not delete Railway Postgres yet.**

### A6) Push latest code to GitHub (so the VPS can clone)

From your project folder:

```powershell
cd "C:\Users\imran khan\Desktop\APEX-SYSTEM\APEX_SYSTEM_PROJECT"
git status
# After reviewing changes, commit when you are ready, then:
git push origin main
```

Repo used by this project: `https://github.com/Imran-Azizi/Apex-Marketing-Agency-Workspace.git`

### A7) Copy the dump to the VPS (after VPS user/dirs exist)

```powershell
scp $env:USERPROFILE\apex-db-migration\apex_railway.dump root@200.234.47.162:/tmp/apex_railway.dump
```

---

# Part B — Commands on the **Hostinger VPS** (Ubuntu)

All commands below run **after** `ssh root@200.234.47.162` unless noted.

### B1) Update the OS

```bash
# Refresh package lists and upgrade installed packages
apt update && apt upgrade -y

# Optional reboot if the kernel was upgraded
# reboot
```

### B2) Create app user and directories

```bash
# Dedicated non-root user for the app
adduser --disabled-password --gecos "" apex
usermod -aG sudo apex

# App + log + backup dirs
mkdir -p /var/www/apex /var/log/apex /var/backups/apex /var/www/certbot
chown -R apex:apex /var/www/apex /var/log/apex
chmod 750 /var/log/apex /var/backups/apex
```

Or run the helper:

```bash
bash /var/www/apex/apps/api/deploy/scripts/bootstrap-dirs.sh
# (only after the repo is cloned)
```

### B3) Install Node.js 20, PostgreSQL, Nginx, Git, Certbot, UFW helpers

```bash
# Git + build tools + nginx + certbot + firewall + fail2ban
apt install -y git curl build-essential nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades

# Node.js 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # expect v20.x
npm -v

# PostgreSQL
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# PM2 globally
npm install -g pm2
```

### B4) Firewall (UFW) — only SSH + HTTP + HTTPS

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Do NOT allow 3000, 4000, or 5432 from the internet
ufw --force enable
ufw status
```

### B5) Harden SSH (after your key works)

```bash
# Edit sshd config
nano /etc/ssh/sshd_config
```

Recommended settings:

```text
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
```

Then:

```bash
systemctl reload ssh
```

Enable fail2ban:

```bash
systemctl enable --now fail2ban
```

Enable unattended security updates:

```bash
dpkg-reconfigure -plow unattended-upgrades
```

### B6) Create PostgreSQL role + database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER apex WITH PASSWORD 'CHANGE_ME_STRONG_DB_PASSWORD';
CREATE DATABASE apex_workspace OWNER apex;
GRANT ALL PRIVILEGES ON DATABASE apex_workspace TO apex;
\c apex_workspace
GRANT ALL ON SCHEMA public TO apex;
ALTER SCHEMA public OWNER TO apex;
SQL
```

Listen on localhost only (default on Ubuntu is usually fine). Confirm:

```bash
# Should show listen on 127.0.0.1 or local socket — not 0.0.0.0:5432 for remote
ss -lntp | grep 5432 || true
```

In `/etc/postgresql/*/main/pg_hba.conf`, keep remote access denied (no `0.0.0.0/0` trust).

### B7) Clone the project

```bash
sudo -u apex -H bash -lc '
  cd /var/www
  git clone https://github.com/Imran-Azizi/Apex-Marketing-Agency-Workspace.git apex
  cd apex
  git checkout main
'
```

If the repo is private, use a GitHub deploy key or HTTPS token for the `apex` user.

### B8) Install npm dependencies

```bash
sudo -u apex -H bash -lc '
  cd /var/www/apex
  npm install
'
```

### B9) Configure production `.env` files

```bash
sudo -u apex -H bash -lc '
  cp /var/www/apex/apps/api/deploy/.env.production.example /var/www/apex/apps/api/.env
  cp /var/www/apex/apps/web/deploy/.env.production.example /var/www/apex/apps/web/.env.production
  chmod 600 /var/www/apex/apps/api/.env /var/www/apex/apps/web/.env.production
  nano /var/www/apex/apps/api/.env
  nano /var/www/apex/apps/web/.env.production
'
```

Fill at minimum:

**`apps/api/.env`**

```env
NODE_ENV=production
API_PORT=4000
HOST=127.0.0.1
API_URL=https://smartapex.tech
WEB_URL=https://smartapex.tech
DATABASE_URL=postgresql://apex:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/apex_workspace?schema=public
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
# + strong JWT/CSRF/SIGNED secrets
# + existing BUNNY_* values from current production
```

**`apps/web/.env.production`**

```env
NEXT_PUBLIC_API_URL=https://smartapex.tech/api/v1
NEXT_PUBLIC_STORAGE_PUBLIC_BASE=https://smartapex.tech/files
```

Generate secrets on the VPS:

```bash
openssl rand -base64 48
```

### B10) Migrate the database from Railway dump

If you uploaded `/tmp/apex_railway.dump` (custom format from `pg_dump -F c`):

```bash
# Restore into the new database (keeps Railway source intact)
sudo -u postgres pg_restore \
  --no-owner --no-acl \
  -d apex_workspace \
  /tmp/apex_railway.dump

# Reassign ownership to apex
sudo -u postgres psql -d apex_workspace -c 'ALTER DATABASE apex_workspace OWNER TO apex;'
sudo -u postgres psql -d apex_workspace -c 'REASSIGN OWNED BY postgres TO apex;'
```

If you have a plain `.sql` dump instead:

```bash
sudo -u postgres psql -d apex_workspace -f /tmp/apex_railway.sql
```

Then apply any Prisma migrations not yet in the dump history:

```bash
sudo -u apex -H bash -lc '
  cd /var/www/apex/apps/api
  npx prisma generate
  npx prisma migrate deploy
'
```

Verify schema:

```bash
sudo -u apex -H bash -lc '
  cd /var/www/apex/apps/api
  npm run db:ping
  npx prisma migrate status
'
```

**Fresh install only (no Railway data):** skip restore; run `migrate deploy` then `npm run db:seed` once.

**Do not drop Railway** until login, CRM, files, and chat work on the VPS.

### B11) Build the frontend (production)

`NEXT_PUBLIC_*` are baked in at **build** time — set `.env.production` first.

```bash
sudo -u apex -H bash -lc '
  cd /var/www/apex
  npm run build -w @apex/api
  npm run build -w @apex/web
'
```

### B12) Start API + Web with PM2

```bash
# Ensure log dir writable
chown -R apex:apex /var/log/apex

sudo -u apex -H bash -lc '
  cd /var/www/apex
  pm2 start apps/api/deploy/ecosystem.config.cjs
  pm2 status
  pm2 logs --lines 50
'
```

Enable start on reboot:

```bash
sudo -u apex -H bash -lc 'pm2 startup systemd -u apex --hp /home/apex'
# Run the exact sudo command that PM2 prints, then:
sudo -u apex -H bash -lc 'pm2 save'
```

Local smoke tests (on the VPS):

```bash
curl -sS http://127.0.0.1:4000/health
curl -sS -I http://127.0.0.1:3000
```

### B13) Configure Nginx

```bash
# Snakeoil certs let nginx start before Let's Encrypt (Ubuntu package)
apt install -y ssl-cert

cp /var/www/apex/apps/web/deploy/nginx/smartapex.tech.conf \
  /etc/nginx/sites-available/smartapex.tech

ln -sf /etc/nginx/sites-available/smartapex.tech /etc/nginx/sites-enabled/smartapex.tech
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx
```

### B14) SSL with Let's Encrypt

DNS must already point to `200.234.47.162`.

```bash
certbot --nginx -d smartapex.tech -d www.smartapex.tech
# Follow prompts; choose redirect HTTP→HTTPS

# Test auto-renewal
certbot renew --dry-run
```

Certbot updates the Nginx SSL paths automatically.

### B15) End-to-end verification checklist

From a browser:

1. `https://smartapex.tech` loads  
2. `https://smartapex.tech/health` returns JSON `{ success: true, ... }`  
3. Manager login works (cookies / session stick)  
4. CRM list / create works  
5. Project open + file upload works (Bunny URLs still valid)  
6. Chat connects (Socket.IO, no console CORS errors)  
7. Soft refresh on deep routes (e.g. `/crm`) does not 404  

From VPS:

```bash
pm2 status
journalctl -u nginx -n 50 --no-pager
tail -n 100 /var/log/apex/api-error.log
```

### B16) Database backups (cron)

```bash
cp /var/www/apex/apps/api/deploy/scripts/backup-postgres.sh \
  /usr/local/bin/apex-backup-postgres.sh
chmod 750 /usr/local/bin/apex-backup-postgres.sh

# Root-only credentials for pg_dump
install -d -m 700 /etc/apex
cat >/etc/apex/backup.env <<'EOF'
PGPASSWORD='CHANGE_ME_STRONG_DB_PASSWORD'
DB_USER=apex
DB_NAME=apex_workspace
PGHOST=127.0.0.1
EOF
chmod 600 /etc/apex/backup.env

# Daily 03:00
crontab -e
```

Add:

```cron
0 3 * * * /usr/local/bin/apex-backup-postgres.sh >> /var/log/apex/backup.log 2>&1
```

Test once:

```bash
/usr/local/bin/apex-backup-postgres.sh
ls -lh /var/backups/apex
```

App-level Backup & Restore (in-product) can still email archives if SMTP is configured.

### B17) Monitoring basics

```bash
pm2 monit
df -h
free -h
ss -lntp   # expect nginx :80/:443; node on 127.0.0.1:3000/4000; postgres local
```

---

# Part C — Cutover & cleanup

1. Put Railway/Vercel in maintenance or leave read-only while testing VPS.  
2. Final dump from Railway → restore to VPS if data changed after the first dump.  
3. Switch DNS fully to VPS (already done in A4).  
4. Confirm production for 24–48 hours.  
5. **Only then** remove Railway services / Vercel project.  
6. Keep one offline dump archive offline (USB / encrypted drive).

---

# Part D — Redeploy after code changes

**On Windows (push):**

```powershell
cd "C:\Users\imran khan\Desktop\APEX-SYSTEM\APEX_SYSTEM_PROJECT"
git add -A
git commit -m "your message"
git push origin main
```

**On VPS (pull + rebuild):**

```bash
sudo -u apex -H bash -lc '
  cd /var/www/apex
  git pull origin main
  npm install
  cd apps/api && npx prisma generate && npx prisma migrate deploy && cd ../..
  npm run build -w @apex/api
  npm run build -w @apex/web
  pm2 restart apex-api apex-web
'
```

---

# Troubleshooting

| Symptom | Fix |
| ------- | --- |
| 502 Bad Gateway | `pm2 status`; API/web not running; check logs in `/var/log/apex/` |
| Login fails / cookies | Same-origin: `COOKIE_SAME_SITE=lax`, `COOKIE_SECURE=true`, `WEB_URL` exact match |
| CORS errors | Prefer same domain; else add origin to `CORS_ORIGINS` |
| Prisma migrate fails | Check `DATABASE_URL`, `migrate status`, restore ownership |
| Next build missing API URL | Rebuild after setting `apps/web/.env.production` |
| Socket.IO fails | Ensure Nginx `/socket.io/` has `Upgrade` headers (see sample conf) |
| SSL fails | DNS not pointing yet; wait for propagation; retry certbot |
| Uploads fail | Bunny credentials; never switch to local disk accidentally |

---

# Production readiness checklist

- [ ] UFW: 22/80/443 only  
- [ ] Postgres not public  
- [ ] API/Web bound to localhost via Nginx  
- [ ] PM2 online + `pm2 save` + startup enabled  
- [ ] HTTPS valid + certbot renew dry-run OK  
- [ ] `/health` OK  
- [ ] Login + RBAC + CRUD OK  
- [ ] Bunny upload/download OK  
- [ ] Chat realtime OK  
- [ ] Daily `pg_dump` cron OK  
- [ ] Railway DB retained until verified, then decommissioned  
- [ ] No Vercel/Railway deploy configs left in repo  

---

© Apex Smart Marketing — Hostinger KVM 2 production guide
