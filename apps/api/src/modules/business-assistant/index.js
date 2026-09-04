import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission, requireInternal } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok } from '../../utils/response.js';
import { businessAssistantService, chatSchema } from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

const canView = requirePermission('business_assistant.view', 'dashboard.view');
const canAct = requirePermission('business_assistant.act', 'business_assistant.manage');
const canManage = requirePermission('business_assistant.manage', 'settings.edit');

router.get('/briefing', canView, async (req, res, next) => {
  try {
    ok(res, await businessAssistantService.getBriefing(req.auth));
  } catch (e) {
    next(e);
  }
});

router.get('/chat/messages', canView, async (req, res, next) => {
  try {
    ok(res, await businessAssistantService.getChatMessages(req.auth));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/chat/messages',
  requireCsrf,
  canAct,
  validate(chatSchema),
  async (req, res, next) => {
    try {
      ok(res, await businessAssistantService.sendChatMessage(req.body, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.delete('/chat/messages', requireCsrf, canManage, async (req, res, next) => {
  try {
    ok(res, await businessAssistantService.clearChat(req.auth));
  } catch (e) {
    next(e);
  }
});

export default router;
