import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '../migrations/20260715000000_init/migration.sql');
const checksum = crypto.createHash('sha256').update(fs.readFileSync(migrationPath)).digest('hex');
const sql = `UPDATE "_prisma_migrations" SET checksum = '${checksum}' WHERE migration_name = '20260715000000_init';`;

console.log('Updating init migration checksum:', checksum);
execSync('npx prisma db execute --stdin --schema prisma/schema.prisma', {
  input: sql,
  stdio: ['pipe', 'inherit', 'inherit'],
  cwd: path.join(__dirname, '..'),
});
