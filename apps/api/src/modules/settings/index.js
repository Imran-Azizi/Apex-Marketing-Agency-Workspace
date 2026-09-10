import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';

const router = Router();
router.use(requireAuth, requireInternal);

const settingKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9._-]+$/, 'کلید تنظیمات نامعتبر است');

const upsertSettingSchema = z.object({
  value: z.unknown(),
});

const createServiceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional().nullable(),
  imageKey: z.string().trim().max(500).optional().nullable(),
  startingPrice: z.coerce.number().nonnegative().optional().nullable(),
  revisionCount: z.coerce.number().int().min(0).max(50).optional(),
  durationOptions: z.unknown().optional(),
  outputs: z.unknown().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  ctaLabel: z.string().trim().max(120).optional().nullable(),
  ctaHref: z.string().trim().max(500).optional().nullable(),
});

router.get('/catalog/services', requirePermission('settings.view'), async (req, res, next) => {
  try { ok(res, await prisma.service.findMany({ where: { deletedAt: null } })); } catch (e) { next(e); }
});

router.post(
  '/catalog/services',
  requireCsrf,
  requirePermission('settings.edit'),
  validate(createServiceSchema),
  async (req, res, next) => {
    try {
      created(res, await prisma.service.create({
        data: {
          name: req.body.name,
          slug: req.body.slug,
          description: req.body.description,
          imageKey: req.body.imageKey || null,
          startingPrice: req.body.startingPrice,
          revisionCount: req.body.revisionCount || 2,
          durationOptions: req.body.durationOptions,
          outputs: req.body.outputs,
          isPublished: req.body.isPublished ?? true,
          sortOrder: req.body.sortOrder ?? 0,
          ctaLabel: req.body.ctaLabel || null,
          ctaHref: req.body.ctaHref || null,
        },
      }));
    } catch (e) { next(e); }
  },
);

router.get('/', requirePermission('settings.view'), async (req, res, next) => {
  try { ok(res, await prisma.setting.findMany()); } catch (e) { next(e); }
});

router.get('/:key', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const key = settingKeySchema.parse(req.params.key);
    const setting = await prisma.setting.findUnique({ where: { key } });
    ok(res, setting);
  } catch (e) {
    next(e);
  }
});

router.put(
  '/:key',
  requireCsrf,
  requirePermission('settings.edit'),
  validate(upsertSettingSchema),
  async (req, res, next) => {
    try {
      const key = settingKeySchema.parse(req.params.key);
      const setting = await prisma.setting.upsert({
        where: { key },
        create: { key, value: req.body.value },
        update: { value: req.body.value },
      });
      ok(res, setting);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
