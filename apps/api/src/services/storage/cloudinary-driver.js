import { Readable } from "stream";
import http from "http";
import https from "https";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import {
  deliveryFormatForExtension,
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

/** Per-request and SDK default — videos on slow links need generous headroom. */
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
/** Prefer chunked/large upload above this size (Cloudinary recommends ≥5MB chunks). */
const CHUNKED_UPLOAD_THRESHOLD = 5 * 1024 * 1024;
/** 5MB chunks keep each part under typical gateway idle limits on slow networks. */
const CHUNK_SIZE = 5 * 1024 * 1024;
const UPLOAD_RETRY_ATTEMPTS = 4;

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
    timeout: UPLOAD_TIMEOUT_MS,
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
  const text = String(message);
  const httpCode = Number(err?.http_code || err?.statusCode || 0);
  if (httpCode === 404 || /not found/i.test(text)) {
    return new AppError("فایل یافت نشد", 404, "NOT_FOUND");
  }
  if (
    httpCode === 401 ||
    httpCode === 403 ||
    /invalid.*(api|signature|cloud)/i.test(text)
  ) {
    return new AppError(
      "اتصال به Cloudinary ناموفق بود",
      502,
      "CLOUDINARY_AUTH",
    );
  }
  if (httpCode === 413 || /file size too large|too large/i.test(text)) {
    return new AppError(
      "حجم فایل بیشتر از حد مجاز حساب Cloudinary است",
      413,
      "CLOUDINARY_FILE_TOO_LARGE",
    );
  }
  if (httpCode === 420 || httpCode === 429 || /rate limit/i.test(text)) {
    return new AppError(
      "محدودیت درخواست Cloudinary — کمی بعد دوباره تلاش کنید",
      429,
      "CLOUDINARY_RATE_LIMIT",
    );
  }
  if (isTransientNetworkError(err)) {
    return new AppError(
      "آپلود ویدیو به دلیل کندی ارتباط با فضای ذخیره‌سازی زمان‌بر شد. لطفاً دوباره تلاش کنید.",
      504,
      "CLOUDINARY_NETWORK",
    );
  }
  return new AppError(
    `آپلود/دسترسی Cloudinary ناموفق: ${message}`,
    502,
    "CLOUDINARY_ERROR",
  );
}

/** Network hiccups that are worth retrying instead of failing the request. */
function isTransientNetworkError(err) {
  if (!err || typeof err !== "object") return false;
  const code = String(err.code || err.cause?.code || err.errno || "");
  const message = String(err.message || err.cause?.message || "");
  if (
    [
      "ECONNRESET",
      "ECONNABORTED",
      "ETIMEDOUT",
      "EPIPE",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ESOCKETTIMEDOUT",
    ].includes(code)
  ) {
    return true;
  }
  if (/^terminated$/i.test(message)) return true;
  return /ECONNRESET|socket hang up|timeout|network|terminated/i.test(message);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Write buffer to a unique temp file (used by upload_large — more reliable than
 * dumping a giant buffer into upload_chunked_stream on slow links).
 */
async function writeTempUploadFile(buffer, filenameHint = "upload.bin") {
  const dir = await mkdtemp(path.join(tmpdir(), "apex-cloudinary-"));
  const safe = sanitizeFilename(filenameHint).replace(/\s+/g, "-").slice(0, 80);
  const filePath = path.join(dir, safe || "upload.bin");
  await writeFile(filePath, buffer);
  return { dir, filePath };
}

async function removeTempDir(dir) {
  if (!dir) return;
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}

/**
 * Cloudinary upload_large from disk — chunked HTTP parts with proper timeouts.
 */
function uploadLargeFromPath(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      {
        ...options,
        chunk_size: CHUNK_SIZE,
        timeout: UPLOAD_TIMEOUT_MS,
      },
      (err, uploaded) => {
        if (err) reject(err);
        else if (!uploaded)
          reject(new Error("Empty Cloudinary upload response"));
        else resolve(uploaded);
      },
    );
  });
}

/**
 * Small-file streaming upload (single request).
 */
function uploadStreamFromBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { ...options, timeout: UPLOAD_TIMEOUT_MS },
      (err, uploaded) => {
        if (err) reject(err);
        else if (!uploaded)
          reject(new Error("Empty Cloudinary upload response"));
        else resolve(uploaded);
      },
    );
    stream.on("error", reject);
    Readable.from(buffer).pipe(stream);
  });
}

/**
 * Upload a buffer with retries for transient Cloudinary/network failures.
 * Videos and files ≥5MB use disk-backed upload_large (chunked) so slow
 * connections do not hit a single-request Request Timeout.
 */
async function uploadBufferWithRetry(buffer, options, { filename } = {}) {
  const size = Buffer.isBuffer(buffer) ? buffer.length : 0;
  const useLarge =
    size >= CHUNKED_UPLOAD_THRESHOLD || options.resource_type === "video";

  let lastErr = null;
  let tempDir = null;

  try {
    let filePath = null;
    if (useLarge) {
      const tmp = await writeTempUploadFile(
        buffer,
        filename || `${options.public_id || "upload"}.bin`,
      );
      tempDir = tmp.dir;
      filePath = tmp.filePath;
    }

    for (let i = 0; i < UPLOAD_RETRY_ATTEMPTS; i++) {
      try {
        if (useLarge && filePath) {
          return await uploadLargeFromPath(filePath, options);
        }
        return await uploadStreamFromBuffer(buffer, options);
      } catch (err) {
        lastErr = err;
        const retryable = isTransientNetworkError(err);
        console.warn(
          `[cloudinary] upload attempt ${i + 1}/${UPLOAD_RETRY_ATTEMPTS} failed:`,
          err?.error?.message || err?.message || err,
          `(mode=${useLarge ? "large" : "stream"}, bytes=${size})`,
          retryable ? "(retrying)" : "(not retrying)",
        );
        if (!retryable || i === UPLOAD_RETRY_ATTEMPTS - 1) break;
        await sleep(1000 * 2 ** i);
      }
    }
  } finally {
    await removeTempDir(tempDir);
  }

  throw lastErr || new Error("Cloudinary upload failed");
}

/**
 * Fetch a response body over HTTP/1.1 (Node https).
 * Global fetch/undici often aborts Cloudinary CDN bodies with "terminated" on HTTP/2.
 */
function httpsGetBuffer(url, { headers = {}, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }
    const lib = parsed.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "http:" ? 80 : 443),
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        headers: {
          Connection: "close",
          ...headers,
        },
        // Force HTTP/1.1 — avoids undici HTTP/2 "terminated" mid-body.
        ALPNProtocols: ["http/1.1"],
      },
      (res) => {
        const chunks = [];
        let total = 0;
        res.on("data", (chunk) => {
          chunks.push(chunk);
          total += chunk.length;
          // Guard against runaway downloads (500MB)
          if (total > 500 * 1024 * 1024) {
            req.destroy();
            reject(new Error("Download too large"));
          }
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            buffer: Buffer.concat(chunks, total),
          });
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Request Timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetch a full response body with retries (Cloudinary Admin/CDN downloads are
 * flaky on some networks — undici "terminated" mid-body is common on HTTP/2).
 */
async function fetchBufferWithRetry(
  url,
  { attempts = 4, label = "cloudinary", headers = {} } = {},
) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const out = await httpsGetBuffer(url, { headers });
      const ok = out.status >= 200 && out.status < 300;
      const partial = out.status === 206;
      // Mimic Fetch Response surface used by callers
      const res = {
        ok,
        status: out.status,
        headers: {
          get(name) {
            const key = String(name || "").toLowerCase();
            const val = out.headers[key];
            return Array.isArray(val) ? val[0] : val || null;
          },
        },
      };
      if (!ok && !partial) {
        return { res, buffer: null };
      }
      return { res, buffer: out.buffer };
    } catch (err) {
      lastErr = err;
      // Only log first + last attempt to reduce noise during flaky networks
      if (i === 0 || i === attempts - 1) {
        console.warn(
          `[${label}] attempt ${i + 1}/${attempts} failed:`,
          err?.message || err,
        );
      }
      await sleep(500 * 2 ** i);
    }
  }
  throw lastErr || new Error("fetch failed");
}

export const cloudinaryDriver = {
  ensureConfigured,

  publicIdForKey(storageKey, resourceType) {
    return publicIdFor(
      storageKey,
      resourceType || resourceTypeForKey(storageKey),
    );
  },

  /**
   * Build a public delivery URL for a storage key.
   * Prefer upload-time `secure_url` or `resolveDeliveryUrl()` when possible —
   * this sync fallback must not force filename formats Cloudinary normalized away.
   */
  publicUrl(storageKey, { contentType, resourceType, publicId, format } = {}) {
    ensureConfigured();
    const type =
      resourceType || resourceTypeForKey(storageKey, { contentType });
    const id = publicId || publicIdFor(storageKey, type);
    const deliveryFormat =
      format != null
        ? format || undefined
        : type === "raw"
          ? undefined
          : deliveryFormatForExtension(extensionOf(storageKey));
    return cloudinary.url(id, {
      resource_type: type,
      type: "upload",
      secure: true,
      sign_url: false,
      force_version: false,
      ...(deliveryFormat ? { format: deliveryFormat } : {}),
    });
  },

  /**
   * Resolve a working CDN URL via Admin API when needed (correct resource type / format).
   * Falls back to reconstructed publicUrl when head is unavailable.
   */
  async resolveDeliveryUrl(storageKey, { contentType } = {}) {
    ensureConfigured();
    try {
      const head = await this.head(storageKey);
      if (head?.secureUrl) return head.secureUrl;
      return this.publicUrl(storageKey, {
        contentType: contentType || head?.contentType,
        resourceType: head?.resourceType,
        publicId: head?.publicId,
        format: "",
      });
    } catch {
      return this.publicUrl(storageKey, { contentType });
    }
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

    const uploadOptions = {
      public_id: publicId,
      resource_type: resourceType,
      overwrite: Boolean(overwrite),
      unique_filename: false,
      use_filename: false,
      type: "upload",
      timeout: UPLOAD_TIMEOUT_MS,
      tags,
      context: `apex_key=${key}|folder=${folderPath}|category=${placement?.category || folderPath.split("/")[0]}`,
    };

    try {
      const result = await uploadBufferWithRetry(buffer, uploadOptions, {
        filename: safeName || filename,
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
      console.error(
        "[cloudinary] upload failed:",
        err?.error?.message || err?.message || err,
        `(key=${key}, type=${resourceType}, bytes=${buffer.length})`,
      );
      throw wrapCloudinaryError(err, "Cloudinary upload failed");
    }
  },

  async exists(storageKey) {
    ensureConfigured();
    const preferred = resourceTypeForKey(storageKey);
    for (const resourceType of [
      ...new Set([preferred, "image", "video", "raw"]),
    ]) {
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
    const tryTypes = [resourceTypeForKey(storageKey), "image", "video", "raw"];
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
          version: info.version != null ? Number(info.version) : null,
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

  /**
   * Admin API private download — works when CDN delivery returns 401 for
   * Restricted file types (.gz, .zip, docs, etc.).
   * Format is empty when the extension is already part of the raw public_id.
   */
  buildPrivateDownloadUrl(head, storageKey, resourceType) {
    ensureConfigured();
    const publicId =
      head?.publicId || publicIdFor(storageKey, resourceType || "raw");
    const ttl = Number(env.signedUrlTtl || 600);
    return cloudinary.utils.private_download_url(publicId, "", {
      resource_type: resourceType || "raw",
      type: "upload",
      expires_at: Math.floor(Date.now() / 1000) + ttl,
      attachment: true,
    });
  },

  async openReadStream(storageKey, { start, end } = {}) {
    const head = await this.head(storageKey);
    const resourceType =
      head.resourceType ||
      resourceTypeForKey(storageKey, { contentType: head.contentType });

    const headers = {};
    if (start != null) {
      headers.Range = `bytes=${start}-${end != null ? end : ""}`;
    }

    /**
     * Restricted raw types (.gz backups, docs, archives) often return 401 on CDN
     * signed URLs. Admin private_download works for those — skip for video/image
     * (CDN delivery is correct and private_download often fails/noise).
     */
    if (start == null && resourceType === "raw") {
      try {
        const privUrl = this.buildPrivateDownloadUrl(
          head,
          storageKey,
          resourceType,
        );
        const { res: privRes, buffer } = await fetchBufferWithRetry(privUrl, {
          attempts: 3,
          label: "cloudinary-private-download",
        });
        if (privRes?.ok && buffer) {
          return {
            stream: Readable.from(buffer),
            contentLength: buffer.length,
            contentRange: undefined,
            contentType:
              privRes.headers.get("content-type") || "application/octet-stream",
            fileSize: head.size || buffer.length,
            resourceType,
          };
        }
        if (privRes && privRes.status !== 401 && privRes.status !== 403) {
          console.warn("[cloudinary] private_download status:", privRes.status);
        }
      } catch (err) {
        console.warn(
          "[cloudinary] private_download failed, trying CDN:",
          err?.message || err,
        );
      }
    }

    /**
     * CDN delivery candidates (signed first — required for restricted types).
     */
    const candidates = [];
    try {
      candidates.push(await this.createPresignedGetUrl(storageKey));
    } catch (err) {
      console.warn(
        "[cloudinary] signed URL failed, will try public URL:",
        err?.message || err,
      );
    }
    if (head.secureUrl) candidates.push(head.secureUrl);
    candidates.push(
      this.publicUrl(storageKey, { contentType: head.contentType }),
    );

    let lastStatus = 0;
    let lastErr = null;
    const tried = new Set();
    for (const url of candidates) {
      if (!url || tried.has(url)) continue;
      tried.add(url);
      try {
        const { res, buffer } = await fetchBufferWithRetry(url, {
          attempts: 4,
          label: "cloudinary-cdn",
          headers,
        });
        if (!res) continue;
        lastStatus = res.status;
        if (res.status === 404) {
          throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
        }
        if (res.status === 401 || res.status === 403) {
          continue;
        }
        if ((res.ok || res.status === 206) && buffer) {
          return {
            stream: Readable.from(buffer),
            contentLength: buffer.length,
            contentRange: res.headers.get("content-range") || undefined,
            contentType: res.headers.get("content-type") || undefined,
            fileSize: head.size || buffer.length,
            resourceType,
          };
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        lastErr = err;
        console.warn("[cloudinary] CDN candidate failed:", err?.message || err);
      }
    }

    throw (
      (lastErr &&
        wrapCloudinaryError(lastErr, "Failed to fetch Cloudinary asset")) ||
      new AppError(
        `خواندن فایل از Cloudinary ناموفق بود (${lastStatus || "error"})`,
        502,
        "CLOUDINARY_FETCH",
      )
    );
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
   * Required for raw/restricted formats (e.g. .gz backups) when unsigned delivery is blocked.
   */
  async createPresignedGetUrl(storageKey, ttl = env.signedUrlTtl) {
    ensureConfigured();
    let resourceType = resourceTypeForKey(storageKey);
    let publicId = publicIdFor(storageKey, resourceType);
    let version = undefined;
    try {
      const head = await this.head(storageKey);
      if (head.resourceType) resourceType = head.resourceType;
      if (head.publicId) publicId = head.publicId;
      if (head.version) version = head.version;
    } catch {
      // fall back to extension-based type / derived public id
    }
    const expiresAt = Math.floor(Date.now() / 1000) + Number(ttl || 600);
    const deliveryFormat =
      resourceType === "raw"
        ? undefined
        : deliveryFormatForExtension(extensionOf(storageKey));
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "upload",
      secure: true,
      sign_url: true,
      expires_at: expiresAt,
      ...(version ? { version } : {}),
      ...(deliveryFormat ? { format: deliveryFormat } : {}),
    });
  },

  /**
   * Read a raw/cloud asset into a Buffer.
   * Uses Admin private_download first (restricted types), then CDN fallbacks.
   */
  async readBuffer(storageKey) {
    const { stream, contentLength } = await this.openReadStream(storageKey);
    const chunks = [];
    let total = 0;
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      total += buf.length;
      if (contentLength && total > contentLength * 2) {
        throw new AppError("حجم فایل غیرمنتظره است", 502, "CLOUDINARY_FETCH");
      }
    }
    return Buffer.concat(chunks, total);
  },
};
