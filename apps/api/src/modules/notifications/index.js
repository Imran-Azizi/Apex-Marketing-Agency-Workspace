import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { ok } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';
import {
  recipientWhere,
  unseenWhere,
  parseViewedBefore,
} from '../../services/notifications.js';
import {
  NARRATION_NOTIFICATION_TYPES,
  serializeNarratorNotification,
} from '../narration/narratorView.js';

const router = Router();
router.use(requireAuth);

function serializeNotification(n, auth) {
  const meta = n.meta && typeof n.meta === 'object' ? n.meta : {};
  const isUnseen = !n.isRead;

  if (auth?.roleCode === 'NARRATOR') {
    if (!NARRATION_NOTIFICATION_TYPES.includes(meta.type)) {
      return null;
    }
    return {
      ...serializeNarratorNotification(n),
      isUnseen,
      link: meta.projectId ? `/narrator/tasks/${meta.projectId}` : null,
      meta: {
        type: meta.type || null,
        projectId: meta.projectId || null,
        projectCode: null,
        projectName: null,
        customerName: null,
        customerId: null,
        statusLabel: null,
        phone: null,
        eventKey: null,
      },
    };
  }

  return {
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    isRead: n.isRead,
    isUnseen,
    createdAt: n.createdAt,
    readAt: n.readAt,
    meta: {
      type: meta.type || null,
      projectId: meta.projectId || null,
      projectCode: meta.projectCode || null,
      projectName: meta.projectName || null,
      customerName: meta.customerName || null,
      customerId: meta.customerId || null,
      statusLabel: meta.statusLabel || null,
      phone: meta.phone || null,
      eventKey: meta.eventKey || null,
    },
  };
}

async function countUnseen(auth) {
  return prisma.notification.count({
    where: unseenWhere(auth),
  });
}

router.get('/', async (req, res, next) => {
  try {
    const where = recipientWhere(req.auth);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';

    const filter = unreadOnly ? unseenWhere(req.auth) : where;

    const [total, unseenCount, items] = await Promise.all([
      prisma.notification.count({ where }),
      countUnseen(req.auth),
      prisma.notification.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const serialized = items
      .map((n) => serializeNotification(n, req.auth))
      .filter(Boolean);

    ok(
      res,
      {
        items: serialized,
        page,
        pageSize,
        total: req.auth?.roleCode === 'NARRATOR' ? serialized.length : total,
        totalPages: Math.max(
          1,
          Math.ceil(
            (req.auth?.roleCode === 'NARRATOR' ? serialized.length : total) / pageSize,
          ),
        ),
        hasMore: page * pageSize < total,
      },
      { unreadCount: unseenCount, unseenCount, total },
    );
  } catch (e) { next(e); }
});

async function sendUnseenCount(req, res, next) {
  try {
    const unseenCount = await countUnseen(req.auth);
    ok(res, { unseenCount, unreadCount: unseenCount });
  } catch (e) { next(e); }
}

router.get('/unseen-count', sendUnseenCount);
router.get('/unread-count', sendUnseenCount);

router.patch('/:id/read', requireCsrf, async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...recipientWhere(req.auth) };
    const result = await prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });
    ok(res, { updated: result.count });
  } catch (e) { next(e); }
});

router.post('/read-all', requireCsrf, async (req, res, next) => {
  try {
    const viewedBefore = parseViewedBefore(req.body?.viewedBefore);
    const result = await prisma.notification.updateMany({
      where: unseenWhere(req.auth, viewedBefore),
      data: { isRead: true, readAt: new Date() },
    });
    ok(res, { updated: result.count });
  } catch (e) { next(e); }
});

router.delete('/read', requireCsrf, async (req, res, next) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: { ...recipientWhere(req.auth), isRead: true },
    });
    ok(res, { deleted: result.count });
  } catch (e) { next(e); }
});

export default router;
