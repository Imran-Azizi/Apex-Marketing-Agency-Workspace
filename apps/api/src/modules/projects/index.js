import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission, requireRoles, denyRoles } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { ok } from '../../utils/response.js';
import { projectService } from './service.js';

const router = Router();
router.use(requireAuth, requireInternal, denyRoles('NARRATOR'));

router.get('/dashboard-summary', requirePermission('dashboard:view'), async (req, res, next) => {
  try { ok(res, await projectService.dashboard(req.auth)); } catch (e) { next(e); }
});

router.get('/', requirePermission('project:read'), async (req, res, next) => {
  try { ok(res, await projectService.list(req.auth, req.query)); } catch (e) { next(e); }
});

router.get('/:id', requirePermission('project:read'), async (req, res, next) => {
  try { ok(res, await projectService.get(req.params.id, req.auth)); } catch (e) { next(e); }
});


router.post('/:id/content/generate', requireCsrf, requirePermission('content:generate'), async (req, res, next) => {
  try { ok(res, await projectService.generateContent(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.post('/:id/content/:versionId/approve-for-client', requireCsrf, requirePermission('content:approve_internal'), async (req, res, next) => {
  try { ok(res, await projectService.approveContentForClient(req.params.id, req.params.versionId, req.auth, req)); } catch (e) { next(e); }
});

router.post('/:id/extra-revision', requireCsrf, requirePermission('project:start'), async (req, res, next) => {
  try { ok(res, await projectService.enableExtraRevision(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/:id/voice/upload', requireCsrf, requirePermission('voice:upload'), async (req, res, next) => {
  try { ok(res, await projectService.uploadVoice(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/:id/voice/accept', requireCsrf, requirePermission('narration:assign'), async (req, res, next) => {
  try { ok(res, await projectService.acceptVoice(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.post('/:id/voice/return', requireCsrf, requirePermission('narration:assign'), async (req, res, next) => {
  try { ok(res, await projectService.returnVoice(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/:id/production/submit', requireCsrf, requirePermission('production:submit'), async (req, res, next) => {
  try { ok(res, await projectService.submitProduction(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/:id/final/review', requireCsrf, requirePermission('content:approve_internal'), async (req, res, next) => {
  try { ok(res, await projectService.runQcAndApproveFinal(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.delete('/:id', requireCsrf, requireRoles('MANAGER', 'ADMIN'), async (req, res, next) => {
  try { ok(res, await projectService.softDelete(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

export default router;
