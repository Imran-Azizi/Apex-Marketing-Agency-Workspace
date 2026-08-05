import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePortal } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { otpLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/response.js';
import { portalService, registerSchema, briefSchema } from './service.js';

const router = Router();

router.get('/invite/:token', async (req, res, next) => {
  try { ok(res, await portalService.getInvite(req.params.token)); } catch (e) { next(e); }
});

router.post('/invite/:token/request-otp', otpLimiter, requireCsrf, async (req, res, next) => {
  try { ok(res, await portalService.requestOtp(req.params.token)); } catch (e) { next(e); }
});

router.post('/invite/:token/register', otpLimiter, requireCsrf, validate(registerSchema), async (req, res, next) => {
  try { created(res, await portalService.register(req.params.token, req.body, req)); } catch (e) { next(e); }
});

router.use(requireAuth, requirePortal);

router.get('/dashboard', async (req, res, next) => {
  try { ok(res, await portalService.dashboard(req.auth)); } catch (e) { next(e); }
});

router.get('/pending-briefs', async (req, res, next) => {
  try { ok(res, await portalService.pendingBriefs(req.auth)); } catch (e) { next(e); }
});

router.get('/assets', async (req, res, next) => {
  try { ok(res, await portalService.listClientAssets(req.auth)); } catch (e) { next(e); }
});

router.post('/assets', requireCsrf, async (req, res, next) => {
  try { created(res, await portalService.createClientAsset(req.auth, req.body)); } catch (e) { next(e); }
});

router.delete('/assets/:id', requireCsrf, async (req, res, next) => {
  try { ok(res, await portalService.softDeleteClientAsset(req.auth, req.params.id)); } catch (e) { next(e); }
});

router.get('/projects', async (req, res, next) => {
  try { ok(res, await portalService.listProjects(req.auth, req.query)); } catch (e) { next(e); }
});

router.get('/projects/:id', async (req, res, next) => {
  try { ok(res, await portalService.getProject(req.params.id, req.auth)); } catch (e) { next(e); }
});

router.post('/brief', requireCsrf, validate(briefSchema), async (req, res, next) => {
  try { created(res, await portalService.submitBrief(null, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/content/:versionId/approve', requireCsrf, async (req, res, next) => {
  try { ok(res, await portalService.approveContent(req.params.versionId, req.auth, req)); } catch (e) { next(e); }
});

router.post('/content/:versionId/request-changes', requireCsrf, async (req, res, next) => {
  try { ok(res, await portalService.requestContentChanges(req.params.versionId, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/projects/:id/final/approve', requireCsrf, async (req, res, next) => {
  try { ok(res, await portalService.approveFinal(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.post('/projects/:id/final/request-changes', requireCsrf, async (req, res, next) => {
  try { ok(res, await portalService.requestFinalChanges(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/orders', requireCsrf, async (req, res, next) => {
  try { created(res, await portalService.newOrder(req.body, req.auth, req)); } catch (e) { next(e); }
});

router.get('/downloads/:projectId', async (req, res, next) => {
  try { ok(res, await portalService.getDownload(req.params.projectId, req.auth, req)); } catch (e) { next(e); }
});

router.get('/projects/:id/contact-manager', async (req, res, next) => {
  try { ok(res, await portalService.contactManager(req.params.id, req.auth)); } catch (e) { next(e); }
});

router.get('/profile', async (req, res, next) => {
  try { ok(res, await portalService.profile(req.auth)); } catch (e) { next(e); }
});

export default router;
