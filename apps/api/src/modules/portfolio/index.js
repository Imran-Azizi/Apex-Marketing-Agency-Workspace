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
  streamPortfolioVideo,
} from './service.js';
import {
  showcaseMethods,
  createPortfolioItemSchema,
  createCategorySchema,
  updateCategorySchema,
  mixedSelectionSchema,
  reorderPortfolioSchema,
} from './showcase.js';

Object.assign(portfolioService, showcaseMethods);

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/', requirePermission('portfolio.view'), async (req, res, next) => {
  try {
    ok(res, await portfolioService.listAdmin(req.query || {}));
  } catch (e) {
    next(e);
  }
});

router.get('/stats', requirePermission('portfolio.view'), async (req, res, next) => {
  try {
    ok(res, await portfolioService.getStats());
  } catch (e) {
    next(e);
  }
});

router.get(
  '/categories',
  requirePermission('portfolio.view'),
  async (req, res, next) => {
    try {
      ok(res, await portfolioService.listCategoriesAdmin());
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/categories',
  requireCsrf,
  requirePermission('portfolio.edit'),
  validate(createCategorySchema),
  async (req, res, next) => {
    try {
      created(res, await portfolioService.createCategory(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/categories/:id',
  requireCsrf,
  requirePermission('portfolio.edit'),
  validate(updateCategorySchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await portfolioService.updateCategory(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get('/mixed', requirePermission('portfolio.view'), async (req, res, next) => {
  try {
    ok(res, await portfolioService.listMixedAdmin());
  } catch (e) {
    next(e);
  }
});

router.put(
  '/mixed',
  requireCsrf,
  requirePermission('portfolio.edit'),
  validate(mixedSelectionSchema),
  async (req, res, next) => {
    try {
      ok(res, await portfolioService.setMixed(req.body.orderedIds, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/reorder',
  requireCsrf,
  requirePermission('portfolio.edit'),
  validate(reorderPortfolioSchema),
  async (req, res, next) => {
    try {
      ok(res, await portfolioService.reorderPortfolio(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

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

router.post(
  '/',
  requireCsrf,
  requirePermission('portfolio.publish'),
  validate(createPortfolioItemSchema),
  async (req, res, next) => {
    try {
      created(res, await portfolioService.createItem(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/:id/stream',
  requirePermission('portfolio.view'),
  async (req, res, next) => {
    try {
      const file = await portfolioService.getStreamTarget(req.params.id, {
        publishedOnly: false,
      });
      await streamPortfolioVideo(req, res, file);
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
