import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
import { cloudinaryDriver } from "./storage/cloudinary-driver.js";

function isS3Compatible() {
  return env.storageDriver === "s3" || env.storageDriver === "r2";
}

function isCloudinary() {
  return env.storageDriver === "cloudinary";
}

function isObjectStorage() {
  return isS3Compatible() || isCloudinary();
}

function assertStorageConfigured() {
  if (isObjectStorage()) return;
  throw new AppError(
    "Storage is not configured. Set STORAGE_DRIVER=cloudinary (dev) or r2/s3 (production).",
    500,
    "STORAGE_MISCONFIGURED",
  );
}

let s3Client = null;

function getS3() {
  if (!isS3Compatible()) return null;
  if (s3Client) return s3Client;

  if (!env.s3Bucket || !env.s3AccessKey || !env.s3SecretKey) {
    throw new AppError(
      "Object storage is not configured",
      500,
      "STORAGE_MISCONFIGURED",
    );
  }

  const config = {
    region: env.s3Region || "auto",
    credentials: {
      accessKeyId: env.s3AccessKey,
      secretAccessKey: env.s3SecretKey,
    },
  };

  if (env.s3Endpoint) {
    config.endpoint = env.s3Endpoint;
    config.forcePathStyle = env.s3ForcePathStyle;
  }

  s3Client = new S3Client(config);
  return s3Client;
}

function publicUrlForKey(key, opts = {}) {
  if (isCloudinary()) {
    return cloudinaryDriver.publicUrl(key, opts);
  }
  const base = env.storagePublicBase.replace(/\/$/, "");
  const encoded = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/${encoded}`;
}

/** Short TTL cache so repeated <img> hits don't spam Cloudinary Admin API. */
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

/**
 * Unified cloud storage: Cloudinary (dev/testing) or S3-compatible R2/S3 (production).
 * Database keeps opaque `storageKey`; URLs come from the active driver.
 */
export const storage = {
  isObjectStorage,
  isCloudinary,
  isS3Compatible,

  publicUrl(key, opts = {}) {
    assertStorageConfigured();
    return publicUrlForKey(key, opts);
  },

  /**
   * Best-effort public delivery URL. For Cloudinary, prefers Admin-resolved
   * secure_url so extension/resource-type mismatches (e.g. .jfif) still work.
   */
  async resolveDeliveryUrl(key, opts = {}) {
    assertStorageConfigured();
    const storageKey = String(key || "").replace(/^\/+/, "");
    if (!storageKey) {
      throw new AppError("File key required", 400, "INVALID_KEY");
    }
    const cached = getCachedDeliveryUrl(storageKey);
    if (cached) return cached;

    let url;
    if (isCloudinary() && typeof cloudinaryDriver.resolveDeliveryUrl === "function") {
      url = await cloudinaryDriver.resolveDeliveryUrl(storageKey, opts);
    } else {
      url = publicUrlForKey(storageKey, opts);
    }
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

    const context = uploadContext || parseUploadContext({ folder }, {});
    const placement = resolveMediaPlacement(context, {
      contentType,
      filename,
    });
    const folderPath = placement.folderPath;

    if (isCloudinary()) {
      try {
        return await cloudinaryDriver.saveBuffer(buffer, {
          filename,
          folder: folderPath,
          contentType,
          storageKey,
          overwrite,
          placement,
        });
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          err?.message || "Cloudinary upload failed",
          502,
          "CLOUDINARY_ERROR",
        );
      }
    }

    const safeName = sanitizeFilename(filename);
    const key =
      storageKey || generateStorageKey(folderPath, safeName || filename);

    try {
      const client = getS3();
      await client.send(
        new PutObjectCommand({
          Bucket: env.s3Bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType || undefined,
        }),
      );
      const result = { key, url: publicUrlForKey(key) };
      result.storageMeta = buildStorageMeta(result, placement);
      result.folderPath = folderPath;
      result.category = placement.category;
      return result;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        err?.message || "Object storage upload failed",
        502,
        "STORAGE_UPLOAD_FAILED",
      );
    }
  },

  async exists(key) {
    assertStorageConfigured();
    if (isCloudinary()) return cloudinaryDriver.exists(key);

    try {
      await getS3().send(
        new HeadObjectCommand({ Bucket: env.s3Bucket, Key: key }),
      );
      return true;
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      if (
        status === 404 ||
        err?.name === "NotFound" ||
        err?.Code === "NotFound"
      ) {
        return false;
      }
      throw err;
    }
  },

  async head(key) {
    assertStorageConfigured();
    if (isCloudinary()) return cloudinaryDriver.head(key);

    try {
      const out = await getS3().send(
        new HeadObjectCommand({ Bucket: env.s3Bucket, Key: key }),
      );
      return {
        size: Number(out.ContentLength || 0),
        contentType: out.ContentType || null,
        fullPath: null,
      };
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 404 || err?.name === "NotFound") {
        throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
      }
      throw err;
    }
  },

  /**
   * Open a readable stream (optionally ranged).
   * @returns {{ stream: import('stream').Readable, contentLength?: number, contentRange?: string, contentType?: string }}
   */
  async openReadStream(key, { start, end } = {}) {
    assertStorageConfigured();
    if (isCloudinary()) {
      return cloudinaryDriver.openReadStream(key, { start, end });
    }

    const range =
      start != null ? `bytes=${start}-${end != null ? end : ""}` : undefined;

    try {
      const out = await getS3().send(
        new GetObjectCommand({
          Bucket: env.s3Bucket,
          Key: key,
          Range: range,
        }),
      );
      return {
        stream: out.Body,
        contentLength:
          out.ContentLength != null ? Number(out.ContentLength) : undefined,
        contentRange: out.ContentRange || undefined,
        contentType: out.ContentType || undefined,
        fileSize: undefined,
      };
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 404 || err?.name === "NoSuchKey") {
        throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
      }
      throw err;
    }
  },

  async deleteObject(key) {
    assertStorageConfigured();
    if (isCloudinary()) {
      await cloudinaryDriver.deleteObject(key);
      return;
    }
    await getS3().send(
      new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }),
    );
  },

  /**
   * Read object bytes into a Buffer (used by backup restore/download fallbacks).
   */
  async readBuffer(key) {
    assertStorageConfigured();
    if (isCloudinary() && typeof cloudinaryDriver.readBuffer === "function") {
      return cloudinaryDriver.readBuffer(key);
    }
    const { stream } = await this.openReadStream(key);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  },

  /** Short-lived direct download URL for remote storage (optional fast path). */
  async createPresignedGetUrl(key, ttl = env.signedUrlTtl) {
    assertStorageConfigured();
    if (isCloudinary()) {
      return cloudinaryDriver.createPresignedGetUrl(key, ttl);
    }
    const command = new GetObjectCommand({ Bucket: env.s3Bucket, Key: key });
    return getSignedUrl(getS3(), command, { expiresIn: ttl });
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
