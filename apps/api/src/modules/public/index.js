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
import { createTtlCache } from '../../utils/ttlCache.js';

const router = Router();
const originCache = createTtlCache();

function cachePublic(seconds = 60) {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    next();
  };
}

function remember(key, ttlMs, factory) {
  return originCache.getOrSet(key, ttlMs, factory);
}

router.get('/hero', cachePublic(30), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('hero', 30_000, async () => {
        const { heroService } = await import('../hero/service.js');
        return heroService.listPublic();
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/services', cachePublic(60), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('services', 60_000, async () => {
        const { servicesService } = await import('../services/service.js');
        return servicesService.listPublic();
      }),
    );
  } catch (e) { next(e); }
});

router.get('/customers', cachePublic(30), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('customers', 30_000, async () => {
        const { customersService } = await import('../customers/service.js');
        return customersService.listPublic();
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/portfolio/categories', cachePublic(30), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('portfolio-categories', 30_000, async () => {
        const { listCategoriesPublic } = await import('../portfolio/showcase.js');
        return listCategoriesPublic();
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/portfolio', cachePublic(30), async (req, res, next) => {
  try {
    const category = String(req.query?.category || 'mixed');
    ok(
      res,
      await remember(`portfolio:${category}`, 30_000, () =>
        portfolioService.listPublic(req.query || {}),
      ),
    );
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
    ok(
      res,
      await remember(`portfolio-slug:${req.params.slug}`, 60_000, () =>
        portfolioService.getPublicBySlug(req.params.slug),
      ),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/contact-info', cachePublic(30), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('contact-info', 30_000, () =>
        contactService.getPublicContactInfo(),
      ),
    );
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
  try {
    ok(
      res,
      await remember('formats', 300_000, () => prisma.format.findMany()),
    );
  } catch (e) { next(e); }
});

export default router;
