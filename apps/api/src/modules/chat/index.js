import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.js";
import { requireInternal, requirePermission } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { chatMessageLimiter, chatUploadLimiter } from "../../middleware/rateLimit.js";
import { ok, created, AppError } from "../../utils/response.js";
import {
  chatService,
  openDirectSchema,
  sendMessageSchema,
  editMessageSchema,
  reactionSchema,
  participantPrefsSchema,
  orgSettingsSchema,
  allowPairSchema,
} from "./service.js";
import { assertDirectStillAllowed } from "./authz.js";
import { saveChatAttachment } from "./upload.js";
import { streamChatAttachment } from "./attachmentStream.js";
import { parsePagination } from "../../utils/pagination.js";
import { SECURITY } from "../../config/security.js";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 25 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth, requireInternal);

router.get(
  "/directory",
  requirePermission("chat.view"),
  async (req, res, next) => {
    try {
      ok(res, await chatService.listDirectory(req.auth, { q: req.query.q }));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/conversations",
  requirePermission("chat.view"),
  async (req, res, next) => {
    try {
      ok(res, await chatService.listConversations(req.auth, { q: req.query.q }));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/conversations/direct",
  requireCsrf,
  chatMessageLimiter,
  requirePermission("chat.send"),
  validate(openDirectSchema),
  async (req, res, next) => {
    try {
      created(res, await chatService.openDirect(req.auth, req.body, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/conversations/:id",
  requirePermission("chat.view"),
  async (req, res, next) => {
    try {
      ok(res, await chatService.getConversation(req.auth, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/conversations/:id/prefs",
  requireCsrf,
  requirePermission("chat.view"),
  validate(participantPrefsSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await chatService.updateParticipantPrefs(
          req.auth,
          req.params.id,
          req.body,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/conversations/:id/messages",
  requirePermission("chat.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await chatService.listMessages(req.auth, req.params.id, {
          cursor: req.query.cursor,
          limit: parsePagination(req.query, {
            defaultPageSize: 40,
            maxPageSize: SECURITY.pagination.chatMessageMax,
          }).take,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/conversations/:id/messages",
  requireCsrf,
  chatMessageLimiter,
  requirePermission("chat.send"),
  validate(sendMessageSchema),
  async (req, res, next) => {
    try {
      const result = await chatService.sendMessage(
        req.auth,
        req.params.id,
        req.body,
        req,
      );
      created(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/conversations/:id/attachments",
  requireCsrf,
  chatUploadLimiter,
  requirePermission("chat.upload"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      await assertDirectStillAllowed(req.params.id, req.auth.userId);
      if (!req.file) throw new AppError("فایل الزامی است", 400, "FILE_REQUIRED");
      const isVoice = String(req.body?.kind || "").toLowerCase() === "voice";
      const meta = await saveChatAttachment(req.file, {
        conversationId: req.params.id,
        userId: req.auth.userId,
        isVoice,
        durationMs: req.body?.durationMs,
      });
      created(res, meta);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/conversations/:id/read",
  requireCsrf,
  requirePermission("chat.view"),
  validate(
    z.object({ messageId: z.string().optional().nullable() }),
  ),
  async (req, res, next) => {
    try {
      ok(
        res,
        await chatService.markRead(req.auth, req.params.id, {
          messageId: req.body.messageId,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/conversations/:id/delivered",
  requireCsrf,
  requirePermission("chat.view"),
  validate(z.object({ messageIds: z.array(z.string()).max(100) })),
  async (req, res, next) => {
    try {
      ok(
        res,
        await chatService.markDelivered(
          req.auth,
          req.params.id,
          req.body.messageIds,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/messages/:id",
  requireCsrf,
  requirePermission("chat.send"),
  validate(editMessageSchema),
  async (req, res, next) => {
    try {
      ok(res, await chatService.editMessage(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/messages/:id",
  requireCsrf,
  requirePermission("chat.send"),
  async (req, res, next) => {
    try {
      ok(res, await chatService.deleteMessage(req.auth, req.params.id, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/messages/:id/reactions",
  requireCsrf,
  requirePermission("chat.send"),
  validate(reactionSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await chatService.toggleReaction(req.auth, req.params.id, req.body),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/search",
  requirePermission("chat.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await chatService.search(req.auth, {
          q: req.query.q,
          limit: parsePagination(req.query, {
            defaultPageSize: 30,
            maxPageSize: 50,
          }).take,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/attachments/:id",
  requirePermission("chat.view"),
  async (req, res, next) => {
    try {
      const attachment = await chatService.getAttachmentForDownload(
        req.auth,
        req.params.id,
      );
      await streamChatAttachment(req, res, attachment);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/settings",
  requirePermission("chat.view"),
  async (req, res, next) => {
    try {
      ok(res, await chatService.getOrgChatSettings(req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/settings",
  requireCsrf,
  requirePermission("chat.manage"),
  validate(orgSettingsSchema),
  async (req, res, next) => {
    try {
      ok(res, await chatService.updateOrgChatSettings(req.auth, req.body, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/settings/allow-pairs",
  requireCsrf,
  requirePermission("chat.manage"),
  validate(allowPairSchema),
  async (req, res, next) => {
    try {
      created(res, await chatService.addAllowPair(req.auth, req.body, req));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/settings/allow-pairs/:id",
  requireCsrf,
  requirePermission("chat.manage"),
  async (req, res, next) => {
    try {
      ok(res, await chatService.removeAllowPair(req.auth, req.params.id, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
