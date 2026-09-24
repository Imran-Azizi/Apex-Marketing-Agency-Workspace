import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/response.js";
import {
  landingPagesService,
  createLandingPageSchema,
  updateLandingPageSchema,
} from "./service.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get("/", requirePermission("landing_pages.view"), async (req, res, next) => {
  try {
    ok(
      res,
      await landingPagesService.list({
        q: req.query.q,
        status: req.query.status,
        page: Number(req.query.page || 1),
        pageSize: Number(req.query.pageSize || 50),
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requirePermission("landing_pages.view"), async (req, res, next) => {
  try {
    ok(res, await landingPagesService.getById(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  requireCsrf,
  requirePermission("landing_pages.create"),
  validate(createLandingPageSchema),
  async (req, res, next) => {
    try {
      created(res, await landingPagesService.create(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id",
  requireCsrf,
  requirePermission("landing_pages.edit"),
  validate(updateLandingPageSchema),
  async (req, res, next) => {
    try {
      ok(res, await landingPagesService.update(req.params.id, req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/duplicate",
  requireCsrf,
  requirePermission("landing_pages.create"),
  async (req, res, next) => {
    try {
      created(res, await landingPagesService.duplicate(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/publish",
  requireCsrf,
  requirePermission("landing_pages.publish"),
  async (req, res, next) => {
    try {
      ok(res, await landingPagesService.publish(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/unpublish",
  requireCsrf,
  requirePermission("landing_pages.publish"),
  async (req, res, next) => {
    try {
      ok(res, await landingPagesService.unpublish(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/:id",
  requireCsrf,
  requirePermission("landing_pages.delete"),
  async (req, res, next) => {
    try {
      ok(res, await landingPagesService.remove(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
