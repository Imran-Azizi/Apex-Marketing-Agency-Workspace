import crypto from 'crypto';
import { COOKIE, csrfCookieOptions } from '../config/cookies.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/response.js';

function originAllowed(value) {
  if (!value) return false;
  try {
    const origin = new URL(value).origin;
    return env.corsOrigins.includes(origin);
  } catch {
    return env.corsOrigins.includes(String(value).replace(/\/$/, ''));
  }
}

export function issueCsrf(req, res, next) {
  let token = req.cookies?.[COOKIE.csrf];
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie(COOKIE.csrf, token, csrfCookieOptions());
  }
  req.csrfToken = token;
  next();
}

export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (env.nodeEnv === 'test') return next();

  const cookieToken = req.cookies?.[COOKIE.csrf];
  const headerToken = req.get('X-CSRF-Token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError('CSRF validation failed', 403, 'CSRF_FAILED'));
  }

  const origin = req.get('Origin');
  const referer = req.get('Referer');
  if (origin) {
    if (!originAllowed(origin)) {
      return next(new AppError('CSRF validation failed', 403, 'CSRF_FAILED'));
    }
  } else if (referer) {
    if (!originAllowed(referer)) {
      return next(new AppError('CSRF validation failed', 403, 'CSRF_FAILED'));
    }
  }

  next();
}
