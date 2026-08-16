import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { ok } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';

const router = Router();
router.use(requireAuth, requireInternal, requirePermission('audit.view'));

router.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.entityId) where.entityId = req.query.entityId;
    if (req.query.action) where.action = req.query.action;
    ok(res, await prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(req.query.limit || 100),
    }));
  } catch (e) { next(e); }
});

export default router;
