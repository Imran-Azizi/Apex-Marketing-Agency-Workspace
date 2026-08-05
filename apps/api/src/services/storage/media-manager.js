import crypto from "crypto";
import { env } from "../../config/env.js";
import { extensionOf, resolveCloudinaryResourceType } from "./resource-type.js";

/** Canonical upload purposes — single source of truth for folder routing. */
export const UPLOAD_PURPOSE = Object.freeze({
  PORTAL_ASSET: "portal-asset",
  PRODUCTION_FINAL: "production-final",
  NARRATION_AUDIO: "narration-audio",
  EMPLOYEE_PROFILE: "employee-profile",
  GENERIC: "generic",
});

/** Top-level Cloudinary folder segments (under CLOUDINARY_FOLDER_PREFIX). */
export const MEDIA_ROOTS = Object.freeze({
  IMAGES: "images",
  VIDEOS: "videos",
  DOCUMENTS: "documents",
  AUDIO: "audio",
  PROJECTS: "projects",
  USERS: "users",
  LEGACY: "legacy",
  UPLOADS: "uploads",
});

/** Legacy flat folders from before hierarchical routing — still valid for reads. */
export const LEGACY_UPLOAD_FOLDERS = Object.freeze([
  "uploads",
  "client-assets",
  "project-audio",
  "production-watermarked",
  "production-clean",
  "profile-images",
  "samples",
]);

export const ALLOWED_UPLOAD_FOLDERS = Object.freeze([
  ...Object.values(MEDIA_ROOTS),
  ...LEGACY_UPLOAD_FOLDERS,
]);

const LEGACY_FOLDER_TO_PURPOSE = Object.freeze({
  "client-assets": UPLOAD_PURPOSE.PORTAL_ASSET,
  "project-audio": UPLOAD_PURPOSE.NARRATION_AUDIO,
  "production-watermarked": UPLOAD_PURPOSE.PRODUCTION_FINAL,
  "production-clean": UPLOAD_PURPOSE.PRODUCTION_FINAL,
  "profile-images": UPLOAD_PURPOSE.EMPLOYEE_PROFILE,
  samples: UPLOAD_PURPOSE.GENERIC,
  uploads: UPLOAD_PURPOSE.GENERIC,
});

const MIME_MEDIA_CATEGORY = Object.freeze({
  image: MEDIA_ROOTS.IMAGES,
  video: MEDIA_ROOTS.VIDEOS,
  audio: MEDIA_ROOTS.AUDIO,
  document: MEDIA_ROOTS.DOCUMENTS,
});

/**
 * @param {unknown} id
 * @returns {string | null}
 */
export function sanitizePathSegment(id) {
  const raw = String(id || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!raw || raw.includes("..") || raw.includes("//")) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(raw)) return null;
  return raw;
}

/**
 * @param {unknown} filename
 */
export function sanitizeFilename(filename) {
  return String(filename || "file").replace(
    /[^\w.\-()\s\u0600-\u06FF]+/g,
    "_",
  );
}

/**
 * @param {unknown} folder
 */
export function normalizeUploadFolder(folder) {
  const raw = String(folder || "uploads")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!raw || raw.includes("..") || raw.includes("//")) {
    return MEDIA_ROOTS.UPLOADS;
  }
  const first = raw.split("/")[0];
  if (!ALLOWED_UPLOAD_FOLDERS.includes(first)) {
    return MEDIA_ROOTS.UPLOADS;
  }
  return raw;
}

/**
 * @param {string | null | undefined} mimeType
 * @param {string | null | undefined} filename
 */
export function mediaCategoryFromMime(mimeType, filename) {
  const resourceType = resolveCloudinaryResourceType({
    contentType: mimeType,
    filename,
  });
  if (resourceType === "image") return MIME_MEDIA_CATEGORY.image;
  if (resourceType === "video") {
    const mime = String(mimeType || "").toLowerCase();
    if (mime.startsWith("audio/")) return MIME_MEDIA_CATEGORY.audio;
    const ext = extensionOf(filename);
    const audioExt = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"]);
    if (ext && audioExt.has(ext)) return MIME_MEDIA_CATEGORY.audio;
    return MIME_MEDIA_CATEGORY.video;
  }
  return MIME_MEDIA_CATEGORY.document;
}

/**
 * @typedef {Object} UploadContext
 * @property {string} [purpose]
 * @property {string} [projectId]
 * @property {string} [userId]
 * @property {string} [assetKind]
 * @property {"WATERMARKED"|"CLEAN"} [videoType]
 * @property {string} [folder] legacy hint
 */

/**
 * Build upload context from multipart body + auth.
 * @param {Record<string, unknown>} body
 * @param {{ userId?: string }} [auth]
 * @returns {UploadContext}
 */
export function parseUploadContext(body = {}, auth = {}) {
  const purpose =
    String(body.purpose || "").trim() ||
    legacyPurposeFromFolder(body.folder) ||
    UPLOAD_PURPOSE.GENERIC;

  return {
    purpose,
    projectId: sanitizePathSegment(body.projectId),
    userId: sanitizePathSegment(body.userId) || sanitizePathSegment(auth.userId),
    assetKind: String(body.assetKind || body.kind || "").trim() || undefined,
    videoType:
      String(body.videoType || "").toUpperCase() === "CLEAN"
        ? "CLEAN"
        : String(body.videoType || "").toUpperCase() === "WATERMARKED"
          ? "WATERMARKED"
          : undefined,
    folder: body.folder ? normalizeUploadFolder(body.folder) : undefined,
  };
}

/**
 * @param {unknown} folder
 */
export function legacyPurposeFromFolder(folder) {
  const normalized = normalizeUploadFolder(folder);
  const first = normalized.split("/")[0];
  return LEGACY_FOLDER_TO_PURPOSE[first] || null;
}

/**
 * Resolve Cloudinary folder path (without account prefix) for a new upload.
 * @param {UploadContext} context
 * @param {{ contentType?: string | null, filename?: string | null }} fileInfo
 * @returns {{ folderPath: string, category: string, purpose: string }}
 */
export function resolveMediaPlacement(context, fileInfo = {}) {
  const purpose = context.purpose || UPLOAD_PURPOSE.GENERIC;
  const category = mediaCategoryFromMime(
    fileInfo.contentType,
    fileInfo.filename,
  );

  if (purpose === UPLOAD_PURPOSE.EMPLOYEE_PROFILE && context.userId) {
    return {
      folderPath: `${MEDIA_ROOTS.USERS}/${context.userId}`,
      category: MEDIA_ROOTS.IMAGES,
      purpose,
    };
  }

  if (purpose === UPLOAD_PURPOSE.NARRATION_AUDIO && context.projectId) {
    return {
      folderPath: `${MEDIA_ROOTS.PROJECTS}/${context.projectId}/audio`,
      category: MEDIA_ROOTS.AUDIO,
      purpose,
    };
  }

  if (purpose === UPLOAD_PURPOSE.PRODUCTION_FINAL && context.projectId) {
    const variant =
      context.videoType === "CLEAN" ? "final/clean" : "final/watermarked";
    return {
      folderPath: `${MEDIA_ROOTS.PROJECTS}/${context.projectId}/${variant}`,
      category: MEDIA_ROOTS.VIDEOS,
      purpose,
    };
  }

  if (purpose === UPLOAD_PURPOSE.PORTAL_ASSET) {
    return {
      folderPath: category,
      category,
      purpose,
    };
  }

  if (context.projectId) {
    return {
      folderPath: `${MEDIA_ROOTS.PROJECTS}/${context.projectId}`,
      category,
      purpose,
    };
  }

  return {
    folderPath: category,
    category,
    purpose,
  };
}

/**
 * @param {string} folderPath
 * @param {string} filename
 */
export function generateStorageKey(folderPath, filename) {
  const safeFolder = normalizeMediaFolderPath(folderPath);
  const safeName = sanitizeFilename(filename);
  return `${safeFolder}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeName}`;
}

/**
 * @param {unknown} folderPath
 */
export function normalizeMediaFolderPath(folderPath) {
  const raw = String(folderPath || MEDIA_ROOTS.UPLOADS)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!raw || raw.includes("..") || raw.includes("//")) {
    return MEDIA_ROOTS.UPLOADS;
  }
  const segments = raw.split("/").filter(Boolean);
  for (const seg of segments) {
    if (!/^[a-zA-Z0-9_-]+$/.test(seg)) {
      return MEDIA_ROOTS.UPLOADS;
    }
  }
  return segments.join("/");
}

/**
 * @param {string} storageKey
 * @param {{ contentType?: string | null, meta?: Record<string, unknown> | null }} [opts]
 */
export function getMediaCategory(storageKey, opts = {}) {
  const meta = asObject(opts.meta?.storage) || asObject(opts.meta);
  if (typeof meta?.category === "string") return meta.category;

  const key = String(storageKey || "");
  if (!key || key.startsWith("ref://")) return "reference";

  const first = key.split("/")[0];
  if (Object.values(MEDIA_ROOTS).includes(first)) {
    if (first === MEDIA_ROOTS.PROJECTS) {
      if (key.includes("/audio/")) return MEDIA_ROOTS.AUDIO;
      if (key.includes("/final/clean")) return MEDIA_ROOTS.VIDEOS;
      if (key.includes("/final/watermarked")) return MEDIA_ROOTS.VIDEOS;
      return MEDIA_ROOTS.PROJECTS;
    }
    if (first === MEDIA_ROOTS.USERS) return MEDIA_ROOTS.IMAGES;
    return first;
  }

  if (LEGACY_UPLOAD_FOLDERS.includes(first)) {
    return legacyCategoryFromFolder(first, opts.contentType, key);
  }

  return mediaCategoryFromMime(opts.contentType, key);
}

function legacyCategoryFromFolder(folder, contentType, storageKey) {
  if (folder === "profile-images") return MEDIA_ROOTS.IMAGES;
  if (folder === "project-audio") return MEDIA_ROOTS.AUDIO;
  if (folder === "production-watermarked" || folder === "production-clean") {
    return MEDIA_ROOTS.VIDEOS;
  }
  if (folder === "client-assets") {
    return mediaCategoryFromMime(contentType, storageKey);
  }
  return MEDIA_ROOTS.UPLOADS;
}

/**
 * Human-readable folder label (Persian) for Media Library UI.
 * @param {string} storageKey
 * @param {{ contentType?: string | null, meta?: Record<string, unknown> | null }} [opts]
 */
export function getMediaFolderLabel(storageKey, opts = {}) {
  const meta = asObject(opts.meta?.storage) || asObject(opts.meta);
  if (typeof meta?.folderPath === "string") {
    return formatFolderPathLabel(meta.folderPath);
  }

  const key = String(storageKey || "");
  if (key.startsWith(`${MEDIA_ROOTS.USERS}/`)) return "پروفایل کاربر";
  if (key.startsWith(`${MEDIA_ROOTS.PROJECTS}/`)) {
    if (key.includes("/audio/")) return "صوت پروژه";
    if (key.includes("/final/clean")) return "ویدیوی نهایی (پاک)";
    if (key.includes("/final/watermarked")) return "ویدیوی نهایی (واترمارک)";
    return "دارایی‌های پروژه";
  }

  const category = getMediaCategory(storageKey, opts);
  const labels = {
    [MEDIA_ROOTS.IMAGES]: "تصاویر",
    [MEDIA_ROOTS.VIDEOS]: "ویدیوها",
    [MEDIA_ROOTS.DOCUMENTS]: "اسناد",
    [MEDIA_ROOTS.AUDIO]: "صوت",
    [MEDIA_ROOTS.PROJECTS]: "پروژه",
    [MEDIA_ROOTS.USERS]: "کاربران",
    [MEDIA_ROOTS.UPLOADS]: "عمومی",
    reference: "لینک مرجع",
  };
  return labels[category] || category;
}

function formatFolderPathLabel(folderPath) {
  const parts = String(folderPath).split("/");
  if (parts[0] === MEDIA_ROOTS.PROJECTS && parts.length >= 2) {
    if (parts.includes("audio")) return "صوت پروژه";
    if (parts.includes("clean")) return "ویدیوی نهایی (پاک)";
    if (parts.includes("watermarked")) return "ویدیوی نهایی (واترمارک)";
    return "دارایی‌های پروژه";
  }
  if (parts[0] === MEDIA_ROOTS.USERS) return "پروفایل کاربر";
  return getMediaFolderLabel(parts[0], {});
}

/**
 * @param {string} storageKey
 */
export function isCleanFinalStorageKey(storageKey) {
  const key = String(storageKey || "");
  return (
    key.includes("production-clean") ||
    key.includes("/final/clean/") ||
    key.endsWith("/final/clean")
  );
}

/**
 * Build metadata persisted on ClientAsset / ProjectFile.meta.storage
 * @param {object} saved upload result from storage.saveBuffer
 * @param {{ folderPath: string, category: string, purpose: string }} placement
 */
export function buildStorageMeta(saved, placement) {
  const prefix = String(env.cloudinaryFolderPrefix || "apex").replace(
    /^\/+|\/+$/g,
    "",
  );
  const folderPath = placement.folderPath;
  const publicId = saved.publicId || null;
  return {
    provider: saved.provider || env.storageDriver,
    publicId,
    folder: placement.category,
    folderPath,
    cloudinaryFolder: prefix ? `${prefix}/${folderPath}` : folderPath,
    resourceType: saved.resourceType || null,
    url: saved.url || null,
    category: placement.category,
    purpose: placement.purpose,
    format: saved.format || extensionOf(saved.key) || null,
    bytes: saved.bytes ?? saved.sizeBytes ?? null,
  };
}

/**
 * Merge storage metadata into an existing meta object.
 */
export function mergeStorageMeta(existingMeta, storageMeta) {
  const base = asObject(existingMeta) || {};
  return {
    ...base,
    storage: {
      ...(asObject(base.storage) || {}),
      ...storageMeta,
    },
  };
}

/**
 * Cloudinary tags for an upload.
 */
export function buildCloudinaryTags(placement) {
  const tags = ["apex", placement.category, placement.purpose];
  const projectId = placement.folderPath.match(/projects\/([^/]+)/)?.[1];
  const userId = placement.folderPath.match(/users\/([^/]+)/)?.[1];
  if (projectId) tags.push(`project_${projectId}`);
  if (userId) tags.push(`user_${userId}`);
  return [...new Set(tags.filter(Boolean))];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}
