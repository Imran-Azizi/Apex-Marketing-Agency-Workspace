import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { ok } from "../../utils/response.js";
import { contactService } from "./service.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get("/", requirePermission("contact.view"), async (req, res, next) => {
  try {
    ok(
      res,
      await contactService.list({
        q: req.query.q,
        status: req.query.status,
        subject: req.query.subject,
        page: req.query.page,
        pageSize: req.query.pageSize,
        sort: req.query.sort,
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get(
  "/unread-count",
  requirePermission("contact.view"),
  async (req, res, next) => {
    try {
      ok(res, await contactService.unreadCount());
    } catch (e) {
      next(e);
    }
  },
);

router.get("/:id", requirePermission("contact.view"), async (req, res, next) => {
  try {
    ok(res, await contactService.getById(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/:id/read",
  requireCsrf,
  requirePermission("contact.edit"),
  async (req, res, next) => {
    try {
      ok(res, await contactService.markRead(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/unread",
  requireCsrf,
  requirePermission("contact.edit"),
  async (req, res, next) => {
    try {
      ok(res, await contactService.markUnread(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/:id",
  requireCsrf,
  requirePermission("contact.delete"),
  async (req, res, next) => {
    try {
      ok(res, await contactService.remove(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
