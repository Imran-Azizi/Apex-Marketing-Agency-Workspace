import { env } from "../config/env.js";
import { signDownloadToken, verifyDownloadToken } from "../utils/tokens.js";
import { AppError } from "../utils/response.js";
import {
  generateStorageKey,
  parseUploadContext,
  resolveMediaPlacement,
  buildStorageMeta,
  sanitizeFilename,
} from "./storage/media-manager.js";
import { bunnyDriver } from "./storage/bunny-driver.js";

function assertStorageConfigured() {
  if (env.bunnyStorageZone && env.bunnyStorageApiKey) return;
  throw new AppError(
    "Bunny.net is not configured. Set BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY.",
    500,
    "STORAGE_MISCONFIGURED",
  );
}

const deliveryUrlCache = new Map();
const DELIVERY_URL_TTL_MS = 5 * 60 * 1000;

function getCachedDeliveryUrl(key) {
  const hit = deliveryUrlCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    deliveryUrlCache.delete(key);
    return null;
  }
  return hit.url;
}

function setCachedDeliveryUrl(key, url) {
  if (deliveryUrlCache.size > 500) {
    const oldest = deliveryUrlCache.keys().next().value;
    if (oldest != null) deliveryUrlCache.delete(oldest);
  }
  deliveryUrlCache.set(key, {
    url,
    expiresAt: Date.now() + DELIVERY_URL_TTL_MS,
  });
}

function placementFor(opts = {}) {
  const context = opts.uploadContext || parseUploadContext({ folder: opts.folder }, {});
  return resolveMediaPlacement(context, {
    contentType: opts.contentType,
    filename: opts.filename,
  });
}

/**
 * Application storage facade. Bunny.net is the only external provider.
 */
export const storage = {
  isObjectStorage: () => true,
  isBunny: () => true,
  providerName: () => "bunny",

  prefersDirectCdnRedirect({ signed = false } = {}) {
    if (signed) return Boolean(env.bunnyCdnTokenKey);
    return Boolean(env.bunnyCdnHostname || env.storagePublicBase);
  },

  publicUrl(key, opts = {}) {
    assertStorageConfigured();
    return bunnyDriver.publicUrl(key, opts);
  },

  async resolveDeliveryUrl(key, opts = {}) {
    assertStorageConfigured();
    const storageKey = String(key || "").replace(/^\/+/, "");
    if (!storageKey) {
      throw new AppError("File key required", 400, "INVALID_KEY");
    }
    const cached = getCachedDeliveryUrl(storageKey);
    if (cached) return cached;
    const url =
      typeof bunnyDriver.resolveDeliveryUrl === "function"
        ? await bunnyDriver.resolveDeliveryUrl(storageKey, opts)
        : bunnyDriver.publicUrl(storageKey, opts);
    if (url) setCachedDeliveryUrl(storageKey, url);
    return url;
  },

  async saveBuffer(
    buffer,
    {
      filename,
      folder = "uploads",
      contentType,
      storageKey,
      uploadContext,
      overwrite,
    } = {},
  ) {
    assertStorageConfigured();
    const placement = placementFor({
      filename,
      folder,
      contentType,
      uploadContext,
    });
    try {
      return await bunnyDriver.saveBuffer(buffer, {
        filename,
        folder: placement.folderPath,
        contentType,
        storageKey,
        overwrite,
        placement,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        err?.message || "Storage upload failed",
        502,
        "STORAGE_UPLOAD_FAILED",
      );
    }
  },

  async saveFile(
    filePath,
    {
      filename,
      folder = "uploads",
      contentType,
      storageKey,
      uploadContext,
      overwrite,
      sizeBytes,
    } = {},
  ) {
    assertStorageConfigured();
    const placement = placementFor({
      filename,
      folder,
      contentType,
      uploadContext,
    });
    try {
      return await bunnyDriver.saveFile(filePath, {
        filename,
        folder: placement.folderPath,
        contentType,
        storageKey,
        overwrite,
        placement,
        sizeBytes,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        err?.message || "Storage upload failed",
        502,
        "STORAGE_UPLOAD_FAILED",
      );
    }
  },

  async saveUploadedFile(file, opts = {}) {
    if (!file) {
      throw new AppError("فایل الزامی است", 400, "FILE_REQUIRED");
    }
    const payload = {
      filename: opts.filename || file.originalname,
      folder: opts.folder,
      contentType: opts.contentType || file.mimetype,
      storageKey: opts.storageKey,
      uploadContext: opts.uploadContext,
      overwrite: opts.overwrite,
      sizeBytes: file.size,
    };
    if (file.path) return this.saveFile(file.path, payload);
    if (file.buffer) return this.saveBuffer(file.buffer, payload);
    throw new AppError("فایل الزامی است", 400, "FILE_REQUIRED");
  },

  async exists(key) {
    assertStorageConfigured();
    return bunnyDriver.exists(key);
  },

  async head(key) {
    assertStorageConfigured();
    return bunnyDriver.head(key);
  },

  async openReadStream(key, range = {}) {
    assertStorageConfigured();
    return bunnyDriver.openReadStream(key, range);
  },

  async deleteObject(key) {
    assertStorageConfigured();
    await bunnyDriver.deleteObject(key);
  },

  async readBuffer(key) {
    assertStorageConfigured();
    return bunnyDriver.readBuffer(key);
  },

  async createPresignedGetUrl(key, ttl = env.signedUrlTtl) {
    assertStorageConfigured();
    return bunnyDriver.createPresignedGetUrl(key, ttl);
  },

  createSignedUrl({
    key,
    projectId,
    portalAccountId,
    kind = "CLEAN_FINAL",
    ttl = env.signedUrlTtl,
  }) {
    const token = signDownloadToken(
      { key, projectId, portalAccountId, kind },
      ttl,
    );
    return {
      url: `${env.apiUrl}/api/v1/files/signed?token=${encodeURIComponent(token)}`,
      expiresIn: ttl,
      token,
    };
  },

  verifySignedToken(token) {
    try {
      return verifyDownloadToken(token);
    } catch {
      throw new AppError(
        "Download link expired or invalid",
        403,
        "SIGNED_URL_INVALID",
      );
    }
  },
};

export { generateStorageKey, sanitizeFilename, buildStorageMeta };
