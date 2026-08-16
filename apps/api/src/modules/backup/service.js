/**
 * APEX logical database backup / restore.
 * Exports Prisma business tables to a gzipped JSON archive, stores via object storage,
 * emails the archive when SMTP is configured, and supports validated restore.
 */
import crypto from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { Readable } from 'stream';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { storage } from '../../services/storage.js';
import { writeAudit } from '../../middleware/audit.js';
import { sendMail, isEmailConfigured } from '../../services/email.js';
import { env } from '../../config/env.js';
import { formatFaDateTime } from '../../utils/datetime.js';
import {
  saveLocalBackup,
  readLocalBackup,
  localBackupExists,
  deleteLocalBackup,
  openLocalBackupStream,
} from '../../services/backupLocalStore.js';

export const BACKUP_FORMAT = 'apex-backup';
export const BACKUP_VERSION = 1;
export const SCHEDULE_SETTING_KEY = 'backup_schedule';

/** Ephemeral tables excluded from backup/restore. */
const SKIP_TABLES = new Set(['Session', 'OtpCode', 'SystemBackup']);

/**
 * Insert order (parents before children). Delete order is reverse.
 * Keep this aligned with Prisma FK dependencies or restore will 500.
 */
export const BACKUP_TABLES = [
  'Role',
  'Permission',
  'RolePermission',
  'User',
  'Setting',
  'Service',
  'Style',
  'Format',
  'TeamProfile',
  'Rate',
  'AudioSample',
  'CrmCustomer',
  'PortalAccount',
  'ClientAsset',
  'Project',
  'Opportunity',
  'PortalInvite',
  'ProjectFinance',
  'ProjectAssignment',
  'ProjectFile',
  'ProjectTimelineEvent',
  'ProjectContext',
  'AssetReference',
  'ContentVersion',
  'NarrationTask',
  'NarrationTake',
  'EditingTask',
  'EditingResource',
  'Approval',
  'ClientFeedback',
  'AiAgent',
  'AiWorkflowExecution',
  'AiRun',
  'AiActivityLog',
  'AiSetting',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'Expense',
  'EmployeePayable',
  'DownloadPermission',
  'DownloadHistory',
  'Notification',
  'AuditLog',
];

const DEFAULT_SCHEDULE = {
  emailTo: '',
  daily: { enabled: false, time: '23:00' },
  weekly: { enabled: false, dayOfWeek: 0, time: '23:00' },
  monthly: { enabled: false, dayOfMonth: 1, time: '23:00' },
};

function prismaDelegate(modelName) {
  const key = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = prisma[key];
  if (!delegate?.findMany) {
    throw new AppError(`مدل ${modelName} برای پشتیبان‌گیری در دسترس نیست`, 500, 'BACKUP_MODEL_MISSING');
  }
  return delegate;
}

function isPrismaDecimal(value) {
  if (value == null || typeof value !== 'object') return false;
  if (Decimal.isDecimal?.(value)) return true;
  if (value instanceof Prisma.Decimal) return true;
  if (value.constructor?.name === 'Decimal') return true;
  // JSON shape produced when Decimal was accidentally Object.entries-serialized
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
  // Legacy backups accidentally JSON-serialized Decimal internals as { s, e, d }
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

/**
 * Keep only scalar/enum columns and revive Decimal / DateTime / Bytes for Prisma create.
 * Also repairs older backups where Decimal was saved as {s,e,d}.
 */
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

    // Legacy accidental Decimal object on non-decimal fields — leave as-is unless shape matches
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
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
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
  const next = {
    ...getDefaultSchedule(),
    ...value,
    daily: { ...DEFAULT_SCHEDULE.daily, ...(value?.daily || {}) },
    weekly: { ...DEFAULT_SCHEDULE.weekly, ...(value?.weekly || {}) },
    monthly: { ...DEFAULT_SCHEDULE.monthly, ...(value?.monthly || {}) },
    emailTo: String(value?.emailTo || '').trim(),
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

  // Hot-reload cron jobs
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

async function buildPayload() {
  const tables = {};
  let recordCount = 0;
  for (const name of BACKUP_TABLES) {
    if (SKIP_TABLES.has(name)) continue;
    const rows = await prismaDelegate(name).findMany();
    tables[name] = rows.map(serializeValue);
    recordCount += rows.length;
  }
  const body = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: 'APEX_SYSTEM',
    tables,
  };
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex');
  const finalPayload = { ...body, checksum };
  const finalJson = JSON.stringify(finalPayload);
  const gzip = gzipSync(Buffer.from(finalJson, 'utf8'));
  return {
    gzip,
    checksum,
    tableCount: Object.keys(tables).length,
    recordCount,
    jsonBytes: Buffer.byteLength(finalJson),
  };
}

function parseBackupBuffer(buffer) {
  let raw;
  try {
    // Accept gzip or plain JSON
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      raw = gunzipSync(buffer).toString('utf8');
    } else {
      raw = buffer.toString('utf8');
    }
  } catch {
    throw new AppError('فایل پشتیبان قابل خواندن نیست', 400, 'BACKUP_CORRUPT');
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new AppError('فرمت فایل پشتیبان نامعتبر است', 400, 'BACKUP_INVALID');
  }

  if (payload.format !== BACKUP_FORMAT || payload.version !== BACKUP_VERSION) {
    throw new AppError('نسخه فایل پشتیبان پشتیبانی نمی‌شود', 400, 'BACKUP_VERSION');
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    throw new AppError('ساختار داده پشتیبان ناقص است', 400, 'BACKUP_INVALID');
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
    const verifyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(verifyBody))
      .digest('hex');
    if (checksum !== verifyHash) {
      throw new AppError('اعتبارسنجی فایل پشتیبان ناموفق بود (checksum)', 400, 'BACKUP_CHECKSUM');
    }
  }

  return payload;
}

async function emailBackup({ to, fileName, gzip, backupId, type }) {
  if (!to) return null;
  if (!isEmailConfigured()) {
    console.warn('[backup] SMTP not configured — skip email for', backupId);
    return null;
  }

  const maxAttach = env.backupEmailMaxBytes;
  const attachments = [];
  let textExtra = '';
  if (gzip.length <= maxAttach) {
    attachments.push({
      filename: fileName,
      content: gzip,
      contentType: 'application/gzip',
    });
  } else {
    textExtra = `\nحجم فایل (${formatBytes(gzip.length)}) از حد پیوست بیشتر است؛ فایل در فضای ذخیره سیستم نگهداری شد.`;
  }

  await sendMail({
    to,
    subject: `[APEX] پشتیبان سیستم — ${fileName}`,
    text: [
      'پشتیبان جدید سیستم اپیکس ایجاد شد.',
      `شناسه: ${backupId}`,
      `نوع: ${type}`,
      `نام فایل: ${fileName}`,
      `حجم: ${formatBytes(gzip.length)}`,
      `زمان: ${formatFaDateTime(new Date())}`,
      textExtra,
    ].join('\n'),
    html: `<div dir="rtl" style="font-family:Tahoma,sans-serif">
      <h2>پشتیبان سیستم اپیکس</h2>
      <p>یک نسخه پشتیبان جدید با موفقیت ایجاد شد.</p>
      <ul>
        <li>شناسه: <code>${backupId}</code></li>
        <li>نوع: ${type}</li>
        <li>فایل: ${fileName}</li>
        <li>حجم: ${formatBytes(gzip.length)}</li>
      </ul>
      <p>${textExtra ? textExtra : 'فایل پیوست شده است.'}</p>
    </div>`,
    attachments,
  });
  return new Date();
}

async function runBackupJob(backupId) {
  const backup = await prisma.systemBackup.findUnique({ where: { id: backupId } });
  if (!backup) return;

  try {
    const built = await buildPayload();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `apex-backup-${stamp}.json.gz`;
    // Local key is always authoritative for download/restore (Cloudinary blocks many raw types)
    const storageKey = `local:backups/${backupId}/${fileName}`;

    await saveLocalBackup(backupId, fileName, built.gzip);

    // Optional cloud mirror — never required for SUCCESS (local file is authoritative).
    // CDN delivery of .gz is often 401 (restricted types); reads use Admin private_download.
    let cloudKey = null;
    try {
      const cloudStorageKey = `documents/backups/${fileName}`;
      const saved = await storage.saveBuffer(built.gzip, {
        filename: fileName,
        folder: 'documents',
        contentType: 'application/octet-stream',
        storageKey: cloudStorageKey,
      });
      cloudKey = saved.key || cloudStorageKey;
    } catch (cloudErr) {
      console.warn(
        '[backup] cloud mirror skipped:',
        cloudErr?.message || cloudErr,
      );
    }

    let emailSentAt = null;
    try {
      emailSentAt = await emailBackup({
        to: backup.emailTo,
        fileName,
        gzip: built.gzip,
        backupId,
        type: backup.type,
      });
    } catch (mailErr) {
      console.error('[backup] email failed:', mailErr?.message || mailErr);
    }

    await prisma.systemBackup.update({
      where: { id: backupId },
      data: {
        status: 'SUCCESS',
        fileName,
        // Prefer local key; keep cloud key as fallback suffix for migration
        storageKey: cloudKey ? `${storageKey}|${cloudKey}` : storageKey,
        sizeBytes: built.gzip.length,
        checksum: built.checksum,
        tableCount: built.tableCount,
        recordCount: built.recordCount,
        emailSentAt,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    console.error('[backup] job failed:', err);
    await prisma.systemBackup.update({
      where: { id: backupId },
      data: {
        status: 'FAILED',
        errorMessage: err?.message || 'Backup failed',
        completedAt: new Date(),
      },
    });
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
  // Legacy Cloudinary-only key
  return { localKey: null, cloudKey: raw || null };
}

/**
 * Load backup bytes: local disk first, then optional cloud mirror.
 * Caches cloud bytes locally after a successful cloud read.
 */
async function loadBackupBuffer(backup) {
  const fileName = backup.fileName;
  if (!fileName) {
    throw new AppError('نام فایل پشتیبان موجود نیست', 400, 'BACKUP_NOT_READY');
  }

  if (await localBackupExists(backup.id, fileName)) {
    return readLocalBackup(backup.id, fileName);
  }

  const { cloudKey } = parseStorageKeys(backup.storageKey);
  if (!cloudKey) {
    throw new AppError(
      'فایل پشتیبان روی دیسک محلی یافت نشد. لطفاً یک پشتیبان جدید ایجاد کنید.',
      404,
      'BACKUP_FILE_MISSING',
    );
  }

  try {
    const buffer = await storage.readBuffer(cloudKey);
    // Cache for future downloads/restores
    try {
      await saveLocalBackup(backup.id, fileName, buffer);
    } catch (cacheErr) {
      console.warn('[backup] local cache write failed:', cacheErr?.message || cacheErr);
    }
    return buffer;
  } catch (err) {
    console.error('[backup] cloud read failed:', err?.message || err);
    throw new AppError(
      'خواندن فایل پشتیبان از فضای ابری ناموفق بود. یک پشتیبان جدید ایجاد کنید (ذخیره محلی).',
      502,
      'BACKUP_CLOUD_READ',
    );
  }
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
      latest,
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
      items,
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
    if (!row) throw new AppError('پشتیبان یافت نشد', 404, 'NOT_FOUND');
    return row;
  },

  async create({ type = 'MANUAL', auth, req } = {}) {
    const schedule = await getScheduleSettings();
    const emailTo =
      schedule.emailTo ||
      env.backupEmailTo ||
      auth?.user?.email ||
      env.defaultManagerEmail ||
      null;

    const backup = await prisma.systemBackup.create({
      data: {
        type,
        status: 'PROCESSING',
        emailTo,
        createdById: auth?.userId || null,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: 'BACKUP_CREATE',
      entityType: 'SystemBackup',
      entityId: backup.id,
      after: { type, emailTo },
      req,
    });

    // Fire-and-forget so the HTTP request returns quickly
    setImmediate(() => {
      runBackupJob(backup.id).catch((err) =>
        console.error('[backup] unhandled job error', err),
      );
    });

    return backup;
  },

  async createAutomatic(trigger = 'scheduler') {
    return this.create({ type: 'AUTOMATIC', auth: null, req: { ip: trigger } });
  },

  async download(id, auth, req) {
    const backup = await this.get(id);
    if (backup.status !== 'SUCCESS' || !backup.fileName) {
      throw new AppError('فایل پشتیبان آماده نیست', 400, 'BACKUP_NOT_READY');
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
      try {
        await storage.deleteObject(cloudKey);
      } catch (err) {
        console.warn('[backup] storage delete:', err?.message || err);
      }
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
      throw new AppError('پشتیبان برای بازگردانی آماده نیست', 400, 'BACKUP_NOT_READY');
    }

    const buffer = await loadBackupBuffer(backup);
    return this.restoreFromBuffer(buffer, { confirm: true, auth, req, sourceBackupId: id });
  },

  /** Stream helper for HTTP download route */
  async openDownloadStream(id) {
    const backup = await this.get(id);
    if (backup.status !== 'SUCCESS' || !backup.fileName) {
      throw new AppError('فایل پشتیبان آماده نیست', 400, 'BACKUP_NOT_READY');
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
    const buffer = await loadBackupBuffer(backup);
    return {
      stream: Readable.from(buffer),
      fileName: backup.fileName,
      sizeBytes: buffer.length,
      backup,
    };
  },

  async restoreFromBuffer(buffer, { confirm, auth, req, sourceBackupId } = {}) {
    if (confirm !== true && confirm !== 'true') {
      throw new AppError('تأیید بازگردانی الزامی است', 400, 'CONFIRM_REQUIRED');
    }

    const payload = parseBackupBuffer(buffer);

    await writeAudit({
      userId: auth?.userId,
      action: 'BACKUP_RESTORE_START',
      entityType: 'SystemBackup',
      entityId: sourceBackupId || null,
      after: {
        createdAt: payload.createdAt,
        tables: Object.keys(payload.tables || {}),
      },
      req,
    });

    // Wipe + reload in FK-safe order inside one interactive transaction
    try {
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
            const rows = payload.tables[name];
            if (!Array.isArray(rows) || !rows.length) continue;
            const key = name.charAt(0).toLowerCase() + name.slice(1);
            if (!tx[key]?.createMany && !tx[key]?.create) {
              throw new AppError(
                `مدل ${name} برای بازگردانی در دسترس نیست`,
                500,
                'BACKUP_MODEL_MISSING',
              );
            }

            const data = rows.map((row) => sanitizeRowForRestore(name, row));
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
          }
        },
        { timeout: 300_000, maxWait: 30_000 },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error('[backup] restore transaction failed:', err);
      throw new AppError(
        `بازگردانی ناموفق بود: ${prismaErrorMessage(err)}`,
        500,
        'BACKUP_RESTORE_FAILED',
      );
    }

    await writeAudit({
      userId: auth?.userId,
      action: 'BACKUP_RESTORE_COMPLETE',
      entityType: 'SystemBackup',
      entityId: sourceBackupId || null,
      after: { restoredAt: new Date().toISOString() },
      req,
    });

    return {
      restored: true,
      tableCount: Object.keys(payload.tables).length,
      createdAt: payload.createdAt,
    };
  },

  validateUploadBuffer(buffer) {
    const payload = parseBackupBuffer(buffer);
    return {
      valid: true,
      format: payload.format,
      version: payload.version,
      createdAt: payload.createdAt,
      tableCount: Object.keys(payload.tables).length,
      recordCount: Object.values(payload.tables).reduce(
        (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
        0,
      ),
    };
  },

  formatBytes,
  computeNextRuns,
};
