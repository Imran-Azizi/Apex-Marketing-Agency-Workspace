import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { tmpdir } from "os";
import { unlink, readFile, writeFile } from "fs/promises";
import { requireAuth } from "../../middleware/auth.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { uploadLimiter } from "../../middleware/rateLimit.js";
import { created, AppError } from "../../utils/response.js";
import { storage } from "../../services/storage.js";
import {
  parseUploadContext,
  UPLOAD_PURPOSE,
  validateContentImportFile,
} from "../../services/storage/media-manager.js";
import { prisma } from "../../db/prisma.js";
import { normalizeDigitsDeep } from "../../utils/toEnglishDigits.js";
import { SECURITY, BLOCKED_UPLOAD_EXTENSIONS } from "../../config/security.js";
import { assertRawStorageAccess } from "./rawAccess.js";
import {
  assertClientAssetImageFile,
  isClientAssetImageKind,
  isSvgUpload,
} from "./image-formats.js";
import { sanitizeSvgContent } from "./svg-sanitize.js";

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.",
  "application/postscript",
  "text/plain",
];

const OCTET_STREAM_EXTS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "mp4",
  "mov",
  "mkv",
  "webm",
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "zip",
  "jpg",
  "jpeg",
  "jfif",
  "jpe",
  "jif",
  "png",
  "webp",
  "gif",
  "svg",
  "bmp",
  "tif",
  "tiff",
  "avif",
  "ai",
  "eps",
  "psd",
]);

function fileExtension(name) {
  return path.extname(String(name || "")).slice(1).toLowerCase();
}

function isBlockedUploadName(name) {
  return BLOCKED_UPLOAD_EXTENSIONS.includes(fileExtension(name));
}

function isAllowedMime(mime, originalname) {
  if (isBlockedUploadName(originalname)) return false;
  const ext = fileExtension(originalname);
  const value = String(mime || "").toLowerCase();

  // SVG is allowed only with a matching extension (sanitized later on upload).
  if (ext === "svg") {
    return (
      !value ||
      value === "image/svg+xml" ||
      value === "application/octet-stream" ||
      value === "text/xml" ||
      value === "application/xml"
    );
  }
  if (value === "image/svg+xml") {
    return ext === "svg";
  }

  if (!value) return false;
  if (value === "application/octet-stream") {
    return OCTET_STREAM_EXTS.has(ext);
  }
  return ALLOWED_MIME_PREFIXES.some(
    (prefix) => value === prefix || value.startsWith(prefix),
  );
}

const upload = multer({
  // Disk-backed so large videos are streamed to Bunny without sitting in RAM.
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, tmpdir());
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname || "").slice(0, 16);
      cb(
        null,
        `apex-upload-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`,
      );
    },
  }),
  // Large production videos are allowed; unbounded bodies are not.
  limits: { files: 1, fileSize: SECURITY.upload.maxFileBytes },
  fileFilter(_req, file, cb) {
    if (!isAllowedMime(file.mimetype, file.originalname)) {
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

    if (file.kind === "POSTER") {
      const poster = await prisma.projectPoster.findFirst({
        where: {
          fileId: file.id,
          projectId: project.id,
          status: "SENT_TO_CUSTOMER",
        },
        select: { id: true },
      });
      if (!poster) {
        throw new AppError(
          "این پوستر هنوز برای شما ارسال نشده است",
          403,
          "NOT_SENT",
        );
      }
      return;
    }

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

  if (auth.roleCode === "PROJECT_MANAGER") {
    const perms = auth.permissions || [];
    if (!perms.includes("projects.view")) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    if (file.kind === "CLEAN_FINAL" && !perms.includes("delivery.allow")) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    return;
  }

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
        "POSTER",
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

  const isSvg =
    String(contentType).toLowerCase().includes("svg") ||
    inferredExt === "svg";

  /**
   * After ACL, send AV players to a short-lived CDN URL when the driver can
   * sign it (Bunny token auth / Cloudinary signed URL). Otherwise proxy/stream
   * so protected files are not left on a permanent public CDN URL.
   */
  const isAv =
    String(contentType).startsWith("video/") ||
    String(contentType).startsWith("audio/") ||
    head.resourceType === "video";
  if (isAv && storage.prefersDirectCdnRedirect({ signed: true })) {
    try {
      const url = await storage.createPresignedGetUrl(storageKey);
      if (url) {
        res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
        res.redirect(302, url);
        return;
      }
    } catch (err) {
      console.warn(
        "[files] CDN redirect failed, falling back to proxy:",
        err?.message || err,
      );
    }
  }

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (isSvg) {
    // Defense-in-depth if SVG is opened directly in a tab (scripts still
    // sanitized on upload; <img> embedding does not execute scripts).
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'none'; style-src 'unsafe-inline'; script-src 'none'; sandbox",
    );
  }
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
  uploadLimiter,
  (req, res, next) => {
    // Final videos can take several minutes on slow storage links.
    req.setTimeout(20 * 60 * 1000);
    res.setTimeout(20 * 60 * 1000);
    next();
  },
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err && req.file?.path) {
        unlink(req.file.path).catch(() => {});
      }
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
      if (uploadContext.purpose === UPLOAD_PURPOSE.CONTENT_IMPORT) {
        const check = validateContentImportFile(req.file);
        if (!check.ok) {
          throw new AppError(check.message, 400, "FILE_TYPE_NOT_ALLOWED");
        }
      }

      const assetKind = String(
        req.body?.assetKind || uploadContext.assetKind || "",
      ).toUpperCase();
      if (
        uploadContext.purpose === UPLOAD_PURPOSE.PORTAL_ASSET &&
        isClientAssetImageKind(assetKind)
      ) {
        assertClientAssetImageFile({
          name: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          kind: assetKind,
        });
      }

      let mimeType = req.file.mimetype;
      let sizeBytes = req.file.size;

      if (isSvgUpload(req.file)) {
        const raw = await readFile(req.file.path);
        const sanitized = sanitizeSvgContent(raw);
        await writeFile(req.file.path, sanitized);
        mimeType = "image/svg+xml";
        sizeBytes = sanitized.length;
        req.file.size = sizeBytes;
        req.file.mimetype = mimeType;
      }

      const saved = await storage.saveUploadedFile(req.file, {
        filename: req.file.originalname,
        folder: uploadContext.folder,
        contentType: mimeType,
        uploadContext,
      });
      created(res, {
        key: saved.key,
        url: saved.url,
        mimeType,
        sizeBytes,
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
    } finally {
      if (req.file?.path) {
        await unlink(req.file.path).catch(() => {});
      }
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

    // Prefer short-lived direct object/CDN URL (faster, less API bandwidth).
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

    const ext = path.extname(String(file.name || file.storageKey || ""))
      .slice(1)
      .toLowerCase();
    const audioExts = new Set([
      "mp3",
      "wav",
      "m4a",
      "aac",
      "ogg",
      "oga",
      "flac",
      "webm",
    ]);
    const fallbackMime =
      file.kind === "AUDIO" || audioExts.has(ext)
        ? ext === "wav"
          ? "audio/wav"
          : ext === "m4a" || ext === "aac"
            ? "audio/mp4"
            : ext === "ogg" || ext === "oga"
              ? "audio/ogg"
              : ext === "flac"
                ? "audio/flac"
                : ext === "webm"
                  ? "audio/webm"
                  : "audio/mpeg"
        : "video/mp4";

    await streamStoredFile(req, res, file.storageKey, {
      mimeType: file.mimeType || fallbackMime,
      downloadName: file.name,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/raw/*", requireAuth, async (req, res, next) => {
  try {
    const key = req.params[0];
    await assertRawStorageAccess(key, req.auth);
    await streamStoredFile(req, res, key);
  } catch (e) {
    next(e);
  }
});

export default router;
