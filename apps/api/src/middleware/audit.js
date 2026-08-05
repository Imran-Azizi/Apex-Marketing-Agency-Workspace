import { prisma } from '../db/prisma.js';

export async function writeAudit({ userId, action, entityType, entityId, before, after, req }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entityType,
        entityId: entityId || null,
        before: before ?? undefined,
        after: after ?? undefined,
        ipAddress: req?.ip || null,
        userAgent: req?.get?.('user-agent') || null,
      },
    });
  } catch (err) {
    console.error('[audit]', err.message);
  }
}

export function auditAction(action, entityType, getEntity) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body?.success) {
        const entity = getEntity ? getEntity(req, body) : { id: req.params.id };
        writeAudit({
          userId: req.auth?.userId,
          action,
          entityType,
          entityId: entity?.id,
          after: body.data,
          req,
        });
      }
      return originalJson(body);
    };
    next();
  };
}
