import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { verifyPassword } from '../../utils/passwords.js';
import { hashToken, randomToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens.js';
import { writeAudit } from '../../middleware/audit.js';
import {
  assertLoginNotLocked,
  clearLoginFailures,
  loginAttemptKey,
  recordLoginFailure,
} from '../../middleware/loginGuard.js';
import { getWhatsappLookupKeys, parseInternationalPhone, WHATSAPP_VALIDATION_MESSAGE } from '../../utils/whatsappNormalize.js';
import { roleToPanel } from '../../config/cookies.js';
import { effectiveFromUser } from '../../services/permissions/effective.js';
import { SECURITY } from '../../config/security.js';
import { profileImageUrlFor } from '../../utils/profileImageUrl.js';

function parseExpiryToDate(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn || '7d');
  const n = match ? Number(match[1]) : 7;
  const unit = match ? match[2] : 'd';
  const ms = unit === 's' ? n * 1000 : unit === 'm' ? n * 60_000 : unit === 'h' ? n * 3_600_000 : n * 86_400_000;
  return new Date(Date.now() + ms);
}

async function createSession({ audience, userId, portalAccountId, refreshToken, req }) {
  return prisma.session.create({
    data: {
      audience,
      userId: userId || null,
      portalAccountId: portalAccountId || null,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: req.get('user-agent') || null,
      ipAddress: req.ip || null,
      expiresAt: parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES || '7d'),
    },
  });
}

function buildTokens({ sub, aud, role, sessionId }) {
  const accessToken = signAccessToken({ sub, aud, role, sid: sessionId });
  const refreshToken = signRefreshToken({ sub, aud, sid: sessionId });
  return { accessToken, refreshToken };
}

export const authService = {
  async loginInternal({ email, password }, req) {
    const identity = String(email || '').toLowerCase();
    const attemptKey = loginAttemptKey({ identity, ip: req.ip });
    assertLoginNotLocked(attemptKey);

    const user = await prisma.user.findFirst({
      where: { email: identity, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordLoginFailure(attemptKey);
      await writeAudit({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user?.id || null,
        after: { audience: 'INTERNAL' },
        req,
      });
      throw new AppError('ایمیل یا رمز عبور نادرست است', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) throw new AppError('حساب غیرفعال است', 403, 'INACTIVE');
    clearLoginFailures(attemptKey);

    const refreshToken = randomToken();
    const session = await createSession({
      audience: 'INTERNAL',
      userId: user.id,
      refreshToken,
      req,
    });
    // Re-sign with session id
    const tokens = buildTokens({
      sub: user.id,
      aud: 'INTERNAL',
      role: user.role.code,
      sessionId: session.id,
    });
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: hashToken(tokens.refreshToken) },
    });

    const loginUpdate = { lastLoginAt: new Date() };
    await prisma.user.update({
      where: { id: user.id },
      data: loginUpdate,
    });

    await writeAudit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      req,
    });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.code,
        profileImage: user.profileImage || null,
        profileImageUrl: profileImageUrlFor(user.profileImage),
        permissions: effectiveFromUser(user),
      },
    };
  },

  async loginPortal({ whatsapp, password }, req) {
    const attemptKey = loginAttemptKey({ identity: `portal:${whatsapp}`, ip: req.ip });
    assertLoginNotLocked(attemptKey);

    const lookupKeys = getWhatsappLookupKeys(whatsapp);
    const account = await prisma.portalAccount.findFirst({
      where: { normalizedWhatsapp: { in: lookupKeys }, deletedAt: null },
      include: { crmCustomer: true },
    });
    if (!account?.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
      recordLoginFailure(attemptKey);
      await writeAudit({
        action: 'LOGIN_FAILED',
        entityType: 'PortalAccount',
        entityId: account?.id || null,
        after: { audience: 'PORTAL' },
        req,
      });
      throw new AppError('شماره یا رمز عبور نادرست است', 401, 'INVALID_CREDENTIALS');
    }
    if (!account.isActive || account.crmCustomer?.deletedAt) {
      throw new AppError('حساب غیرفعال است', 403, 'INACTIVE');
    }
    clearLoginFailures(attemptKey);

    const session = await createSession({
      audience: 'PORTAL',
      portalAccountId: account.id,
      refreshToken: randomToken(),
      req,
    });
    const tokens = buildTokens({
      sub: account.id,
      aud: 'PORTAL',
      role: 'CUSTOMER',
      sessionId: session.id,
    });
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: hashToken(tokens.refreshToken) },
    });

    await writeAudit({
      action: 'LOGIN',
      entityType: 'PortalAccount',
      entityId: account.id,
      after: { audience: 'PORTAL' },
      req,
    });

    return {
      tokens,
      account: {
        id: account.id,
        customerId: account.crmCustomerId,
        whatsapp: account.normalizedWhatsapp,
        companyName: account.crmCustomer.companyName,
        personName: account.crmCustomer.personName,
      },
    };
  },

  async refresh(refreshToken, req, { requestedPanel } = {}) {
    if (!refreshToken) throw new AppError('Refresh token required', 401, 'UNAUTHENTICATED');
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
    }

    const session = await prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new AppError('Session revoked or expired', 401, 'SESSION_INVALID');
    }
    if (session.refreshTokenHash !== hashToken(refreshToken)) {
      const rotatedRecently =
        session.updatedAt &&
        Date.now() - new Date(session.updatedAt).getTime() < 15_000;
      if (rotatedRecently) {
        throw new AppError(
          'Refresh token was already rotated',
          401,
          'TOKEN_ROTATED',
        );
      }
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new AppError('Refresh token reuse detected', 401, 'TOKEN_REUSE');
    }

    let role = payload.aud === 'PORTAL' ? 'CUSTOMER' : payload.role;
    if (payload.aud === 'INTERNAL' && !role) {
      const user = await prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        include: { role: true },
      });
      if (!user?.isActive) throw new AppError('User not found', 401, 'UNAUTHENTICATED');
      role = user.role.code;
    }

    const panel = roleToPanel(role);
    if (!panel) throw new AppError('Unsupported role', 401, 'TOKEN_INVALID');
    if (requestedPanel && requestedPanel !== panel) {
      throw new AppError('نشست با این پنل هم‌خوانی ندارد', 401, 'PANEL_MISMATCH');
    }

    const tokens = buildTokens({
      sub: payload.sub,
      aud: payload.aud,
      role,
      sessionId: session.id,
    });

    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES || '7d'),
      },
    });

    return { tokens, panel };
  },

  async logout(sessionId, req) {
    if (!sessionId) return;
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      action: 'LOGOUT',
      entityType: 'Session',
      entityId: sessionId,
      req,
    });
  },

  async logoutAll(auth, req) {
    if (auth.audience === 'INTERNAL') {
      await prisma.session.updateMany({
        where: { userId: auth.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.session.updateMany({
        where: { portalAccountId: auth.portalAccountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await writeAudit({
      userId: auth.userId || null,
      action: 'LOGOUT_ALL',
      entityType: auth.audience === 'INTERNAL' ? 'User' : 'PortalAccount',
      entityId: auth.userId || auth.portalAccountId || null,
      req,
    });
  },

  async me(auth) {
    if (auth.audience === 'INTERNAL') {
      return {
        audience: 'INTERNAL',
        id: auth.user.id,
        email: auth.user.email,
        fullName: auth.user.fullName,
        role: auth.roleCode,
        profileImage: auth.user.profileImage || null,
        profileImageUrl: profileImageUrlFor(auth.user.profileImage),
        permissions: auth.permissions,
      };
    }
    return {
      audience: 'PORTAL',
      id: auth.portalAccountId,
      customerId: auth.customerId,
      whatsapp: auth.portalAccount.normalizedWhatsapp,
      personName: auth.portalAccount.crmCustomer.personName,
      companyName: auth.portalAccount.crmCustomer.companyName,
      role: 'CUSTOMER',
      permissions: auth.permissions,
    };
  },
};

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(SECURITY.password.loginMinLength).max(SECURITY.password.maxLength),
});

const whatsappFieldSchema = z
  .string()
  .min(1, WHATSAPP_VALIDATION_MESSAGE)
  .refine((value) => {
    try {
      parseInternationalPhone(value);
      return true;
    } catch {
      return false;
    }
  }, WHATSAPP_VALIDATION_MESSAGE);

export const portalLoginSchema = z.object({
  whatsapp: whatsappFieldSchema,
  password: z.string().min(SECURITY.password.loginMinLength).max(SECURITY.password.maxLength),
});

export { hashPassword } from '../../utils/passwords.js';
