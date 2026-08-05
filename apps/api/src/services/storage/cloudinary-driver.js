import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import {
  extensionOf,
  resolveCloudinaryResourceType,
  toCloudinaryPublicId,
} from "./resource-type.js";
import {
  buildCloudinaryTags,
  buildStorageMeta,
  generateStorageKey,
  normalizeMediaFolderPath,
  sanitizeFilename,
} from "./media-manager.js";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    throw new AppError(
      "Cloudinary is not configured",
      500,
      "STORAGE_MISCONFIGURED",
    );
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  configured = true;
}

function withRootPrefix(publicId) {
  const prefix = String(env.cloudinaryFolderPrefix || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!prefix) return publicId;
  if (publicId === prefix || publicId.startsWith(`${prefix}/`)) return publicId;
  return `${prefix}/${publicId}`;
}

/**
 * Raw assets keep the extension in public_id; image/video strip it.
 * @param {string} storageKey
 * @param {"image"|"video"|"raw"} [resourceType]
 */
function publicIdFor(storageKey, resourceType) {
  const id =
    resourceType === "raw"
      ? String(storageKey || "")
      : toCloudinaryPublicId(storageKey);
  return withRootPrefix(id);
}

function wrapCloudinaryError(err, fallbackMessage = "Cloudinary error") {
  const message =
    err?.error?.message ||
    err?.message ||
    (typeof err === "string" ? err : fallbackMessage);
  const httpCode = Number(err?.http_code || err?.statusCode || 0);
  if (httpCode === 404 || /not found/i.test(String(message))) {
    return new AppError("فایل یافت نشد", 404, "NOT_FOUND");
  }
  if (
    httpCode === 401 ||
    httpCode === 403 ||
    /invalid.*(api|signature|cloud)/i.test(String(message))
  ) {
    return new AppError(
      "اتصال به Cloudinary ناموفق بود",
      502,
      "CLOUDINARY_AUTH",
    );
  }
  return new AppError(
    `آپلود/دسترسی Cloudinary ناموفق: ${message}`,
    502,
    "CLOUDINARY_ERROR",
  );
}

/**
 * @param {string} storageKey
 * @param {{ contentType?: string | null }} [meta]
 */
function resourceTypeForKey(storageKey, meta = {}) {
  return resolveCloudinaryResourceType({
    contentType: meta.contentType,
    storageKey,
    filename: storageKey,
  });
}

export const cloudinaryDriver = {
  ensureConfigured,

  publicIdForKey(storageKey, resourceType) {
    return publicIdFor(storageKey, resourceType || resourceTypeForKey(storageKey));
  },

  /**
   * Build a public delivery URL for a storage key.
   * Prefer the returned upload `secure_url` when available; this is the fallback.
   */
  publicUrl(storageKey, { contentType } = {}) {
    ensureConfigured();
    const resourceType = resourceTypeForKey(storageKey, { contentType });
    const publicId = publicIdFor(storageKey, resourceType);
    const format = extensionOf(storageKey);
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "upload",
      secure: true,
      sign_url: false,
      ...(format && resourceType !== "raw" ? { format } : {}),
    });
  },

  /**
   * Upload bytes under an existing or newly generated storage key.
   * When `storageKey` is provided (migration), the DB key stays unchanged.
   */
  async saveBuffer(
    buffer,
    {
      filename,
      folder = "uploads",
      contentType,
      storageKey,
      overwrite = false,
      placement,
    } = {},
  ) {
    ensureConfigured();
    const safeName = sanitizeFilename(filename);
    const folderPath = placement?.folderPath
      ? normalizeMediaFolderPath(placement.folderPath)
      : normalizeMediaFolderPath(folder);
    const key =
      storageKey || generateStorageKey(folderPath, safeName || filename);
    const resourceType = resolveCloudinaryResourceType({
      contentType,
      filename: safeName || key,
      storageKey: key,
    });
    const publicId = publicIdFor(key, resourceType);
    const tags = placement
      ? buildCloudinaryTags(placement)
      : ["apex", folderPath.split("/")[0] || "uploads"];

    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: resourceType === "raw" ? "raw" : "auto",
            overwrite: Boolean(overwrite),
            unique_filename: false,
            use_filename: false,
            type: "upload",
            tags,
            context: `apex_key=${key}|folder=${folderPath}|category=${placement?.category || folderPath.split("/")[0]}`,
          },
          (err, uploaded) => {
            if (err) reject(err);
            else resolve(uploaded);
          },
        );
        stream.end(buffer);
      });

      const url = result?.secure_url || this.publicUrl(key, { contentType });
      const saved = {
        key,
        url,
        mimeType: contentType || null,
        sizeBytes: result?.bytes != null ? Number(result.bytes) : buffer.length,
        provider: "cloudinary",
        publicId: result?.public_id || publicId,
        resourceType: result?.resource_type || resourceType,
        format: result?.format || extensionOf(key) || null,
        bytes: result?.bytes != null ? Number(result.bytes) : buffer.length,
      };

      if (placement) {
        saved.storageMeta = buildStorageMeta(saved, placement);
        saved.folderPath = placement.folderPath;
        saved.category = placement.category;
      }

      return saved;
    } catch (err) {
      throw wrapCloudinaryError(err, "Cloudinary upload failed");
    }
  },

  async exists(storageKey) {
    ensureConfigured();
    const preferred = resourceTypeForKey(storageKey);
    for (const resourceType of [...new Set([preferred, "image", "video", "raw"])]) {
      try {
        await cloudinary.api.resource(publicIdFor(storageKey, resourceType), {
          resource_type: resourceType,
        });
        return true;
      } catch (err) {
        const code = Number(err?.error?.http_code || err?.http_code || 0);
        if (code === 404) continue;
        throw wrapCloudinaryError(err);
      }
    }
    return false;
  },

  async head(storageKey) {
    ensureConfigured();
    const tryTypes = [
      resourceTypeForKey(storageKey),
      "image",
      "video",
      "raw",
    ];
    const unique = [...new Set(tryTypes)];
    let lastErr = null;
    for (const resourceType of unique) {
      try {
        const info = await cloudinary.api.resource(
          publicIdFor(storageKey, resourceType),
          { resource_type: resourceType },
        );
        return {
          size: Number(info.bytes || 0),
          contentType: null,
          fullPath: null,
          resourceType: info.resource_type || resourceType,
          publicId: info.public_id,
          secureUrl: info.secure_url || null,
        };
      } catch (err) {
        lastErr = err;
        const code = Number(err?.error?.http_code || err?.http_code || 0);
        if (code === 404) continue;
        throw wrapCloudinaryError(err);
      }
    }
    throw wrapCloudinaryError(lastErr || new Error("Not found"));
  },

  async openReadStream(storageKey, { start, end } = {}) {
    const head = await this.head(storageKey);
    const url =
      head.secureUrl ||
      this.publicUrl(storageKey, { contentType: head.contentType });

    const headers = {};
    if (start != null) {
      headers.Range = `bytes=${start}-${end != null ? end : ""}`;
    }

    let res;
    try {
      res = await fetch(url, { headers });
    } catch (err) {
      throw wrapCloudinaryError(err, "Failed to fetch Cloudinary asset");
    }

    if (res.status === 404) {
      throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
    }
    if (!res.ok && res.status !== 206) {
      throw new AppError(
        `خواندن فایل از Cloudinary ناموفق بود (${res.status})`,
        502,
        "CLOUDINARY_FETCH",
      );
    }

    if (!res.body) {
      throw new AppError("پاسخ خالی از Cloudinary", 502, "CLOUDINARY_FETCH");
    }

    return {
      stream: Readable.fromWeb(res.body),
      contentLength: res.headers.get("content-length")
        ? Number(res.headers.get("content-length"))
        : undefined,
      contentRange: res.headers.get("content-range") || undefined,
      contentType: res.headers.get("content-type") || undefined,
      fileSize: head.size,
    };
  },

  async deleteObject(storageKey) {
    ensureConfigured();
    const preferred = resourceTypeForKey(storageKey);
    const types = [...new Set([preferred, "image", "video", "raw"])];
    let deleted = false;
    let lastErr = null;
    for (const resourceType of types) {
      try {
        const result = await cloudinary.uploader.destroy(
          publicIdFor(storageKey, resourceType),
          {
            resource_type: resourceType,
            invalidate: true,
          },
        );
        if (result?.result === "ok" || result?.result === "not found") {
          deleted = true;
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }
    if (!deleted && lastErr) throw wrapCloudinaryError(lastErr);
  },

  /**
   * Short-lived signed delivery URL (public upload type + signature + expiry).
   */
  async createPresignedGetUrl(storageKey, ttl = env.signedUrlTtl) {
    ensureConfigured();
    let resourceType = resourceTypeForKey(storageKey);
    try {
      const head = await this.head(storageKey);
      if (head.resourceType) resourceType = head.resourceType;
    } catch {
      // fall back to extension-based type
    }
    const publicId = publicIdFor(storageKey, resourceType);
    const expiresAt = Math.floor(Date.now() / 1000) + Number(ttl || 300);
    const format = extensionOf(storageKey);
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "upload",
      secure: true,
      sign_url: true,
      expires_at: expiresAt,
      ...(format && resourceType !== "raw" ? { format } : {}),
    });
  },
};
