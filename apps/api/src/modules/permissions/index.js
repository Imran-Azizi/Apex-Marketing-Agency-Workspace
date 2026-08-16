import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok } from '../../utils/response.js';
import { permissionsService, updatePermissionsSchema } from './service.js';

const router = Router();
router.use(requireAuth, requireInternal, requirePermission('settings.permissions'));

router.get('/catalog', async (req, res, next) => {
  try {
    ok(res, permissionsService.getCatalog());
  } catch (e) {
    next(e);
  }
});

router.get('/employees', async (req, res, next) => {
  try {
    ok(res, await permissionsService.listEmployees(req.query || {}, req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/employees/:id', async (req, res, next) => {
  try {
    ok(res, await permissionsService.getEmployee(req.params.id, req.auth));
  } catch (e) {
    next(e);
  }
});

router.put(
  '/employees/:id',
  requireCsrf,
  validate(updatePermissionsSchema),
  async (req, res, next) => {
    try {
      ok(res, await permissionsService.updateEmployee(req.params.id, req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
