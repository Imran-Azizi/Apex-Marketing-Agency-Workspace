import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { writeAudit } from '../../middleware/audit.js';
import { aiProvider } from '../../services/aiProvider.js';
import { rebuildProjectContext, mapProjectStatusToCustomer, computeFinanceFields } from '../../services/projectContext.js';
import {
  batchOpportunityFinanceSnapshots,
  syncOpportunityFinance,
  syncProjectFinanceFromPayments,
} from '../crm/paymentFinance.js';
import {
  syncCustomerWhatsappFromBrief,
} from '../../utils/whatsappNormalize.js';
import {
  attachProjectProgress,
  attachProjectProgressMany,
} from '../../services/projectProgress.js';
import {
  buildProjectFinanceSnapshot,
  createProjectGraph,
  resolveAgreedPrice,
  resolveOpportunityForProjectCreate,
} from './createProjectCore.js';
import {
  findProjectByCreateKey,
  findProjectForOpportunity,
  isIdempotencyUniqueConflict,
  lockOpportunityRow,
  normalizeIdempotencyKey,
  withProjectCreateLock,
} from './projectCreateGuard.js';
import {
  assertProjectAccess,
  canAccessProject,
  PROJECT_LEAD_CANDIDATE_ROLES,
  projectLeadScopeWhere,
  resolveProjectLead,
} from '../../services/projectAccess.js';
import { createNotificationOnce, notifyManagersOnce } from '../../services/notifications.js';
import { getCustomerPersonName } from '../../utils/crmCustomerName.js';
import {
  customerListScopeCondition,
  customerSearchCondition,
} from '../crm/visibility.js';
import {
  contractProgressPayload,
  summarizeContractVideos,
} from './contractVideoStats.js';
import { z } from 'zod';
import { storage } from '../../services/storage.js';
import { serializePortalAsset } from '../portal/helpers.js';
import {
  assertClientAssetImageFile,
  isClientAssetImageKind,
} from '../files/image-formats.js';

const assignProjectLeadSchema = z.object({
  userId: z.string().trim().min(1, 'انتخاب کارمند الزامی است'),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const createProjectSchema = z.object({
  crmCustomerId: z.string().min(1),
  opportunityId: z.string().optional().nullable(),
  title: z.string().trim().min(2).max(200),
  serviceId: z.string().optional().nullable(),
  formatId: z.string().optional().nullable(),
  customAspectRatio: z
    .string()
    .trim()
    .regex(/^\d{1,3}:\d{1,3}$/)
    .optional()
    .nullable(),
  durationSec: z.coerce.number().int().positive().optional().nullable(),
  language: z.string().trim().max(16).optional().nullable(),
  tone: z.string().trim().max(80).optional().nullable(),
  platforms: z.array(z.string()).optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
  mainMessage: z.string().trim().max(1000).optional().nullable(),
  productName: z.string().trim().max(200).optional().nullable(),
  productDescription: z.string().trim().max(4000).optional().nullable(),
  features: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  audience: z.string().trim().max(400).optional().nullable(),
  goal: z.string().trim().max(400).optional().nullable(),
  cta: z.string().trim().max(200).optional().nullable(),
  agreedPrice: z.coerce.number().nonnegative().optional().nullable(),
  agreedTerms: z.string().trim().max(4000).optional().nullable(),
  personName: z.string().trim().min(1).max(200).optional().nullable(),
  jobTitle: z.string().trim().min(1).max(200).optional().nullable(),
  companyName: z.string().trim().min(1).max(200).optional().nullable(),
  phone: z.string().trim().min(5).max(40).optional().nullable(),
  whatsapp: z.string().trim().min(5).max(40).optional().nullable(),
  address: z.string().trim().min(1).max(500).optional().nullable(),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().email().optional().nullable(),
  ),
  website: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(500).optional().nullable(),
  ),
  clientAssetIds: z.array(z.string()).optional(),
  idempotencyKey: z.string().trim().min(8).max(80).optional().nullable(),
  parentProjectId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().min(1).optional().nullable(),
  ),
});

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().email().optional().nullable(),
);

const optionalWebsite = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(500).optional().nullable(),
);

const createContractSchema = z.object({
  crmCustomerId: z.string().min(1),
  idempotencyKey: z.string().trim().min(8).max(80).optional().nullable(),
  personName: z.string().trim().min(1).max(200),
  jobTitle: z.string().trim().min(1).max(200),
  companyName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(40),
  whatsapp: z.string().trim().min(5).max(40),
  address: z.string().trim().min(1).max(500),
  email: optionalEmail,
  website: optionalWebsite,
});

const updateContractSchema = z.object({
  personName: z.string().trim().min(1).max(200).optional(),
  jobTitle: z.string().trim().min(1).max(200).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  whatsapp: z.string().trim().min(5).max(40).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  email: optionalEmail,
  website: optionalWebsite,
});

const PROJECT_CLIENT_ASSET_KINDS = new Set([
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

const attachProjectAssetSchema = z.object({
  kind: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(300),
  storageKey: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().max(200).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
});

function trimText(value) {
  return String(value || '').trim();
}

function assertVideoWorkflowProject(project) {
  if (project?.kind === 'CONTRACT') {
    throw new AppError(
      'این یک قرارداد چندویدیویی است. این عملیات را روی پروژه ویدیو انجام دهید.',
      400,
      'CONTRACT_CONTAINER',
    );
  }
}

async function assertLoadedVideoProject(projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, kind: true },
  });
  if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');
  assertVideoWorkflowProject(project);
  return project;
}

function customerSnapshotFromParent(parent, customer) {
  const brief = parent?.brief && typeof parent.brief === 'object' ? parent.brief : {};
  return {
    personName: trimText(brief.personName) || customer.personName,
    jobTitle: trimText(brief.jobTitle) || customer.jobTitle || '',
    companyName: trimText(brief.companyName) || customer.companyName || '',
    phone: trimText(brief.phone) || customer.phone || customer.whatsappRaw || '',
    whatsapp:
      trimText(brief.whatsapp) ||
      customer.whatsappRaw ||
      customer.normalizedWhatsapp ||
      '',
    address: trimText(brief.address) || customer.address || '',
    email: trimText(brief.email) || customer.email || undefined,
    website: trimText(brief.website) || undefined,
  };
}

function contractTitleFor({ companyName, personName }) {
  const who = trimText(companyName) || trimText(personName) || 'مشتری';
  return `${who} — قرارداد ماهانه`;
}

function withContractPresentation(project, videoStats) {
  if (!project || project.kind !== 'CONTRACT') return project;
  const stats = videoStats || summarizeContractVideos([]);
  return {
    ...project,
    videoStats: stats,
    progress: contractProgressPayload(stats),
  };
}

function stripFinanceForRole(project, roleCode) {
  if (['EDITOR', 'NARRATOR', 'SALES', 'PROJECT_MANAGER'].includes(roleCode)) {
    const { finance, invoices, payables, ...rest } = project;
    return rest;
  }
  return project;
}

function assertCanListProjects(auth) {
  if (auth.roleCode === 'NARRATOR' || auth.roleCode === 'EDITOR') {
    if (auth.projectLeadElevated) return;
    throw new AppError(
      auth.roleCode === 'EDITOR'
        ? 'دسترسی به فهرست پروژه‌ها برای ادیتور مجاز نیست — از میز کار ادیت استفاده کنید'
        : 'دسترسی به فهرست پروژه‌ها برای نریتور مجاز نیست',
      403,
      'FORBIDDEN',
    );
  }
}

function shouldScopeToProjectLead(auth) {
  if (!auth?.userId) return false;
  if (auth.roleCode === 'PROJECT_MANAGER') return true;
  if (
    auth.projectLeadElevated &&
    (auth.roleCode === 'EDITOR' ||
      auth.roleCode === 'NARRATOR' ||
      auth.roleCode === 'SALES' ||
      auth.roleCode === 'FINANCE')
  ) {
    return true;
  }
  return false;
}

function startOfLocalDay(d = new Date()) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(d = new Date()) {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
}

function resolveCreatedAtRange({ createdPreset, createdFrom, createdTo }) {
  const preset = String(createdPreset || '').trim().toLowerCase();
  const from = String(createdFrom || '').trim();
  const to = String(createdTo || '').trim();
  const now = new Date();

  if (preset === 'today') {
    return { gte: startOfLocalDay(now), lte: endOfLocalDay(now) };
  }
  if (preset === 'week') {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 6);
    return { gte: start, lte: endOfLocalDay(now) };
  }
  if (preset === 'month') {
    return {
      gte: new Date(now.getFullYear(), now.getMonth(), 1),
      lte: endOfLocalDay(now),
    };
  }

  if (preset === 'custom' || from || to) {
    const range = {};
    if (from) {
      const parsed = new Date(from);
      if (!Number.isNaN(parsed.getTime())) range.gte = startOfLocalDay(parsed);
    }
    if (to) {
      const parsed = new Date(to);
      if (!Number.isNaN(parsed.getTime())) range.lte = endOfLocalDay(parsed);
    }
    return Object.keys(range).length ? range : null;
  }

  return null;
}

function buildListWhere(auth, query = {}) {
  const status = String(query.status || '').trim();
  const q = String(query.q || '').trim();
  const customerId = String(query.customerId || '').trim();
  const editorId = String(query.editorId || '').trim();
  const deliveryStatus = String(query.deliveryStatus || '').trim();
  const wantsTopLevel = query.topLevel === '1' || query.topLevel === 'true';
  const assignmentScoped =
    shouldScopeToProjectLead(auth) ||
    auth.roleCode === 'EDITOR' ||
    auth.roleCode === 'NARRATOR';

  const where = { deletedAt: null };
  const and = [];

  // Managers see contracts and single videos. Child videos live inside the contract.
  // Assignment-scoped staff still see the videos they are responsible for.
  // Editor / delivery filters switch to the matching video rows.
  const hideChildRows =
    wantsTopLevel && !assignmentScoped && !editorId && !deliveryStatus && !status;
  if (hideChildRows) and.push({ kind: { not: 'CHILD' } });
  if (wantsTopLevel && !assignmentScoped && !hideChildRows) {
    and.push({ kind: { not: 'CONTRACT' } });
  }

  if (status) where.status = status;
  if (customerId) where.crmCustomerId = customerId;
  if (deliveryStatus) where.deliveryStatus = deliveryStatus;

  const createdAt = resolveCreatedAtRange(query);
  if (createdAt) where.createdAt = createdAt;

  if (q) {
    const textMatch = [
      { id: { equals: q } },
      { code: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { crmCustomer: { personName: { contains: q, mode: 'insensitive' } } },
      { crmCustomer: { companyName: { contains: q, mode: 'insensitive' } } },
    ];
    if (hideChildRows) {
      textMatch.push({
        kind: 'CONTRACT',
        childProjects: {
          some: {
            deletedAt: null,
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      });
    }
    and.push({ OR: textMatch });
  }

  if (editorId) {
    and.push({
      assignments: {
        some: {
          isActive: true,
          role: 'EDITOR',
          OR: [{ userId: editorId }, { teamProfile: { userId: editorId } }],
        },
      },
    });
  }

  if (shouldScopeToProjectLead(auth)) {
    and.push(projectLeadScopeWhere(auth.userId));
  } else if (auth.roleCode === 'EDITOR' || auth.roleCode === 'NARRATOR') {
    and.push({
      assignments: {
        some: {
          isActive: true,
          OR: [{ userId: auth.userId }, { teamProfile: { userId: auth.userId } }],
        },
      },
    });
  }

  if (and.length) where.AND = and;
  return where;
}

function withProjectLead(project) {
  if (!project) return project;
  return {
    ...project,
    projectLead: resolveProjectLead(project.assignments || []),
  };
}

async function presentProjectDetail(result, auth) {
  if (!result) return result;

  if (result.kind === 'CHILD' && result.parentProjectId) {
    result = {
      ...result,
      parentProject: await prisma.project.findFirst({
        where: { id: result.parentProjectId, deletedAt: null },
        select: { id: true, code: true, title: true, kind: true },
      }),
    };
  }

  if (result.kind !== 'CONTRACT') {
    return attachProjectProgress(result, 'internal');
  }

  const children = await prisma.project.findMany({
    where: { parentProjectId: result.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      assignments: {
        where: { isActive: true },
        include: {
          teamProfile: { select: { displayName: true, userId: true } },
          user: { select: { id: true, fullName: true, profileImage: true } },
        },
      },
      finance: {
        select: { agreedPrice: true, finalProjectPrice: true, received: true },
      },
    },
  });
  const videos = await attachProjectProgressMany(
    children.map((child) => withProjectLead(stripFinanceForRole(child, auth.roleCode))),
    'internal',
  );
  return withContractPresentation(
    { ...result, videos },
    summarizeContractVideos(videos),
  );
}

export const projectService = {
  async list(auth, query = {}) {
    assertCanListProjects(auth);
    const where = buildListWhere(auth, query);

    const safePage = Math.max(1, Number(query.page) || 1);
    const rawSize = Number(query.pageSize ?? query.limit ?? 15);
    const safePageSize = Math.min(100, Math.max(1, Number.isFinite(rawSize) ? rawSize : 15));

    const [rows, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          crmCustomer: { select: { id: true, personName: true, companyName: true } },
          parentProject: { select: { id: true, code: true, title: true } },
          assignments: {
            where: { isActive: true },
            include: {
              teamProfile: { select: { displayName: true, userId: true } },
              user: { select: { id: true, fullName: true, profileImage: true } },
            },
          },
          finance: ['EDITOR', 'NARRATOR', 'SALES', 'PROJECT_MANAGER'].includes(auth.roleCode)
            ? false
            : true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      prisma.project.count({ where }),
    ]);

    const contractIds = rows.filter((p) => p.kind === 'CONTRACT').map((p) => p.id);
    const statsByParent = new Map();
    if (contractIds.length) {
      const children = await prisma.project.findMany({
        where: { parentProjectId: { in: contractIds }, deletedAt: null },
        select: { parentProjectId: true, status: true },
      });
      const grouped = new Map();
      for (const child of children) {
        const bucket = grouped.get(child.parentProjectId) || [];
        bucket.push(child);
        grouped.set(child.parentProjectId, bucket);
      }
      for (const id of contractIds) {
        statsByParent.set(id, summarizeContractVideos(grouped.get(id) || []));
      }
    }

    const items = (await attachProjectProgressMany(
      rows.map((p) => withProjectLead(stripFinanceForRole(p, auth.roleCode))),
      'internal',
    )).map((project) =>
      withContractPresentation(project, statsByParent.get(project.id)),
    );

    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
    };
  },

  async filterOptions(auth) {
    assertCanListProjects(auth);

    const [customers, editorAssignments] = await Promise.all([
      prisma.crmCustomer.findMany({
        where: {
          deletedAt: null,
          projects: { some: { deletedAt: null } },
        },
        select: { id: true, personName: true, companyName: true },
        orderBy: { personName: 'asc' },
        take: 300,
      }),
      prisma.projectAssignment.findMany({
        where: {
          isActive: true,
          role: 'EDITOR',
          project: { deletedAt: null },
        },
        select: {
          userId: true,
          user: { select: { id: true, fullName: true, profileImage: true } },
          teamProfile: {
            select: {
              userId: true,
              displayName: true,
              user: { select: { id: true, fullName: true, profileImage: true } },
            },
          },
        },
        take: 500,
      }),
    ]);

    const editorsById = new Map();
    for (const assignment of editorAssignments) {
      const id =
        assignment.user?.id ||
        assignment.userId ||
        assignment.teamProfile?.user?.id ||
        assignment.teamProfile?.userId ||
        null;
      if (!id || editorsById.has(id)) continue;
      const name =
        assignment.user?.fullName ||
        assignment.teamProfile?.displayName ||
        assignment.teamProfile?.user?.fullName ||
        null;
      if (!name) continue;
      const profileImage =
        assignment.user?.profileImage ||
        assignment.teamProfile?.user?.profileImage ||
        null;
      editorsById.set(id, { id, fullName: name, profileImage });
    }

    return {
      customers: customers.map((c) => ({
        id: c.id,
        personName: c.personName,
        companyName: c.companyName,
      })),
      editors: [...editorsById.values()].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, 'fa'),
      ),
    };
  },

  async get(id, auth) {
    if (
      (auth.roleCode === 'NARRATOR' || auth.roleCode === 'EDITOR') &&
      !auth.projectLeadElevated
    ) {
      throw new AppError(
        auth.roleCode === 'EDITOR'
          ? 'دسترسی به جزئیات پروژه برای ادیتور مجاز نیست — از فضای ادیت استفاده کنید'
          : 'دسترسی به جزئیات پروژه برای نریتور مجاز نیست',
        403,
        'FORBIDDEN',
      );
    }
    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        crmCustomer: true,
        service: true,
        format: true,
        assignments: { include: { teamProfile: true, user: { select: { id: true, fullName: true, profileImage: true } } } },
        files: { where: { deletedAt: null } },
        contentVersions: { orderBy: { versionNumber: 'desc' } },
        finance: true,
        context: true,
        timeline: { orderBy: { createdAt: 'desc' }, take: 50 },
        approvals: { orderBy: { createdAt: 'desc' } },
        feedback: { orderBy: { createdAt: 'desc' } },
        aiRuns: { orderBy: { createdAt: 'desc' }, take: 20 },
        payables: true,
        downloadPermission: true,
        invoices: { include: { payments: true, items: true } },
        assetRefs: { include: { clientAsset: true } },
        opportunity: {
          select: {
            id: true,
            crmCustomerId: true,
            agreedPrice: true,
            contractLocked: true,
          },
        },
      },
    });
    if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');
    if (!canAccessProject(project, auth)) throw new AppError('دسترسی به این پروژه ندارید', 403, 'FORBIDDEN');

    // Live payment totals for the response only — avoid rewriting caches on every GET.
    const synced = await syncProjectFinanceFromPayments(prisma, id, { persist: false });
    if (synced?.projectFinance) {
      project.finance = synced.projectFinance;
    } else if (project.finance && synced?.finance) {
      project.finance = {
        ...project.finance,
        finalProjectPrice: synced.finance.projectTotal,
        received: synced.finance.totalPaid,
      };
    }

    let result = withProjectLead(stripFinanceForRole(project, auth.roleCode));
    if (result.finance && ['MANAGER', 'ADMIN', 'FINANCE'].includes(auth.roleCode)) {
      const calc = computeFinanceFields(result.finance);
      result = { ...result, finance: { ...result.finance, ...calc } };
    }

    if (project.opportunity?.id) {
      result = {
        ...result,
        opportunityId: project.opportunity.id,
        contractLocked: Boolean(project.opportunity.contractLocked),
      };
      if (result.finance) {
        const snaps = await batchOpportunityFinanceSnapshots(prisma, [
          project.opportunity,
        ]);
        const paymentFinance = snaps.get(project.opportunity.id);
        if (paymentFinance) {
          result = { ...result, paymentFinance };
        }
      }
    }

    if (['MANAGER', 'ADMIN', 'FINANCE', 'SALES'].includes(auth.roleCode)) {
      const { evaluateDeliveryAccess, deliverySnapshot } = await import('../../services/deliveryAccess.js');
      const evalResult = evaluateDeliveryAccess({
        projectStatus: project.status,
        finance: project.finance,
        downloadPermission: project.downloadPermission,
        hasCleanFile: (project.files || []).some((f) => f.kind === 'CLEAN_FINAL'),
      });
      result = {
        ...result,
        ...deliverySnapshot(evalResult),
        paymentStatus: project.paymentStatus || evalResult.paymentStatus,
        deliveryStatus: project.deliveryStatus || evalResult.deliveryStatus,
        cleanFileAccess: project.cleanFileAccess || evalResult.cleanFileAccess,
      };
    }

    return presentProjectDetail(result, auth);
  },

  async generateContent(id, auth, req) {
    await assertLoadedVideoProject(id);
    const { aiService } = await import('../ai/service.js');
    const result = await aiService.generateContent(id, auth, req);
    return result.version;
  },

  async approveContentForClient(projectId, versionId, auth, req) {
    await assertLoadedVideoProject(projectId);
    const { aiService } = await import('../ai/service.js');
    return aiService.approveVersion(projectId, versionId, auth, req);
  },

  async enableExtraRevision(projectId, { scope }, auth, req) {
    await assertLoadedVideoProject(projectId);
    const data = scope === 'VIDEO' ? { extraVideoRevision: true } : { extraContentRevision: true };
    await prisma.project.update({ where: { id: projectId }, data });
    await writeAudit({
      userId: auth.userId,
      action: 'EXTRA_REVISION_ENABLE',
      entityType: 'Project',
      entityId: projectId,
      after: { scope },
      req,
    });
    return { enabled: true, scope };
  },

  async acceptVoice(projectId, auth, req) {
    await assertLoadedVideoProject(projectId);
    await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          projectId,
          type: 'VOICE_ACCEPT',
          decision: 'APPROVED',
          actorType: 'MANAGER',
          actorId: auth.userId,
        },
      });
      await tx.employeePayable.updateMany({
        where: { projectId, roleLabel: 'NARRATOR', status: 'ESTIMATED' },
        data: { status: 'CONFIRMED' },
      });
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'PRODUCTION_EDITING', customerFacingStatus: 'IN_PRODUCTION' },
      });

      const editorAssign = await tx.projectAssignment.findFirst({
        where: { projectId, role: 'EDITOR', isActive: true },
        include: { teamProfile: true },
      });
      if (editorAssign) {
        const existing = await tx.editingTask.findFirst({
          where: {
            projectId,
            status: { in: ['ASSIGNED', 'IN_PROGRESS', 'REVIEW_REQUIRED', 'REVISION_REQUESTED'] },
          },
        });
        if (!existing) {
          await tx.editingTask.create({
            data: {
              projectId,
              editorUserId: editorAssign.userId || editorAssign.teamProfile?.userId || null,
              editorTeamProfileId: editorAssign.teamProfileId,
              assignedById: editorAssign.assignedById || auth.userId,
              status: 'ASSIGNED',
              deadline: editorAssign.deadlineAt,
              instructions: editorAssign.notes,
            },
          });
        }
      }
    });
    await writeAudit({ userId: auth.userId, action: 'VOICE_ACCEPT', entityType: 'Project', entityId: projectId, req });
    return { accepted: true };
  },

  async returnVoice(projectId, { comment }, auth, req) {
    await assertLoadedVideoProject(projectId);
    await prisma.approval.create({
      data: {
        projectId,
        type: 'VOICE_ACCEPT',
        decision: 'RETURNED',
        comment,
        actorType: 'MANAGER',
        actorId: auth.userId,
      },
    });
    await writeAudit({ userId: auth.userId, action: 'VOICE_RETURN', entityType: 'Project', entityId: projectId, after: { comment }, req });
    return { returned: true };
  },

  async submitProduction(projectId, body, auth, req) {
    await assertLoadedVideoProject(projectId);
    const { productionService } = await import('../production/service.js');
    return productionService.submitProduction(projectId, body, auth, req);
  },

  async runQcAndApproveFinal(projectId, body, auth, req) {
    await assertLoadedVideoProject(projectId);
    const { productionService } = await import('../production/service.js');
    return productionService.managerReview(projectId, body, auth, req);
  },

  async uploadVoice(projectId, { storageKey, name }, auth, req) {
    await assertLoadedVideoProject(projectId);
    const project = await this.get(projectId, auth);
    if (!canAccessProject(project, auth) && auth.roleCode !== 'MANAGER' && auth.roleCode !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 403, 'FORBIDDEN');
    }
    const file = await prisma.projectFile.create({
      data: {
        projectId,
        kind: 'AUDIO',
        name: name || 'narration.mp3',
        storageKey,
      },
    });
    await prisma.projectTimelineEvent.create({
      data: { projectId, type: 'VOICE_UPLOAD', title: 'آپلود صدای نریتور', actorId: auth.userId },
    });
    await writeAudit({ userId: auth.userId, action: 'VOICE_UPLOAD', entityType: 'ProjectFile', entityId: file.id, req });
    return file;
  },

  /**
   * Manager-only project removal.
   * Soft-deletes the project (keeps an audit trail) and hard-deletes all
   * finance/portfolio child records so nothing remains visible in مالی,
   * CRM, portal, public portfolio, or dashboards.
   */
  async softDelete(id, auth, req) {
    if (auth.roleCode !== 'MANAGER' && auth.roleCode !== 'ADMIN') {
      throw new AppError('فقط مدیر می‌تواند پروژه را حذف کند', 403, 'FORBIDDEN');
    }

    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        opportunity: true,
        invoices: { select: { id: true } },
        files: {
          where: { deletedAt: null },
          select: { id: true, storageKey: true },
        },
        _count: {
          select: {
            invoices: true,
            expenses: true,
            payables: true,
          },
        },
      },
    });
    if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

    if (project.kind === 'CONTRACT') {
      const childCount = await prisma.project.count({
        where: { parentProjectId: id, deletedAt: null },
      });
      if (childCount > 0) {
        throw new AppError(
          'این قرارداد ویدیو دارد. ابتدا ویدیوها را حذف کنید، سپس قرارداد را حذف کنید.',
          400,
          'CONTRACT_HAS_VIDEOS',
        );
      }
    }

    const [portfolioItems, expenses] = await Promise.all([
      prisma.portfolioItem.findMany({
        where: { projectId: id, deletedAt: null },
        select: { storageKey: true, thumbnailKey: true },
      }),
      prisma.expense.findMany({
        where: { projectId: id },
        select: { receiptKey: true },
      }),
    ]);

    const storageKeys = storage.collectStorageKeys(
      project.files.map((f) => f.storageKey),
      portfolioItems.flatMap((p) => [p.storageKey, p.thumbnailKey]),
      expenses.map((e) => e.receiptKey),
    );

    await storage.deleteStoredObjects(storageKeys, {
      required: true,
      logTag: 'project-delete',
    });

    const deletedAt = new Date();
    const invoiceIds = project.invoices.map((inv) => inv.id);

    const result = await prisma.$transaction(async (tx) => {
      // 1) Payments belonging to this project's invoices (must go before invoices)
      const paymentsDeleted = invoiceIds.length
        ? (
            await tx.payment.deleteMany({
              where: { invoiceId: { in: invoiceIds } },
            })
          ).count
        : 0;

      // 2) Invoice items cascade via FK; delete invoices themselves
      const invoicesDeleted = invoiceIds.length
        ? (
            await tx.invoice.deleteMany({
              where: { id: { in: invoiceIds } },
            })
          ).count
        : 0;

      // 3) Project-linked expenses & employee payables
      const expensesDeleted = (
        await tx.expense.deleteMany({ where: { projectId: id } })
      ).count;
      const payablesDeleted = (
        await tx.employeePayable.deleteMany({ where: { projectId: id } })
      ).count;

      // 4) Unpublish + soft-delete portfolio showcase rows tied to this project
      const portfolioUpdated = await tx.portfolioItem.updateMany({
        where: { projectId: id, deletedAt: null },
        data: { deletedAt, status: 'UNPUBLISHED' },
      });

      // Soft-delete project files (Bunny objects already removed above)
      await tx.projectFile.updateMany({
        where: { projectId: id, deletedAt: null },
        data: { deletedAt },
      });

      // Detach opportunity and restore pre-project CRM stage
      if (project.opportunity) {
        await tx.opportunity.update({
          where: { id: project.opportunity.id },
          data: { projectId: null, pipelineStage: 'DEPOSIT_CONFIRMED' },
        });
      }

      const otherProject = await tx.project.findFirst({
        where: {
          crmCustomerId: project.crmCustomerId,
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });

      if (!otherProject) {
        await tx.crmCustomer.update({
          where: { id: project.crmCustomerId },
          data: { pipelineStage: 'DEPOSIT_CONFIRMED' },
        });
      }

      // Soft-delete the project itself (retains code for audit / uniqueness)
      const deleted = await tx.project.update({
        where: { id },
        data: { deletedAt },
      });

      return {
        deleted,
        removed: {
          invoices: invoicesDeleted,
          payments: paymentsDeleted,
          expenses: expensesDeleted,
          payables: payablesDeleted,
          portfolioItems: portfolioUpdated.count,
        },
      };
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PROJECT_SOFT_DELETE',
      entityType: 'Project',
      entityId: id,
      before: {
        code: project.code,
        title: project.title,
        status: project.status,
      },
      after: { deletedAt, removed: result.removed },
      req,
    });

    return {
      id: result.deleted.id,
      code: result.deleted.code,
      deletedAt: result.deleted.deletedAt,
      removed: result.removed,
    };
  },

  async dashboard(auth) {
    const ACTIVE = new Set([
      'NEW_MANAGER_REVIEW',
      'CONTENT_GENERATION',
      'INTERNAL_CONTENT_REVIEW',
      'WAITING_CLIENT_CONTENT_APPROVAL',
      'CONTENT_REVISION',
      'NARRATION_RECORDING',
      'PRODUCTION_EDITING',
      'MANAGER_FINAL_REVIEW',
      'FINAL_REVISION',
      'WAITING_CLIENT_FINAL_APPROVAL',
      'WAITING_PAYMENT',
      'READY_TO_DOWNLOAD',
    ]);
    const WAITING_CUSTOMER = new Set([
      'WAITING_CLIENT_CONTENT_APPROVAL',
      'WAITING_CLIENT_FINAL_APPROVAL',
    ]);
    const WAITING_APPROVAL = new Set([
      'NEW_MANAGER_REVIEW',
      'INTERNAL_CONTENT_REVIEW',
      'MANAGER_FINAL_REVIEW',
    ]);

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const projectScope = shouldScopeToProjectLead(auth)
      ? { deletedAt: null, kind: { not: 'CONTRACT' }, ...projectLeadScopeWhere(auth.userId) }
      : { deletedAt: null, kind: { not: 'CONTRACT' } };
    const [counts, leadsToday, followUps, createdRows] = await Promise.all([
      prisma.project.groupBy({
        by: ['status'],
        where: projectScope,
        _count: true,
      }),
      prisma.crmCustomer.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          deletedAt: null,
        },
      }),
      prisma.crmCustomer.count({
        where: { nextFollowUpAt: { lte: new Date() }, deletedAt: null },
      }),
      shouldScopeToProjectLead(auth)
        ? prisma.project.findMany({
            where: {
              ...projectScope,
              createdAt: { gte: sixMonthsAgo },
            },
            select: { createdAt: true },
          }).then((rows) => {
            const map = new Map();
            for (const row of rows) {
              const d = new Date(row.createdAt);
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              map.set(key, (map.get(key) || 0) + 1);
            }
            return [...map.entries()].map(([key, count]) => ({ key, count }));
          })
        : prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS key,
               COUNT(*)::int AS count
        FROM projects
        WHERE "deletedAt" IS NULL
          AND "kind"::text <> 'CONTRACT'
          AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY 1
      `,
    ]);

    let total = 0;
    let active = 0;
    let completed = 0;
    let waitingCustomer = 0;
    let waitingApproval = 0;
    let onHold = 0;
    let canceled = 0;

    for (const row of counts) {
      const n = row._count;
      total += n;
      if (ACTIVE.has(row.status)) active += n;
      if (row.status === 'COMPLETED') completed += n;
      if (WAITING_CUSTOMER.has(row.status)) waitingCustomer += n;
      if (WAITING_APPROVAL.has(row.status)) waitingApproval += n;
      if (row.status === 'ON_HOLD') onHold += n;
      if (row.status === 'CANCELED') canceled += n;
    }

    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      );
    }
    const growthMap = new Map(monthKeys.map((k) => [k, 0]));
    for (const p of createdRows || []) {
      const k = String(p.key || '');
      const n = Number(p.count) || 0;
      if (growthMap.has(k)) growthMap.set(k, n);
    }
    const monthlyProjectGrowth = monthKeys.map((key) => {
      const [y, m] = key.split('-').map(Number);
      return { key, year: y, month: m, count: growthMap.get(key) || 0 };
    });

    return {
      projectStatusCounts: counts,
      leadsToday,
      followUpsDue: followUps,
      projectKpis: {
        total,
        active,
        completed,
        waitingCustomer,
        waitingApproval,
        onHold,
        canceled,
      },
      monthlyProjectGrowth,
    };
  },

  /**
   * Options for the manager "create project" dialog (customer search + catalogs).
   */
  async createOptions(auth, query = {}) {
    assertCanListProjects(auth);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
    // Same list as مدیریت مشتری: transferred from CRM و فروش and not yet delivered.
    const and = [customerListScopeCondition('management')];
    const searchCondition = customerSearchCondition(query.q);
    if (searchCondition) and.push(searchCondition);
    const customerWhere = { deletedAt: null, AND: and };

    const [customers, customerTotal, services, formats] = await Promise.all([
      prisma.crmCustomer.findMany({
        where: customerWhere,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          customerCode: true,
          personName: true,
          companyName: true,
          jobTitle: true,
          phone: true,
          whatsappRaw: true,
          normalizedWhatsapp: true,
          email: true,
          city: true,
          address: true,
          pipelineStage: true,
        },
      }),
      prisma.crmCustomer.count({ where: customerWhere }),
      prisma.service.findMany({
        where: { deletedAt: null, isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, revisionCount: true },
      }),
      prisma.format.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, ratio: true },
      }),
    ]);

    return {
      customers,
      customerTotal,
      page,
      pageSize,
      hasMore: page * pageSize < customerTotal,
      services,
      formats,
    };
  },

  /**
   * Manager/staff create project for an existing CRM customer.
   * Uses the same createProjectGraph as portal submitBrief so Manager + Finance
   * dashboards see identical project/finance relationships.
   */
  async createForCustomer(body, auth, req) {
    assertCanListProjects(auth);
    const parsed = createProjectSchema.safeParse(body || {});
    if (!parsed.success) {
      throw new AppError('اطلاعات پروژه ناقص یا نامعتبر است', 400, 'VALIDATION');
    }
    const input = parsed.data;
    let parentProject = null;
    if (input.parentProjectId) {
      parentProject = await assertProjectAccess(input.parentProjectId, auth);
      if (parentProject.kind !== 'CONTRACT') {
        throw new AppError(
          'ویدیو فقط می‌تواند داخل یک قرارداد چندویدیویی ساخته شود',
          400,
          'VALIDATION',
        );
      }
      input.crmCustomerId = parentProject.crmCustomerId;
      input.opportunityId = null;
      if (!(Number(input.agreedPrice) > 0)) {
        throw new AppError('قیمت مجموعی پروژه الزامی است', 400, 'VALIDATION');
      }
      if (!trimText(input.agreedTerms)) {
        throw new AppError('شرایط توافق‌شده الزامی است', 400, 'VALIDATION');
      }
    }
    const title = input.title.trim();
    const crmCustomerId = input.crmCustomerId;
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    const replayIfExists = async () => {
      const byKey = await findProjectByCreateKey(
        prisma,
        idempotencyKey,
        crmCustomerId,
      );
      if (byKey) return byKey;
      if (input.opportunityId) {
        const byOpp = await findProjectForOpportunity(prisma, input.opportunityId);
        if (byOpp && byOpp.crmCustomerId === crmCustomerId) return byOpp;
      }
      return null;
    };

    const existing = await replayIfExists();
    if (existing) return this.get(existing.id, auth);

    return withProjectCreateLock(idempotencyKey, async () => {
      const lockedExisting = await replayIfExists();
      if (lockedExisting) return this.get(lockedExisting.id, auth);

      const customer = await prisma.crmCustomer.findFirst({
        where: { id: crmCustomerId, deletedAt: null },
        include: { portalAccount: true },
      });
      if (!customer) throw new AppError('مشتری یافت نشد', 404, 'NOT_FOUND');

      let service = null;
      if (input.serviceId) {
        service = await prisma.service.findFirst({
          where: { id: input.serviceId, deletedAt: null },
        });
        if (!service) throw new AppError('سرویس یافت نشد', 404, 'NOT_FOUND');
      }

      if (input.formatId) {
        const format = await prisma.format.findUnique({ where: { id: input.formatId } });
        if (!format) throw new AppError('فرمت یافت نشد', 404, 'NOT_FOUND');
      }

      const manager =
        (auth.roleCode === 'MANAGER' || auth.roleCode === 'ADMIN'
          ? await prisma.user.findFirst({
              where: { id: auth.userId, isActive: true, deletedAt: null },
            })
          : null) ||
        (await prisma.user.findFirst({
          where: { role: { code: 'MANAGER' }, isActive: true, deletedAt: null },
        }));
      if (!manager) {
        throw new AppError('مدیر سیستم تعریف نشده', 500, 'NO_MANAGER');
      }

      const priorProjects = await prisma.project.count({
        where: { crmCustomerId, deletedAt: null },
      });

      try {
        const result = await prisma.$transaction(async (tx) => {
          const inherited = parentProject
            ? customerSnapshotFromParent(parentProject, customer)
            : null;
          if (inherited) Object.assign(input, inherited);

          const customerWithWhatsapp = await syncCustomerWhatsappFromBrief(
            tx,
            customer,
            input.whatsapp,
          );

          const { opportunity } = await resolveOpportunityForProjectCreate(
            tx,
            customerWithWhatsapp,
            {
              opportunityId: input.opportunityId || null,
              title,
              pipelineStage: priorProjects > 0 ? 'REPEAT_CUSTOMER' : 'ORDER_CONFIRMED',
              alwaysCreateFresh: Boolean(parentProject),
            },
          );

          const locked = await lockOpportunityRow(tx, opportunity.id);
          if (locked.projectId) {
            const existingProject = await tx.project.findFirst({
              where: { id: locked.projectId, deletedAt: null },
            });
            if (existingProject) {
              return { project: existingProject, opportunityId: opportunity.id, agreedPrice: 0, replayed: true };
            }
          }

          const liveOpportunity = await tx.opportunity.findFirst({
            where: { id: opportunity.id },
            include: { service: true },
          });

          const agreed = resolveAgreedPrice(liveOpportunity, input.agreedPrice);
          const financeSnap = await buildProjectFinanceSnapshot(tx, {
            crmCustomerId,
            opportunityId: liveOpportunity.id,
            agreedPrice: agreed,
          });

          const isFreshBlank =
            !liveOpportunity.agreedPrice &&
            !liveOpportunity.proposedPrice &&
            !liveOpportunity.contractLocked;
          if (!parentProject && isFreshBlank && agreed <= 0) {
            throw new AppError(
              'مبلغ توافق‌شده برای پروژه الزامی است',
              400,
              'VALIDATION',
            );
          }

          const created = await createProjectGraph(tx, {
            opportunity: liveOpportunity,
            customer: customerWithWhatsapp,
            manager,
            brief: { ...input, title },
            source: 'INTERNAL',
            actorId: auth.userId,
            portalAccountId: customerWithWhatsapp.portalAccount?.id || null,
            service,
            agreedPrice: agreed,
            financeSnap,
            timelineBody: parentProject
              ? 'ویدیوی قرارداد ماهانه ایجاد شد'
              : 'پروژه توسط مدیر برای مشتری موجود ایجاد شد',
            notifyPortal: Boolean(customerWithWhatsapp.portalAccount?.id),
            createIdempotencyKey: idempotencyKey,
            kind: parentProject ? 'CHILD' : 'SINGLE',
            parentProjectId: parentProject ? parentProject.id : null,
          });

          if (parentProject) {
            // Same lock as saving «جزئیات قرارداد» in CRM, so payments can be recorded.
            await tx.opportunity.update({
              where: { id: liveOpportunity.id },
              data: {
                agreedPrice: agreed,
                proposedPrice: liveOpportunity.proposedPrice ?? agreed,
                agreedTerms: trimText(input.agreedTerms),
                contractLocked: true,
                contractLockedAt: new Date(),
                contractLockedById: auth.userId,
              },
            });
            await syncOpportunityFinance(tx, liveOpportunity.id, { persist: true });
          }
          return { ...created, replayed: false };
        });

        if (!result.replayed) {
          await writeAudit({
            userId: auth.userId,
            action: 'PROJECT_CREATE',
            entityType: 'Project',
            entityId: result.project.id,
            after: {
              code: result.project.code,
              title: result.project.title,
              crmCustomerId,
              opportunityId: result.opportunityId,
              agreedPrice: result.agreedPrice,
              source: 'INTERNAL',
              kind: parentProject ? 'CHILD' : 'SINGLE',
              parentProjectId: parentProject?.id || null,
            },
            req,
          });

          // Creator with PROJECT_MANAGER role becomes the project lead automatically
          if (auth.roleCode === 'PROJECT_MANAGER') {
            const creatorProfile = await prisma.teamProfile.findFirst({
              where: {
                userId: auth.userId,
                deletedAt: null,
                status: { not: 'INACTIVE' },
              },
              select: { id: true },
            });
            await prisma.projectAssignment.create({
              data: {
                projectId: result.project.id,
                role: 'PROJECT_LEAD',
                userId: auth.userId,
                teamProfileId: creatorProfile?.id || null,
                assignedById: auth.userId,
                notes: 'اختصاص خودکار هنگام ایجاد پروژه',
                isActive: true,
              },
            });
          }
        }

        return this.get(result.project.id, auth);
      } catch (err) {
        if (
          isIdempotencyUniqueConflict(err) ||
          err?.code === 'PROJECT_EXISTS'
        ) {
          const replayed = await replayIfExists();
          if (replayed) return this.get(replayed.id, auth);
        }
        throw err;
      }
    });
  },

  /**
   * Monthly / multi-video parent. Stores the customer once.
   * Child videos are created later through the normal project workflow.
   */
  async createContract(body, auth, req) {
    assertCanListProjects(auth);
    const parsed = createContractSchema.safeParse(body || {});
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues?.[0]?.message || 'اطلاعات قرارداد ناقص یا نامعتبر است',
        400,
        'VALIDATION',
      );
    }
    const input = parsed.data;
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    const replay = async () =>
      findProjectByCreateKey(prisma, idempotencyKey, input.crmCustomerId);

    const existing = await replay();
    if (existing) return this.get(existing.id, auth);

    return withProjectCreateLock(idempotencyKey, async () => {
      const lockedExisting = await replay();
      if (lockedExisting) return this.get(lockedExisting.id, auth);

      const customer = await prisma.crmCustomer.findFirst({
        where: { id: input.crmCustomerId, deletedAt: null },
        include: { portalAccount: true },
      });
      if (!customer) throw new AppError('مشتری یافت نشد', 404, 'NOT_FOUND');

      const manager =
        (auth.roleCode === 'MANAGER' || auth.roleCode === 'ADMIN'
          ? await prisma.user.findFirst({
              where: { id: auth.userId, isActive: true, deletedAt: null },
            })
          : null) ||
        (await prisma.user.findFirst({
          where: { role: { code: 'MANAGER' }, isActive: true, deletedAt: null },
        }));
      if (!manager) {
        throw new AppError('مدیر سیستم تعریف نشده', 500, 'NO_MANAGER');
      }

      const brief = {
        personName: input.personName,
        jobTitle: input.jobTitle,
        companyName: input.companyName,
        phone: input.phone,
        whatsapp: input.whatsapp,
        address: input.address,
        email: input.email || undefined,
        website: input.website || undefined,
        createdBy: 'INTERNAL',
        createdByUserId: auth.userId,
      };
      for (const key of Object.keys(brief)) {
        if (brief[key] === undefined) delete brief[key];
      }

      try {
        const created = await prisma.$transaction(async (tx) => {
          await syncCustomerWhatsappFromBrief(tx, customer, input.whatsapp);
          const year = new Date().getFullYear();
          const count = await tx.project.count();
          const code = `APX-${year}-${String(count + 1).padStart(4, '0')}`;
          const project = await tx.project.create({
            data: {
              code,
              title: contractTitleFor(input),
              status: 'NEW_MANAGER_REVIEW',
              customerFacingStatus: 'INFO_RECEIVED',
              crmCustomerId: customer.id,
              managerId: manager.id,
              kind: 'CONTRACT',
              brief,
              platforms: [],
            },
          });

          if (idempotencyKey) {
            await tx.$executeRaw`
              UPDATE "projects"
              SET "createIdempotencyKey" = ${idempotencyKey}
              WHERE id = ${project.id}
            `;
          }

          await tx.projectAssignment.create({
            data: {
              projectId: project.id,
              role: 'MANAGER',
              userId: manager.id,
            },
          });

          await tx.projectTimelineEvent.create({
            data: {
              projectId: project.id,
              type: 'CREATED',
              title: 'قرارداد چندویدیویی ایجاد شد',
              body: 'اطلاعات مشتری روی قرارداد ذخیره شد. ویدیوها جداگانه ساخته می‌شوند.',
              actorId: auth.userId,
            },
          });

          await rebuildProjectContext(project.id, tx);

          const customerName =
            getCustomerPersonName({
              personName: input.personName,
              companyName: input.companyName,
            }) ||
            getCustomerPersonName(customer) ||
            'مشتری';

          await notifyManagersOnce(
            {
              eventKey: `contract.created:${project.id}`,
              title: 'قرارداد چندویدیویی ایجاد شد',
              body: `${customerName} — ${project.title} (${project.code})`,
              link: `/projects/${project.id}`,
              meta: {
                type: 'CONTRACT_CREATED',
                projectId: project.id,
                projectCode: project.code,
                projectName: project.title,
              },
            },
            tx,
          );

          return project;
        });

        if (auth.roleCode === 'PROJECT_MANAGER') {
          const creatorProfile = await prisma.teamProfile.findFirst({
            where: {
              userId: auth.userId,
              deletedAt: null,
              status: { not: 'INACTIVE' },
            },
            select: { id: true },
          });
          await prisma.projectAssignment.create({
            data: {
              projectId: created.id,
              role: 'PROJECT_LEAD',
              userId: auth.userId,
              teamProfileId: creatorProfile?.id || null,
              assignedById: auth.userId,
              notes: 'اختصاص خودکار هنگام ایجاد قرارداد',
              isActive: true,
            },
          });
        }

        await writeAudit({
          userId: auth.userId,
          action: 'PROJECT_CREATE',
          entityType: 'Project',
          entityId: created.id,
          after: {
            code: created.code,
            title: created.title,
            kind: 'CONTRACT',
            crmCustomerId: customer.id,
          },
          req,
        });

        return this.get(created.id, auth);
      } catch (err) {
        if (isIdempotencyUniqueConflict(err)) {
          const replayed = await replay();
          if (replayed) return this.get(replayed.id, auth);
        }
        throw err;
      }
    });
  },

  async updateContract(id, body, auth, req) {
    const project = await assertProjectAccess(id, auth);
    if (project.kind !== 'CONTRACT') {
      throw new AppError('این پروژه یک قرارداد چندویدیویی نیست', 400, 'VALIDATION');
    }
    const parsed = updateContractSchema.safeParse(body || {});
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues?.[0]?.message || 'اطلاعات قرارداد نامعتبر است',
        400,
        'VALIDATION',
      );
    }
    const input = parsed.data;
    const brief = {
      ...(project.brief && typeof project.brief === 'object' ? project.brief : {}),
    };
    for (const key of [
      'personName',
      'jobTitle',
      'companyName',
      'phone',
      'whatsapp',
      'address',
      'email',
      'website',
    ]) {
      if (input[key] !== undefined) brief[key] = input[key] || undefined;
    }
    for (const key of Object.keys(brief)) {
      if (brief[key] === undefined) delete brief[key];
    }

    const data = { brief };
    if (input.companyName !== undefined || input.personName !== undefined) {
      data.title = contractTitleFor(brief);
    }

    await prisma.$transaction(async (tx) => {
      if (input.whatsapp) {
        const customer = await tx.crmCustomer.findFirst({
          where: { id: project.crmCustomerId, deletedAt: null },
        });
        if (customer) await syncCustomerWhatsappFromBrief(tx, customer, input.whatsapp);
      }
      await tx.project.update({ where: { id: project.id }, data });
      await tx.projectTimelineEvent.create({
        data: {
          projectId: project.id,
          type: 'UPDATED',
          title: 'اطلاعات قرارداد به‌روزرسانی شد',
          actorId: auth.userId,
        },
      });
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PROJECT_UPDATE',
      entityType: 'Project',
      entityId: project.id,
      after: {
        title: data.title || project.title,
      },
      req,
    });

    return this.get(project.id, auth);
  },

  async addClientAsset(projectId, body, auth, req) {
    const project = await assertProjectAccess(projectId, auth);
    assertVideoWorkflowProject(project);
    const parsed = attachProjectAssetSchema.parse(body);
    const kind = parsed.kind.toUpperCase();
    if (!PROJECT_CLIENT_ASSET_KINDS.has(kind)) {
      throw new AppError('نوع فایل مجاز نیست', 400, 'VALIDATION');
    }
    if (isClientAssetImageKind(kind)) {
      assertClientAssetImageFile({
        name: parsed.name,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
        kind,
      });
    }

    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.clientAsset.create({
        data: {
          crmCustomerId: project.crmCustomerId,
          kind,
          name: parsed.name,
          storageKey: parsed.storageKey,
          mimeType: parsed.mimeType || null,
          sizeBytes: parsed.sizeBytes != null ? Number(parsed.sizeBytes) : null,
          meta: parsed.meta || undefined,
        },
      });
      await tx.assetReference.create({
        data: { projectId: project.id, clientAssetId: created.id },
      });
      return created;
    });

    await rebuildProjectContext(project.id);
    await writeAudit({
      userId: auth.userId,
      action: 'PROJECT_ASSET_CREATE',
      entityType: 'ClientAsset',
      entityId: asset.id,
      after: { projectId: project.id, kind: asset.kind, name: asset.name },
      req,
    });

    return serializePortalAsset(asset);
  },

  async removeClientAsset(projectId, assetId, auth, req) {
    const project = await assertProjectAccess(projectId, auth);
    assertVideoWorkflowProject(project);
    const ref = await prisma.assetReference.findFirst({
      where: { projectId: project.id, clientAssetId: assetId },
      include: { clientAsset: true },
    });
    const asset = ref?.clientAsset;
    if (!ref || !asset || asset.deletedAt || asset.crmCustomerId !== project.crmCustomerId) {
      throw new AppError('فایل یافت نشد', 404, 'NOT_FOUND');
    }

    const otherRefs = await prisma.assetReference.count({
      where: {
        clientAssetId: asset.id,
        NOT: { id: ref.id },
      },
    });

    if (otherRefs === 0) {
      await storage.deleteStoredObject(asset.storageKey, {
        required: true,
        logTag: 'project-client-asset',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.assetReference.delete({ where: { id: ref.id } });
      if (otherRefs === 0) {
        await tx.clientAsset.update({
          where: { id: asset.id },
          data: { deletedAt: new Date() },
        });
      }
    });

    await rebuildProjectContext(project.id);
    await writeAudit({
      userId: auth.userId,
      action: 'PROJECT_ASSET_DELETE',
      entityType: 'ClientAsset',
      entityId: asset.id,
      before: { projectId: project.id, kind: asset.kind, name: asset.name },
      req,
    });

    return { deleted: true };
  },

  /**
   * Active staff who can be assigned as full project lead (any employee role).
   */
  async listProjectLeadCandidates(projectId, auth) {
    await assertProjectAccess(projectId, auth);
    if (!['MANAGER', 'ADMIN'].includes(auth.roleCode)) {
      throw new AppError('فقط مدیر می‌تواند مسئول پروژه را تعیین کند', 403, 'FORBIDDEN');
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { code: { in: [...PROJECT_LEAD_CANDIDATE_ROLES] } },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
        role: { select: { code: true } },
        teamProfile: {
          select: { id: true, displayName: true, status: true, deletedAt: true },
        },
      },
      orderBy: { fullName: 'asc' },
      take: 300,
    });

    return {
      items: users.map((u) => ({
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        profileImage: u.profileImage,
        roleCode: u.role?.code || null,
        teamProfileId:
          u.teamProfile && !u.teamProfile.deletedAt && u.teamProfile.status !== 'INACTIVE'
            ? u.teamProfile.id
            : null,
        displayName: u.teamProfile?.displayName || u.fullName,
      })),
    };
  },

  async assignProjectLead(projectId, body, auth, req) {
    if (!['MANAGER', 'ADMIN'].includes(auth.roleCode)) {
      throw new AppError('فقط مدیر می‌تواند مسئول پروژه را تعیین کند', 403, 'FORBIDDEN');
    }
    const project = await assertProjectAccess(projectId, auth);
    const parsed = assignProjectLeadSchema.safeParse(body || {});
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues?.[0]?.message || 'اطلاعات نامعتبر است',
        400,
        'VALIDATION',
      );
    }
    const { userId, notes } = parsed.data;

    const employee = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
        role: { code: { in: [...PROJECT_LEAD_CANDIDATE_ROLES] } },
      },
      include: {
        role: { select: { code: true } },
        teamProfile: {
          select: { id: true, displayName: true, status: true, deletedAt: true },
        },
      },
    });
    if (!employee) {
      throw new AppError(
        'کارمند یافت نشد یا برای اختصاص پروژه مجاز نیست',
        404,
        'NOT_FOUND',
      );
    }

    const teamProfileId =
      employee.teamProfile &&
      !employee.teamProfile.deletedAt &&
      employee.teamProfile.status !== 'INACTIVE'
        ? employee.teamProfile.id
        : null;

    await prisma.$transaction(async (tx) => {
      await tx.projectAssignment.updateMany({
        where: { projectId: project.id, role: 'PROJECT_LEAD', isActive: true },
        data: { isActive: false },
      });
      await tx.projectAssignment.create({
        data: {
          projectId: project.id,
          role: 'PROJECT_LEAD',
          userId: employee.id,
          teamProfileId,
          assignedById: auth.userId,
          notes: notes?.trim() || null,
          isActive: true,
        },
      });
    });

    await createNotificationOnce({
      userId: employee.id,
      title: 'اختصاص مدیریت پروژه',
      body: `شما به‌عنوان مسئول مدیریت پروژه «${project.title || project.code}» تعیین شدید.`,
      link: `/projects/${project.id}`,
      eventKey: `project-lead:${project.id}:${employee.id}`,
      meta: { projectId: project.id, kind: 'PROJECT_LEAD_ASSIGNED' },
    }).catch(() => {});

    await writeAudit({
      userId: auth.userId,
      action: 'PROJECT_LEAD_ASSIGN',
      entityType: 'Project',
      entityId: project.id,
      after: { leadUserId: employee.id, teamProfileId },
      req,
    });

    return this.get(project.id, auth);
  },

  async unassignProjectLead(projectId, auth, req) {
    if (!['MANAGER', 'ADMIN'].includes(auth.roleCode)) {
      throw new AppError('فقط مدیر می‌تواند مسئول پروژه را حذف کند', 403, 'FORBIDDEN');
    }
    const project = await assertProjectAccess(projectId, auth);

    const active = await prisma.projectAssignment.findFirst({
      where: { projectId: project.id, role: 'PROJECT_LEAD', isActive: true },
    });
    if (!active) {
      return this.get(project.id, auth);
    }

    await prisma.projectAssignment.updateMany({
      where: { projectId: project.id, role: 'PROJECT_LEAD', isActive: true },
      data: { isActive: false },
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PROJECT_LEAD_UNASSIGN',
      entityType: 'Project',
      entityId: project.id,
      before: { leadUserId: active.userId },
      req,
    });

    return this.get(project.id, auth);
  },
};
