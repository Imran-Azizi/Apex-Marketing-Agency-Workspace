import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { ok, AppError } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';
import { writeAudit } from '../../middleware/audit.js';
import {
  evaluateDeliveryAccess,
  syncProjectDeliveryFields,
  deliverySnapshot,
} from '../../services/deliveryAccess.js';
import { syncProjectFinanceFromPayments } from '../crm/paymentFinance.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/:projectId/status', requirePermission('delivery.view'), async (req, res, next) => {
  try {
    await syncProjectFinanceFromPayments(prisma, req.params.projectId, { persist: true });

    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, deletedAt: null },
      include: {
        finance: true,
        downloadPermission: true,
        files: {
          where: { kind: { in: ['CLEAN_FINAL', 'WATERMARKED_FINAL'] }, deletedAt: null },
          select: { id: true, kind: true, version: true, name: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

    const evalResult = evaluateDeliveryAccess({
      projectStatus: project.status,
      finance: project.finance,
      downloadPermission: project.downloadPermission,
      hasCleanFile: project.files.some((f) => f.kind === 'CLEAN_FINAL'),
    });

    ok(res, {
      projectId: project.id,
      status: project.status,
      customerFacingStatus: project.customerFacingStatus,
      completedAt: project.completedAt,
      downloadPermission: project.downloadPermission,
      finance: project.finance
        ? {
            finalProjectPrice: project.finance.finalProjectPrice,
            received: project.finance.received,
            balance: evalResult.balance,
          }
        : null,
      ...deliverySnapshot(evalResult),
      files: project.files,
    });
  } catch (e) { next(e); }
});

router.post('/:projectId/allow', requireCsrf, requirePermission('delivery.allow'), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const finance = await prisma.projectFinance.findUnique({ where: { projectId } });
    if (!finance) throw new AppError('Project finance not found', 404, 'NOT_FOUND');
    const balance = Number(finance.finalProjectPrice) - Number(finance.received);

    let overrideBalance = false;
    if (balance > 0) {
      if (req.auth.roleCode !== 'MANAGER' && req.auth.roleCode !== 'ADMIN') {
        throw new AppError('مانده بیشتر از صفر است؛ فقط مدیر با دلیل می‌تواند Override کند', 403, 'BALANCE_OUTSTANDING');
      }
      if (!req.body.overrideReason) {
        throw new AppError('دلیل Override الزامی است', 400, 'OVERRIDE_REASON_REQUIRED');
      }
      overrideBalance = true;
    }

    const perm = await prisma.downloadPermission.upsert({
      where: { projectId },
      create: {
        projectId,
        allowed: true,
        allowedAt: new Date(),
        allowedById: req.auth.userId,
        overrideBalance,
        overrideReason: req.body.overrideReason || null,
      },
      update: {
        allowed: true,
        allowedAt: new Date(),
        allowedById: req.auth.userId,
        revokedAt: null,
        overrideBalance,
        overrideReason: req.body.overrideReason || null,
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'READY_TO_DOWNLOAD',
        customerFacingStatus: 'READY_DELIVERY',
      },
    });

    await syncProjectDeliveryFields(prisma, projectId);

    await prisma.projectTimelineEvent.create({
      data: {
        projectId,
        type: 'DOWNLOAD_ALLOWED',
        title: 'اجازه تحویل نسخه پاک صادر شد',
        body: overrideBalance ? `Override مانده: ${req.body.overrideReason}` : 'پرداخت تسویه و تأیید مدیر',
        actorId: req.auth.userId,
      },
    });

    await writeAudit({
      userId: req.auth.userId,
      action: 'DOWNLOAD_ALLOW',
      entityType: 'DownloadPermission',
      entityId: perm.id,
      after: { overrideBalance, reason: req.body.overrideReason },
      req,
    });

    ok(res, perm);
  } catch (e) { next(e); }
});

router.post('/:projectId/revoke', requireCsrf, requirePermission('delivery.allow'), async (req, res, next) => {
  try {
    const perm = await prisma.downloadPermission.update({
      where: { projectId: req.params.projectId },
      data: {
        allowed: false,
        revokedAt: new Date(),
        revokeReason: req.body.reason || null,
      },
    });
    await prisma.downloadHistory.updateMany({
      where: { downloadPermissionId: perm.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await syncProjectDeliveryFields(prisma, req.params.projectId);
    await writeAudit({
      userId: req.auth.userId,
      action: 'DOWNLOAD_REVOKE',
      entityType: 'DownloadPermission',
      entityId: perm.id,
      after: { reason: req.body.reason },
      req,
    });
    ok(res, perm);
  } catch (e) { next(e); }
});

router.get('/:projectId/history', requirePermission('delivery.view'), async (req, res, next) => {
  try {
    const perm = await prisma.downloadPermission.findUnique({
      where: { projectId: req.params.projectId },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    const history = await prisma.downloadHistory.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    ok(res, { permission: perm, history: history.length ? history : (perm?.history || []) });
  } catch (e) { next(e); }
});

router.post('/:projectId/complete', requireCsrf, requirePermission('projects.complete'), async (req, res, next) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.projectId },
      data: {
        status: 'COMPLETED',
        customerFacingStatus: 'COMPLETED',
        completedAt: new Date(),
        deliveryStatus: 'COMPLETED',
      },
    });
    await syncProjectDeliveryFields(prisma, project.id, {
      projectPatch: { deliveryStatus: 'COMPLETED' },
    });
    await prisma.crmCustomer.update({
      where: { id: project.crmCustomerId },
      data: { pipelineStage: 'COMPLETED' },
    });
    await prisma.opportunity.updateMany({
      where: { projectId: project.id },
      data: { pipelineStage: 'COMPLETED' },
    });
    await prisma.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        type: 'PROJECT_COMPLETED',
        title: 'پروژه تکمیل شد',
        actorId: req.auth.userId,
      },
    });
    await writeAudit({
      userId: req.auth.userId,
      action: 'PROJECT_COMPLETE',
      entityType: 'Project',
      entityId: project.id,
      req,
    });
    ok(res, project);
  } catch (e) { next(e); }
});

export default router;
