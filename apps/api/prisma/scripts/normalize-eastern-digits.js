/**
 * One-time backfill: convert Persian / Arabic-Indic digits stored in text
 * columns to English (ASCII) digits.
 *
 * Usage (from apps/api):
 *   node prisma/scripts/normalize-eastern-digits.js
 *   node prisma/scripts/normalize-eastern-digits.js --dry-run
 *
 * Safe to re-run: rows without Eastern digits are skipped.
 */
import { PrismaClient } from '@prisma/client';
import { toEnglishDigits, hasEasternDigits } from '../../src/utils/toEnglishDigits.js';

const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

/**
 * @typedef {{ model: keyof PrismaClient, idField?: string, fields: string[] }} Target
 */

/** @type {Target[]} */
const TARGETS = [
  { model: 'user', fields: ['phone'] },
  {
    model: 'crmCustomer',
    fields: ['phone', 'whatsappRaw', 'normalizedWhatsapp', 'email', 'notes'],
  },
  { model: 'portalAccount', fields: ['normalizedWhatsapp'] },
  { model: 'portalInvite', fields: ['whatsappNumber'] },
  { model: 'project', fields: ['code', 'title'] },
  { model: 'opportunity', fields: ['title', 'agreedTerms', 'lostReason'] },
  { model: 'invoice', fields: ['invoiceNumber', 'notes'] },
  { model: 'payment', fields: ['reference', 'notes'] },
];

async function normalizeModel({ model, idField = 'id', fields }) {
  const client = prisma[model];
  if (!client?.findMany || !client?.update) {
    console.warn(`Skipping unknown model: ${model}`);
    return { model, scanned: 0, updated: 0 };
  }

  const rows = await client.findMany({
    select: Object.fromEntries([[idField, true], ...fields.map((f) => [f, true])]),
  });

  let updated = 0;
  for (const row of rows) {
    /** @type {Record<string, string>} */
    const data = {};
    for (const field of fields) {
      const value = row[field];
      if (typeof value === 'string' && hasEasternDigits(value)) {
        data[field] = toEnglishDigits(value);
      }
    }
    if (Object.keys(data).length === 0) continue;

    updated += 1;
    if (dryRun) {
      console.log(`[dry-run] ${model}.${row[idField]}`, data);
      continue;
    }
    await client.update({
      where: { [idField]: row[idField] },
      data,
    });
  }

  return { model, scanned: rows.length, updated };
}

async function main() {
  console.log(`Eastern digit backfill${dryRun ? ' (dry-run)' : ''}…`);
  const results = [];
  for (const target of TARGETS) {
    try {
      results.push(await normalizeModel(target));
    } catch (err) {
      console.error(`Failed on ${target.model}:`, err.message);
      results.push({ model: target.model, scanned: 0, updated: 0, error: err.message });
    }
  }
  console.table(results);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
