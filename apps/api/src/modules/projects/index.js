import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { ok } from "../../utils/response.js";
import { projectService } from "./service.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get(
  "/dashboard-summary",
  requirePermission("dashboard.view"),
  async (req, res, next) => {
    try {
      ok(res, await projectService.dashboard(req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/", requirePermission("projects.view"), async (req, res, next) => {
  try {
    ok(res, await projectService.list(req.auth, req.query));
  } catch (e) {
    next(e);
  }
});

router.get(
  "/:id",
  requirePermission("projects.view"),
  async (req, res, next) => {
    try {
      ok(res, await projectService.get(req.params.id, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/content/generate",
  requireCsrf,
  requirePermission("content.generate"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await projectService.generateContent(req.params.id, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/content/:versionId/approve-for-client",
  requireCsrf,
  requirePermission("content.approve"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await projectService.approveContentForClient(
          req.params.id,
          req.params.versionId,
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
  "/:id/extra-revision",
  requireCsrf,
  requirePermission("projects.complete"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await projectService.enableExtraRevision(
          req.params.id,
          req.body,
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
  "/:id/voice/upload",
  requireCsrf,
  requirePermission("narration.upload"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await projectService.uploadVoice(
          req.params.id,
          req.body,
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
  "/:id/voice/accept",
  requireCsrf,
  requirePermission("narration.approve"),
  async (req, res, next) => {
    try {
      ok(res, await projectService.acceptVoice(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/voice/return",
  requireCsrf,
  requirePermission("narration.revise"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await projectService.returnVoice(
          req.params.id,
          req.body,
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
  "/:id/production/submit",
  requireCsrf,
  requirePermission("video.upload"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await projectService.submitProduction(
          req.params.id,
          req.body,
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
  "/:id/final/review",
  requireCsrf,
  requirePermission("video.approve"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await projectService.runQcAndApproveFinal(
          req.params.id,
          req.body,
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
  requirePermission("projects.delete"),
  async (req, res, next) => {
    try {
      ok(res, await projectService.softDelete(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
