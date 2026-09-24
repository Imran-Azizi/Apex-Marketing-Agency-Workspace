import { z } from 'zod';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { ok, created, AppError } from '../../utils/response.js';
import { aiService } from './service.js';
import { prisma } from '../../db/prisma.js';
import { assertProjectAccess } from '../../services/projectAccess.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

router.use(requireAuth, requireInternal);

async function requireProjectParam(req, res, next) {
  try {
    await assertProjectAccess(req.params.projectId, req.auth);
    next();
  } catch (err) {
    next(err);
  }
}

const generateSchema = z.object({
  changeNotes: z.string().trim().max(4000).optional(),
  sync: z.boolean().optional(),
  userPrompt: z.string().trim().max(4000).optional(),
  baseVersionId: z.string().min(1).max(64).optional(),
});

const manualVersionSchema = z
  .object({
    changeNotes: z.string().trim().max(4000).optional(),
    scenario: z.unknown().optional(),
    narration: z.unknown().optional(),
    storyboard: z.unknown().optional(),
  })
  .passthrough();

const editVersionSchema = z
  .object({
    baseVersionId: z.string().min(1).max(64),
    section: z.enum(['scenario', 'narration', 'storyboard']),
    changeNotes: z.string().trim().max(4000).optional(),
    scenario: z.unknown().optional(),
    narration: z.unknown().optional(),
    storyboard: z.unknown().optional(),
  })
  .passthrough();

router.get('/workflows/:id', requirePermission('content.view'), async (req, res, next) => {
  try {
    const wf = await aiService.getWorkflow(req.params.id);
    await assertProjectAccess(wf.projectId, req.auth);
    ok(res, wf);
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
    if (run.projectId) {
      await assertProjectAccess(run.projectId, req.auth);
    } else if (req.auth.roleCode !== 'MANAGER' && req.auth.roleCode !== 'ADMIN') {
      throw new AppError('دسترسی به این پروژه ندارید', 403, 'FORBIDDEN');
    }
    ok(res, run);
  } catch (e) {
    next(e);
  }
});

router.get(
  '/:projectId/overview',
  requirePermission('content.view'),
  requireProjectParam,
  async (req, res, next) => {
    try {
      ok(res, await aiService.getOverview(req.params.projectId));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/:projectId/workflows',
  requirePermission('content.view'),
  requireProjectParam,
  async (req, res, next) => {
    try {
      ok(res, await aiService.listWorkflows(req.params.projectId));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/:projectId/versions',
  requirePermission('content.view'),
  requireProjectParam,
  async (req, res, next) => {
    try {
      ok(res, await aiService.listVersions(req.params.projectId));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/:projectId/versions/compare',
  requirePermission('content.view'),
  requireProjectParam,
  async (req, res, next) => {
    try {
      const { left, right } = req.query;
      if (!left || !right) throw new AppError('left و right الزامی است', 400, 'VALIDATION');
      ok(res, await aiService.compareVersions(req.params.projectId, String(left), String(right)));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/:projectId/versions/:versionId',
  requirePermission('content.view'),
  requireProjectParam,
  async (req, res, next) => {
    try {
      ok(res, await aiService.getVersion(req.params.projectId, req.params.versionId));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:projectId/generate',
  requireCsrf,
  aiLimiter,
  requirePermission('content.generate'),
  requireProjectParam,
  validate(generateSchema),
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
  requireProjectParam,
  validate(generateSchema),
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

router.post(
  '/:projectId/versions/manual',
  requireCsrf,
  requirePermission('content.edit'),
  requireProjectParam,
  validate(manualVersionSchema),
  async (req, res, next) => {
    try {
      created(
        res,
        await aiService.createManualVersion(
          req.params.projectId,
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

router.post(
  '/:projectId/versions/edit',
  requireCsrf,
  requirePermission('content.edit'),
  requireProjectParam,
  validate(editVersionSchema),
  async (req, res, next) => {
    try {
      created(
        res,
        await aiService.createEditedVersion(
          req.params.projectId,
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
  requireProjectParam,
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

const confirmSectionSchema = z.object({
  section: z.enum(['scenario', 'narration', 'storyboard']),
  confirmed: z.boolean(),
});

router.post(
  '/:projectId/versions/:versionId/confirm-section',
  requireCsrf,
  requirePermission('content.approve'),
  requireProjectParam,
  validate(confirmSectionSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await aiService.confirmSection(
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

router.post(
  '/:projectId/versions/:versionId/release-for-production',
  requireCsrf,
  requirePermission('content.approve'),
  requireProjectParam,
  async (req, res, next) => {
    try {
      ok(
        res,
        await aiService.releaseForProduction(
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
  requireProjectParam,
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

router.get(
  '/:projectId/runs',
  requirePermission('content.view'),
  requireProjectParam,
  async (req, res, next) => {
    try {
      ok(res, await aiService.listRuns(req.params.projectId));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
