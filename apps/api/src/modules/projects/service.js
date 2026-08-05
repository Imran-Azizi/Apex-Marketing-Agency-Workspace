import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { writeAudit } from '../../middleware/audit.js';
import { aiProvider } from '../../services/aiProvider.js';
import { rebuildProjectContext, mapProjectStatusToCustomer, computeFinanceFields } from '../../services/projectContext.js';
import { syncProjectFinanceFromPayments } from '../crm/paymentFinance.js';
import {
  attachProjectProgress,
  attachProjectProgressMany,
} from '../../services/projectProgress.js';

function canAccessProject(project, auth) {
  if (auth.roleCode === 'MANAGER' || auth.roleCode === 'ADMIN' || auth.roleCode === 'FINANCE' || auth.roleCode === 'SALES') return true;
  if (auth.roleCode === 'EDITOR' || auth.roleCode === 'NARRATOR') {
    return project.assignments?.some(
      (a) => a.isActive && (a.userId === auth.userId || a.teamProfile?.userId === auth.userId),
    );
  }
  return false;
}

function stripFinanceForRole(project, roleCode) {
  if (['EDITOR', 'NARRATOR', 'SALES'].includes(roleCode)) {
    const { finance, invoices, payables, ...rest } = project;
    return rest;
  }
  return project;
}

export const projectService = {
  async list(auth, { status, q }) {
    if (auth.roleCode === 'NARRATOR' || auth.roleCode === 'EDITOR') {
      throw new AppError(
        auth.roleCode === 'EDITOR'
          ? 'دسترسی به فهرست پروژه‌ها برای ادیتور مجاز نیست — از میز کار ادیت استفاده کنید'
          : 'دسترسی به فهرست پروژه‌ها برای نریتور مجاز نیست',
        403,
        'FORBIDDEN',
      );
    }
    const where = { deletedAt: null };
    if (status) where.status = status;
    if (q) where.OR = [{ code: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }];

    if (auth.roleCode === 'EDITOR' || auth.roleCode === 'NARRATOR') {
      where.assignments = {
        some: {
          isActive: true,
          OR: [{ userId: auth.userId }, { teamProfile: { userId: auth.userId } }],
        },
      };
    }

    const items = await prisma.project.findMany({
      where,
      include: {
        crmCustomer: { select: { id: true, personName: true, companyName: true } },
        assignments: { where: { isActive: true }, include: { teamProfile: true } },
        finance: ['EDITOR', 'NARRATOR', 'SALES'].includes(auth.roleCode) ? false : true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return attachProjectProgressMany(
      items.map((p) => stripFinanceForRole(p, auth.roleCode)),
      'internal',
    );
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
          data: { projectId: null, pipelineStage: 'ORDER_CONFIRMED' },
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
          data: { pipelineStage: 'ORDER_CONFIRMED' },
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
    const counts = await prisma.project.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });
    const leadsToday = await prisma.crmCustomer.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, deletedAt: null },
    });
    const followUps = await prisma.crmCustomer.count({
      where: { nextFollowUpAt: { lte: new Date() }, deletedAt: null },
    });
    return { projectStatusCounts: counts, leadsToday, followUpsDue: followUps };
  },
};
