/**
 * Quick Railway / Postgres reachability check (run from apps/api):
 *   node prisma/scripts/db-ping.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function normalizeUrl(raw) {
  if (!raw) throw new Error('DATABASE_URL is missing in .env');
  const url = new URL(raw);
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
1. Railway → Postgres → must be Running (not sleeping).
2. Use the PUBLIC URL (*.proxy.rlwy.net), not the internal hostname.
3. Ensure DATABASE_URL includes: ?sslmode=require&connect_timeout=60
4. Prefer seeding inside Railway (one-off): npm run db:seed
`);
await prisma.$disconnect().catch(() => {});
process.exit(1);
