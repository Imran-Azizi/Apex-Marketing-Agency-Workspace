/**
 * APEX full-system backup / restore.
 * Archives every durable Prisma table plus referenced Bunny media into a tar.gz
 * package, stores it locally (optional cloud mirror), emails when SMTP allows,
 * and supports validated wipe-and-restore of the complete system.
 */
import crypto from 'crypto';
import { gunzipSync } from 'zlib';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { storage } from '../../services/storage.js';
import { writeAudit } from '../../middleware/audit.js';
import { sendMail, isEmailConfigured } from '../../services/email.js';
import { env } from '../../config/env.js';
import {
  saveLocalBackup,
  localBackupExists,
  deleteLocalBackup,
  openLocalBackupStream,
  moveIntoLocalBackup,
  stagingDirFor,
  clearStaging,
  localBackupPath,
  ensureBackupRoot,
} from '../../services/backupLocalStore.js';
import {
  backupEmailDeliveryPlan,
  buildBackupEmailContent,
  normalizeBackupRecipientEmail,
  resolveBackupRecipientEmail,
  safeEmailErrorMessage,
  withBackupEmailLock,
} from './emailDelivery.js';
import {
  BACKUP_TABLES,
  SKIP_TABLES,
  SELF_REF_NULL_ON_CREATE,
  assertBackupTablesComplete,
} from './tables.js';
import { collectMediaKeysFromTables } from './media-keys.js';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  LEGACY_VERSION,
  ensureEmptyDir,
  writeJsonGzip,
  readJsonGzipFile,
  writeManifest,
  writeMediaIndex,
  packStagingDir,
  unpackArchive,
  readManifest,
  mediaRelPath,
  sha256File,
  sniffFileKind,
  fileExists,
} from './archive.js';

export const BACKUP_FORMAT = ARCHIVE_FORMAT;
export const BACKUP_VERSION = ARCHIVE_VERSION;
export { BACKUP_TABLES, SKIP_TABLES };
export const SCHEDULE_SETTING_KEY = 'backup_schedule';

const DEFAULT_SCHEDULE = {
  emailTo: '',
  daily: { enabled: false, time: '23:00' },
  weekly: { enabled: false, dayOfWeek: 0, time: '23:00' },
  monthly: { enabled: false, dayOfMonth: 1, time: '23:00' },
};

const MEDIA_CONCURRENCY = 4;
const MEDIA_DOWNLOAD_RETRIES = 3;

function prismaDelegate(modelName) {
  const key = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = prisma[key];
  if (!delegate?.findMany) {
    throw new AppError(`مدل ${modelName} برای بک اپ گیری در دسترس نیست`, 500, 'BACKUP_MODEL_MISSING');
  }
  return delegate;
}

function isPrismaDecimal(value) {
  if (value == null || typeof value !== 'object') return false;
  if (Decimal.isDecimal?.(value)) return true;
  if (value instanceof Prisma.Decimal) return true;
  if (value.constructor?.name === 'Decimal') return true;
  return (
    typeof value.s === 'number' &&
    typeof value.e === 'number' &&
    Array.isArray(value.d)
  );
}

function decimalToPlain(value) {
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Decimal.isDecimal?.(value) || value instanceof Prisma.Decimal) {
    return value.toString();
  }
  if (value.constructor?.name === 'Decimal' && typeof value.toString === 'function') {
    return value.toString();
  }
  if (
    typeof value === 'object' &&
    typeof value.s === 'number' &&
    typeof value.e === 'number' &&
    Array.isArray(value.d)
  ) {
    const revived = new Decimal(0);
    revived.s = value.s;
    revived.e = value.e;
    revived.d = value.d.slice();
    return revived.toString();
  }
  if (typeof value?.toString === 'function') return value.toString();
  return String(value);
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { __apexType: 'Bytes', data: value.toString('base64') };
  if (isPrismaDecimal(value)) return decimalToPlain(value);
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

const modelByName = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, m]),
);

function sanitizeRowForRestore(modelName, row) {
  if (!row || typeof row !== 'object') return row;
  const model = modelByName[modelName];
  if (!model) return row;

  const out = {};
  for (const field of model.fields) {
    if (field.kind !== 'scalar' && field.kind !== 'enum') continue;
    if (!(field.name in row)) continue;
    let val = row[field.name];
    if (val === undefined) continue;

    if (val === null) {
      out[field.name] = null;
      continue;
    }

    if (field.type === 'Decimal') {
      out[field.name] = decimalToPlain(val);
      continue;
    }

    if (field.type === 'DateTime') {
      out[field.name] = val instanceof Date ? val : new Date(val);
      continue;
    }

    if (field.type === 'Bytes') {
      if (Buffer.isBuffer(val)) out[field.name] = val;
      else if (val?.__apexType === 'Bytes' && typeof val.data === 'string') {
        out[field.name] = Buffer.from(val.data, 'base64');
      } else if (typeof val === 'string') {
        out[field.name] = Buffer.from(val, 'base64');
      } else {
        out[field.name] = val;
      }
      continue;
    }

    if (field.type === 'BigInt' && typeof val === 'string') {
      out[field.name] = BigInt(val);
      continue;
    }

    if (isPrismaDecimal(val) && field.type !== 'Json') {
      out[field.name] = decimalToPlain(val);
      continue;
    }

    out[field.name] = val;
  }
  return out;
}

function prismaErrorMessage(err) {
  const meta = err?.meta ? ` (${JSON.stringify(err.meta)})` : '';
  return `${err?.message || 'Prisma error'}${meta}`;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value == null) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function jsonSafeBigInt(value) {
  const n = toBigInt(value);
  // Keep JSON-safe number when within safe integer range
  if (n <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(n);
  return n.toString();
}

export function getDefaultSchedule() {
  return structuredClone(DEFAULT_SCHEDULE);
}

export async function getScheduleSettings() {
  const row = await prisma.setting.findUnique({ where: { key: SCHEDULE_SETTING_KEY } });
  if (!row?.value || typeof row.value !== 'object') {
    return getDefaultSchedule();
  }
  return {
    ...getDefaultSchedule(),
    ...row.value,
    daily: { ...DEFAULT_SCHEDULE.daily, ...(row.value.daily || {}) },
    weekly: { ...DEFAULT_SCHEDULE.weekly, ...(row.value.weekly || {}) },
    monthly: { ...DEFAULT_SCHEDULE.monthly, ...(row.value.monthly || {}) },
  };
}

export async function saveScheduleSettings(value, auth, req) {
  const emailRaw = String(value?.emailTo ?? '').trim();
  let emailTo = '';
  if (emailRaw) {
    const normalized = normalizeBackupRecipientEmail(emailRaw);
    if (!normalized) {
      throw new AppError('آدرس ایمیل دریافت بک اپ نامعتبر است', 400, 'VALIDATION');
    }
    emailTo = normalized;
  }

  const next = {
    ...getDefaultSchedule(),
    ...value,
    daily: { ...DEFAULT_SCHEDULE.daily, ...(value?.daily || {}) },
    weekly: { ...DEFAULT_SCHEDULE.weekly, ...(value?.weekly || {}) },
    monthly: { ...DEFAULT_SCHEDULE.monthly, ...(value?.monthly || {}) },
    emailTo,
  };

  const setting = await prisma.setting.upsert({
    where: { key: SCHEDULE_SETTING_KEY },
    create: { key: SCHEDULE_SETTING_KEY, value: next },
    update: { value: next },
  });

  await writeAudit({
    userId: auth?.userId,
    action: 'BACKUP_SCHEDULE_UPDATE',
    entityType: 'Setting',
    entityId: setting.id,
    after: next,
    req,
  });

  try {
    const { reloadBackupScheduler } = await import('../../services/backupScheduler.js');
    await reloadBackupScheduler();
  } catch (err) {
    console.warn('[backup] scheduler reload failed:', err?.message || err);
  }

  return next;
}

function computeNextRuns(schedule, from = new Date()) {
  const next = {};
  const parseTime = (t) => {
    const [h, m] = String(t || '23:00').split(':').map(Number);
    return { h: Number.isFinite(h) ? h : 23, m: Number.isFinite(m) ? m : 0 };
  };

  if (schedule.daily?.enabled) {
    const { h, m } = parseTime(schedule.daily.time);
    const d = new Date(from);
    d.setSeconds(0, 0);
    d.setHours(h, m, 0, 0);
    if (d <= from) d.setDate(d.getDate() + 1);
    next.daily = d.toISOString();
  }
  if (schedule.weekly?.enabled) {
    const { h, m } = parseTime(schedule.weekly.time);
    const target = Number(schedule.weekly.dayOfWeek) || 0;
    const d = new Date(from);
    d.setSeconds(0, 0);
    d.setHours(h, m, 0, 0);
    const delta = (target - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + delta);
    if (d <= from) d.setDate(d.getDate() + 7);
    next.weekly = d.toISOString();
  }
  if (schedule.monthly?.enabled) {
    const { h, m } = parseTime(schedule.monthly.time);
    const day = Math.min(28, Math.max(1, Number(schedule.monthly.dayOfMonth) || 1));
    const d = new Date(from.getFullYear(), from.getMonth(), day, h, m, 0, 0);
    if (d <= from) d.setMonth(d.getMonth() + 1);
    next.monthly = d.toISOString();
  }
  return next;
}

async function updateProgress(backupId, percent, phase, extra = {}) {
  try {
    await prisma.systemBackup.update({
      where: { id: backupId },
      data: {
        progressPercent: Math.max(0, Math.min(100, Math.round(percent))),
        progressPhase: phase,
        ...extra,
      },
    });
  } catch (err) {
    console.warn('[backup] progress update failed:', err?.message || err);
  }
}

async function exportDatabaseTables(onProgress) {
  assertBackupTablesComplete();
  const tables = {};
  let recordCount = 0;
  const total = BACKUP_TABLES.filter((n) => !SKIP_TABLES.has(n)).length;
  let done = 0;

  for (const name of BACKUP_TABLES) {
    if (SKIP_TABLES.has(name)) continue;
    const rows = await prismaDelegate(name).findMany();
    tables[name] = rows.map(serializeValue);
    recordCount += rows.length;
    done += 1;
    if (onProgress) {
      await onProgress(done, total, name);
    }
  }

  return {
    tables,
    tableCount: Object.keys(tables).length,
    recordCount,
  };
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i], i);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => run());
  await Promise.all(runners);
  return results;
}

async function downloadMediaToStaging(stagingDir, mediaKeys, onProgress) {
  const entries = [];
  const missing = [];
  const errors = [];
  let mediaBytes = 0n;
  let completed = 0;

  await mapPool(mediaKeys, MEDIA_CONCURRENCY, async (storageKey) => {
    const rel = mediaRelPath(storageKey);
    const abs = path.join(stagingDir, rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });

    let lastErr = null;
    for (let attempt = 1; attempt <= MEDIA_DOWNLOAD_RETRIES; attempt++) {
      try {
        const { stream } = await storage.openReadStream(storageKey);
        await pipeline(stream, createWriteStream(abs));
        const stat = await fsp.stat(abs);
        const sha256 = await sha256File(abs);
        entries.push({
          key: storageKey,
          path: rel.replace(/\\/g, '/'),
          sizeBytes: stat.size,
          sha256,
        });
        mediaBytes += BigInt(stat.size);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const status = Number(err?.status || err?.statusCode || 0);
        const code = String(err?.code || '');
        if (status === 404 || code === 'NOT_FOUND') {
          missing.push({ key: storageKey, reason: 'not_found' });
          try {
            await fsp.unlink(abs);
          } catch {
            /* ignore */
          }
          lastErr = null;
          break;
        }
        if (attempt < MEDIA_DOWNLOAD_RETRIES) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }

    if (lastErr) {
      errors.push({
        key: storageKey,
        message: lastErr?.message || String(lastErr),
      });
    }

    completed += 1;
    if (onProgress) {
      await onProgress(completed, mediaKeys.length);
    }
  });

  if (errors.length) {
    const sample = errors
      .slice(0, 3)
      .map((e) => e.key)
      .join(', ');
    throw new AppError(
      `دانلود ${errors.length} فایل رسانه ناموفق بود (نمونه: ${sample})`,
      502,
      'BACKUP_MEDIA_FETCH',
      { errors: errors.slice(0, 20) },
    );
  }

  return { entries, missing, mediaBytes };
}

async function uploadMediaFromStaging(stagingDir, mediaIndex, onProgress) {
  const files = Array.isArray(mediaIndex?.files) ? mediaIndex.files : [];
  let completed = 0;
  const failures = [];

  await mapPool(files, MEDIA_CONCURRENCY, async (entry) => {
    const rel = entry.path || mediaRelPath(entry.key);
    const abs = path.join(stagingDir, rel);
    if (!(await fileExists(abs))) {
      failures.push({ key: entry.key, message: 'missing in archive' });
      completed += 1;
      if (onProgress) await onProgress(completed, files.length);
      return;
    }

    try {
      if (entry.sha256) {
        const hash = await sha256File(abs);
        if (hash !== entry.sha256) {
          throw new AppError(
            `checksum mismatch for ${entry.key}`,
            400,
            'BACKUP_MEDIA_CORRUPT',
          );
        }
      }
      const stat = await fsp.stat(abs);
      await storage.saveFile(abs, {
        filename: path.basename(entry.key),
        storageKey: entry.key,
        contentType: 'application/octet-stream',
        overwrite: true,
        sizeBytes: stat.size,
      });
    } catch (err) {
      failures.push({ key: entry.key, message: err?.message || String(err) });
    }

    completed += 1;
    if (onProgress) await onProgress(completed, files.length);
  });

  if (failures.length) {
    throw new AppError(
      `بازگردانی ${failures.length} فایل رسانه ناموفق بود`,
      502,
      'BACKUP_MEDIA_RESTORE',
      { failures: failures.slice(0, 20) },
    );
  }

  return { restored: files.length };
}

/**
 * Legacy v1: gzipped JSON database-only payload (kept for restore compatibility).
 */
function parseLegacyBackupBuffer(buffer) {
  let raw;
  try {
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      raw = gunzipSync(buffer).toString('utf8');
    } else {
      raw = buffer.toString('utf8');
    }
  } catch {
    throw new AppError('فایل بک اپ قابل خواندن نیست', 400, 'BACKUP_CORRUPT');
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new AppError('فرمت فایل بک اپ نامعتبر است', 400, 'BACKUP_INVALID');
  }

  if (payload.format !== BACKUP_FORMAT) {
    throw new AppError('فرمت فایل بک اپ نامعتبر است', 400, 'BACKUP_INVALID');
  }
  if (payload.version !== LEGACY_VERSION && payload.version !== ARCHIVE_VERSION) {
    // v2 database.json.gz inside archive also uses version 2 with tables
    if (!(payload.tables && payload.version === ARCHIVE_VERSION)) {
      throw new AppError('نسخه فایل بک اپ پشتیبانی نمی‌شود', 400, 'BACKUP_VERSION');
    }
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    throw new AppError('ساختار داده بک اپ ناقص است', 400, 'BACKUP_INVALID');
  }

  const { checksum, ...rest } = payload;
  if (checksum) {
    const verifyBody = {
      format: rest.format,
      version: rest.version,
      createdAt: rest.createdAt,
      app: rest.app,
      tables: rest.tables,
    };
    if (rest.scope) verifyBody.scope = rest.scope;
    const verifyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(verifyBody))
      .digest('hex');
    if (checksum !== verifyHash) {
      throw new AppError('اعتبارسنجی فایل بک اپ ناموفق بود (checksum)', 400, 'BACKUP_CHECKSUM');
    }
  }

  return payload;
}

async function emailBackup({ to, fileName, archivePath, sizeBytes, backupId, type, createdAt }) {
  const plan = backupEmailDeliveryPlan({ emailTo: to, emailSentAt: null });
  if (!plan.shouldSend) {
    if (plan.reason === 'smtp_not_configured') {
      console.warn('[backup] SMTP not configured — skip email for', backupId);
      return {
        emailSentAt: null,
        emailError:
          'سرویس ایمیل (SMTP) پیکربندی نشده است. فایل بک اپ ذخیره شد اما ارسال نشد.',
      };
    }
    if (plan.reason === 'invalid_recipient') {
      return {
        emailSentAt: null,
        emailError: 'آدرس ایمیل دریافت بک اپ نامعتبر است.',
      };
    }
    return { emailSentAt: null, emailError: null };
  }

  const maxAttach = env.backupEmailMaxBytes;
  const attachments = [];
  let oversizedNote = '';
  let attached = false;
  const size = Number(sizeBytes) || 0;

  if (size > 0 && size <= maxAttach && archivePath) {
    const content = await fsp.readFile(archivePath);
    attachments.push({
      filename: fileName,
      content,
      contentType: 'application/gzip',
    });
    attached = true;
  } else {
    oversizedNote = `File size (${formatBytes(size)}) exceeds the email attachment limit (${formatBytes(maxAttach)}); the full-system archive remains available for download in Backup & Restore.`;
  }

  const content = buildBackupEmailContent({
    fileName,
    backupId,
    type,
    sizeLabel: formatBytes(size),
    createdAt: createdAt || new Date(),
    attached,
    oversizedNote,
  });

  await sendMail({
    to: plan.recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
    attachments,
  });

  return { emailSentAt: new Date(), emailError: null };
}

async function persistBackupEmailOutcome(backupId, { emailSentAt, emailError }) {
  const softEmailError = emailError ? `EMAIL: ${emailError}` : null;
  await prisma.systemBackup.update({
    where: { id: backupId },
    data: {
      emailSentAt,
      errorMessage: softEmailError,
    },
  });
  try {
    await prisma.$executeRaw`
      UPDATE "system_backups"
      SET "emailError" = ${emailError}
      WHERE id = ${backupId}
    `;
  } catch (err) {
    console.warn('[backup] emailError column update skipped:', err?.message || err);
  }
}

function serializeBackupRow(row) {
  if (!row) return row;
  const emailError =
    row.emailError ||
    (typeof row.errorMessage === 'string' && row.errorMessage.startsWith('EMAIL: ')
      ? row.errorMessage.slice('EMAIL: '.length)
      : null);
  return {
    ...row,
    sizeBytes: jsonSafeBigInt(row.sizeBytes),
    mediaBytes: jsonSafeBigInt(row.mediaBytes ?? 0),
    mediaFileCount: row.mediaFileCount ?? 0,
    progressPercent: row.progressPercent ?? (row.status === 'SUCCESS' ? 100 : 0),
    progressPhase: row.progressPhase || null,
    scope: row.scope || 'FULL_SYSTEM',
    emailError,
    errorMessage:
      typeof row.errorMessage === 'string' && row.errorMessage.startsWith('EMAIL: ')
        ? null
        : row.errorMessage,
  };
}

async function runBackupJob(backupId) {
  const backup = await prisma.systemBackup.findUnique({ where: { id: backupId } });
  if (!backup) return;
  if (backup.status === 'SUCCESS' || backup.status === 'FAILED') {
    return;
  }

  const stagingDir = stagingDirFor(backupId);
  let packedPath = null;

  try {
    await ensureBackupRoot();
    await ensureEmptyDir(stagingDir);
    await updateProgress(backupId, 2, 'آماده‌سازی');

    // 1) Export all database tables
    const exported = await exportDatabaseTables(async (done, total) => {
      const pct = 2 + Math.round((done / Math.max(1, total)) * 28);
      await updateProgress(backupId, pct, `پایگاه داده (${done}/${total})`);
    });

    const createdAt = new Date().toISOString();
    const dbBody = {
      format: BACKUP_FORMAT,
      version: ARCHIVE_VERSION,
      createdAt,
      app: 'APEX_SYSTEM',
      scope: 'FULL_SYSTEM',
      tables: exported.tables,
    };
    const dbChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(dbBody))
      .digest('hex');
    const dbPayload = { ...dbBody, checksum: dbChecksum };

    await writeJsonGzip(path.join(stagingDir, 'database.json.gz'), dbPayload);
    await updateProgress(backupId, 32, 'جمع‌آوری فایل‌های رسانه', {
      tableCount: exported.tableCount,
      recordCount: exported.recordCount,
    });

    // 2) Collect + download media
    const mediaKeys = collectMediaKeysFromTables(exported.tables);
    await updateProgress(backupId, 35, `رسانه: ${mediaKeys.length} فایل`, {
      mediaFileCount: mediaKeys.length,
    });

    const mediaResult = await downloadMediaToStaging(
      stagingDir,
      mediaKeys,
      async (done, total) => {
        const pct = 35 + Math.round((done / Math.max(1, total)) * 45);
        await updateProgress(backupId, pct, `دانلود رسانه (${done}/${total})`);
      },
    );

    await writeMediaIndex(stagingDir, mediaResult.entries);
    await updateProgress(backupId, 82, 'بسته‌بندی آرشیو', {
      mediaFileCount: mediaResult.entries.length,
      mediaBytes: mediaResult.mediaBytes,
    });

    const manifest = {
      format: BACKUP_FORMAT,
      version: ARCHIVE_VERSION,
      createdAt,
      app: 'APEX_SYSTEM',
      scope: 'FULL_SYSTEM',
      tableCount: exported.tableCount,
      recordCount: exported.recordCount,
      mediaFileCount: mediaResult.entries.length,
      mediaBytes: Number(mediaResult.mediaBytes),
      mediaMissingCount: mediaResult.missing.length,
      mediaMissing: mediaResult.missing.slice(0, 100),
      databaseChecksum: dbChecksum,
      includes: {
        database: true,
        media: true,
        settings: true,
      },
    };
    await writeManifest(stagingDir, manifest);

    // 3) Pack tar.gz outside staging (never include the archive in itself)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `apex-backup-${stamp}.tar.gz`;
    packedPath = path.join(path.dirname(stagingDir), `${backupId}-packed.tar.gz`);
    const packed = await packStagingDir(stagingDir, packedPath);

    // Verify pack is readable and non-empty
    if (!packed.sizeBytes || packed.sizeBytes < 64) {
      throw new AppError('آرشیو بک اپ خالی یا ناقص است', 500, 'BACKUP_EMPTY');
    }

    await updateProgress(backupId, 92, 'ذخیره نهایی');
    const finalPath = await moveIntoLocalBackup(backupId, fileName, packedPath);
    packedPath = null;

    // Re-hash after move (authoritative)
    const archiveChecksum = await sha256File(finalPath);
    const storageKey = `local:backups/${backupId}/${fileName}`;

    // Optional cloud mirror (skip very large archives — local file is authoritative)
    let cloudKey = null;
    const CLOUD_MIRROR_MAX = 100 * 1024 * 1024;
    if (packed.sizeBytes <= CLOUD_MIRROR_MAX) {
      try {
        const cloudStorageKey = `documents/backups/${fileName}`;
        const buf = await fsp.readFile(finalPath);
        const saved = await storage.saveBuffer(buf, {
          filename: fileName,
          folder: 'documents',
          contentType: 'application/gzip',
          storageKey: cloudStorageKey,
        });
        cloudKey = saved.key || cloudStorageKey;
      } catch (cloudErr) {
        console.warn('[backup] cloud mirror skipped:', cloudErr?.message || cloudErr);
      }
    } else {
      console.info(
        '[backup] cloud mirror skipped — archive exceeds',
        CLOUD_MIRROR_MAX,
        'bytes',
      );
    }

    await prisma.systemBackup.update({
      where: { id: backupId },
      data: {
        status: 'SUCCESS',
        fileName,
        storageKey: cloudKey ? `${storageKey}|${cloudKey}` : storageKey,
        sizeBytes: BigInt(packed.sizeBytes),
        checksum: archiveChecksum,
        tableCount: exported.tableCount,
        recordCount: exported.recordCount,
        mediaFileCount: mediaResult.entries.length,
        mediaBytes: mediaResult.mediaBytes,
        progressPercent: 100,
        progressPhase: 'تکمیل شد',
        scope: 'FULL_SYSTEM',
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    await clearStaging(backupId);

    const mailResult = await withBackupEmailLock(backupId, async () => {
      const fresh = await prisma.systemBackup.findUnique({
        where: { id: backupId },
        select: { emailTo: true, emailSentAt: true, type: true, createdAt: true, sizeBytes: true },
      });
      if (!fresh) return { emailSentAt: null, emailError: null };
      if (fresh.emailSentAt) {
        return { emailSentAt: fresh.emailSentAt, emailError: null };
      }
      try {
        return await emailBackup({
          to: fresh.emailTo,
          fileName,
          archivePath: finalPath,
          sizeBytes: fresh.sizeBytes,
          backupId,
          type: fresh.type || backup.type,
          createdAt: fresh.createdAt || new Date(),
        });
      } catch (mailErr) {
        console.error('[backup] email failed for', backupId, safeEmailErrorMessage(mailErr));
        return {
          emailSentAt: null,
          emailError: safeEmailErrorMessage(mailErr),
        };
      }
    });

    if (mailResult && !mailResult.skipped) {
      await persistBackupEmailOutcome(backupId, mailResult);
    }
  } catch (err) {
    console.error('[backup] job failed:', err);
    await prisma.systemBackup.update({
      where: { id: backupId },
      data: {
        status: 'FAILED',
        errorMessage: err?.message || 'Backup failed',
        progressPhase: 'ناموفق',
        completedAt: new Date(),
      },
    });
    await clearStaging(backupId);
    if (packedPath) {
      try {
        await fsp.unlink(packedPath);
      } catch {
        /* ignore */
      }
    }
  }
}

function parseStorageKeys(storageKey) {
  const raw = String(storageKey || '');
  if (raw.includes('|')) {
    const [localKey, cloudKey] = raw.split('|');
    return { localKey, cloudKey };
  }
  if (raw.startsWith('local:')) {
    return { localKey: raw, cloudKey: null };
  }
  return { localKey: null, cloudKey: raw || null };
}

async function loadBackupToPath(backup) {
  const fileName = backup.fileName;
  if (!fileName) {
    throw new AppError('نام فایل بک اپ موجود نیست', 400, 'BACKUP_NOT_READY');
  }

  const localPath = localBackupPath(backup.id, fileName);
  if (await localBackupExists(backup.id, fileName)) {
    return localPath;
  }

  const { cloudKey } = parseStorageKeys(backup.storageKey);
  if (!cloudKey) {
    throw new AppError(
      'فایل بک اپ روی دیسک محلی یافت نشد. لطفاً یک بک اپ جدید ایجاد کنید.',
      404,
      'BACKUP_FILE_MISSING',
    );
  }

  try {
    const buffer = await storage.readBuffer(cloudKey);
    await saveLocalBackup(backup.id, fileName, buffer);
    return localPath;
  } catch (err) {
    console.error('[backup] cloud read failed:', err?.message || err);
    throw new AppError(
      'خواندن فایل بک اپ از فضای ابری ناموفق بود. یک بک اپ جدید ایجاد کنید (ذخیره محلی).',
      502,
      'BACKUP_CLOUD_READ',
    );
  }
}

async function restoreDatabaseTables(tables) {
  await prisma.$transaction(
    async (tx) => {
      const reverse = [...BACKUP_TABLES].reverse();
      for (const name of reverse) {
        if (SKIP_TABLES.has(name)) continue;
        const key = name.charAt(0).toLowerCase() + name.slice(1);
        if (tx[key]?.deleteMany) {
          await tx[key].deleteMany({});
        }
      }

      for (const name of BACKUP_TABLES) {
        if (SKIP_TABLES.has(name)) continue;
        const rows = tables[name];
        if (!Array.isArray(rows) || !rows.length) continue;
        const key = name.charAt(0).toLowerCase() + name.slice(1);
        if (!tx[key]?.createMany && !tx[key]?.create) {
          throw new AppError(
            `مدل ${name} برای بازگردانی در دسترس نیست`,
            500,
            'BACKUP_MODEL_MISSING',
          );
        }

        const selfNulls = SELF_REF_NULL_ON_CREATE[name] || [];
        const data = rows.map((row) => {
          const cleaned = sanitizeRowForRestore(name, row);
          for (const field of selfNulls) {
            if (field in cleaned) cleaned[field] = null;
          }
          return cleaned;
        });

        try {
          await tx[key].createMany({ data });
        } catch (bulkErr) {
          console.warn(
            `[backup] createMany failed for ${name}, falling back to create:`,
            bulkErr?.message || bulkErr,
          );
          for (let i = 0; i < data.length; i++) {
            try {
              await tx[key].create({ data: data[i] });
            } catch (rowErr) {
              throw new AppError(
                `بازگردانی جدول ${name} در ردیف ${i + 1} ناموفق بود: ${prismaErrorMessage(rowErr)}`,
                500,
                'BACKUP_RESTORE_ROW',
                { table: name, index: i },
              );
            }
          }
        }

        // Second pass for self-referential FKs
        if (selfNulls.length) {
          for (let i = 0; i < rows.length; i++) {
            const original = sanitizeRowForRestore(name, rows[i]);
            const patch = {};
            for (const field of selfNulls) {
              if (original[field] != null) patch[field] = original[field];
            }
            if (!Object.keys(patch).length) continue;
            const id = original.id;
            if (!id) continue;
            try {
              await tx[key].update({ where: { id }, data: patch });
            } catch (updErr) {
              console.warn(`[backup] self-ref update failed for ${name}:`, updErr?.message);
            }
          }
        }
      }
    },
    { timeout: 600_000, maxWait: 60_000 },
  );
}

export const backupService = {
  async overview() {
    const [schedule, latest, counts] = await Promise.all([
      getScheduleSettings(),
      prisma.systemBackup.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemBackup.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const statusMap = Object.fromEntries(
      counts.map((c) => [c.status, c._count._all]),
    );

    return {
      schedule,
      nextRuns: computeNextRuns(schedule),
      emailConfigured: isEmailConfigured(),
      latest: serializeBackupRow(latest),
      scope: 'FULL_SYSTEM',
      includes: {
        database: true,
        media: true,
        settings: true,
        catalog: true,
        crm: true,
        projects: true,
        finance: true,
        portfolio: true,
        landingPages: true,
        chat: true,
        assistants: true,
      },
      stats: {
        total: Object.values(statusMap).reduce((a, b) => a + b, 0),
        success: statusMap.SUCCESS || 0,
        failed: statusMap.FAILED || 0,
        processing: statusMap.PROCESSING || 0,
      },
    };
  },

  async list({ page = 1, pageSize = 10, type, status, search } = {}) {
    const where = {};
    if (type && type !== 'ALL') where.type = type;
    if (status && status !== 'ALL') where.status = status;
    if (search?.trim()) {
      where.OR = [
        { fileName: { contains: search.trim(), mode: 'insensitive' } },
        { emailTo: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const take = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const [total, items] = await Promise.all([
      prisma.systemBackup.count({ where }),
      prisma.systemBackup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return {
      items: items.map(serializeBackupRow),
      total,
      page: Math.max(1, Number(page) || 1),
      pageSize: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  },

  async get(id) {
    const row = await prisma.systemBackup.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!row) throw new AppError('بک اپ یافت نشد', 404, 'NOT_FOUND');
    try {
      const extras = await prisma.$queryRaw`
        SELECT "emailError" FROM "system_backups" WHERE id = ${id} LIMIT 1
      `;
      if (Array.isArray(extras) && extras[0]?.emailError != null) {
        row.emailError = extras[0].emailError;
      }
    } catch {
      /* column may be pending migrate */
    }
    return serializeBackupRow(row);
  },

  async create({ type = 'MANUAL', auth, req } = {}) {
    const schedule = await getScheduleSettings();
    const recipient = resolveBackupRecipientEmail(schedule);
    if (recipient === null) {
      throw new AppError(
        'آدرس ایمیل دریافت بک اپ نامعتبر است. ابتدا ایمیل را در تنظیمات بک اپ اصلاح کنید.',
        400,
        'VALIDATION',
      );
    }
    const emailTo = recipient || null;

    const backup = await prisma.systemBackup.create({
      data: {
        type,
        status: 'PROCESSING',
        emailTo,
        createdById: auth?.userId || null,
        progressPercent: 0,
        progressPhase: 'در صف',
        scope: 'FULL_SYSTEM',
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: 'BACKUP_CREATE',
      entityType: 'SystemBackup',
      entityId: backup.id,
      after: { type, emailTo, scope: 'FULL_SYSTEM' },
      req,
    });

    setImmediate(() => {
      runBackupJob(backup.id).catch((err) =>
        console.error('[backup] unhandled job error', err),
      );
    });

    return serializeBackupRow(backup);
  },

  async createAutomatic(trigger = 'scheduler') {
    return this.create({ type: 'AUTOMATIC', auth: null, req: { ip: trigger } });
  },

  async download(id, auth, req) {
    const backup = await this.get(id);
    if (backup.status !== 'SUCCESS' || !backup.fileName) {
      throw new AppError('فایل بک اپ آماده نیست', 400, 'BACKUP_NOT_READY');
    }

    await writeAudit({
      userId: auth?.userId,
      action: 'BACKUP_DOWNLOAD',
      entityType: 'SystemBackup',
      entityId: id,
      req,
    });

    return {
      fileName: backup.fileName,
      storageKey: backup.storageKey,
      sizeBytes: backup.sizeBytes,
    };
  },

  async delete(id, auth, req) {
    const backup = await this.get(id);
    const { cloudKey } = parseStorageKeys(backup.storageKey);
    if (cloudKey) {
      await storage.deleteStoredObject(cloudKey, {
        required: true,
        logTag: 'backup',
      });
    }
    await deleteLocalBackup(backup.id);
    await prisma.systemBackup.delete({ where: { id } });
    await writeAudit({
      userId: auth?.userId,
      action: 'BACKUP_DELETE',
      entityType: 'SystemBackup',
      entityId: id,
      before: { fileName: backup.fileName, storageKey: backup.storageKey },
      req,
    });
    return { deleted: true };
  },

  async restoreFromBackupId(id, { confirm }, auth, req) {
    if (confirm !== true && confirm !== 'true') {
      throw new AppError('تأیید بازگردانی الزامی است', 400, 'CONFIRM_REQUIRED');
    }
    const backup = await this.get(id);
    if (backup.status !== 'SUCCESS' || !backup.fileName) {
      throw new AppError('بک اپ برای بازگردانی آماده نیست', 400, 'BACKUP_NOT_READY');
    }

    const archivePath = await loadBackupToPath(backup);
    return this.restoreFromArchivePath(archivePath, {
      confirm: true,
      auth,
      req,
      sourceBackupId: id,
    });
  },

  async openDownloadStream(id) {
    const backup = await this.get(id);
    if (backup.status !== 'SUCCESS' || !backup.fileName) {
      throw new AppError('فایل بک اپ آماده نیست', 400, 'BACKUP_NOT_READY');
    }
    const localStream = openLocalBackupStream(backup.id, backup.fileName);
    if (localStream) {
      return {
        stream: localStream,
        fileName: backup.fileName,
        sizeBytes: backup.sizeBytes,
        backup,
      };
    }
    const archivePath = await loadBackupToPath(backup);
    const { createReadStream } = await import('fs');
    return {
      stream: createReadStream(archivePath),
      fileName: backup.fileName,
      sizeBytes: backup.sizeBytes,
      backup,
    };
  },

  async restoreFromBuffer(buffer, opts = {}) {
    // Persist buffer to temp file then restore (supports large uploads via disk path preferred)
    await ensureBackupRoot();
    const tmpDir = stagingDirFor(`restore-${Date.now()}`);
    await ensureEmptyDir(tmpDir);
    const tmpFile = path.join(tmpDir, 'upload.bin');
    try {
      await fsp.writeFile(tmpFile, buffer);
      return await this.restoreFromArchivePath(tmpFile, opts);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  },

  async restoreFromArchivePath(archivePath, { confirm, auth, req, sourceBackupId } = {}) {
    if (confirm !== true && confirm !== 'true') {
      throw new AppError('تأیید بازگردانی الزامی است', 400, 'CONFIRM_REQUIRED');
    }

    const kind = await sniffFileKind(archivePath);
    let tables;
    let mediaIndex = { files: [] };
    let createdAt = null;
    let scope = 'DATABASE_ONLY';
    let stagingDir = null;

    try {
      if (kind === 'legacy' || kind === 'gzip-unknown' || kind === 'unknown') {
        // Try legacy JSON first; if that fails and kind is gzip-unknown, try archive unpack
        try {
          const buffer = await fsp.readFile(archivePath);
          // Quick check: gunzip and see if JSON
          let isLegacy = false;
          try {
            const raw =
              buffer[0] === 0x1f && buffer[1] === 0x8b
                ? gunzipSync(buffer).toString('utf8')
                : buffer.toString('utf8');
            if (raw.trimStart().startsWith('{')) {
              const payload = parseLegacyBackupBuffer(buffer);
              tables = payload.tables;
              createdAt = payload.createdAt;
              scope = payload.scope || 'DATABASE_ONLY';
              isLegacy = true;
            }
          } catch {
            /* fall through to archive */
          }

          if (!isLegacy) {
            stagingDir = stagingDirFor(`restore-unpack-${Date.now()}`);
            await unpackArchive(archivePath, stagingDir);
            const manifest = await readManifest(stagingDir);
            const dbPayload = await readJsonGzipFile(path.join(stagingDir, 'database.json.gz'));
            tables = dbPayload.tables;
            createdAt = manifest.createdAt || dbPayload.createdAt;
            scope = manifest.scope || 'FULL_SYSTEM';
            try {
              const idxRaw = await fsp.readFile(
                path.join(stagingDir, 'media-index.json'),
                'utf8',
              );
              mediaIndex = JSON.parse(idxRaw);
            } catch {
              mediaIndex = { files: [] };
            }
          }
        } catch (err) {
          if (err instanceof AppError) throw err;
          throw new AppError('فایل بک اپ قابل خواندن نیست', 400, 'BACKUP_CORRUPT');
        }
      } else {
        stagingDir = stagingDirFor(`restore-unpack-${Date.now()}`);
        await unpackArchive(archivePath, stagingDir);
        const manifest = await readManifest(stagingDir);
        const dbPayload = await readJsonGzipFile(path.join(stagingDir, 'database.json.gz'));
        tables = dbPayload.tables;
        createdAt = manifest.createdAt || dbPayload.createdAt;
        scope = manifest.scope || 'FULL_SYSTEM';
        try {
          const idxRaw = await fsp.readFile(path.join(stagingDir, 'media-index.json'), 'utf8');
          mediaIndex = JSON.parse(idxRaw);
        } catch {
          mediaIndex = { files: [] };
        }
      }

      if (!tables || typeof tables !== 'object') {
        throw new AppError('ساختار داده بک اپ ناقص است', 400, 'BACKUP_INVALID');
      }

      await writeAudit({
        userId: auth?.userId,
        action: 'BACKUP_RESTORE_START',
        entityType: 'SystemBackup',
        entityId: sourceBackupId || null,
        after: {
          createdAt,
          scope,
          tables: Object.keys(tables),
          mediaFiles: mediaIndex.files?.length || 0,
        },
        req,
      });

      try {
        await restoreDatabaseTables(tables);
      } catch (err) {
        if (err instanceof AppError) throw err;
        console.error('[backup] restore transaction failed:', err);
        throw new AppError(
          `بازگردانی پایگاه داده ناموفق بود: ${prismaErrorMessage(err)}`,
          500,
          'BACKUP_RESTORE_FAILED',
        );
      }

      let mediaRestored = 0;
      if (stagingDir && mediaIndex.files?.length) {
        const result = await uploadMediaFromStaging(stagingDir, mediaIndex);
        mediaRestored = result.restored;
      }

      await writeAudit({
        userId: auth?.userId,
        action: 'BACKUP_RESTORE_COMPLETE',
        entityType: 'SystemBackup',
        entityId: sourceBackupId || null,
        after: {
          restoredAt: new Date().toISOString(),
          scope,
          mediaRestored,
        },
        req,
      });

      return {
        restored: true,
        scope,
        tableCount: Object.keys(tables).length,
        recordCount: Object.values(tables).reduce(
          (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
          0,
        ),
        mediaFileCount: mediaRestored,
        createdAt,
      };
    } finally {
      if (stagingDir) {
        await fsp.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  },

  async validateUploadBuffer(buffer) {
    // Prefer writing to temp for large buffers
    await ensureBackupRoot();
    const tmpDir = stagingDirFor(`validate-${Date.now()}`);
    await ensureEmptyDir(tmpDir);
    const tmpFile = path.join(tmpDir, 'upload.bin');
    try {
      await fsp.writeFile(tmpFile, buffer);
      return await this.validateUploadPath(tmpFile);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  },

  async validateUploadPath(filePath) {
    const kind = await sniffFileKind(filePath);
    const stagingDir = stagingDirFor(`validate-unpack-${Date.now()}`);

    try {
      // Attempt legacy JSON
      try {
        const buffer = await fsp.readFile(filePath);
        const raw =
          buffer[0] === 0x1f && buffer[1] === 0x8b
            ? gunzipSync(buffer).toString('utf8')
            : buffer.toString('utf8');
        if (raw.trimStart().startsWith('{')) {
          const payload = parseLegacyBackupBuffer(buffer);
          return {
            valid: true,
            format: payload.format,
            version: payload.version,
            scope: payload.scope || 'DATABASE_ONLY',
            createdAt: payload.createdAt,
            tableCount: Object.keys(payload.tables).length,
            recordCount: Object.values(payload.tables).reduce(
              (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
              0,
            ),
            mediaFileCount: 0,
            warning:
              'این بک اپ قدیمی فقط شامل پایگاه داده است و فایل‌های رسانه را ندارد.',
          };
        }
      } catch {
        /* try archive */
      }

      if (kind === 'unknown') {
        throw new AppError('فرمت فایل بک اپ نامعتبر است', 400, 'BACKUP_INVALID');
      }

      await unpackArchive(filePath, stagingDir);
      const manifest = await readManifest(stagingDir);
      const dbPayload = await readJsonGzipFile(path.join(stagingDir, 'database.json.gz'));
      let mediaFileCount = manifest.mediaFileCount || 0;
      try {
        const idx = JSON.parse(
          await fsp.readFile(path.join(stagingDir, 'media-index.json'), 'utf8'),
        );
        mediaFileCount = idx.files?.length ?? mediaFileCount;
      } catch {
        /* optional */
      }

      return {
        valid: true,
        format: manifest.format,
        version: manifest.version,
        scope: manifest.scope || 'FULL_SYSTEM',
        createdAt: manifest.createdAt || dbPayload.createdAt,
        tableCount: manifest.tableCount || Object.keys(dbPayload.tables || {}).length,
        recordCount:
          manifest.recordCount ||
          Object.values(dbPayload.tables || {}).reduce(
            (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
            0,
          ),
        mediaFileCount,
        mediaBytes: manifest.mediaBytes || 0,
        warning: null,
      };
    } finally {
      await fsp.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    }
  },

  formatBytes,
  computeNextRuns,
};
