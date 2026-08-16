import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { ok } from '../../utils/response.js';
import { narrationService } from './service.js';

const router = Router();

router.use(requireAuth, requireInternal);

router.get('/narrators', requirePermission('projects.assign'), async (req, res, next) => {
  try {
    ok(res, await narrationService.listAvailableNarrators());
  } catch (e) {
    next(e);
  }
});

router.get('/my-tasks', requirePermission('narration.view'), async (req, res, next) => {
  try {
    ok(res, await narrationService.listMyTasks(req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/dashboard', requirePermission('narration.view'), async (req, res, next) => {
  try {
    ok(res, await narrationService.getNarratorDashboard(req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/projects', requirePermission('narration.view'), async (req, res, next) => {
  try {
    ok(res, await narrationService.listNarratorProjects(req.auth, req.query || {}));
  } catch (e) {
    next(e);
  }
});

router.get(
  '/workspace/:projectId',
  requirePermission('narration.view'),
  async (req, res, next) => {
    try {
      ok(res, await narrationService.getNarratorWorkspace(req.params.projectId, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/projects/:projectId',
  requirePermission('projects.view', 'projects.assign', 'narration.approve', 'narration.edit'),
  async (req, res, next) => {
    try {
      ok(res, await narrationService.getProjectTask(req.params.projectId, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/assign',
  requireCsrf,
  requirePermission('projects.assign'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await narrationService.assignNarrator(
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

router.patch(
  '/projects/:projectId/deadline',
  requireCsrf,
  requirePermission('narration.edit'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await narrationService.updateDeadline(
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
  '/projects/:projectId/start',
  requireCsrf,
  requirePermission('narration.upload'),
  async (req, res, next) => {
    try {
      ok(res, await narrationService.markInProgress(req.params.projectId, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/submit',
  requireCsrf,
  requirePermission('narration.upload'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await narrationService.submitAudio(
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
  '/projects/:projectId/accept',
  requireCsrf,
  requirePermission('narration.approve'),
  async (req, res, next) => {
    try {
      ok(res, await narrationService.acceptNarration(req.params.projectId, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/projects/:projectId/request-revision',
  requireCsrf,
  requirePermission('narration.revise'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await narrationService.requestRevision(
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

export default router;
