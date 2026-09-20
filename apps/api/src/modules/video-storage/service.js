import { z } from "zod";
import path from "path";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { isFullAccessRole } from "../../services/permissions/catalog.js";
import { hasAnyPermission } from "../../services/permissions/effective.js";
import { storage } from "../../services/storage.js";
import { env } from "../../config/env.js";
import { signDownloadToken, verifyDownloadToken } from "../../utils/tokens.js";
import {
  isPublicStorageKey,
  stripStoragePrefix,
  UPLOAD_PURPOSE,
} from "../../services/storage/media-manager.js";
import {
  preparePortfolioVideoForWeb,
} from "../../services/video/optimize-web-mp4.js";
import { extractVideoThumbnail } from "../../services/video/extract-thumbnail.js";
import { uniqueSlug } from "../portfolio/service.js";
import { afterPublicPortfolioMutation } from "../portfolio/public-invalidate.js";

const ALLOWED_VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv", "m4v"]);
const ALLOWED_VIDEO_MIME_PREFIXES = ["video/"];
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 4000;
const MEDIA_TOKEN_TTL_SEC = Math.max(300, Number(env.signedUrlTtl) || 300);

export const createVideoSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE),
  description: z.string().trim().max(MAX_DESCRIPTION).optional().nullable(),
  storageKey: z.string().trim().min(1).max(500),
  thumbnailKey: z.string().trim().max(500).optional().nullable(),
  originalFilename: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().max(120).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  durationSeconds: z.number().nonnegative().max(86_400).optional().nullable(),
});

export const updateVideoSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE).optional(),
  description: z.string().trim().max(MAX_DESCRIPTION).optional().nullable(),
  thumbnailKey: z.string().trim().max(500).optional().nullable(),
  durationSeconds: z.number().nonnegative().max(86_400).optional().nullable(),
  status: z.enum(["UPLOADED", "UNDER_REVIEW"]).optional(),
});

export const attachThumbnailSchema = z.object({
  thumbnailKey: z.string().trim().min(1).max(500),
});

export const sendToPortfolioSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE).optional(),
  description: z.string().trim().max(MAX_DESCRIPTION).optional().nullable(),
  categoryIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

function fileExtension(name) {
  return path.extname(String(name || "")).slice(1).toLowerCase();
}

function isVideoStorageKey(storageKey) {
  const unprefixed = stripStoragePrefix(storageKey);
  return (
    unprefixed === "videos/storage" ||
    unprefixed.startsWith("videos/storage/") ||
    unprefixed === "images/video-storage" ||
    unprefixed.startsWith("images/video-storage/")
  );
}

function assertVideoFileMeta({ originalFilename, mimeType }) {
  const ext = fileExtension(originalFilename);
  if (!ALLOWED_VIDEO_EXTS.has(ext)) {
    throw new AppError(
      "فرمت ویدیو پشتیبانی نمی‌شود. فرمت‌های مجاز: mp4، webm، mov، mkv",
      400,
      "FILE_TYPE_NOT_ALLOWED",
    );
  }
  const mime = String(mimeType || "").toLowerCase();
  if (
    mime &&
    mime !== "application/octet-stream" &&
    !ALLOWED_VIDEO_MIME_PREFIXES.some(
      (prefix) => mime === prefix || mime.startsWith(prefix),
    )
  ) {
    throw new AppError("نوع MIME ویدیو نامعتبر است", 400, "FILE_TYPE_NOT_ALLOWED");
  }
}

function canSeeAllVideos(auth) {
  return isFullAccessRole(auth?.roleCode);
}

function ownershipFilter(auth) {
  if (canSeeAllVideos(auth)) return {};
  return { uploadedByUserId: auth.userId };
}

function assertCanAccess(video, auth) {
  if (!video || video.deletedAt) {
    throw new AppError("ویدیو یافت نشد", 404, "NOT_FOUND");
  }
  if (canSeeAllVideos(auth)) return;
  if (video.uploadedByUserId !== auth.userId) {
    throw new AppError("شما اجازه دسترسی به این منبع را ندارید", 403, "FORBIDDEN");
  }
}

function assertCanMutateOwnOrManage(video, auth) {
  assertCanAccess(video, auth);
}

function syncWorkflowStatus(video, portfolioStatus) {
  if (!video.portfolioItemId) {
    return video.status === "UNDER_REVIEW" ? "UNDER_REVIEW" : "UPLOADED";
  }
  if (portfolioStatus === "PUBLISHED") return "PUBLISHED";
  return "IN_PORTFOLIO";
}

function signedMediaUrl(videoId, purpose) {
  const token = signDownloadToken(
    { kind: "COMPANY_VIDEO", videoId, purpose },
    MEDIA_TOKEN_TTL_SEC,
  );
  const leaf = purpose === "thumbnail" ? "thumbnail" : "stream";
  const base = String(env.apiUrl || "").replace(/\/$/, "");
  return `${base}/api/v1/video-storage/${encodeURIComponent(videoId)}/${leaf}?token=${encodeURIComponent(token)}`;
}

export function verifyCompanyVideoMediaToken(token, videoId, purpose) {
  let payload;
  try {
    payload = verifyDownloadToken(token);
  } catch {
    throw new AppError("لینک پخش منقضی یا نامعتبر است", 403, "SIGNED_URL_INVALID");
  }
  if (
    payload?.kind !== "COMPANY_VIDEO" ||
    payload?.videoId !== videoId ||
    (purpose && payload?.purpose !== purpose)
  ) {
    throw new AppError("لینک پخش نامعتبر است", 403, "SIGNED_URL_INVALID");
  }
  return payload;
}

function serializeVideo(row) {
  const portfolio = row.portfolioItem || null;
  const portfolioStatus = portfolio?.deletedAt ? null : portfolio?.status || null;
  const inPortfolio = Boolean(portfolio && !portfolio.deletedAt);
  const publishedPublic = inPortfolio && portfolioStatus === "PUBLISHED";
  const workflowStatus = syncWorkflowStatus(
    { ...row, portfolioItemId: inPortfolio ? row.portfolioItemId : null },
    portfolioStatus,
  );
  const hasThumbnail = Boolean(row.thumbnailKey);
  let thumbnailUrl = null;
  if (hasThumbnail) {
    // Prefer CDN poster for list cards (no auth hop / no expired tokens).
    if (storage.prefersDirectCdnRedirect({ signed: false })) {
      try {
        thumbnailUrl = storage.publicUrl(row.thumbnailKey);
      } catch {
        thumbnailUrl = null;
      }
    }
    if (!thumbnailUrl) {
      thumbnailUrl = signedMediaUrl(row.id, "thumbnail");
    }
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    originalFilename: row.originalFilename,
    storageKey: row.storageKey,
    thumbnailKey: row.thumbnailKey,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    durationSeconds: row.durationSeconds,
    status: workflowStatus,
    processingStatus: row.processingStatus,
    uploadedByUserId: row.uploadedByUserId,
    uploadedBy: row.uploadedBy
      ? {
          id: row.uploadedBy.id,
          fullName: row.uploadedBy.fullName,
          email: row.uploadedBy.email,
        }
      : null,
    portfolioItemId: inPortfolio ? row.portfolioItemId : null,
    portfolioStatus: inPortfolio ? portfolioStatus : null,
    inPortfolio,
    publishedPublic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    /** Prefer fetching /playback for play; list may include a temporary signed URL. */
    playbackUrl: signedMediaUrl(row.id, "stream"),
    thumbnailUrl,
    hasThumbnail,
    streamUrl: `/video-storage/${row.id}/stream`,
    thumbnailStreamUrl: `/video-storage/${row.id}/thumbnail`,
    canSendToPortfolio: !inPortfolio && row.processingStatus !== "FAILED",
  };
}

const videoInclude = {
  uploadedBy: { select: { id: true, fullName: true, email: true } },
  portfolioItem: {
    select: { id: true, status: true, slug: true, deletedAt: true },
  },
};

async function loadVideo(id) {
  return prisma.companyVideo.findFirst({
    where: { id, deletedAt: null },
    include: videoInclude,
  });
}

export async function syncCompanyVideoFromPortfolio(portfolioItemId, portfolioStatus) {
  if (!portfolioItemId) return;
  const linked = await prisma.companyVideo.findFirst({
    where: { portfolioItemId, deletedAt: null },
    select: { id: true },
  });
  if (!linked) return;

  const nextStatus =
    portfolioStatus === "PUBLISHED" ? "PUBLISHED" : "IN_PORTFOLIO";
  await prisma.companyVideo.update({
    where: { id: linked.id },
    data: { status: nextStatus },
  });
}

export async function unlinkCompanyVideoFromPortfolio(portfolioItemId) {
  if (!portfolioItemId) return;
  await prisma.companyVideo.updateMany({
    where: { portfolioItemId, deletedAt: null },
    data: {
      portfolioItemId: null,
      status: "UNDER_REVIEW",
    },
  });
}

export const videoStorageService = {
  async list(query, auth) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 12));
    const q = String(query.q || "").trim();
    const portfolio = String(query.portfolio || "").trim().toUpperCase();
    const published = String(query.published || "").trim().toUpperCase();
    const uploaderId = String(query.uploaderId || "").trim();
    const sort = String(query.sort || "newest").toLowerCase();

    const where = {
      deletedAt: null,
      ...ownershipFilter(auth),
    };

    const andClauses = [];

    if (q) {
      andClauses.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { originalFilename: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          {
            uploadedBy: {
              fullName: { contains: q, mode: "insensitive" },
            },
          },
        ],
      });
    }

    if (canSeeAllVideos(auth) && uploaderId) {
      where.uploadedByUserId = uploaderId;
    }

    if (portfolio === "IN") {
      andClauses.push({
        portfolioItem: { is: { deletedAt: null } },
      });
    } else if (portfolio === "OUT") {
      andClauses.push({
        OR: [
          { portfolioItemId: null },
          { portfolioItem: { is: { deletedAt: { not: null } } } },
        ],
      });
    }

    if (published === "YES") {
      andClauses.push({
        portfolioItem: { is: { deletedAt: null, status: "PUBLISHED" } },
      });
    } else if (published === "NO") {
      andClauses.push({
        OR: [
          { portfolioItemId: null },
          { portfolioItem: { is: { deletedAt: null, status: "UNPUBLISHED" } } },
          { portfolioItem: { is: { deletedAt: { not: null } } } },
        ],
      });
    }

    if (andClauses.length) {
      where.AND = andClauses;
    }

    const orderBy =
      sort === "oldest"
        ? { createdAt: "asc" }
        : sort === "title"
          ? { title: "asc" }
          : sort === "size"
            ? { sizeBytes: "desc" }
            : { createdAt: "desc" };

    const [total, rows] = await Promise.all([
      prisma.companyVideo.count({ where }),
      prisma.companyVideo.findMany({
        where,
        include: videoInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(serializeVideo),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async stats(auth) {
    const base = { deletedAt: null, ...ownershipFilter(auth) };
    const [total, inPortfolio, published] = await Promise.all([
      prisma.companyVideo.count({ where: base }),
      prisma.companyVideo.count({
        where: {
          ...base,
          portfolioItem: { is: { deletedAt: null, status: "UNPUBLISHED" } },
        },
      }),
      prisma.companyVideo.count({
        where: {
          ...base,
          portfolioItem: { is: { deletedAt: null, status: "PUBLISHED" } },
        },
      }),
    ]);
    return { total, inPortfolio, published };
  },

  async listUploaders(auth) {
    if (!canSeeAllVideos(auth)) {
      throw new AppError("شما اجازه دسترسی به این منبع را ندارید", 403, "FORBIDDEN");
    }
    const rows = await prisma.companyVideo.findMany({
      where: { deletedAt: null },
      distinct: ["uploadedByUserId"],
      select: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows
      .map((r) => r.uploadedBy)
      .filter(Boolean)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "fa"));
  },

  async getById(id, auth) {
    const video = await loadVideo(id);
    assertCanAccess(video, auth);
    return serializeVideo(video);
  },

  async create(body, auth, req) {
    assertVideoFileMeta({
      originalFilename: body.originalFilename,
      mimeType: body.mimeType,
    });

    if (!isVideoStorageKey(body.storageKey) || isPublicStorageKey(body.storageKey)) {
      throw new AppError("مسیر ذخیره‌سازی ویدیو نامعتبر است", 400, "INVALID_KEY");
    }
    const unprefixed = stripStoragePrefix(body.storageKey);
    if (
      unprefixed !== "videos/storage" &&
      !unprefixed.startsWith("videos/storage/")
    ) {
      throw new AppError(
        "ویدیو باید در فضای Bunny (videos/storage) ذخیره شود",
        400,
        "INVALID_STORAGE_FOLDER",
      );
    }
    if (body.thumbnailKey) {
      if (
        !isVideoStorageKey(body.thumbnailKey) ||
        isPublicStorageKey(body.thumbnailKey)
      ) {
        throw new AppError("مسیر تصویر بندانگشتی نامعتبر است", 400, "INVALID_KEY");
      }
    }

    const head = await storage.head(body.storageKey).catch(() => null);
    if (!head) {
      throw new AppError("فایل ویدیو در فضای ذخیره‌سازی یافت نشد", 400, "FILE_MISSING");
    }

    const uploadedByUserId = auth.userId;
    if (!uploadedByUserId) {
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    let thumbnailKey = body.thumbnailKey?.trim() || null;
    if (!thumbnailKey) {
      const seek =
        body.durationSeconds && body.durationSeconds > 2
          ? Math.min(2, body.durationSeconds * 0.15)
          : 0.5;
      const extracted = await extractVideoThumbnail(body.storageKey.trim(), {
        seekSeconds: seek,
      });
      if (extracted?.storageKey) thumbnailKey = extracted.storageKey;
    }

    const row = await prisma.companyVideo.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        originalFilename: body.originalFilename.trim(),
        storageKey: body.storageKey.trim(),
        thumbnailKey,
        mimeType: body.mimeType || head.contentType || null,
        sizeBytes: body.sizeBytes ?? head.size ?? null,
        durationSeconds: body.durationSeconds ?? null,
        status: "UPLOADED",
        processingStatus: "READY",
        uploadedByUserId,
      },
      include: videoInclude,
    });

    await writeAudit({
      userId: uploadedByUserId,
      action: "VIDEO_STORAGE_UPLOAD",
      entityType: "CompanyVideo",
      entityId: row.id,
      after: {
        title: row.title,
        storageKey: row.storageKey,
        sizeBytes: row.sizeBytes,
        mimeType: row.mimeType,
      },
      req,
    });

    return serializeVideo(row);
  },

  async update(id, body, auth, req) {
    const existing = await loadVideo(id);
    assertCanMutateOwnOrManage(existing, auth);

    if (body.status && !canSeeAllVideos(auth)) {
      // Employees may not move workflow beyond their own metadata edits.
      throw new AppError("شما اجازه تغییر وضعیت را ندارید", 403, "FORBIDDEN");
    }

    if (existing.portfolioItemId && body.status) {
      throw new AppError(
        "وضعیت ویدیوهای داخل نمونه‌کار از طریق نمونه‌کارها مدیریت می‌شود",
        400,
        "STATUS_LOCKED",
      );
    }

    const data = {};
    if (body.title != null) data.title = body.title.trim();
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.durationSeconds !== undefined) {
      data.durationSeconds = body.durationSeconds;
    }
    if (body.status) data.status = body.status;

    if (body.thumbnailKey !== undefined) {
      if (body.thumbnailKey) {
        if (
          !isVideoStorageKey(body.thumbnailKey) ||
          isPublicStorageKey(body.thumbnailKey)
        ) {
          throw new AppError("مسیر تصویر بندانگشتی نامعتبر است", 400, "INVALID_KEY");
        }
        if (
          existing.thumbnailKey &&
          existing.thumbnailKey !== body.thumbnailKey
        ) {
          await storage.tryDeleteStoredObject(existing.thumbnailKey, {
            logTag: "video-storage",
          });
        }
        data.thumbnailKey = body.thumbnailKey;
      } else {
        if (existing.thumbnailKey) {
          await storage.tryDeleteStoredObject(existing.thumbnailKey, {
            logTag: "video-storage",
          });
        }
        data.thumbnailKey = null;
      }
    }

    const updated = await prisma.companyVideo.update({
      where: { id },
      data,
      include: videoInclude,
    });

    await writeAudit({
      userId: auth.userId,
      action: "VIDEO_STORAGE_UPDATE",
      entityType: "CompanyVideo",
      entityId: id,
      before: {
        title: existing.title,
        description: existing.description,
        status: existing.status,
      },
      after: {
        title: updated.title,
        description: updated.description,
        status: updated.status,
      },
      req,
    });

    return serializeVideo(updated);
  },

  async remove(id, auth, req) {
    const existing = await loadVideo(id);
    assertCanMutateOwnOrManage(existing, auth);

    await prisma.$transaction(async (tx) => {
      if (existing.portfolioItemId) {
        const portfolio = await tx.portfolioItem.findFirst({
          where: { id: existing.portfolioItemId, deletedAt: null },
        });
        if (portfolio) {
          await tx.portfolioItem.update({
            where: { id: portfolio.id },
            data: { deletedAt: new Date(), status: "UNPUBLISHED" },
          });
        }
      }

      await tx.companyVideo.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          portfolioItemId: null,
        },
      });
    });

    await storage.tryDeleteStoredObject(existing.storageKey, {
      logTag: "video-storage",
    });
    if (existing.thumbnailKey) {
      await storage.tryDeleteStoredObject(existing.thumbnailKey, {
        logTag: "video-storage",
      });
    }

    // Portfolio public copy (videos/portfolio) may differ from library key.
    if (existing.portfolioItem?.id) {
      const portfolio = await prisma.portfolioItem.findFirst({
        where: { id: existing.portfolioItem.id },
        select: { storageKey: true, thumbnailKey: true, slug: true },
      });
      if (portfolio?.storageKey && portfolio.storageKey !== existing.storageKey) {
        await storage.tryDeleteStoredObject(portfolio.storageKey, {
          logTag: "video-storage-portfolio",
        });
      }
      if (
        portfolio?.thumbnailKey &&
        portfolio.thumbnailKey !== existing.thumbnailKey
      ) {
        await storage.tryDeleteStoredObject(portfolio.thumbnailKey, {
          logTag: "video-storage-portfolio",
        });
      }
      await afterPublicPortfolioMutation({ slug: portfolio?.slug });
    }

    await writeAudit({
      userId: auth.userId,
      action: "VIDEO_STORAGE_DELETE",
      entityType: "CompanyVideo",
      entityId: id,
      before: {
        title: existing.title,
        storageKey: existing.storageKey,
        portfolioItemId: existing.portfolioItemId,
      },
      after: { deleted: true },
      req,
    });

    return { id, deleted: true };
  },

  async sendToPortfolio(id, body, auth, req) {
    const existing = await loadVideo(id);
    assertCanAccess(existing, auth);

    if (existing.portfolioItemId && !existing.portfolioItem?.deletedAt) {
      throw new AppError(
        "این ویدیو قبلاً به نمونه‌کارها اضافه شده است",
        409,
        "ALREADY_IN_PORTFOLIO",
      );
    }

    const title = (body.title || existing.title).trim();
    const description =
      body.description !== undefined
        ? body.description?.trim() || null
        : existing.description;

    const prepared = await preparePortfolioVideoForWeb(existing.storageKey);

    let portfolioItem;
    try {
      portfolioItem = await prisma.$transaction(async (tx) => {
        // Re-check inside transaction against concurrent sends.
        const fresh = await tx.companyVideo.findFirst({
          where: { id, deletedAt: null },
          include: {
            portfolioItem: { select: { id: true, deletedAt: true } },
          },
        });
        if (!fresh) {
          throw new AppError("ویدیو یافت نشد", 404, "NOT_FOUND");
        }
        if (fresh.portfolioItemId && !fresh.portfolioItem?.deletedAt) {
          throw new AppError(
            "این ویدیو قبلاً به نمونه‌کارها اضافه شده است",
            409,
            "ALREADY_IN_PORTFOLIO",
          );
        }

        const item = await tx.portfolioItem.create({
          data: {
            title,
            description,
            slug: await uniqueSlug(title),
            storageKey: prepared.storageKey,
            thumbnailKey: existing.thumbnailKey || null,
            status: "UNPUBLISHED",
            sortOrder: 0,
            publishedAt: null,
            publishedById: null,
          },
        });

        try {
          await tx.companyVideo.update({
            where: { id },
            data: {
              portfolioItemId: item.id,
              status: "IN_PORTFOLIO",
            },
          });
        } catch (err) {
          if (err?.code === "P2002") {
            throw new AppError(
              "این ویدیو قبلاً به نمونه‌کارها اضافه شده است",
              409,
              "ALREADY_IN_PORTFOLIO",
            );
          }
          throw err;
        }

        if (body.categoryIds?.length) {
          const categories = await tx.portfolioCategory.findMany({
            where: { id: { in: body.categoryIds }, deletedAt: null },
            select: { id: true },
          });
          if (categories.length) {
            await tx.portfolioItemCategory.createMany({
              data: categories.map((c, index) => ({
                itemId: item.id,
                categoryId: c.id,
                sortOrder: index,
              })),
              skipDuplicates: true,
            });
          }
        }

        return item;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err?.code === "P2002") {
        throw new AppError(
          "این ویدیو قبلاً به نمونه‌کارها اضافه شده است",
          409,
          "ALREADY_IN_PORTFOLIO",
        );
      }
      throw err;
    }

    await writeAudit({
      userId: auth.userId,
      action: "VIDEO_STORAGE_SEND_PORTFOLIO",
      entityType: "CompanyVideo",
      entityId: id,
      after: {
        portfolioItemId: portfolioItem.id,
        title: portfolioItem.title,
        status: portfolioItem.status,
        optimized: prepared.optimized,
      },
      req,
    });

    await afterPublicPortfolioMutation({ slug: portfolioItem.slug });
    return this.getById(id, auth);
  },

  async attachThumbnail(id, thumbnailKey, auth, req) {
    const existing = await loadVideo(id);
    assertCanAccess(existing, auth);

    const key = String(thumbnailKey || "").trim();
    if (!key) {
      throw new AppError("تصویر بندانگشتی الزامی است", 400, "THUMBNAIL_REQUIRED");
    }
    if (!isVideoStorageKey(key) || isPublicStorageKey(key)) {
      throw new AppError("مسیر تصویر بندانگشتی نامعتبر است", 400, "INVALID_KEY");
    }

    const head = await storage.head(key).catch(() => null);
    if (!head) {
      throw new AppError("فایل بندانگشتی یافت نشد", 400, "FILE_MISSING");
    }

    if (existing.thumbnailKey && existing.thumbnailKey !== key) {
      await storage.tryDeleteStoredObject(existing.thumbnailKey, {
        logTag: "video-storage",
      });
    }

    const updated = await prisma.companyVideo.update({
      where: { id },
      data: { thumbnailKey: key },
      include: videoInclude,
    });

    await writeAudit({
      userId: auth.userId,
      action: "VIDEO_STORAGE_THUMBNAIL",
      entityType: "CompanyVideo",
      entityId: id,
      after: { thumbnailKey: key },
      req,
    });

    return serializeVideo(updated);
  },

  async getPlaybackUrl(id, auth) {
    const video = await loadVideo(id);
    assertCanAccess(video, auth);

    // Prefer Bunny CDN (same path portfolio admin uses). Fall back to a
    // short-lived API stream token so <video> does not need cookie refresh.
    let playbackUrl = null;
    let delivery = "proxy";
    if (storage.prefersDirectCdnRedirect({ signed: true })) {
      playbackUrl = await storage
        .createPresignedGetUrl(video.storageKey)
        .catch(() => null);
      if (playbackUrl) delivery = "cdn-signed";
    }
    if (!playbackUrl && storage.prefersDirectCdnRedirect({ signed: false })) {
      playbackUrl =
        (await storage
          .createPresignedGetUrl(video.storageKey)
          .catch(() => null)) || storage.publicUrl(video.storageKey);
      if (playbackUrl) delivery = "cdn";
    }
    if (!playbackUrl) {
      playbackUrl = signedMediaUrl(video.id, "stream");
      delivery = "token";
    }

    let thumbnailUrl = null;
    if (video.thumbnailKey) {
      if (storage.prefersDirectCdnRedirect({ signed: false })) {
        thumbnailUrl =
          (await storage
            .createPresignedGetUrl(video.thumbnailKey)
            .catch(() => null)) || storage.publicUrl(video.thumbnailKey);
      }
      if (!thumbnailUrl) {
        thumbnailUrl = signedMediaUrl(video.id, "thumbnail");
      }
    }

    return {
      id: video.id,
      mimeType: video.mimeType || "video/mp4",
      sizeBytes: video.sizeBytes,
      playbackUrl,
      thumbnailUrl,
      delivery,
      expiresIn: MEDIA_TOKEN_TTL_SEC,
    };
  },

  async getStreamTarget(id, auth) {
    const video = await loadVideo(id);
    if (auth) assertCanAccess(video, auth);
    else if (!video || video.deletedAt) {
      throw new AppError("ویدیو یافت نشد", 404, "NOT_FOUND");
    }
    return {
      storageKey: video.storageKey,
      mimeType: video.mimeType || "video/mp4",
      name: video.originalFilename || "video.mp4",
    };
  },

  async getThumbnailTarget(id, auth) {
    let video = await loadVideo(id);
    if (auth) assertCanAccess(video, auth);
    else if (!video || video.deletedAt) {
      throw new AppError("ویدیو یافت نشد", 404, "NOT_FOUND");
    }

    if (!video.thumbnailKey) {
      const seek =
        video.durationSeconds && video.durationSeconds > 2
          ? Math.min(2, video.durationSeconds * 0.15)
          : 0.5;
      const extracted = await extractVideoThumbnail(video.storageKey, {
        seekSeconds: seek,
      });
      if (extracted?.storageKey) {
        video = await prisma.companyVideo.update({
          where: { id: video.id },
          data: { thumbnailKey: extracted.storageKey },
          include: videoInclude,
        });
      }
    }

    if (!video.thumbnailKey) {
      throw new AppError("تصویر بندانگشتی در دسترس نیست", 404, "NOT_FOUND");
    }
    return {
      storageKey: video.thumbnailKey,
      mimeType: "image/jpeg",
      name: "thumbnail.jpg",
    };
  },
};

function pipeMediaStream(stream, res) {
  stream.on("error", (err) => {
    console.error("[video-storage-stream]", err?.message || err);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: { code: "STREAM_FAILED", message: "خواندن ویدیو ناموفق بود" },
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

export async function streamCompanyVideo(req, res, file) {
  const storageKey = file.storageKey;
  const contentTypeHint = file.mimeType || "video/mp4";

  // Match portfolio streaming: after ACL, hand Range requests to Bunny CDN.
  // Without pull-zone token auth, createPresignedGetUrl returns null for private
  // keys — fall back to publicUrl exactly like streamPortfolioVideo.
  if (storage.prefersDirectCdnRedirect({ signed: true })) {
    try {
      const url = await storage.createPresignedGetUrl(storageKey);
      if (url) {
        res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Accept-Ranges", "bytes");
        res.redirect(302, url);
        return;
      }
    } catch (err) {
      console.warn(
        "[video-storage-stream] signed CDN failed, trying public CDN:",
        err?.message || err,
      );
    }
  }

  if (storage.prefersDirectCdnRedirect({ signed: false })) {
    try {
      const url =
        (await storage.createPresignedGetUrl(storageKey).catch(() => null)) ||
        storage.publicUrl(storageKey);
      if (url) {
        res.setHeader(
          "Cache-Control",
          "private, max-age=120, stale-while-revalidate=300",
        );
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Accept-Ranges", "bytes");
        res.redirect(302, url);
        return;
      }
    } catch (err) {
      console.warn(
        "[video-storage-stream] CDN redirect failed, proxying:",
        err?.message || err,
      );
    }
  }

  const head = await storage.head(storageKey);
  const fileSize = head.size;
  const contentType =
    contentTypeHint ||
    (head.contentType && head.contentType !== "application/octet-stream"
      ? head.contentType
      : null) ||
    "video/mp4";

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=60, must-revalidate");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (file.name) {
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
  }

  const range = req.headers.range;
  if (range && fileSize && fileSize > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : fileSize - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      end >= fileSize ||
      start > end
    ) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    const { stream, contentLength, contentRange } =
      await storage.openReadStream(storageKey, {
        start,
        end,
      });
    res.status(206);
    res.setHeader(
      "Content-Range",
      contentRange || `bytes ${start}-${end}/${fileSize}`,
    );
    res.setHeader("Content-Length", contentLength ?? end - start + 1);
    pipeMediaStream(stream, res);
    return;
  }

  const { stream, contentLength } = await storage.openReadStream(storageKey);
  if (contentLength != null || fileSize) {
    res.setHeader("Content-Length", contentLength ?? fileSize);
  }
  pipeMediaStream(stream, res);
}

export function assertUploadPurposeAllowed(purpose, auth) {
  if (purpose === UPLOAD_PURPOSE.VIDEO_STORAGE) {
    if (
      !hasAnyPermission(
        auth?.permissions,
        ["video_storage.upload"],
        auth?.roleCode,
      )
    ) {
      throw new AppError("شما اجازه دسترسی به این منبع را ندارید", 403, "FORBIDDEN");
    }
    return;
  }
  if (purpose === UPLOAD_PURPOSE.VIDEO_STORAGE_THUMBNAIL) {
    if (
      !hasAnyPermission(
        auth?.permissions,
        ["video_storage.view", "video_storage.upload"],
        auth?.roleCode,
      )
    ) {
      throw new AppError("شما اجازه دسترسی به این منبع را ندارید", 403, "FORBIDDEN");
    }
  }
}

export { isVideoStorageKey, canSeeAllVideos };
