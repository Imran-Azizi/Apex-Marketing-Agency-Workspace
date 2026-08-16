import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { ok, created, AppError } from '../../utils/response.js';
import { aiService } from './service.js';
import { prisma } from '../../db/prisma.js';

const router = Router();

router.use(requireAuth, requireInternal);

router.get('/:projectId/overview', requirePermission('content.view'), async (req, res, next) => {
  try {
    ok(res, await aiService.getOverview(req.params.projectId));
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/workflows', requirePermission('content.view'), async (req, res, next) => {
  try {
    ok(res, await aiService.listWorkflows(req.params.projectId));
  } catch (e) {
    next(e);
  }
});

router.get('/workflows/:id', requirePermission('content.view'), async (req, res, next) => {
  try {
    ok(res, await aiService.getWorkflow(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/versions', requirePermission('content.view'), async (req, res, next) => {
  try {
    ok(res, await aiService.listVersions(req.params.projectId));
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/versions/compare', requirePermission('content.view'), async (req, res, next) => {
  try {
    const { left, right } = req.query;
    if (!left || !right) throw new AppError('left و right الزامی است', 400, 'VALIDATION');
    ok(res, await aiService.compareVersions(req.params.projectId, String(left), String(right)));
  } catch (e) {
    next(e);
  }
});

router.get('/:projectId/versions/:versionId', requirePermission('content.view'), async (req, res, next) => {
  try {
    ok(res, await aiService.getVersion(req.params.projectId, req.params.versionId));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/:projectId/generate',
  requireCsrf,
  aiLimiter,
  requirePermission('content.generate'),
  async (req, res, next) => {
    try {
      const result = await aiService.generateContent(req.params.projectId, req.auth, req, {
        changeNotes: req.body?.changeNotes,
        sync: req.body?.sync === true,
        userPrompt: req.body?.userPrompt,
        baseVersionId: req.body?.baseVersionId,
      });
      created(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:projectId/regenerate',
  requireCsrf,
  aiLimiter,
  requirePermission('content.generate'),
  async (req, res, next) => {
    try {
      const result = await aiService.generateContent(req.params.projectId, req.auth, req, {
        changeNotes: req.body?.changeNotes || 'بازتولید محتوا',
        sync: req.body?.sync === true,
        userPrompt: req.body?.userPrompt,
        baseVersionId: req.body?.baseVersionId,
      });
      created(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/:projectId/versions/:versionId',
  requireCsrf,
  requirePermission('content.edit'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await aiService.updateVersionContent(
          req.params.projectId,
          req.params.versionId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/:projectId/versions/:versionId',
  requireCsrf,
  requirePermission('content.delete'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await aiService.deleteVersion(
          req.params.projectId,
          req.params.versionId,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:projectId/versions/:versionId/send-for-approval',
  requireCsrf,
  requirePermission('content.approve'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await aiService.approveVersion(
          req.params.projectId,
          req.params.versionId,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get('/:projectId/runs', requirePermission('content.view'), async (req, res, next) => {
  try {
    ok(res, await aiService.listRuns(req.params.projectId));
  } catch (e) {
    next(e);
  }
});

router.get('/runs/:id', requirePermission('content.view'), async (req, res, next) => {
  try {
    const run = await prisma.aiRun.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!run) throw new AppError('یافت نشد', 404, 'NOT_FOUND');
    ok(res, run);
  } catch (e) {
    next(e);
  }
});

export default router;
