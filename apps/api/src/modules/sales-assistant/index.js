import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission, requireInternal } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok } from '../../utils/response.js';
import { salesAssistantService, patchRecSchema } from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

const canView = requirePermission('sales_assistant.view', 'crm.view');

router.get('/inbox', canView, async (req, res, next) => {
  try {
    ok(res, await salesAssistantService.getInbox(req.query, req.auth));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/run',
  requireCsrf,
  requirePermission('sales_assistant.act', 'sales_assistant.manage', 'crm.edit'),
  async (req, res, next) => {
    try {
      ok(res, await salesAssistantService.runNow(req.body || {}, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get('/recommendations/:id', canView, async (req, res, next) => {
  try {
    ok(res, await salesAssistantService.getRecommendation(req.params.id, req.auth));
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/recommendations/:id',
  requireCsrf,
  requirePermission('sales_assistant.act', 'crm.edit'),
  validate(patchRecSchema),
  async (req, res, next) => {
    try {
      ok(res, await salesAssistantService.patchRecommendation(
        req.params.id,
        req.body,
        req.auth,
        req,
      ));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
