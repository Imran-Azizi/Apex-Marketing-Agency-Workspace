import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { parsePagination } from '../../utils/pagination.js';
import { ok, created } from '../../utils/response.js';
import {
  tasksService,
  createTaskSchema,
  updateTaskSchema,
  noteSchema,
  issueSchema,
  rejectSchema,
} from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/stats', requirePermission('tasks.view'), async (req, res, next) => {
  try {
    ok(res, await tasksService.stats(req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/assignees', requirePermission('tasks.create', 'tasks.edit', 'tasks.manage'), async (req, res, next) => {
  try {
    ok(res, await tasksService.listAssignees(req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/', requirePermission('tasks.view'), async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req.query, { defaultPageSize: 20 });
    ok(
      res,
      await tasksService.list(req.auth, {
        q: req.query.q,
        status: req.query.status,
        priority: req.query.priority,
        assigneeId: req.query.assigneeId,
        overdue: req.query.overdue,
        mine: req.query.mine,
        sort: req.query.sort,
        order: req.query.order,
        page,
        pageSize,
      }),
      { page },
    );
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requirePermission('tasks.view'), async (req, res, next) => {
  try {
    ok(res, await tasksService.getById(req.auth, req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/',
  requireCsrf,
  requirePermission('tasks.create'),
  validate(createTaskSchema),
  async (req, res, next) => {
    try {
      created(res, await tasksService.create(req.auth, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/:id',
  requireCsrf,
  requirePermission('tasks.edit', 'tasks.create'),
  validate(updateTaskSchema),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.update(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/accept',
  requireCsrf,
  requirePermission('tasks.view'),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.accept(req.auth, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/decline',
  requireCsrf,
  requirePermission('tasks.view'),
  validate(noteSchema),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.decline(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/start',
  requireCsrf,
  requirePermission('tasks.view'),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.start(req.auth, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/complete',
  requireCsrf,
  requirePermission('tasks.view'),
  validate(noteSchema),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.complete(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/report-issue',
  requireCsrf,
  requirePermission('tasks.view'),
  validate(issueSchema),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.reportIssue(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/approve',
  requireCsrf,
  requirePermission('tasks.manage'),
  validate(noteSchema),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.approve(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/reject-completion',
  requireCsrf,
  requirePermission('tasks.manage'),
  validate(rejectSchema),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.rejectCompletion(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/cancel',
  requireCsrf,
  requirePermission('tasks.edit', 'tasks.manage'),
  validate(noteSchema),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.cancel(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/:id',
  requireCsrf,
  requirePermission('tasks.delete'),
  async (req, res, next) => {
    try {
      ok(res, await tasksService.softDelete(req.auth, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
