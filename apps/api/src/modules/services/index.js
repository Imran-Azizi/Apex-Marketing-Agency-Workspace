import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/response.js";
import {
  servicesService,
  createServiceSchema,
  updateServiceSchema,
  reorderServicesSchema,
} from "./service.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get("/", requirePermission("services.view"), async (req, res, next) => {
  try {
    ok(
      res,
      await servicesService.list({
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

router.get("/:id", requirePermission("services.view"), async (req, res, next) => {
  try {
    ok(res, await servicesService.getById(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  requireCsrf,
  requirePermission("services.create"),
  validate(createServiceSchema),
  async (req, res, next) => {
    try {
      created(res, await servicesService.create(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/reorder",
  requireCsrf,
  requirePermission("services.edit"),
  validate(reorderServicesSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await servicesService.reorder(req.body.orderedIds, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id",
  requireCsrf,
  requirePermission("services.edit"),
  validate(updateServiceSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await servicesService.update(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/publish",
  requireCsrf,
  requirePermission("services.edit"),
  validate(z.object({ isPublished: z.boolean() })),
  async (req, res, next) => {
    try {
      ok(
        res,
        await servicesService.setPublished(
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
  requirePermission("services.delete"),
  async (req, res, next) => {
    try {
      ok(res, await servicesService.remove(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
