import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission, requireRoles, denyRoles } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { ok } from "../../utils/response.js";
import { productionService } from "./service.js";
import { posterService } from "./posterService.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get(
  "/editors",
  denyRoles("EDITOR"),
  requirePermission("projects.assign"),
  async (req, res, next) => {
    try {
      ok(res, await productionService.listAvailableEditors(req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/my-tasks",
  requirePermission("video.view"),
  async (req, res, next) => {
    try {
      ok(res, await productionService.listMyTasks(req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/dashboard",
  requirePermission("video.view"),
  async (req, res, next) => {
    try {
      ok(res, await productionService.getEditorDashboard(req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/projects",
  requirePermission("video.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.listEditorProjects(req.auth, req.query || {}),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/projects/:projectId",
  requirePermission("video.view", "projects.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.getProjectTask(req.params.projectId, req.auth),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/assign",
  requireCsrf,
  denyRoles("EDITOR"),
  requirePermission("projects.assign"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.assignEditor(
          req.params.projectId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/projects/:projectId/deadline",
  requireCsrf,
  requirePermission("video.edit", "projects.assign"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.updateDeadline(
          req.params.projectId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/start",
  requireCsrf,
  requirePermission("video.edit"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.markInProgress(req.params.projectId, req.auth),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/submit",
  requireCsrf,
  requirePermission("video.upload"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.submitProduction(
          req.params.projectId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/manager-review",
  requireCsrf,
  requirePermission("video.approve"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.managerReview(
          req.params.projectId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/projects/:projectId/final-products",
  requirePermission("video.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.listFinalProducts(
          req.params.projectId,
          req.auth,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/final-products/upload",
  requireCsrf,
  requirePermission("video.upload"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.uploadFinalVideo(
          req.params.projectId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/final-products/:fileId/review",
  requireCsrf,
  denyRoles("EDITOR"),
  requireRoles("MANAGER", "ADMIN"),
  requirePermission("video.approve"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.reviewFinalVideo(
          req.params.projectId,
          req.params.fileId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/final-products/send",
  requireCsrf,
  denyRoles("EDITOR"),
  requireRoles("MANAGER", "ADMIN"),
  requirePermission("video.send"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await productionService.sendFinalVideos(
          req.params.projectId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/projects/:projectId/posters",
  requirePermission("poster.view", "video.view"),
  async (req, res, next) => {
    try {
      ok(res, await posterService.list(req.params.projectId, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/posters",
  requireCsrf,
  requirePermission("poster.upload", "video.upload"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await posterService.upload(
          req.params.projectId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/posters/:posterId/review",
  requireCsrf,
  denyRoles("EDITOR"),
  requireRoles("MANAGER", "ADMIN"),
  requirePermission("poster.approve"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await posterService.review(
          req.params.projectId,
          req.params.posterId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/projects/:projectId/posters/:posterId/send",
  requireCsrf,
  denyRoles("EDITOR"),
  requireRoles("MANAGER", "ADMIN"),
  requirePermission("poster.send"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await posterService.send(
          req.params.projectId,
          req.params.posterId,
          req.body || {},
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
