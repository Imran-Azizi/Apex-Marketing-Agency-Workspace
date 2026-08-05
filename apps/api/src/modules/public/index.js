import { Router } from 'express';
import { ok } from '../../utils/response.js';
import { prisma } from '../../db/prisma.js';
import { buildWhatsappCta } from '../../services/whatsapp.js';

const router = Router();

function cachePublic(seconds = 60) {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    next();
  };
}

router.get('/services', cachePublic(120), async (req, res, next) => {
  try {
    ok(res, await prisma.service.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    }));
  } catch (e) { next(e); }
});

router.get('/styles', cachePublic(120), async (req, res, next) => {
  try {
    ok(res, await prisma.style.findMany({
      where: { isPublished: true, deletedAt: null },
      include: { service: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
    }));
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

router.get('/narrators/samples', cachePublic(120), async (req, res, next) => {
  try {
    ok(res, await prisma.audioSample.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        teamProfile: ACTIVE_NARRATOR_WHERE,
      },
      include: {
        teamProfile: {
          select: { id: true, displayName: true, languages: true, gender: true, tone: true, status: true },
        },
      },
    }));
  } catch (e) { next(e); }
});

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
