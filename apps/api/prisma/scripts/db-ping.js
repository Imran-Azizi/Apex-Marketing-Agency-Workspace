/**
 * Quick Postgres reachability check (run from apps/api):
 *   node prisma/scripts/db-ping.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function normalizeUrl(raw) {
  if (!raw) throw new Error('DATABASE_URL is missing in .env');
  const url = new URL(raw);
  // Legacy remote proxies sometimes need SSL + longer connect timeout.
  if (!url.searchParams.has('sslmode') && /rlwy\.net|railway/i.test(url.hostname)) {
    url.searchParams.set('sslmode', 'require');
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '60');
  }
  return url.toString();
}

const databaseUrl = normalizeUrl(process.env.DATABASE_URL);
process.env.DATABASE_URL = databaseUrl;

const host = new URL(databaseUrl).host;
console.log(`Pinging database at ${host}…`);

const prisma = new PrismaClient();
let lastError;

for (let i = 1; i <= 5; i++) {
  try {
    await prisma.$connect();
    const rows = await prisma.$queryRaw`SELECT current_database() AS db, now() AS ts`;
    console.log('OK — connected:', rows[0]);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    lastError = err;
    console.warn(`Attempt ${i}/5 failed: ${err.message}`);
    await new Promise((r) => setTimeout(r, 2000 * i));
  }
}

console.error('FAILED — cannot reach database.');
console.error(lastError?.message || lastError);
console.error(`
Tips:
1. Confirm PostgreSQL is running (systemctl status postgresql).
2. For local VPS DB use 127.0.0.1 and a matching DATABASE_URL user/password.
3. For remote SSL hosts, include: ?sslmode=require&connect_timeout=60
4. Then: npm run db:seed
`);
await prisma.$disconnect().catch(() => {});
process.exit(1);
