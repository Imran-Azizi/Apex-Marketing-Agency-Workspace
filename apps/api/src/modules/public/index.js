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
import {
  publicOriginCache,
  invalidatePublicPortfolioCache,
  invalidatePublicServicesCache,
  invalidatePublicCustomersCache,
} from './cache.js';
import whatsappWebhookRoutes from '../whatsapp-webhook/index.js';

const router = Router();

function cachePublic(seconds = 60) {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    next();
  };
}

const PUBLIC_TTL_MS = 60_000;

function remember(key, ttlMs, factory) {
  return publicOriginCache.getOrSet(key, ttlMs, factory);
}

export { invalidatePublicPortfolioCache, invalidatePublicServicesCache, invalidatePublicCustomersCache };

router.get('/hero', cachePublic(60), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('hero', PUBLIC_TTL_MS, async () => {
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
      await remember('services', PUBLIC_TTL_MS, async () => {
        const { servicesService } = await import('../services/service.js');
        return servicesService.listPublic();
      }),
    );
  } catch (e) { next(e); }
});

router.get('/customers', cachePublic(60), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('customers', PUBLIC_TTL_MS, async () => {
        const { customersService } = await import('../customers/service.js');
        return customersService.listPublic();
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/portfolio/categories', cachePublic(60), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('portfolio-categories', PUBLIC_TTL_MS, async () => {
        const { listCategoriesPublic } = await import('../portfolio/showcase.js');
        return listCategoriesPublic();
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/portfolio', cachePublic(60), async (req, res, next) => {
  try {
    const category = String(req.query?.category || 'mixed');
    ok(
      res,
      await remember(`portfolio:${category}`, PUBLIC_TTL_MS, () =>
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
      await remember(`portfolio-slug:${req.params.slug}`, PUBLIC_TTL_MS, () =>
        portfolioService.getPublicBySlug(req.params.slug),
      ),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/contact-info', cachePublic(60), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('contact-info', PUBLIC_TTL_MS, () =>
        contactService.getPublicContactInfo(),
      ),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/site-copy', cachePublic(60), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('site-copy', PUBLIC_TTL_MS, async () => {
        const { getPublicSiteCopy } = await import('../settings/public-copy.js');
        return getPublicSiteCopy();
      }),
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
      fromPublicWebsite: true,
    });
    ok(res, cta);
  } catch (e) { next(e); }
});

router.use('/webhooks/whatsapp', whatsappWebhookRoutes);

router.get('/formats', cachePublic(300), async (req, res, next) => {
  try {
    ok(
      res,
      await remember('formats', 300_000, () => prisma.format.findMany()),
    );
  } catch (e) { next(e); }
});

export default router;
