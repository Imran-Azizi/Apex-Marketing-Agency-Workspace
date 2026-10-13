import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { writeAudit } from '../../middleware/audit.js';
import { assertProjectAccess } from '../../services/projectAccess.js';
import { createNotificationOnce } from '../../services/notifications.js';
import { storage } from '../../services/storage.js';
import { toEnglishDigits } from '../../utils/toEnglishDigits.js';
import { serializePortalAsset } from '../portal/helpers.js';
import {
  assertClientAssetImageFile,
  isClientAssetImageKind,
} from '../files/image-formats.js';

export const CALENDAR_MAX_ROWS = 31;

export const SHARE_SECTIONS = Object.freeze(['COMPANY', 'ASSETS', 'CALENDAR']);
const SHARE_CHANNELS = ['PORTAL', 'WHATSAPP'];

const SECTION_LABELS = {
  COMPANY: 'اطلاعات شرکت',
  ASSETS: 'دارایی‌ها',
  CALENDAR: 'تقویم محتوایی',
};

const SECTION_TABS = { COMPANY: 'company', ASSETS: 'assets', CALENDAR: 'calendar' };

const CONTRACT_ASSET_KINDS = new Set([
  'LOGO',
  'PRODUCT_IMAGE',
  'VIDEO',
  'BRANDBOOK',
  'CATALOG',
  'REFERENCE',
  'PRONUNCIATION',
  'AUDIO',
  'OTHER',
]);

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

const contactNumber = z.preprocess(
  (value) => (typeof value === 'string' ? toEnglishDigits(value).trim() : value),
  z.string().regex(/^\+?[\d\s\-()]{5,24}$/, 'شماره تماس معتبر نیست'),
);

const companySchema = z.object({
  companyName: z.string().trim().min(1, 'نام شرکت الزامی است').max(200),
  companyIntro: optionalText(4000),
  features: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  audience: optionalText(500),
  goal: optionalText(500),
  mainMessage: optionalText(1000),
  cta: optionalText(300),
  address: optionalText(500),
  contactNumbers: z.array(contactNumber).max(10, 'حداکثر ۱۰ شماره تماس مجاز است').default([]),
});

const calendarRowSchema = z.object({
  topic: z.string().trim().min(1, 'موضوع هر ردیف الزامی است').max(300),
  contentType: z.string().trim().min(1, 'نوعیت محتوا الزامی است').max(60),
  language: z.string().trim().min(1, 'زبان الزامی است').max(60),
  publishDate: z.preprocess(
    (value) => (value === '' || value == null ? null : value),
    z.coerce.date({ errorMap: () => ({ message: 'تاریخ نشر معتبر نیست' }) }).nullable(),
  ),
});

const calendarSchema = z.object({
  title: z.string().trim().min(1, 'عنوان تقویم الزامی است').max(200),
  rows: z
    .array(calendarRowSchema)
    .min(1, 'حداقل یک ردیف لازم است')
    .max(CALENDAR_MAX_ROWS, `حداکثر ${CALENDAR_MAX_ROWS} ردیف در هر تقویم مجاز است`),
});

const assetFileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  storageKey: z.string().trim().min(1).max(1000),
  mimeType: z.string().trim().max(200).optional().nullable(),
  sizeBytes: z.coerce.number().int().nonnegative().optional().nullable(),
  meta: z.record(z.unknown()).optional().nullable(),
});

const assetCreateSchema = assetFileSchema.extend({
  kind: z.string().trim().min(1).max(40),
  note: optionalText(1000),
});

const assetUpdateSchema = z.object({
  name: z.string().trim().min(1, 'نام فایل الزامی است').max(255).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  file: assetFileSchema.optional(),
});

const sharePdfSchema = z.object({
  name: z.string().trim().min(1).max(255),
  storageKey: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .refine((key) => /\.pdf$/i.test(key) && !key.includes('..') && !/^[a-z]+:\/\//i.test(key), {
      message: 'فایل PDF نامعتبر است',
    }),
  sizeBytes: z.coerce.number().int().nonnegative().optional().nullable(),
});

const shareSchema = z.object({
  section: z.enum(SHARE_SECTIONS),
  calendarId: z.string().trim().min(1).optional().nullable(),
  channel: z.enum(SHARE_CHANNELS).default('PORTAL'),
  pdf: sharePdfSchema.optional().nullable(),
});

function parseOrThrow(schema, body, fallback) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    throw new AppError(parsed.error.issues?.[0]?.message || fallback, 400, 'VALIDATION');
  }
  return parsed.data;
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function plainMeta(meta) {
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
}

export function serializeCompany(row) {
  if (!row) return null;
  return {
    companyName: row.companyName,
    companyIntro: row.companyIntro,
    features: stringList(row.features),
    audience: row.audience,
    goal: row.goal,
    mainMessage: row.mainMessage,
    cta: row.cta,
    address: row.address,
    contactNumbers: stringList(row.contactNumbers),
    updatedAt: row.updatedAt,
  };
}

export function serializeCalendar(calendar) {
  const items = [...(calendar.items || [])].sort((a, b) => a.position - b.position);
  return {
    id: calendar.id,
    title: calendar.title,
    rows: items.map((item) => ({
      topic: item.topic,
      contentType: item.contentType,
      language: item.language,
      publishDate: item.publishDate,
    })),
    createdAt: calendar.createdAt,
    updatedAt: calendar.updatedAt,
  };
}

export function serializeContractAsset(asset) {
  const base = serializePortalAsset(asset);
  if (!base) return null;
  const note = plainMeta(asset.meta).note;
  return {
    ...base,
    note: typeof note === 'string' && note ? note : null,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

function sharePdfInfo(meta) {
  const pdf = plainMeta(plainMeta(meta).pdf);
  if (typeof pdf.storageKey !== 'string' || !pdf.storageKey) return null;
  let url = null;
  try {
    url = storage.publicUrl(pdf.storageKey);
  } catch {
    url = null;
  }
  if (!url) return null;
  return {
    url,
    name: typeof pdf.name === 'string' ? pdf.name : 'calendar.pdf',
    sizeBytes: typeof pdf.sizeBytes === 'number' ? pdf.sizeBytes : null,
  };
}

function sharePdfStorageKey(meta) {
  const key = plainMeta(plainMeta(meta).pdf).storageKey;
  return typeof key === 'string' && key ? key : null;
}

function serializeShares(rows) {
  const result = { company: null, assets: null, calendars: {} };
  for (const row of rows) {
    const value = { sharedAt: row.sharedAt, channel: row.channel, pdf: sharePdfInfo(row.meta) };
    if (row.section === 'COMPANY') result.company = value;
    else if (row.section === 'ASSETS') result.assets = value;
    else if (row.section === 'CALENDAR' && row.refId) result.calendars[row.refId] = value;
  }
  return result;
}

async function loadContract(projectId, auth) {
  const project = await assertProjectAccess(projectId, auth);
  if (project.kind !== 'CONTRACT') {
    throw new AppError('این بخش فقط برای قرارداد چندویدیویی فعال است', 400, 'VALIDATION');
  }
  return project;
}

function listContractAssets(projectId) {
  return prisma.assetReference
    .findMany({
      where: { projectId, clientAsset: { deletedAt: null } },
      include: { clientAsset: true },
      orderBy: { createdAt: 'desc' },
    })
    .then((refs) => refs.map((ref) => serializeContractAsset(ref.clientAsset)).filter(Boolean));
}

function listCalendars(projectId) {
  return prisma.contentCalendar.findMany({
    where: { projectId },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });
}

async function findContractAssetRef(project, assetId) {
  const ref = await prisma.assetReference.findFirst({
    where: { projectId: project.id, clientAssetId: String(assetId) },
    include: { clientAsset: true },
  });
  const asset = ref?.clientAsset;
  if (!ref || !asset || asset.deletedAt || asset.crmCustomerId !== project.crmCustomerId) {
    throw new AppError('فایل یافت نشد', 404, 'NOT_FOUND');
  }
  return ref;
}

function assertAssetFile(kind, file) {
  if (isClientAssetImageKind(kind)) {
    assertClientAssetImageFile({
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      kind,
    });
  }
}

async function addTimeline(projectId, title, actorId, meta) {
  await prisma.projectTimelineEvent.create({
    data: { projectId, type: 'CONTRACT_WORKSPACE', title, actorId, meta: meta || undefined },
  });
}

async function findCalendar(project, calendarId) {
  const calendar = await prisma.contentCalendar.findFirst({
    where: { id: String(calendarId), projectId: project.id },
  });
  if (!calendar) throw new AppError('تقویم محتوایی یافت نشد', 404, 'NOT_FOUND');
  return calendar;
}

function calendarItemsData(calendarId, rows) {
  return rows.map((row, index) => ({
    calendarId,
    position: index + 1,
    topic: row.topic,
    contentType: row.contentType,
    language: row.language,
    publishDate: row.publishDate,
  }));
}

export const contractWorkspaceService = {
  async get(projectId, auth) {
    const project = await loadContract(projectId, auth);
    const [company, assets, calendars, shares, portalAccount] = await Promise.all([
      prisma.contractCompanyProfile.findUnique({ where: { projectId: project.id } }),
      listContractAssets(project.id),
      listCalendars(project.id),
      prisma.contractShare.findMany({ where: { projectId: project.id } }),
      prisma.portalAccount.findFirst({
        where: { crmCustomerId: project.crmCustomerId, deletedAt: null, isActive: true },
        select: { id: true },
      }),
    ]);
    return {
      company: serializeCompany(company),
      assets,
      calendars: calendars.map(serializeCalendar),
      shares: serializeShares(shares),
      hasPortalAccount: Boolean(portalAccount),
      calendarMaxRows: CALENDAR_MAX_ROWS,
    };
  },

  async saveCompany(projectId, body, auth, req) {
    const project = await loadContract(projectId, auth);
    const input = parseOrThrow(companySchema, body, 'اطلاعات شرکت نامعتبر است');
    const data = { ...input, updatedById: auth.userId };
    const row = await prisma.contractCompanyProfile.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, ...data },
      update: data,
    });
    await addTimeline(project.id, 'اطلاعات شرکت به‌روزرسانی شد', auth.userId);
    await writeAudit({
      userId: auth.userId,
      action: 'CONTRACT_COMPANY_UPDATE',
      entityType: 'Project',
      entityId: project.id,
      after: { companyName: row.companyName },
      req,
    });
    return serializeCompany(row);
  },

  async createAsset(projectId, body, auth, req) {
    const project = await loadContract(projectId, auth);
    const input = parseOrThrow(assetCreateSchema, body, 'اطلاعات فایل نامعتبر است');
    const kind = input.kind.toUpperCase();
    if (!CONTRACT_ASSET_KINDS.has(kind)) {
      throw new AppError('نوع فایل مجاز نیست', 400, 'VALIDATION');
    }
    assertAssetFile(kind, input);

    const meta = { ...plainMeta(input.meta) };
    if (input.note) meta.note = input.note;
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.clientAsset.create({
        data: {
          crmCustomerId: project.crmCustomerId,
          kind,
          name: input.name,
          storageKey: input.storageKey,
          mimeType: input.mimeType || null,
          sizeBytes: input.sizeBytes ?? null,
          meta: Object.keys(meta).length ? meta : undefined,
        },
      });
      await tx.assetReference.create({
        data: { projectId: project.id, clientAssetId: created.id },
      });
      return created;
    });

    await writeAudit({
      userId: auth.userId,
      action: 'CONTRACT_ASSET_CREATE',
      entityType: 'ClientAsset',
      entityId: asset.id,
      after: { projectId: project.id, kind: asset.kind, name: asset.name },
      req,
    });
    return serializeContractAsset(asset);
  },

  async updateAsset(projectId, assetId, body, auth, req) {
    const project = await loadContract(projectId, auth);
    const { clientAsset: asset } = await findContractAssetRef(project, assetId);
    const input = parseOrThrow(assetUpdateSchema, body, 'اطلاعات فایل نامعتبر است');

    const previousMeta = plainMeta(asset.meta);
    const data = {};
    let meta = previousMeta;
    if (input.file) {
      assertAssetFile(asset.kind, input.file);
      data.storageKey = input.file.storageKey;
      data.mimeType = input.file.mimeType || null;
      data.sizeBytes = input.file.sizeBytes ?? null;
      meta = plainMeta(input.file.meta);
      if (previousMeta.note) meta = { ...meta, note: previousMeta.note };
    }
    if (input.note !== undefined) {
      meta = { ...meta };
      if (input.note) meta.note = input.note;
      else delete meta.note;
    }
    if (input.file || input.note !== undefined) data.meta = meta;
    const name = input.name ?? (input.file && asset.kind !== 'REFERENCE' ? input.file.name : undefined);
    if (name) data.name = name;
    if (!Object.keys(data).length) return serializeContractAsset(asset);

    const updated = await prisma.clientAsset.update({ where: { id: asset.id }, data });
    if (input.file && input.file.storageKey !== asset.storageKey) {
      await storage.tryDeleteStoredObject(asset.storageKey, { logTag: 'contract-asset-replace' });
    }

    await writeAudit({
      userId: auth.userId,
      action: 'CONTRACT_ASSET_UPDATE',
      entityType: 'ClientAsset',
      entityId: asset.id,
      before: { name: asset.name, storageKey: asset.storageKey },
      after: { name: updated.name, storageKey: updated.storageKey },
      req,
    });
    return serializeContractAsset(updated);
  },

  async deleteAsset(projectId, assetId, auth, req) {
    const project = await loadContract(projectId, auth);
    const ref = await findContractAssetRef(project, assetId);
    const asset = ref.clientAsset;
    const otherRefs = await prisma.assetReference.count({
      where: { clientAssetId: asset.id, NOT: { id: ref.id } },
    });

    if (otherRefs === 0) {
      await storage.deleteStoredObject(asset.storageKey, {
        required: true,
        logTag: 'contract-asset',
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.assetReference.delete({ where: { id: ref.id } });
      if (otherRefs === 0) {
        await tx.clientAsset.update({ where: { id: asset.id }, data: { deletedAt: new Date() } });
      }
    });

    await writeAudit({
      userId: auth.userId,
      action: 'CONTRACT_ASSET_DELETE',
      entityType: 'ClientAsset',
      entityId: asset.id,
      before: { projectId: project.id, kind: asset.kind, name: asset.name },
      req,
    });
    return { deleted: true };
  },

  async createCalendar(projectId, body, auth, req) {
    const project = await loadContract(projectId, auth);
    const input = parseOrThrow(calendarSchema, body, 'اطلاعات تقویم نامعتبر است');
    const calendar = await prisma.$transaction(async (tx) => {
      const created = await tx.contentCalendar.create({
        data: { projectId: project.id, title: input.title, createdById: auth.userId },
      });
      await tx.contentCalendarItem.createMany({ data: calendarItemsData(created.id, input.rows) });
      return tx.contentCalendar.findUnique({ where: { id: created.id }, include: { items: true } });
    });
    await addTimeline(project.id, `تقویم محتوایی «${calendar.title}» ایجاد شد`, auth.userId, {
      calendarId: calendar.id,
    });
    await writeAudit({
      userId: auth.userId,
      action: 'CONTENT_CALENDAR_CREATE',
      entityType: 'ContentCalendar',
      entityId: calendar.id,
      after: { projectId: project.id, title: calendar.title, rows: input.rows.length },
      req,
    });
    return serializeCalendar(calendar);
  },

  async updateCalendar(projectId, calendarId, body, auth, req) {
    const project = await loadContract(projectId, auth);
    const existing = await findCalendar(project, calendarId);
    const input = parseOrThrow(calendarSchema, body, 'اطلاعات تقویم نامعتبر است');
    const calendar = await prisma.$transaction(async (tx) => {
      await tx.contentCalendarItem.deleteMany({ where: { calendarId: existing.id } });
      await tx.contentCalendarItem.createMany({ data: calendarItemsData(existing.id, input.rows) });
      return tx.contentCalendar.update({
        where: { id: existing.id },
        data: { title: input.title },
        include: { items: true },
      });
    });
    await writeAudit({
      userId: auth.userId,
      action: 'CONTENT_CALENDAR_UPDATE',
      entityType: 'ContentCalendar',
      entityId: calendar.id,
      before: { title: existing.title },
      after: { title: calendar.title, rows: input.rows.length },
      req,
    });
    return serializeCalendar(calendar);
  },

  async deleteCalendar(projectId, calendarId, auth, req) {
    const project = await loadContract(projectId, auth);
    const calendar = await findCalendar(project, calendarId);
    const share = await prisma.contractShare.findUnique({
      where: {
        projectId_section_refId: { projectId: project.id, section: 'CALENDAR', refId: calendar.id },
      },
      select: { meta: true },
    });
    await prisma.$transaction([
      prisma.contractShare.deleteMany({
        where: { projectId: project.id, section: 'CALENDAR', refId: calendar.id },
      }),
      prisma.contentCalendar.delete({ where: { id: calendar.id } }),
    ]);
    const pdfKey = sharePdfStorageKey(share?.meta);
    if (pdfKey) await storage.tryDeleteStoredObject(pdfKey, { logTag: 'contract-share-pdf' });
    await addTimeline(project.id, `تقویم محتوایی «${calendar.title}» حذف شد`, auth.userId);
    await writeAudit({
      userId: auth.userId,
      action: 'CONTENT_CALENDAR_DELETE',
      entityType: 'ContentCalendar',
      entityId: calendar.id,
      before: { projectId: project.id, title: calendar.title },
      req,
    });
    return { deleted: true };
  },

  /** Publishes a section to the customer portal and notifies the portal account. */
  async share(projectId, body, auth, req) {
    const project = await loadContract(projectId, auth);
    const input = parseOrThrow(shareSchema, body, 'درخواست ارسال نامعتبر است');
    let refId = '';
    let label = SECTION_LABELS[input.section];

    if (input.section === 'COMPANY') {
      const company = await prisma.contractCompanyProfile.findUnique({
        where: { projectId: project.id },
        select: { id: true },
      });
      if (!company) {
        throw new AppError('ابتدا اطلاعات شرکت را ثبت کنید', 400, 'NOTHING_TO_SHARE');
      }
    } else if (input.section === 'ASSETS') {
      const count = await prisma.assetReference.count({
        where: { projectId: project.id, clientAsset: { deletedAt: null } },
      });
      if (!count) throw new AppError('هنوز دارایی‌ای ثبت نشده است', 400, 'NOTHING_TO_SHARE');
    } else {
      if (!input.calendarId) {
        throw new AppError('تقویم محتوایی را مشخص کنید', 400, 'VALIDATION');
      }
      const calendar = await findCalendar(project, input.calendarId);
      if (!input.pdf) {
        throw new AppError('فایل PDF تقویم محتوایی الزامی است', 400, 'VALIDATION');
      }
      refId = calendar.id;
      label = `${label} «${calendar.title}»`;
    }

    const shareKey = {
      projectId_section_refId: { projectId: project.id, section: input.section, refId },
    };
    const previous = await prisma.contractShare.findUnique({
      where: shareKey,
      select: { meta: true },
    });
    const meta = input.pdf
      ? {
          pdf: {
            name: input.pdf.name,
            storageKey: input.pdf.storageKey,
            sizeBytes: input.pdf.sizeBytes ?? null,
          },
        }
      : undefined;

    const sharedAt = new Date();
    const saved = await prisma.contractShare.upsert({
      where: shareKey,
      create: {
        projectId: project.id,
        section: input.section,
        refId,
        channel: input.channel,
        sharedAt,
        sharedById: auth.userId,
        meta,
      },
      update: { channel: input.channel, sharedAt, sharedById: auth.userId, meta },
    });

    const previousPdfKey = sharePdfStorageKey(previous?.meta);
    if (previousPdfKey && previousPdfKey !== input.pdf?.storageKey) {
      await storage.tryDeleteStoredObject(previousPdfKey, { logTag: 'contract-share-pdf' });
    }

    const channelLabel = input.channel === 'WHATSAPP' ? 'واتساپ و پورتال' : 'پورتال مشتری';
    await addTimeline(project.id, `${label} از طریق ${channelLabel} برای مشتری ارسال شد`, auth.userId, {
      section: input.section,
      refId: refId || null,
      channel: input.channel,
    });

    const portalPath = `/portal/contracts/${project.id}?tab=${SECTION_TABS[input.section]}`;
    const portalAccount = await prisma.portalAccount.findFirst({
      where: { crmCustomerId: project.crmCustomerId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (portalAccount) {
      await createNotificationOnce({
        portalAccountId: portalAccount.id,
        audience: 'PORTAL',
        title: `${SECTION_LABELS[input.section]} قرارداد برای شما ارسال شد`,
        body: `${label} قرارداد «${project.title}» در پورتال شما قابل مشاهده است.`,
        link: portalPath,
        meta: {
          type: 'CONTRACT_CONTENT_SHARED',
          projectId: project.id,
          section: input.section,
          refId: refId || null,
        },
        eventKey: `contract.share:${project.id}:${input.section}:${refId}:${sharedAt.toISOString()}`,
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: 'CONTRACT_CONTENT_SHARE',
      entityType: 'Project',
      entityId: project.id,
      after: { section: input.section, refId: refId || null, channel: input.channel },
      req,
    });

    return {
      sharedAt,
      channel: input.channel,
      portalPath,
      hasPortalAccount: Boolean(portalAccount),
      pdf: sharePdfInfo(saved.meta),
    };
  },
};

/** Read-only view of shared contract content for the customer portal. */
export const portalContractService = {
  async list(auth) {
    const rows = await prisma.project.findMany({
      where: {
        crmCustomerId: auth.customerId,
        kind: 'CONTRACT',
        deletedAt: null,
        contractShares: { some: {} },
      },
      select: {
        id: true,
        code: true,
        title: true,
        contractStartDate: true,
        contractEndDate: true,
        contractShares: { select: { section: true, sharedAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      startDate: row.contractStartDate,
      endDate: row.contractEndDate,
      sections: [...new Set(row.contractShares.map((share) => share.section))],
      lastSharedAt: row.contractShares.reduce(
        (latest, share) => (!latest || share.sharedAt > latest ? share.sharedAt : latest),
        null,
      ),
    }));
  },

  async get(projectId, auth) {
    const project = await prisma.project.findFirst({
      where: {
        id: String(projectId),
        crmCustomerId: auth.customerId,
        kind: 'CONTRACT',
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        title: true,
        contractStartDate: true,
        contractEndDate: true,
        contractShares: true,
      },
    });
    if (!project || !project.contractShares.length) {
      throw new AppError('قرارداد یافت نشد', 404, 'NOT_FOUND');
    }
    const shares = serializeShares(project.contractShares);
    const sharedCalendarIds = Object.keys(shares.calendars);
    const [company, assets, calendars] = await Promise.all([
      shares.company
        ? prisma.contractCompanyProfile.findUnique({ where: { projectId: project.id } })
        : null,
      shares.assets ? listContractAssets(project.id) : [],
      sharedCalendarIds.length
        ? prisma.contentCalendar.findMany({
            where: { projectId: project.id, id: { in: sharedCalendarIds } },
            include: { items: true },
            orderBy: { createdAt: 'asc' },
          })
        : [],
    ]);
    return {
      id: project.id,
      code: project.code,
      title: project.title,
      startDate: project.contractStartDate,
      endDate: project.contractEndDate,
      company: serializeCompany(company),
      assets,
      calendars: calendars.map(serializeCalendar),
      shares,
    };
  },
};
