import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/response.js";
import {
  videoStorageService,
  createVideoSchema,
  updateVideoSchema,
  sendToPortfolioSchema,
  attachThumbnailSchema,
  streamCompanyVideo,
  verifyCompanyVideoMediaToken,
} from "./service.js";

const router = Router();

/**
 * Media endpoints accept either a short-lived signed ?token= (for <video>/<img>)
 * or a normal authenticated session with video_storage.view.
 * Invalid/expired tokens fall back to session cookies so playback still works.
 */
function requireVideoMediaAccess(purpose) {
  return (req, res, next) => {
    const token = String(req.query?.token || "").trim();

    const continueWithSession = () => {
      requireAuth(req, res, (authErr) => {
        if (authErr) return next(authErr);
        requireInternal(req, res, (internalErr) => {
          if (internalErr) return next(internalErr);
          requirePermission("video_storage.view")(req, res, next);
        });
      });
    };

    if (token) {
      try {
        verifyCompanyVideoMediaToken(token, req.params.id, purpose);
        req.auth = null;
        return next();
      } catch {
        // Token may be expired/stale from a cached list response — try session.
        return continueWithSession();
      }
    }

    return continueWithSession();
  };
}

router.get(
  "/:id/stream",
  requireVideoMediaAccess("stream"),
  async (req, res, next) => {
    try {
      const file = await videoStorageService.getStreamTarget(
        req.params.id,
        req.auth || null,
      );
      await streamCompanyVideo(req, res, file);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/thumbnail",
  requireVideoMediaAccess("thumbnail"),
  async (req, res, next) => {
    try {
      const file = await videoStorageService.getThumbnailTarget(
        req.params.id,
        req.auth || null,
      );
      await streamCompanyVideo(req, res, file);
    } catch (e) {
      next(e);
    }
  },
);

router.use(requireAuth, requireInternal);

router.get("/", requirePermission("video_storage.view"), async (req, res, next) => {
  try {
    ok(res, await videoStorageService.list(req.query || {}, req.auth));
  } catch (e) {
    next(e);
  }
});

router.get(
  "/stats",
  requirePermission("video_storage.view"),
  async (req, res, next) => {
    try {
      ok(res, await videoStorageService.stats(req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/uploaders",
  requirePermission("video_storage.view"),
  async (req, res, next) => {
    try {
      ok(res, await videoStorageService.listUploaders(req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/",
  requireCsrf,
  requirePermission("video_storage.upload"),
  validate(createVideoSchema),
  async (req, res, next) => {
    try {
      created(res, await videoStorageService.create(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/playback",
  requirePermission("video_storage.view"),
  async (req, res, next) => {
    try {
      ok(res, await videoStorageService.getPlaybackUrl(req.params.id, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id",
  requirePermission("video_storage.view"),
  async (req, res, next) => {
    try {
      ok(res, await videoStorageService.getById(req.params.id, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id",
  requireCsrf,
  requirePermission("video_storage.edit"),
  validate(updateVideoSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await videoStorageService.update(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/thumbnail",
  requireCsrf,
  requirePermission("video_storage.view"),
  validate(attachThumbnailSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await videoStorageService.attachThumbnail(
          req.params.id,
          req.body.thumbnailKey,
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
  requirePermission("video_storage.delete"),
  async (req, res, next) => {
    try {
      ok(res, await videoStorageService.remove(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/send-to-portfolio",
  requireCsrf,
  requirePermission("video_storage.send_portfolio"),
  validate(sendToPortfolioSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await videoStorageService.sendToPortfolio(
          req.params.id,
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
