import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth } from "../../middleware/auth.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { created, AppError } from "../../utils/response.js";
import { storage } from "../../services/storage.js";
import {
  isCleanFinalStorageKey,
  parseUploadContext,
} from "../../services/storage/media-manager.js";
import { prisma } from "../../db/prisma.js";
import { normalizeDigitsDeep } from "../../utils/toEnglishDigits.js";

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.",
  "application/postscript",
  "application/octet-stream",
  "text/plain",
];

function isAllowedMime(mime) {
  const value = String(mime || "").toLowerCase();
  if (!value) return true;
  return ALLOWED_MIME_PREFIXES.some(
    (prefix) => value === prefix || value.startsWith(prefix),
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  // No fileSize cap — production and portfolio videos must not be rejected by size.
  limits: { files: 1 },
  fileFilter(_req, file, cb) {
    if (!isAllowedMime(file.mimetype)) {
      cb(new AppError("نوع فایل مجاز نیست", 400, "FILE_TYPE_NOT_ALLOWED"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

async function assertMediaAccess(file, auth) {
  if (!file || file.deletedAt) {
    throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
  }

  if (auth.audience === "PORTAL") {
    const project = await prisma.project.findFirst({
      where: {
        id: file.projectId,
        crmCustomerId: auth.customerId,
        deletedAt: null,
      },
      include: { finance: true, downloadPermission: true },
    });
    if (!project) throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");

    const { isSentToCustomer, asMeta } =
      await import("../production/finalProduct.js");

    if (file.kind === "WATERMARKED_FINAL" || file.kind === "THUMBNAIL") {
      if (
        file.kind === "WATERMARKED_FINAL" &&
        !isSentToCustomer(file, project.status)
      ) {
        throw new AppError(
          "این ویدیو هنوز برای شما ارسال نشده است",
          403,
          "NOT_SENT",
        );
      }
      return;
    }

    if (file.kind === "CLEAN_FINAL") {
      const meta = asMeta(file.meta);
      if (!isSentToCustomer(file, project.status)) {
        throw new AppError(
          "این ویدیو هنوز برای شما ارسال نشده است",
          403,
          "NOT_SENT",
        );
      }
      const { evaluateDeliveryAccess } =
        await import("../../services/deliveryAccess.js");
      const evalResult = evaluateDeliveryAccess({
        projectStatus: project.status,
        finance: project.finance,
        downloadPermission: project.downloadPermission,
        hasCleanFile: true,
      });
      if (!evalResult.cleanDownloadAllowed && meta.allowDownload !== true) {
        throw new AppError(
          evalResult.message || "نسخه پاک هنوز برای شما فعال نیست",
          403,
          "CLEAN_LOCKED",
        );
      }
      return;
    }

    throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
  }

  // Internal roles
  if (auth.roleCode === "MANAGER" || auth.roleCode === "ADMIN") return;

  if (auth.roleCode === "EDITOR") {
    const assigned = await prisma.projectAssignment.findFirst({
      where: {
        projectId: file.projectId,
        role: "EDITOR",
        isActive: true,
        OR: [{ userId: auth.userId }, { teamProfile: { userId: auth.userId } }],
      },
    });
    if (!assigned) throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    if (
      ![
        "WATERMARKED_FINAL",
        "CLEAN_FINAL",
        "WORKING",
        "AUDIO",
        "THUMBNAIL",
      ].includes(file.kind)
    ) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    return;
  }

  if (auth.roleCode === "NARRATOR") {
    const assigned = await prisma.projectAssignment.findFirst({
      where: {
        projectId: file.projectId,
        role: { in: ["NARRATOR", "PROPOSED_NARRATOR"] },
        isActive: true,
        OR: [{ userId: auth.userId }, { teamProfile: { userId: auth.userId } }],
      },
    });
    if (!assigned || file.kind !== "AUDIO") {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    return;
  }

  if (auth.roleCode === "SALES" || auth.roleCode === "FINANCE") {
    // Sales/Finance may preview watermarked finals for project visibility only
    if (file.kind === "WATERMARKED_FINAL" || file.kind === "THUMBNAIL") return;
    throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
  }

  throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
}

function pipeFileStream(stream, res) {
  stream.on("error", (err) => {
    console.error("[files] stream error:", err?.message || err);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: { code: "STREAM_FAILED", message: "خواندن فایل ناموفق بود" },
      });
      return;
    }
    res.destroy(err);
  });
  res.on("close", () => {
    if (!stream.destroyed) stream.destroy();
  });
  stream.pipe(res);
}

async function streamStoredFile(
  req,
  res,
  storageKey,
  { mimeType, downloadName } = {},
) {
  const head = await storage.head(storageKey);
  const fileSize = head.size;
  const range = req.headers.range;
  const inferredExt = String(storageKey || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  const inferredMime =
    inferredExt === "pdf"
      ? "application/pdf"
      : inferredExt === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : inferredExt === "doc"
          ? "application/msword"
          : null;
  const contentType =
    mimeType ||
    (head.contentType && head.contentType !== "application/octet-stream"
      ? head.contentType
      : null) ||
    inferredMime ||
    head.contentType ||
    "application/octet-stream";

  /**
   * Cloudinary video/audio: after ACL, send the player straight to a short-lived
   * CDN URL. Proxying the body through Node+undici causes frequent "terminated"
   * failures on HTTP/2 (especially with Range seeking).
   */
  const isAv =
    String(contentType).startsWith("video/") ||
    String(contentType).startsWith("audio/") ||
    head.resourceType === "video";
  if (isAv && storage.isCloudinary()) {
    try {
      const url = await storage.createPresignedGetUrl(storageKey);
      if (url) {
        res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
        res.redirect(302, url);
        return;
      }
    } catch (err) {
      console.warn(
        "[files] cloudinary CDN redirect failed, falling back to proxy:",
        err?.message || err,
      );
    }
  }

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(
      downloadName || path.basename(storageKey) || "file",
    )}`,
  );

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start >= fileSize
    ) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    const chunkEnd = Math.min(end, fileSize - 1);
    const { stream, contentLength, contentRange } =
      await storage.openReadStream(storageKey, {
        start,
        end: chunkEnd,
      });
    res.status(206);
    res.setHeader(
      "Content-Range",
      contentRange || `bytes ${start}-${chunkEnd}/${fileSize}`,
    );
    res.setHeader("Content-Length", contentLength ?? chunkEnd - start + 1);
    pipeFileStream(stream, res);
    return;
  }

  const { stream, contentLength } = await storage.openReadStream(storageKey);
  res.setHeader("Content-Length", contentLength ?? fileSize);
  pipeFileStream(stream, res);
}

router.post(
  "/upload",
  requireAuth,
  requireCsrf,
  (req, res, next) => {
    // Final videos can take several minutes on slow Cloudinary links.
    req.setTimeout(20 * 60 * 1000);
    res.setTimeout(20 * 60 * 1000);
    next();
  },
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      if (err instanceof AppError) return next(err);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError("آپلود فایل ناموفق بود", 400, "UPLOAD_FAILED"),
          );
        }
        return next(
          new AppError(err.message || "آپلود ناموفق", 400, "UPLOAD_FAILED"),
        );
      }
      return next(err);
    });
  },
  (req, _res, next) => {
    if (req.body && typeof req.body === "object") normalizeDigitsDeep(req.body);
    next();
  },
  async (req, res, next) => {
    try {
      if (!req.file)
        throw new AppError("فایل الزامی است", 400, "FILE_REQUIRED");
      const uploadContext = parseUploadContext(req.body || {}, req.auth || {});
      const saved = await storage.saveBuffer(req.file.buffer, {
        filename: req.file.originalname,
        folder: uploadContext.folder,
        contentType: req.file.mimetype,
        uploadContext,
      });
      created(res, {
        key: saved.key,
        url: saved.url,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        name: req.file.originalname,
        folderPath: saved.folderPath || null,
        category: saved.category || null,
        storageMeta: saved.storageMeta || null,
        ...(saved.provider
          ? {
              provider: saved.provider,
              publicId: saved.publicId,
              resourceType: saved.resourceType,
            }
          : {}),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get("/signed", async (req, res, next) => {
  try {
    const payload = storage.verifySignedToken(req.query.token);
    if (payload.kind === "CLEAN_FINAL" && payload.projectId) {
      const perm = await prisma.downloadPermission.findUnique({
        where: { projectId: payload.projectId },
      });
      if (!perm?.allowed)
        throw new AppError("دسترسی دانلود لغو شده", 403, "DOWNLOAD_REVOKED");
    }

    // Prefer short-lived direct object URL when using R2/S3 (faster, less Railway bandwidth).
    if (storage.isObjectStorage()) {
      const direct = await storage.createPresignedGetUrl(payload.key);
      if (direct) {
        res.redirect(302, direct);
        return;
      }
    }

    await streamStoredFile(req, res, payload.key, {
      downloadName: path.basename(payload.key),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Authenticated, ACL-checked media stream with HTTP Range support for seeking.
 * Use this for in-app video/audio players (Manager / Editor / Customer).
 */
router.get("/media/:fileId", requireAuth, async (req, res, next) => {
  try {
    const file = await prisma.projectFile.findFirst({
      where: { id: req.params.fileId, deletedAt: null },
    });
    await assertMediaAccess(file, req.auth);

    await streamStoredFile(req, res, file.storageKey, {
      mimeType: file.mimeType || "video/mp4",
      downloadName: file.name,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/raw/*", requireAuth, async (req, res, next) => {
  try {
    const key = req.params[0];
    // Harden: never serve CLEAN_FINAL via raw key lookup without ACL
    if (isCleanFinalStorageKey(key)) {
      throw new AppError(
        "از مسیر امن رسانه استفاده کنید",
        403,
        "USE_MEDIA_ROUTE",
      );
    }
    await streamStoredFile(req, res, key);
  } catch (e) {
    next(e);
  }
});

export default router;
