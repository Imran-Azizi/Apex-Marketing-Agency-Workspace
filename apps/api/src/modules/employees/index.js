import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/response.js';
import {
  employeesService,
  createEmployeeSchema,
  updateEmployeeSchema,
  resetPasswordSchema,
} from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/', requirePermission('employees.view'), async (req, res, next) => {
  try {
    ok(
      res,
      await employeesService.list({
        q: req.query.q,
        role: req.query.role,
        status: req.query.status,
        page: Number(req.query.page || 1),
        pageSize: Number(req.query.pageSize || 20),
      }),
      { page: Number(req.query.page || 1) },
    );
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requirePermission('employees.view'), async (req, res, next) => {
  try {
    ok(res, await employeesService.getById(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/',
  requireCsrf,
  requirePermission('employees.create'),
  validate(createEmployeeSchema),
  async (req, res, next) => {
    try {
      created(res, await employeesService.create(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/:id',
  requireCsrf,
  requirePermission('employees.edit'),
  validate(updateEmployeeSchema),
  async (req, res, next) => {
    try {
      ok(res, await employeesService.update(req.params.id, req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/:id/status',
  requireCsrf,
  requirePermission('employees.disable'),
  validate(z.object({ isActive: z.boolean() })),
  async (req, res, next) => {
    try {
      ok(res, await employeesService.setActive(req.params.id, req.body.isActive, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/reset-password',
  requireCsrf,
  requirePermission('employees.edit'),
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      ok(res, await employeesService.resetPassword(req.params.id, req.body.password, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.delete('/:id', requireCsrf, requirePermission('employees.delete'), async (req, res, next) => {
  try {
    ok(res, await employeesService.softDelete(req.params.id, req.auth, req));
  } catch (e) {
    next(e);
  }
});

export default router;
