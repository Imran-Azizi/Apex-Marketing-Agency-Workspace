import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { ok } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';
import { parsePagination } from '../../utils/pagination.js';
import { SECURITY } from '../../config/security.js';

const router = Router();
router.use(requireAuth, requireInternal, requirePermission('audit.view'));

router.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.entityType) where.entityType = String(req.query.entityType).slice(0, 80);
    if (req.query.entityId) where.entityId = String(req.query.entityId).slice(0, 80);
    if (req.query.action) where.action = String(req.query.action).slice(0, 80);
    const { take } = parsePagination(req.query, {
      defaultPageSize: 50,
      maxPageSize: SECURITY.pagination.auditMax,
    });
    ok(res, await prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }));
  } catch (e) { next(e); }
});

export default router;
