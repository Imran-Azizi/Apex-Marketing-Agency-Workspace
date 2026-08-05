import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { hashPassword, verifyPassword } from '../../utils/passwords.js';
import { hashToken, randomToken, signAccessToken, signRefreshToken, verifyRefreshToken, generateOtp } from '../../utils/tokens.js';
import { writeAudit } from '../../middleware/audit.js';
import { normalizeWhatsapp } from '../../utils/whatsappNormalize.js';
import { roleToPanel } from '../../config/cookies.js';
import bcrypt from 'bcryptjs';

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
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError('ایمیل یا رمز عبور نادرست است', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) throw new AppError('حساب غیرفعال است', 403, 'INACTIVE');

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

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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
        permissions: user.role.permissions.map((p) => p.permission.code),
      },
    };
  },

  async loginPortal({ whatsapp, password }, req) {
    const normalized = normalizeWhatsapp(whatsapp);
    const account = await prisma.portalAccount.findFirst({
      where: { normalizedWhatsapp: normalized, deletedAt: null },
      include: { crmCustomer: true },
    });
    if (!account?.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
      throw new AppError('شماره یا رمز عبور نادرست است', 401, 'INVALID_CREDENTIALS');
    }
    if (!account.isActive || account.crmCustomer?.deletedAt) {
      throw new AppError('حساب غیرفعال است', 403, 'INACTIVE');
    }

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

  async logout(sessionId) {
    if (!sessionId) return;
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async logoutAll(auth) {
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

  /** Spec §7.2 — Forgot Password with OTP + attempt limits */
  async requestPasswordReset({ whatsapp }, req) {
    const normalized = normalizeWhatsapp(whatsapp);
    const account = await prisma.portalAccount.findFirst({
      where: { normalizedWhatsapp: normalized, deletedAt: null, isActive: true },
    });
    // Always return generic success to avoid account enumeration
    if (!account) {
      return { message: 'در صورت وجود حساب، کد بازیابی ارسال می‌شود', expiresInMinutes: 15 };
    }

    const otp = generateOtp(6);
    const codeHash = await bcrypt.hash(otp, 10);
    await prisma.otpCode.create({
      data: {
        codeHash,
        portalAccountId: account.id,
        purpose: 'FORGOT_PASSWORD',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        maxAttempts: 5,
      },
    });

    await writeAudit({
      action: 'PORTAL_PASSWORD_RESET_REQUEST',
      entityType: 'PortalAccount',
      entityId: account.id,
      req,
    });

    return {
      message: 'کد بازیابی تولید شد. فروش باید آن را از واتساپ ارسال کند.',
      otpDev: process.env.NODE_ENV === 'production' ? undefined : otp,
      expiresInMinutes: 15,
    };
  },

  async resetPassword({ whatsapp, otp, password }, req) {
    if (!password || password.length < 8) {
      throw new AppError('رمز عبور حداقل ۸ کاراکتر باشد', 400, 'WEAK_PASSWORD');
    }
    const normalized = normalizeWhatsapp(whatsapp);
    const account = await prisma.portalAccount.findFirst({
      where: { normalizedWhatsapp: normalized, deletedAt: null },
    });
    if (!account) throw new AppError('حساب یافت نشد', 404, 'NOT_FOUND');

    const otpRow = await prisma.otpCode.findFirst({
      where: { portalAccountId: account.id, usedAt: null, purpose: 'FORGOT_PASSWORD' },
      orderBy: { createdAt: 'desc' },
    });
    if (!otpRow || otpRow.expiresAt < new Date()) {
      throw new AppError('کد OTP منقضی یا نامعتبر است', 400, 'OTP_INVALID');
    }
    if (otpRow.attempts >= otpRow.maxAttempts) {
      throw new AppError('حداکثر تلاش OTP', 429, 'OTP_MAX_ATTEMPTS');
    }

    const okOtp = await bcrypt.compare(otp, otpRow.codeHash);
    if (!okOtp) {
      await prisma.otpCode.update({ where: { id: otpRow.id }, data: { attempts: { increment: 1 } } });
      throw new AppError('کد OTP نادرست است', 400, 'OTP_INVALID');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.portalAccount.update({ where: { id: account.id }, data: { passwordHash } }),
      prisma.otpCode.update({ where: { id: otpRow.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({
        where: { portalAccountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await writeAudit({
      action: 'PORTAL_PASSWORD_RESET',
      entityType: 'PortalAccount',
      entityId: account.id,
      req,
    });

    return { reset: true };
  },
};

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const portalLoginSchema = z.object({
  whatsapp: z.string().min(8),
  password: z.string().min(6),
});

export const forgotPasswordSchema = z.object({
  whatsapp: z.string().min(8),
});

export const resetPasswordSchema = z.object({
  whatsapp: z.string().min(8),
  otp: z.string().length(6),
  password: z.string().min(8),
});

export { hashPassword };
