import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/response.js";
import {
  customersService,
  createCustomerSchema,
  updateCustomerSchema,
  reorderCustomersSchema,
} from "./service.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get("/", requirePermission("customers.view"), async (req, res, next) => {
  try {
    ok(
      res,
      await customersService.list({
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

router.get("/:id", requirePermission("customers.view"), async (req, res, next) => {
  try {
    ok(res, await customersService.getById(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  requireCsrf,
  requirePermission("customers.create"),
  validate(createCustomerSchema),
  async (req, res, next) => {
    try {
      created(res, await customersService.create(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/reorder",
  requireCsrf,
  requirePermission("customers.edit"),
  validate(reorderCustomersSchema),
  async (req, res, next) => {
    try {
      ok(res, await customersService.reorder(req.body.orderedIds, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id",
  requireCsrf,
  requirePermission("customers.edit"),
  validate(updateCustomerSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await customersService.update(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/publish",
  requireCsrf,
  requirePermission("customers.edit"),
  validate(z.object({ isPublished: z.boolean() })),
  async (req, res, next) => {
    try {
      ok(
        res,
        await customersService.setPublished(
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
  requirePermission("customers.delete"),
  async (req, res, next) => {
    try {
      ok(res, await customersService.remove(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
