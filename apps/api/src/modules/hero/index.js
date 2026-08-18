import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/response.js";
import {
  heroService,
  createHeroSlideSchema,
  updateHeroSlideSchema,
  reorderHeroSlidesSchema,
} from "./service.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get("/", requirePermission("hero.view"), async (req, res, next) => {
  try {
    ok(
      res,
      await heroService.list({
        q: req.query.q,
        status: req.query.status,
        page: Number(req.query.page || 1),
        pageSize: Number(req.query.pageSize || 100),
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requirePermission("hero.view"), async (req, res, next) => {
  try {
    ok(res, await heroService.getById(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  requireCsrf,
  requirePermission("hero.create"),
  validate(createHeroSlideSchema),
  async (req, res, next) => {
    try {
      created(res, await heroService.create(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/reorder",
  requireCsrf,
  requirePermission("hero.edit"),
  validate(reorderHeroSlidesSchema),
  async (req, res, next) => {
    try {
      ok(res, await heroService.reorder(req.body.orderedIds, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id",
  requireCsrf,
  requirePermission("hero.edit"),
  validate(updateHeroSlideSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await heroService.update(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/publish",
  requireCsrf,
  requirePermission("hero.edit"),
  validate(z.object({ isPublished: z.boolean() })),
  async (req, res, next) => {
    try {
      ok(
        res,
        await heroService.setPublished(
          req.params.id,
          req.body.isPublished,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/:id",
  requireCsrf,
  requirePermission("hero.delete"),
  async (req, res, next) => {
    try {
      ok(res, await heroService.remove(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
