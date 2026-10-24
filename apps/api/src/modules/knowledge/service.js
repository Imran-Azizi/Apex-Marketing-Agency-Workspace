import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { isFullAccessRole } from '../../services/permissions/catalog.js';
import { hasAnyPermission } from '../../services/permissions/effective.js';
import { storedAssetUrl } from '../../services/storage/asset-url.js';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_KIND_LABELS,
  KNOWLEDGE_KINDS,
  KNOWLEDGE_ROLE_LABELS,
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_STATUSES,
  KNOWLEDGE_TARGET_ROLES,
} from './constants.js';
import { saveKnowledgeAttachment } from './upload.js';

const userBriefSelect = {
  id: true,
  fullName: true,
  email: true,
  profileImage: true,
  role: { select: { code: true, name: true } },
};

const entryInclude = {
  author: { select: userBriefSelect },
  steps: { orderBy: { sortOrder: 'asc' } },
  attachments: { orderBy: { sortOrder: 'asc' } },
};

const stepSchema = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().max(20000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createKnowledgeSchema = z.object({
  kind: z.enum(KNOWLEDGE_KINDS).default('EXPERIENCE'),
  title: z.string().trim().min(2).max(300),
  summary: z.string().trim().max(2000).optional().nullable(),
  body: z.string().trim().max(100000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  /** Required for POLICY — target employee role */
  roleAudience: z.enum(KNOWLEDGE_TARGET_ROLES).optional().nullable(),
  publish: z.boolean().optional(),
  steps: z.array(stepSchema).max(50).optional(),
});

export const updateKnowledgeSchema = z
  .object({
    title: z.string().trim().min(2).max(300).optional(),
    summary: z.string().trim().max(2000).optional().nullable(),
    body: z.string().trim().max(100000).optional().nullable(),
    category: z.string().trim().max(120).optional().nullable(),
    roleAudience: z.enum(KNOWLEDGE_TARGET_ROLES).optional().nullable(),
    steps: z.array(stepSchema).max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'هیچ فیلدی برای به‌روزرسانی ارسال نشده',
  });

function canManagePolicies(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(auth.permissions, ['knowledge.manage'], auth.roleCode);
}

function canCreateExperience(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(auth.permissions, ['knowledge.create'], auth.roleCode);
}

function canEditExperience(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(
    auth.permissions,
    ['knowledge.edit', 'knowledge.create'],
    auth.roleCode,
  );
}

function canDeleteKnowledge(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(auth.permissions, ['knowledge.delete'], auth.roleCode);
}

/**
 * Strict same-role visibility for published content.
 * Managers/Admins may view all for oversight.
 * Authors always see their own drafts.
 */
function canViewEntry(entry, auth) {
  if (!entry || entry.deletedAt) return false;
  if (entry.authorId === auth.userId) return true;
  if (isFullAccessRole(auth.roleCode) || canManagePolicies(auth)) {
    return true;
  }
  if (entry.roleAudience !== auth.roleCode) return false;
  return entry.status === 'PUBLISHED';
}

function canMutateEntry(entry, auth) {
  if (!entry || entry.deletedAt) return false;
  if (entry.kind === 'POLICY') {
    return canManagePolicies(auth);
  }
  if (isFullAccessRole(auth.roleCode)) return true;
  return entry.authorId === auth.userId && canEditExperience(auth);
}

function listWhere(auth, { kind } = {}) {
  const kindFilter = kind && KNOWLEDGE_KINDS.includes(kind) ? { kind } : {};

  if (isFullAccessRole(auth.roleCode) || canManagePolicies(auth)) {
    return { deletedAt: null, ...kindFilter };
  }

  // Staff: published for their role + own drafts/archives
  return {
    deletedAt: null,
    ...kindFilter,
    OR: [
      { roleAudience: auth.roleCode, status: 'PUBLISHED' },
      {
        authorId: auth.userId,
        status: { in: ['DRAFT', 'ARCHIVED', 'PUBLISHED'] },
      },
    ],
  };
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    profileImage: user.profileImage,
    roleCode: user.role?.code || null,
    roleName: user.role?.name || null,
  };
}

function serializeAttachment(att) {
  return {
    id: att.id,
    fileName: att.fileName,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    kind: att.kind,
    sortOrder: att.sortOrder,
    url: storedAssetUrl(att.meta),
    storageKey: att.storageKey,
    createdAt: att.createdAt,
  };
}

function serializeEntry(entry, auth) {
  if (!entry) return null;
  const kind = entry.kind || 'EXPERIENCE';
  return {
    id: entry.id,
    kind,
    kindLabel: KNOWLEDGE_KIND_LABELS[kind] || kind,
    title: entry.title,
    summary: entry.summary,
    body: entry.body,
    category: kind === 'POLICY' ? null : entry.category,
    status: entry.status,
    statusLabel: KNOWLEDGE_STATUS_LABELS[entry.status] || entry.status,
    roleAudience: entry.roleAudience,
    roleAudienceLabel:
      KNOWLEDGE_ROLE_LABELS[entry.roleAudience] || entry.roleAudience,
    authorId: entry.authorId,
    author: serializeUser(entry.author),
    publishedAt: entry.publishedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    steps: Array.isArray(entry.steps)
      ? entry.steps.map((s) => ({
          id: s.id,
          sortOrder: s.sortOrder,
          title: s.title,
          body: s.body,
        }))
      : undefined,
    attachments: Array.isArray(entry.attachments)
      ? entry.attachments.map(serializeAttachment)
      : undefined,
    capabilities: auth
      ? {
          canEdit: canMutateEntry(entry, auth),
          canPublish:
            canMutateEntry(entry, auth) && entry.status !== 'PUBLISHED',
          canArchive:
            canMutateEntry(entry, auth) && entry.status === 'PUBLISHED',
          canDelete:
            kind === 'POLICY'
              ? canManagePolicies(auth) || canDeleteKnowledge(auth)
              : canDeleteKnowledge(auth) ||
                (entry.authorId === auth.userId && canEditExperience(auth)),
        }
      : undefined,
  };
}

async function replaceSteps(tx, entryId, steps = []) {
  await tx.knowledgeStep.deleteMany({ where: { entryId } });
  if (!steps.length) return;
  await tx.knowledgeStep.createMany({
    data: steps.map((s, i) => ({
      entryId,
      title: s.title,
      body: s.body || null,
      sortOrder: s.sortOrder ?? i,
    })),
  });
}

async function loadEntry(id) {
  return prisma.knowledgeEntry.findFirst({
    where: { id, deletedAt: null },
    include: entryInclude,
  });
}

export const knowledgeService = {
  meta() {
    return {
      kinds: KNOWLEDGE_KINDS.map((code) => ({
        code,
        label: KNOWLEDGE_KIND_LABELS[code],
      })),
      statuses: KNOWLEDGE_STATUSES.map((code) => ({
        code,
        label: KNOWLEDGE_STATUS_LABELS[code],
      })),
      categories: KNOWLEDGE_CATEGORIES,
      targetRoles: KNOWLEDGE_TARGET_ROLES.map((code) => ({
        code,
        label: KNOWLEDGE_ROLE_LABELS[code],
      })),
      roleLabels: KNOWLEDGE_ROLE_LABELS,
    };
  },

  async stats(auth, query = {}) {
    const kind =
      query.kind && KNOWLEDGE_KINDS.includes(query.kind) ? query.kind : undefined;
    const base = listWhere(auth, { kind });
    const [published, myDrafts, mine, policies] = await Promise.all([
      prisma.knowledgeEntry.count({
        where: { ...base, status: 'PUBLISHED', ...(kind ? {} : { kind: 'EXPERIENCE' }) },
      }),
      prisma.knowledgeEntry.count({
        where: {
          deletedAt: null,
          authorId: auth.userId,
          status: 'DRAFT',
          ...(kind ? { kind } : {}),
        },
      }),
      prisma.knowledgeEntry.count({
        where: {
          deletedAt: null,
          authorId: auth.userId,
          ...(kind ? { kind } : {}),
        },
      }),
      prisma.knowledgeEntry.count({
        where: {
          ...listWhere(auth, { kind: 'POLICY' }),
          status: 'PUBLISHED',
        },
      }),
    ]);
    return { published, myDrafts, mine, policies };
  },

  async list(auth, query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 12));
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const category =
      typeof query.category === 'string' ? query.category.trim() : '';
    const status =
      query.status && KNOWLEDGE_STATUSES.includes(query.status)
        ? query.status
        : undefined;
    const kind =
      query.kind && KNOWLEDGE_KINDS.includes(query.kind) ? query.kind : undefined;
    const mine = query.mine === true || query.mine === 'true';

    const where = {
      ...listWhere(auth, { kind }),
      ...(status ? { status } : {}),
      ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
      ...(mine ? { authorId: auth.userId } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { summary: { contains: q, mode: 'insensitive' } },
                  { body: { contains: q, mode: 'insensitive' } },
                  { category: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };

    // Hard guard: non-managers never see other roles' content
    if (!isFullAccessRole(auth.roleCode) && !canManagePolicies(auth) && !mine) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { roleAudience: auth.roleCode, status: 'PUBLISHED' },
            { authorId: auth.userId },
          ],
        },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.knowledgeEntry.count({ where }),
      prisma.knowledgeEntry.findMany({
        where,
        include: entryInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => serializeEntry(row, auth)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      kind: kind || null,
      roleAudience: auth.roleCode,
      roleAudienceLabel:
        KNOWLEDGE_ROLE_LABELS[auth.roleCode] || auth.roleCode,
      canManagePolicies: canManagePolicies(auth),
    };
  },

  async getById(auth, id) {
    const entry = await loadEntry(id);
    if (!entry || !canViewEntry(entry, auth)) {
      throw new AppError('مورد یافت نشد', 404, 'KNOWLEDGE_NOT_FOUND');
    }
    return serializeEntry(entry, auth);
  },

  async create(auth, input) {
    const kind = input.kind || 'EXPERIENCE';

    if (kind === 'POLICY') {
      if (!canManagePolicies(auth)) {
        throw new AppError(
          'فقط مدیران مجاز می‌توانند پالیسی شرکت ایجاد کنند',
          403,
          'FORBIDDEN',
        );
      }
      if (!input.roleAudience || !KNOWLEDGE_TARGET_ROLES.includes(input.roleAudience)) {
        throw new AppError(
          'نقش مخاطب پالیسی الزامی است',
          400,
          'POLICY_ROLE_REQUIRED',
        );
      }
    } else if (!canCreateExperience(auth)) {
      throw new AppError('مجوز ایجاد دانش ندارید', 403, 'FORBIDDEN');
    }

    if (!auth.roleCode) {
      throw new AppError('نقش کاربر نامعتبر است', 400, 'INVALID_ROLE');
    }

    const publish = Boolean(input.publish);
    const now = new Date();
    const roleAudience =
      kind === 'POLICY' ? input.roleAudience : auth.roleCode;

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.knowledgeEntry.create({
        data: {
          kind,
          title: input.title,
          summary: input.summary || null,
          body: input.body || null,
          category: kind === 'POLICY' ? null : input.category || null,
          version: null,
          status: publish ? 'PUBLISHED' : 'DRAFT',
          roleAudience,
          authorId: auth.userId,
          publishedAt: publish ? now : null,
        },
      });
      if (input.steps?.length) {
        await replaceSteps(tx, entry.id, input.steps);
      }
      return tx.knowledgeEntry.findFirst({
        where: { id: entry.id },
        include: entryInclude,
      });
    });

    return serializeEntry(created, auth);
  },

  async update(auth, id, input) {
    const existing = await loadEntry(id);
    if (!existing || !canViewEntry(existing, auth)) {
      throw new AppError('مورد یافت نشد', 404, 'KNOWLEDGE_NOT_FOUND');
    }
    if (!canMutateEntry(existing, auth)) {
      throw new AppError('مجوز ویرایش ندارید', 403, 'FORBIDDEN');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.knowledgeEntry.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(existing.kind === 'POLICY'
            ? { category: null, version: null }
            : input.category !== undefined
              ? { category: input.category }
              : {}),
          ...(existing.kind === 'POLICY' &&
          input.roleAudience &&
          KNOWLEDGE_TARGET_ROLES.includes(input.roleAudience)
            ? { roleAudience: input.roleAudience }
            : {}),
        },
      });
      if (input.steps) {
        await replaceSteps(tx, id, input.steps);
      }
      return tx.knowledgeEntry.findFirst({
        where: { id },
        include: entryInclude,
      });
    });

    return serializeEntry(updated, auth);
  },

  async publish(auth, id) {
    const existing = await loadEntry(id);
    if (!existing || !canViewEntry(existing, auth)) {
      throw new AppError('مورد یافت نشد', 404, 'KNOWLEDGE_NOT_FOUND');
    }
    if (!canMutateEntry(existing, auth)) {
      throw new AppError('مجوز انتشار ندارید', 403, 'FORBIDDEN');
    }

    const updated = await prisma.knowledgeEntry.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: existing.publishedAt || new Date(),
        // Experiences stay locked to author role; policies keep configured audience
        ...(existing.kind === 'EXPERIENCE' && existing.authorId === auth.userId
          ? { roleAudience: auth.roleCode }
          : {}),
      },
      include: entryInclude,
    });

    return serializeEntry(updated, auth);
  },

  async archive(auth, id) {
    const existing = await loadEntry(id);
    if (!existing || !canViewEntry(existing, auth)) {
      throw new AppError('مورد یافت نشد', 404, 'KNOWLEDGE_NOT_FOUND');
    }
    if (!canMutateEntry(existing, auth)) {
      throw new AppError('مجوز آرشیف ندارید', 403, 'FORBIDDEN');
    }

    const updated = await prisma.knowledgeEntry.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: entryInclude,
    });
    return serializeEntry(updated, auth);
  },

  async softDelete(auth, id) {
    const existing = await loadEntry(id);
    if (!existing || !canViewEntry(existing, auth)) {
      throw new AppError('مورد یافت نشد', 404, 'KNOWLEDGE_NOT_FOUND');
    }

    const allowed =
      existing.kind === 'POLICY'
        ? canManagePolicies(auth) || canDeleteKnowledge(auth)
        : canDeleteKnowledge(auth) ||
          (existing.authorId === auth.userId && canEditExperience(auth));

    if (!allowed) {
      throw new AppError('مجوز حذف ندارید', 403, 'FORBIDDEN');
    }

    await prisma.knowledgeEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  },

  async addAttachment(auth, id, file) {
    const existing = await loadEntry(id);
    if (!existing || !canViewEntry(existing, auth)) {
      throw new AppError('مورد یافت نشد', 404, 'KNOWLEDGE_NOT_FOUND');
    }
    if (!canMutateEntry(existing, auth)) {
      throw new AppError('مجوز افزودن فایل ندارید', 403, 'FORBIDDEN');
    }

    const saved = await saveKnowledgeAttachment(file, {
      entryId: id,
      userId: auth.userId,
    });

    const maxOrder = await prisma.knowledgeAttachment.aggregate({
      where: { entryId: id },
      _max: { sortOrder: true },
    });

    const att = await prisma.knowledgeAttachment.create({
      data: {
        entryId: id,
        storageKey: saved.storageKey,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        kind: saved.kind,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        meta: saved.meta,
      },
    });

    return serializeAttachment(att);
  },

  async removeAttachment(auth, id, attachmentId) {
    const existing = await loadEntry(id);
    if (!existing || !canViewEntry(existing, auth)) {
      throw new AppError('مورد یافت نشد', 404, 'KNOWLEDGE_NOT_FOUND');
    }
    if (!canMutateEntry(existing, auth)) {
      throw new AppError('مجوز حذف فایل ندارید', 403, 'FORBIDDEN');
    }

    const att = await prisma.knowledgeAttachment.findFirst({
      where: { id: attachmentId, entryId: id },
    });
    if (!att) {
      throw new AppError('پیوست یافت نشد', 404, 'ATTACHMENT_NOT_FOUND');
    }

    await prisma.knowledgeAttachment.delete({ where: { id: attachmentId } });
    return { id: attachmentId, deleted: true };
  },
};
