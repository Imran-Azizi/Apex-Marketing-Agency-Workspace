import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { ok } from "../../utils/response.js";
import { productionService } from "./service.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get(
  "/editors",
  requirePermission("projects.assign"),
  async (req, res, next) => {
    try {
      ok(res, await productionService.listAvailableEditors());
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

export default router;
