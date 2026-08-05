import {
  readAccessToken,
  resolveAuthPanel,
  roleToPanel,
} from '../config/cookies.js';
import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/response.js';
import { verifyAccessToken } from '../utils/tokens.js';

function assertPanelMatchesRole(panel, roleCode, audience) {
  if (!panel) return;
  const expected =
    audience === 'PORTAL' ? 'portal' : roleToPanel(roleCode);
  if (expected && panel !== expected) {
    throw new AppError('نشست با این پنل هم‌خوانی ندارد', 401, 'PANEL_MISMATCH');
  }
}

export async function requireAuth(req, res, next) {
  try {
    const read = readAccessToken(req);
    if (!read?.token) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }

    let payload;
    try {
      payload = verifyAccessToken(read.token);
    } catch {
      throw new AppError('Invalid or expired access token', 401, 'TOKEN_INVALID');
    }

    const panel = read.panel || resolveAuthPanel(req);

    if (payload.aud === 'INTERNAL') {
      const user = await prisma.user.findFirst({
        where: { id: payload.sub, isActive: true, deletedAt: null },
        select: {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
          roleId: true,
          role: {
            select: {
              code: true,
              permissions: {
                select: { permission: { select: { code: true } } },
              },
            },
          },
        },
      });
      if (!user) throw new AppError('User not found', 401, 'UNAUTHENTICATED');

      assertPanelMatchesRole(panel, user.role.code, 'INTERNAL');

      req.auth = {
        audience: 'INTERNAL',
        userId: user.id,
        roleCode: user.role.code,
        panel: panel || roleToPanel(user.role.code),
        permissions: user.role.permissions.map((p) => p.permission.code),
        user,
      };
    } else if (payload.aud === 'PORTAL') {
      const account = await prisma.portalAccount.findFirst({
        where: { id: payload.sub, isActive: true, deletedAt: null },
        select: {
          id: true,
          crmCustomerId: true,
          isActive: true,
          crmCustomer: {
            select: {
              id: true,
              deletedAt: true,
              personName: true,
              companyName: true,
            },
          },
        },
      });
      if (!account || account.crmCustomer?.deletedAt) {
        throw new AppError('Portal account not found', 401, 'UNAUTHENTICATED');
      }

      assertPanelMatchesRole(panel, 'CUSTOMER', 'PORTAL');

      req.auth = {
        audience: 'PORTAL',
        portalAccountId: account.id,
        customerId: account.crmCustomerId,
        roleCode: 'CUSTOMER',
        panel: 'portal',
        permissions: [
          'portal:own',
          'content:approve_client',
          'finance:read',
          'download:clean',
          'notification:read',
          'dashboard:view',
        ],
        portalAccount: account,
      };
    } else {
      throw new AppError('Invalid token audience', 401, 'TOKEN_INVALID');
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req, res, next) {
  const read = readAccessToken(req);
  if (!read?.token) return next();
  return requireAuth(req, res, next);
}
