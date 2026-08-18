import { Router } from 'express';
import { ok, created } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';
import { buildWhatsappCta } from '../../services/whatsapp.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { contactLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import {
  contactService,
  submitContactSchema,
} from '../contact/service.js';
import {
  portfolioService,
  streamPortfolioVideo,
} from '../portfolio/service.js';

const router = Router();

function cachePublic(seconds = 60) {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    next();
  };
}

router.get('/hero', cachePublic(30), async (req, res, next) => {
  try {
    const { heroService } = await import('../hero/service.js');
    ok(res, await heroService.listPublic());
  } catch (e) {
    next(e);
  }
});

router.get('/services', cachePublic(60), async (req, res, next) => {
  try {
    const { servicesService } = await import('../services/service.js');
    ok(res, await servicesService.listPublic());
  } catch (e) { next(e); }
});

/** Active narrator profiles customers may propose in the portal brief. */
const ACTIVE_NARRATOR_WHERE = {
  kind: 'NARRATOR',
  status: 'ACTIVE',
  deletedAt: null,
  user: { isActive: true, deletedAt: null },
};

router.get('/narrators', cachePublic(15), async (req, res, next) => {
  try {
    const rows = await prisma.teamProfile.findMany({
      where: ACTIVE_NARRATOR_WHERE,
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        languages: true,
        gender: true,
        tone: true,
      },
    });
    ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/customers', cachePublic(30), async (req, res, next) => {
  try {
    const { customersService } = await import('../customers/service.js');
    ok(res, await customersService.listPublic());
  } catch (e) {
    next(e);
  }
});

router.get('/portfolio/categories', cachePublic(30), async (req, res, next) => {
  try {
    const { listCategoriesPublic } = await import('../portfolio/showcase.js');
    ok(res, await listCategoriesPublic());
  } catch (e) {
    next(e);
  }
});

router.get('/portfolio', cachePublic(30), async (req, res, next) => {
  try {
    ok(res, await portfolioService.listPublic(req.query || {}));
  } catch (e) {
    next(e);
  }
});

/** Stream published portfolio video without auth — only PUBLISHED items. */
router.get('/portfolio/:id/stream', async (req, res, next) => {
  try {
    const file = await portfolioService.getPublishedStreamTarget(req.params.id);
    await streamPortfolioVideo(req, res, file);
  } catch (e) {
    next(e);
  }
});

router.get('/portfolio/:slug', cachePublic(60), async (req, res, next) => {
  try {
    ok(res, await portfolioService.getPublicBySlug(req.params.slug));
  } catch (e) {
    next(e);
  }
});

router.get('/contact-info', cachePublic(30), async (req, res, next) => {
  try {
    ok(res, await contactService.getPublicContactInfo());
  } catch (e) {
    next(e);
  }
});

router.post(
  '/contact',
  contactLimiter,
  requireCsrf,
  validate(submitContactSchema),
  async (req, res, next) => {
    try {
      created(res, await contactService.submit(req.body, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get('/whatsapp-cta', cachePublic(60), async (req, res, next) => {
  try {
    const cta = await buildWhatsappCta({
      message: req.query.message,
      serviceId: req.query.serviceId,
    });
    ok(res, cta);
  } catch (e) { next(e); }
});

router.get('/formats', cachePublic(300), async (req, res, next) => {
  try { ok(res, await prisma.format.findMany()); } catch (e) { next(e); }
});

export default router;
