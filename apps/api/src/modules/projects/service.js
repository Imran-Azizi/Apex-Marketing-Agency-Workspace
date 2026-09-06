import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { writeAudit } from '../../middleware/audit.js';
import { aiProvider } from '../../services/aiProvider.js';
import { rebuildProjectContext, mapProjectStatusToCustomer, computeFinanceFields } from '../../services/projectContext.js';
import { syncProjectFinanceFromPayments } from '../crm/paymentFinance.js';
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
import { z } from 'zod';

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
});

function canAccessProject(project, auth) {
  if (auth.roleCode === 'MANAGER' || auth.roleCode === 'ADMIN' || auth.roleCode === 'FINANCE' || auth.roleCode === 'SALES') return true;
  if (auth.roleCode === 'PROJECT_MANAGER') return true;
  if (auth.roleCode === 'EDITOR' || auth.roleCode === 'NARRATOR') {
    return project.assignments?.some(
      (a) => a.isActive && (a.userId === auth.userId || a.teamProfile?.userId === auth.userId),
    );
  }
  return false;
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
    throw new AppError(
      auth.roleCode === 'EDITOR'
        ? 'دسترسی به فهرست پروژه‌ها برای ادیتور مجاز نیست — از میز کار ادیت استفاده کنید'
        : 'دسترسی به فهرست پروژه‌ها برای نریتور مجاز نیست',
      403,
      'FORBIDDEN',
    );
  }
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

  const where = { deletedAt: null };
  const and = [];

  if (status) where.status = status;
  if (customerId) where.crmCustomerId = customerId;
  if (deliveryStatus) where.deliveryStatus = deliveryStatus;

  const createdAt = resolveCreatedAtRange(query);
  if (createdAt) where.createdAt = createdAt;

  if (q) {
    and.push({
      OR: [
        { id: { equals: q } },
        { code: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { crmCustomer: { personName: { contains: q, mode: 'insensitive' } } },
        { crmCustomer: { companyName: { contains: q, mode: 'insensitive' } } },
      ],
    });
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

  if (auth.roleCode === 'EDITOR' || auth.roleCode === 'NARRATOR') {
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

export const projectService = {
  async list(auth, query = {}) {
    assertCanListProjects(auth);
    const where = buildListWhere(auth, query);

    const items = await prisma.project.findMany({
      where,
      include: {
        crmCustomer: { select: { id: true, personName: true, companyName: true } },
        assignments: {
          where: { isActive: true },
          include: {
            teamProfile: { select: { displayName: true, userId: true } },
            user: { select: { id: true, fullName: true } },
          },
        },
        finance: ['EDITOR', 'NARRATOR', 'SALES', 'PROJECT_MANAGER'].includes(auth.roleCode) ? false : true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return attachProjectProgressMany(
      items.map((p) => stripFinanceForRole(p, auth.roleCode)),
      'internal',
    );
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
          user: { select: { id: true, fullName: true } },
          teamProfile: {
            select: {
              userId: true,
              displayName: true,
              user: { select: { id: true, fullName: true } },
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
      editorsById.set(id, { id, fullName: name });
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
    if (auth.roleCode === 'NARRATOR' || auth.roleCode === 'EDITOR') {
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
        assignments: { include: { teamProfile: true, user: { select: { id: true, fullName: true } } } },
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

    let result = stripFinanceForRole(project, auth.roleCode);
    if (result.finance && ['MANAGER', 'ADMIN', 'FINANCE'].includes(auth.roleCode)) {
      const calc = computeFinanceFields(result.finance);
      result = { ...result, finance: { ...result.finance, ...calc } };
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

    return attachProjectProgress(result, 'internal');
  },

  async generateContent(id, auth, req) {
    const { aiService } = await import('../ai/service.js');
    const result = await aiService.generateContent(id, auth, req);
    return result.version;
  },

  async approveContentForClient(projectId, versionId, auth, req) {
    const { aiService } = await import('../ai/service.js');
    return aiService.approveVersion(projectId, versionId, auth, req);
  },

  async enableExtraRevision(projectId, { scope }, auth, req) {
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
    const { productionService } = await import('../production/service.js');
    return productionService.submitProduction(projectId, body, auth, req);
  },

  async runQcAndApproveFinal(projectId, body, auth, req) {
    const { productionService } = await import('../production/service.js');
    return productionService.managerReview(projectId, body, auth, req);
  },

  async uploadVoice(projectId, { storageKey, name }, auth, req) {
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

    const [counts, leadsToday, followUps, createdRows] = await Promise.all([
      prisma.project.groupBy({
        by: ['status'],
        where: { deletedAt: null },
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
      prisma.project.findMany({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
          },
        },
        select: { createdAt: true },
      }),
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
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      );
    }
    const growthMap = new Map(monthKeys.map((k) => [k, 0]));
    for (const p of createdRows) {
      const d = new Date(p.createdAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (growthMap.has(k)) growthMap.set(k, growthMap.get(k) + 1);
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
    const q = String(query.q || '').trim();
    const customerWhere = { deletedAt: null };
    if (q) {
      customerWhere.OR = [
        { personName: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { customerCode: { contains: q, mode: 'insensitive' } },
        { whatsappRaw: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [customers, services, formats] = await Promise.all([
      prisma.crmCustomer.findMany({
        where: customerWhere,
        orderBy: [{ updatedAt: 'desc' }, { personName: 'asc' }],
        take: 100,
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

    return { customers, services, formats };
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
    const title = input.title.trim();
    const crmCustomerId = input.crmCustomerId;

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

    const { project, opportunityId, agreedPrice } = await prisma.$transaction(
      async (tx) => {
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
            // Prefer attaching to a CRM-priced open cycle when available;
            // only force a brand-new blank cycle when neither id nor attachable opp exists.
            alwaysCreateFresh: false,
          },
        );

        const agreed = resolveAgreedPrice(opportunity, input.agreedPrice);
        const financeSnap = await buildProjectFinanceSnapshot(tx, {
          crmCustomerId,
          opportunityId: opportunity.id,
          agreedPrice: agreed,
        });

        // Fresh cycles with no CRM price require an agreed price so finance KPIs stay consistent.
        const isFreshBlank =
          !opportunity.agreedPrice &&
          !opportunity.proposedPrice &&
          !opportunity.contractLocked;
        if (isFreshBlank && agreed <= 0) {
          throw new AppError(
            'مبلغ توافق‌شده برای پروژه الزامی است',
            400,
            'VALIDATION',
          );
        }

        return createProjectGraph(tx, {
          opportunity,
          customer: customerWithWhatsapp,
          manager,
          brief: { ...input, title },
          source: 'INTERNAL',
          actorId: auth.userId,
          portalAccountId: customerWithWhatsapp.portalAccount?.id || null,
          service,
          agreedPrice: agreed,
          financeSnap,
          timelineBody: 'پروژه توسط مدیر برای مشتری موجود ایجاد شد',
          notifyPortal: Boolean(customerWithWhatsapp.portalAccount?.id),
        });
      },
    );

    await writeAudit({
      userId: auth.userId,
      action: 'PROJECT_CREATE',
      entityType: 'Project',
      entityId: project.id,
      after: {
        code: project.code,
        title: project.title,
        crmCustomerId,
        opportunityId,
        agreedPrice,
        source: 'INTERNAL',
      },
      req,
    });

    return this.get(project.id, auth);
  },
};
