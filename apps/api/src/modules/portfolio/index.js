import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/response.js';
import {
  portfolioService,
  publishPortfolioSchema,
  updatePortfolioSchema,
} from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/', requirePermission('portfolio.view'), async (req, res, next) => {
  try {
    ok(res, await portfolioService.listAdmin(req.query || {}));
  } catch (e) {
    next(e);
  }
});

router.get(
  '/projects/:projectId',
  requirePermission('portfolio.view'),
  async (req, res, next) => {
    try {
      ok(res, await portfolioService.getProjectPortfolioState(req.params.projectId));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/generate',
  requireCsrf,
  requirePermission('portfolio.publish'),
  async (req, res, next) => {
    try {
      ok(res, await portfolioService.generateCopy(req.params.projectId));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/publish',
  requireCsrf,
  requirePermission('portfolio.publish'),
  validate(publishPortfolioSchema),
  async (req, res, next) => {
    try {
      const item = await portfolioService.publishFromProject(
        req.params.projectId,
        req.body,
        req.auth,
        req,
      );
      created(res, item);
    } catch (e) {
      next(e);
    }
  },
);

router.get('/:id', requirePermission('portfolio.view'), async (req, res, next) => {
  try {
    ok(res, await portfolioService.getAdmin(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/:id',
  requireCsrf,
  requirePermission('portfolio.edit'),
  validate(updatePortfolioSchema),
  async (req, res, next) => {
    try {
      ok(res, await portfolioService.update(req.params.id, req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/:id',
  requireCsrf,
  requirePermission('portfolio.delete'),
  async (req, res, next) => {
    try {
      ok(res, await portfolioService.remove(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
