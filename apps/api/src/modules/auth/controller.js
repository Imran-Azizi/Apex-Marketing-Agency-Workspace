import {
  COOKIE,
  csrfCookieOptions,
  setPanelAuthCookies,
  clearPanelAuthCookies,
  clearLegacyAuthCookies,
  readAccessToken,
  readRefreshToken,
  resolveAuthPanel,
  roleToPanel,
  isAuthPanel,
} from '../../config/cookies.js';
import { ok, AppError } from '../../utils/response.js';
import { validate } from '../../middleware/validate.js';
import { issueCsrf } from '../../middleware/csrf.js';
import {
  authService,
  loginSchema,
  portalLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './service.js';
import { verifyAccessToken } from '../../utils/tokens.js';
import crypto from 'crypto';

function bindPanelCookies(res, tokens, panel) {
  setPanelAuthCookies(res, tokens, panel);
  // Drop legacy single-slot cookies so they cannot override multi-panel sessions.
  clearLegacyAuthCookies(res);
}

export const authController = {
  csrf: [
    issueCsrf,
    (req, res) => {
      const token = req.csrfToken || crypto.randomBytes(24).toString('hex');
      res.cookie(COOKIE.csrf, token, csrfCookieOptions());
      return ok(res, { csrfToken: token });
    },
  ],

  login: [
    validate(loginSchema),
    async (req, res, next) => {
      try {
        const result = await authService.loginInternal(req.body, req);
        const panel = roleToPanel(result.user.role);
        if (!panel) {
          throw new AppError(`نقش پشتیبانی نمی‌شود: ${result.user.role}`, 400, 'UNSUPPORTED_ROLE');
        }
        bindPanelCookies(res, result.tokens, panel);
        return ok(res, { user: result.user, panel });
      } catch (err) {
        next(err);
      }
    },
  ],

  portalLogin: [
    validate(portalLoginSchema),
    async (req, res, next) => {
      try {
        const result = await authService.loginPortal(req.body, req);
        bindPanelCookies(res, result.tokens, 'portal');
        return ok(res, { account: result.account, panel: 'portal' });
      } catch (err) {
        next(err);
      }
    },
  ],

  forgotPassword: [
    validate(forgotPasswordSchema),
    async (req, res, next) => {
      try {
        return ok(res, await authService.requestPasswordReset(req.body, req));
      } catch (err) {
        next(err);
      }
    },
  ],

  resetPassword: [
    validate(resetPasswordSchema),
    async (req, res, next) => {
      try {
        return ok(res, await authService.resetPassword(req.body, req));
      } catch (err) {
        next(err);
      }
    },
  ],

  refresh: async (req, res, next) => {
    const requestedPanel = resolveAuthPanel(req);
    try {
      const read = readRefreshToken(req);
      if (!read?.token) {
        throw new AppError('Refresh token required', 401, 'UNAUTHENTICATED');
      }

      const { tokens, panel } = await authService.refresh(read.token, req, {
        requestedPanel: requestedPanel || read.panel,
      });

      bindPanelCookies(res, tokens, panel);
      return ok(res, { refreshed: true, panel });
    } catch (err) {
      if (requestedPanel && isAuthPanel(requestedPanel)) {
        clearPanelAuthCookies(res, requestedPanel);
      }
      clearLegacyAuthCookies(res);
      next(err);
    }
  },

  logout: async (req, res, next) => {
    try {
      const panel = resolveAuthPanel(req);
      let sessionId = null;
      try {
        const read = readAccessToken(req);
        if (read?.token) {
          const payload = verifyAccessToken(read.token);
          sessionId = payload.sid;
        }
      } catch {
        /* ignore */
      }
      await authService.logout(sessionId);
      if (panel) clearPanelAuthCookies(res, panel);
      else {
        // No panel hint — clear legacy only (avoid wiping every concurrent panel).
        clearLegacyAuthCookies(res);
      }
      return ok(res, { loggedOut: true, panel: panel || null });
    } catch (err) {
      next(err);
    }
  },

  logoutAll: async (req, res, next) => {
    try {
      await authService.logoutAll(req.auth);
      const panel = req.auth?.panel || resolveAuthPanel(req) || roleToPanel(req.auth?.roleCode);
      if (panel) clearPanelAuthCookies(res, panel);
      clearLegacyAuthCookies(res);
      return ok(res, { loggedOutAll: true });
    } catch (err) {
      next(err);
    }
  },

  me: async (req, res, next) => {
    try {
      const data = await authService.me(req.auth);
      return ok(res, { ...data, panel: req.auth.panel || null });
    } catch (err) {
      next(err);
    }
  },
};
