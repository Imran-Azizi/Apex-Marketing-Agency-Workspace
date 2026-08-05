import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { ok, created } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/catalog/services', requirePermission('settings:manage'), async (req, res, next) => {
  try { ok(res, await prisma.service.findMany({ where: { deletedAt: null } })); } catch (e) { next(e); }
});

router.post('/catalog/services', requireCsrf, requirePermission('settings:manage'), async (req, res, next) => {
  try {
    created(res, await prisma.service.create({
      data: {
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        startingPrice: req.body.startingPrice,
        revisionCount: req.body.revisionCount || 2,
        durationOptions: req.body.durationOptions,
        outputs: req.body.outputs,
        isPublished: req.body.isPublished ?? true,
      },
    }));
  } catch (e) { next(e); }
});

router.get('/', requirePermission('settings:manage'), async (req, res, next) => {
  try { ok(res, await prisma.setting.findMany()); } catch (e) { next(e); }
});

router.get('/:key', async (req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: req.params.key } });
    ok(res, setting);
  } catch (e) { next(e); }
});

router.put('/:key', requireCsrf, requirePermission('settings:manage'), async (req, res, next) => {
  try {
    const setting = await prisma.setting.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, value: req.body.value },
      update: { value: req.body.value },
    });
    ok(res, setting);
  } catch (e) { next(e); }
});

export default router;
