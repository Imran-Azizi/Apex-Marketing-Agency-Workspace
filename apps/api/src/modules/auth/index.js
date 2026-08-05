import { Router } from 'express';
import { authController } from './controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { authLimiter } from '../../middleware/rateLimit.js';

const router = Router();

router.get('/csrf', ...authController.csrf);
router.post('/login', authLimiter, requireCsrf, ...authController.login);
router.post('/portal/login', authLimiter, requireCsrf, ...authController.portalLogin);
router.post('/portal/forgot-password', authLimiter, requireCsrf, ...authController.forgotPassword);
router.post('/portal/reset-password', authLimiter, requireCsrf, ...authController.resetPassword);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', requireAuth, requireCsrf, authController.logoutAll);
router.get('/me', requireAuth, authController.me);

export default router;
