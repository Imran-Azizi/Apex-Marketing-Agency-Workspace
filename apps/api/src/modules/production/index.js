import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { ok } from '../../utils/response.js';
import { productionService } from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/editors', requirePermission('project:start'), async (req, res, next) => {
  try {
    ok(res, await productionService.listAvailableEditors());
  } catch (e) {
    next(e);
  }
});

router.get('/my-tasks', requirePermission('production:upload'), async (req, res, next) => {
  try {
    ok(res, await productionService.listMyTasks(req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/dashboard', requirePermission('production:upload'), async (req, res, next) => {
  try {
    ok(res, await productionService.getEditorDashboard(req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/projects', requirePermission('production:upload'), async (req, res, next) => {
  try {
    ok(res, await productionService.listEditorProjects(req.auth, req.query || {}));
  } catch (e) {
    next(e);
  }
});

router.get('/projects/:projectId', requirePermission('project:read'), async (req, res, next) => {
  try {
    ok(res, await productionService.getProjectTask(req.params.projectId, req.auth));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/projects/:projectId/assign',
  requireCsrf,
  requirePermission('project:start'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.assignEditor(req.params.projectId, req.body || {}, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/projects/:projectId/deadline',
  requireCsrf,
  requirePermission('project:start'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.updateDeadline(req.params.projectId, req.body || {}, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/start',
  requireCsrf,
  requirePermission('production:upload'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.markInProgress(req.params.projectId, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/submit',
  requireCsrf,
  requirePermission('production:submit'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.submitProduction(req.params.projectId, req.body || {}, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/manager-review',
  requireCsrf,
  requirePermission('content:approve_internal'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.managerReview(req.params.projectId, req.body || {}, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/projects/:projectId/final-products',
  requirePermission('project:read'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.listFinalProducts(req.params.projectId, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/final-products/upload',
  requireCsrf,
  requirePermission('production:submit'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.uploadFinalVideo(req.params.projectId, req.body || {}, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/final-products/send',
  requireCsrf,
  requirePermission('content:approve_internal'),
  async (req, res, next) => {
    try {
      ok(res, await productionService.sendFinalVideos(req.params.projectId, req.body || {}, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
