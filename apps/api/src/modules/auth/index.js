import { Router } from 'express';
import { authController } from './controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { authLimiter, loginLimiter } from '../../middleware/rateLimit.js';

const router = Router();

router.get('/csrf', ...authController.csrf);
router.post('/login', loginLimiter, requireCsrf, ...authController.login);
router.post('/portal/login', loginLimiter, requireCsrf, ...authController.portalLogin);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', requireCsrf, authController.logout);
router.post('/logout-all', requireAuth, requireCsrf, authController.logoutAll);
router.get('/me', requireAuth, authController.me);

export default router;
