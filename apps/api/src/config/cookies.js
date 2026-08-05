import { env } from './env.js';
import { parseExpiresToMs } from '../utils/expiry.js';

/** Shared CSRF cookie (not identity-bearing). */
export const COOKIE = {
  csrf: 'apex_csrf',
  /** @deprecated Legacy single-session cookies — still read for migration. */
  access: 'apex_access',
  refresh: 'apex_refresh',
};

/**
 * Concurrent panel sessions (one browser can hold all of these at once).
 * Manager+Admin share the manager slot; portal is customer-only.
 */
export const AUTH_PANELS = Object.freeze([
  'manager',
  'editor',
  'sales',
  'narrator',
  'portal',
]);

export function isAuthPanel(value) {
  return AUTH_PANELS.includes(value);
}

/** Map JWT / DB role → cookie panel namespace. */
export function roleToPanel(role) {
  switch (String(role || '').toUpperCase()) {
    case 'ADMIN':
    case 'MANAGER':
    case 'FINANCE':
      return 'manager';
    case 'EDITOR':
      return 'editor';
    case 'SALES':
      return 'sales';
    case 'NARRATOR':
      return 'narrator';
    case 'CUSTOMER':
      return 'portal';
    default:
      return null;
  }
}

export function accessCookieName(panel) {
  return `apex_access_${panel}`;
}

export function refreshCookieName(panel) {
  return `apex_refresh_${panel}`;
}

export function panelMarkerCookieName(panel) {
  return `apex_has_${panel}`;
}

/**
 * Resolve which panel session this request should use.
 * Order: X-APEX-Panel header → ?panel= (media/video) → null (caller may fall back to legacy).
 */
export function resolveAuthPanel(req) {
  const header = String(req.get?.('X-APEX-Panel') || req.headers?.['x-apex-panel'] || '')
    .trim()
    .toLowerCase();
  if (isAuthPanel(header)) return header;

  const queryPanel = String(req.query?.panel || '')
    .trim()
    .toLowerCase();
  if (isAuthPanel(queryPanel)) return queryPanel;

  return null;
}

export function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: parseExpiresToMs(env.jwtAccessExpires),
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/api/v1/auth',
    maxAge: parseExpiresToMs(env.jwtRefreshExpires),
  };
}

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: parseExpiresToMs(env.jwtRefreshExpires),
  };
}

export function setPanelAuthCookies(res, tokens, panel) {
  if (!isAuthPanel(panel)) {
    throw new Error(`Invalid auth panel: ${panel}`);
  }
  res.cookie(accessCookieName(panel), tokens.accessToken, accessCookieOptions());
  res.cookie(refreshCookieName(panel), tokens.refreshToken, refreshCookieOptions());
  // Readable marker so the client can recover panel after a cold start on shared routes.
  res.cookie(panelMarkerCookieName(panel), '1', {
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: parseExpiresToMs(env.jwtRefreshExpires),
  });
}

/** Clear one panel’s cookies without touching other panels. */
export function clearPanelAuthCookies(res, panel) {
  if (!isAuthPanel(panel)) return;
  res.clearCookie(accessCookieName(panel), { path: '/' });
  res.clearCookie(refreshCookieName(panel), { path: '/api/v1/auth' });
  res.clearCookie(panelMarkerCookieName(panel), { path: '/' });
}

/** Clear legacy single-slot cookies (migration / safety). */
export function clearLegacyAuthCookies(res) {
  res.clearCookie(COOKIE.access, { path: '/' });
  res.clearCookie(COOKIE.refresh, { path: '/api/v1/auth' });
}

/**
 * Read access token for this request’s panel (or legacy cookie).
 * @returns {{ token: string, panel: string|null } | null}
 */
export function readAccessToken(req) {
  const panel = resolveAuthPanel(req);
  if (panel) {
    const token = req.cookies?.[accessCookieName(panel)];
    if (token) return { token, panel };
  }

  const legacy = req.cookies?.[COOKIE.access];
  if (legacy) return { token: legacy, panel: panel || null };

  return null;
}

/**
 * Read refresh token for this request’s panel (or legacy cookie).
 * @returns {{ token: string, panel: string|null } | null}
 */
export function readRefreshToken(req) {
  const panel = resolveAuthPanel(req);
  if (panel) {
    const token = req.cookies?.[refreshCookieName(panel)];
    if (token) return { token, panel };
  }

  const legacy = req.cookies?.[COOKIE.refresh];
  if (legacy) return { token: legacy, panel: panel || null };

  return null;
}
