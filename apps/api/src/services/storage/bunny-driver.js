import crypto from "crypto";
import dns from "dns";
import fs from "fs";
import http from "http";
import https from "https";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { extensionOf } from "./resource-type.js";
import {
  buildStorageMeta,
  generateStorageKey,
  isPublicStorageKey,
  normalizeMediaFolderPath,
  sanitizeFilename,
} from "./media-manager.js";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* Node < 17 */
}

const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const HEAD_TIMEOUT_MS = 30 * 1000;
const UPLOAD_RETRY_ATTEMPTS = 4;
const DELETE_RETRY_ATTEMPTS = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      "UND_ERR_SOCKET",
    ].includes(code)
  ) {
    return true;
  }
  return /ECONNRESET|socket hang up|timeout|network|terminated/i.test(message);
}

function sanitizeErrorText(text) {
  return String(text || "")
    .replace(/AccessKey[^\s,;]*/gi, "AccessKey=***")
    .replace(/[0-9a-f]{32,}/gi, "[redacted]");
}

function wrapBunnyError(err, fallbackMessage = "Bunny storage error") {
  const raw =
    err?.message ||
    (typeof err === "string" ? err : fallbackMessage);
  const text = sanitizeErrorText(raw);
  const httpCode = Number(err?.statusCode || err?.status || err?.http_code || 0);

  if (httpCode === 404 || /not found/i.test(text)) {
    return new AppError("فایل یافت نشد", 404, "NOT_FOUND");
  }
  if (httpCode === 401 || httpCode === 403) {
    return new AppError(
      "اتصال به فضای ذخیره‌سازی ناموفق بود",
      502,
      "STORAGE_AUTH",
    );
  }
  if (httpCode === 413 || /too large|entity too large/i.test(text)) {
    return new AppError("حجم فایل بیش از حد مجاز فضای ذخیره‌سازی است", 413, "STORAGE_FILE_TOO_LARGE");
  }
  if (httpCode === 429 || /rate limit/i.test(text)) {
    return new AppError(
      "محدودیت درخواست فضای ذخیره‌سازی — کمی بعد دوباره تلاش کنید",
      429,
      "STORAGE_RATE_LIMIT",
    );
  }
  if (isTransientNetworkError(err)) {
    return new AppError(
      "اتصال به فضای ذخیره‌سازی ناموفق بود. اینترنت را بررسی کنید و دوباره تلاش کنید.",
      503,
      "STORAGE_NETWORK",
    );
  }
  return new AppError(
    `آپلود/دسترسی فضای ذخیره‌سازی ناموفق بود`,
    502,
    "STORAGE_ERROR",
  );
}

function ensureConfigured() {
  if (!env.bunnyStorageZone || !env.bunnyStorageApiKey) {
    throw new AppError(
      "Bunny.net storage is not configured. Set BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY.",
      500,
      "STORAGE_MISCONFIGURED",
    );
  }
}

function pathPrefix() {
  return String(env.bunnyStoragePathPrefix || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

/** Storage-zone object path (includes optional account prefix). */
export function bunnyObjectPath(storageKey) {
  const key = String(storageKey || "").replace(/^\/+/, "");
  const prefix = pathPrefix();
  if (!prefix) return key;
  if (key === prefix || key.startsWith(`${prefix}/`)) return key;
  return `${prefix}/${key}`;
}

function encodePath(pathname) {
  return String(pathname || "")
    .split("/")
    .filter((part) => part !== "")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function bunnyStorageOrigin() {
  const host = String(env.bunnyStorageHostname || "storage.bunnycdn.com")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  return `https://${host || "storage.bunnycdn.com"}`;
}

export function bunnyCdnOrigin() {
  const candidates = [env.bunnyCdnHostname, env.storagePublicBase];
  for (const candidate of candidates) {
    const raw = String(candidate || "")
      .trim()
      .replace(/\/+$/, "");
    if (!raw) continue;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (isApiFilesBase(url)) continue;
    return url.replace(/\/$/, "");
  }
  return "";
}

function isApiFilesBase(value) {
  const v = String(value || "").replace(/\/$/, "");
  if (!v) return true;
  if (/\/files$/i.test(v)) return true;
  try {
    const api = new URL(env.apiUrl);
    const given = new URL(v);
    return given.host === api.host && given.pathname.replace(/\/$/, "") === "/files";
  } catch {
    return false;
  }
}

export function buildBunnyCdnUrl(storageKey) {
  const origin = bunnyCdnOrigin();
  const objectPath = bunnyObjectPath(storageKey);
  if (origin) {
    return `${origin}/${encodePath(objectPath)}`;
  }
  const encodedKey = String(storageKey || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${String(env.apiUrl || "").replace(/\/$/, "")}/files/${encodedKey}`;
}

export function applyBunnyCdnToken(url, securityKey, ttlSeconds = 600) {
  const key = String(securityKey || "").trim();
  if (!key || !url) return url;

  const expires = Math.floor(Date.now() / 1000) + Number(ttlSeconds || 600);
  const parsed = new URL(url);
  const signaturePath = decodeURIComponent(parsed.pathname);
  const hashableBase = key + signaturePath + expires;
  const token = crypto
    .createHash("sha256")
    .update(hashableBase)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  parsed.searchParams.set("token", token);
  parsed.searchParams.set("expires", String(expires));
  return parsed.toString();
}

/**
 * Bunny Pull Zone token authentication.
 * @see https://docs.bunny.net/docs/cdn-token-authentication
 */
export function signBunnyCdnUrl(url, ttlSeconds = env.signedUrlTtl) {
  return applyBunnyCdnToken(url, env.bunnyCdnTokenKey, ttlSeconds);
}

function storageApiUrl(storageKey) {
  ensureConfigured();
  const zone = String(env.bunnyStorageZone).replace(/^\/+|\/+$/g, "");
  const objectPath = bunnyObjectPath(storageKey);
  return `${bunnyStorageOrigin()}/${encodePath(`${zone}/${objectPath}`)}`;
}

function requestOnce(url, { method = "GET", headers = {}, body = null, timeoutMs = DOWNLOAD_TIMEOUT_MS } = {}) {
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
        method,
        headers,
        ALPNProtocols: ["http/1.1"],
      },
      (res) => resolve({ req, res }),
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Request Timeout"));
    });
    req.on("error", reject);

    if (body && typeof body.pipe === "function") {
      body.on("error", (err) => {
        req.destroy(err);
        reject(err);
      });
      body.pipe(req);
      return;
    }
    if (body) {
      req.end(body);
      return;
    }
    req.end();
  });
}

async function readResponseBuffer(res, { maxBytes = 8 * 1024 * 1024 } = {}) {
  const chunks = [];
  let total = 0;
  for await (const chunk of res) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buf);
    total += buf.length;
    if (total > maxBytes) {
      res.destroy();
      throw new Error("Response too large");
    }
  }
  return Buffer.concat(chunks, total);
}

function authHeaders(extra = {}) {
  return {
    AccessKey: env.bunnyStorageApiKey,
    ...extra,
  };
}

async function putObject({ storageKey, body, contentLength, contentType, timeoutMs }) {
  ensureConfigured();
  const url = storageApiUrl(storageKey);
  const headers = authHeaders({
    "Content-Type": contentType || "application/octet-stream",
    "Content-Length": String(contentLength),
  });

  const { res } = await requestOnce(url, {
    method: "PUT",
    headers,
    body,
    timeoutMs,
  });

  const responseBody = await readResponseBuffer(res, { maxBytes: 256 * 1024 });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { statusCode: res.statusCode };
  }

  const err = new Error(
    `Bunny upload failed (${res.statusCode}): ${sanitizeErrorText(responseBody.toString("utf8").slice(0, 200))}`,
  );
  err.statusCode = res.statusCode;
  throw err;
}

async function putObjectWithRetry(opts, { attempts = UPLOAD_RETRY_ATTEMPTS, filename } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      let body = opts.body;
      if (opts.filePath) {
        body = fs.createReadStream(opts.filePath);
      }
      return await putObject({ ...opts, body });
    } catch (err) {
      lastErr = err;
      const retryable = isTransientNetworkError(err) || Number(err.statusCode) >= 500;
      console.warn(
        `[bunny] upload attempt ${i + 1}/${attempts} failed:`,
        sanitizeErrorText(err?.message || err),
        `(key=${opts.storageKey}, bytes=${opts.contentLength}, file=${filename || "-"})`,
        retryable ? "(retrying)" : "(not retrying)",
      );
      if (!retryable || i === attempts - 1) break;
      await sleep(Math.min(8000, 1000 * 2 ** i));
    }
  }
  throw lastErr || new Error("Bunny upload failed");
}

async function deleteObjectOnce(storageKey) {
  ensureConfigured();
  const url = storageApiUrl(storageKey);
  const { res } = await requestOnce(url, {
    method: "DELETE",
    headers: authHeaders(),
    timeoutMs: HEAD_TIMEOUT_MS,
  });
  await readResponseBuffer(res, { maxBytes: 64 * 1024 });
  if (
    res.statusCode === 404 ||
    res.statusCode === 200 ||
    res.statusCode === 204
  ) {
    return;
  }
  if (res.statusCode >= 400) {
    const err = new Error(`Bunny delete failed (${res.statusCode})`);
    err.statusCode = res.statusCode;
    throw err;
  }
}

async function deleteObjectWithRetry(storageKey, { attempts = DELETE_RETRY_ATTEMPTS } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      await deleteObjectOnce(storageKey);
      return;
    } catch (err) {
      lastErr = err;
      const status = Number(err?.statusCode || err?.status || 0);
      // 404 is success (already deleted) — surface via wrap only if unexpected
      if (status === 404) return;
      const retryable =
        isTransientNetworkError(err) || status === 429 || status >= 500;
      console.warn(
        `[bunny] delete attempt ${i + 1}/${attempts} failed:`,
        sanitizeErrorText(err?.message || err),
        `(key=${storageKey})`,
        retryable ? "(retrying)" : "(not retrying)",
      );
      if (!retryable || i === attempts - 1) break;
      await sleep(Math.min(8000, 1000 * 2 ** i));
    }
  }
  throw lastErr || new Error("Bunny delete failed");
}

function parseContentRangeSize(contentRange, fallback) {
  const match = /\/(\d+)\s*$/.exec(String(contentRange || ""));
  if (match) return Number(match[1]);
  return fallback;
}

export const bunnyDriver = {
  ensureConfigured,

  publicUrl(storageKey) {
    ensureConfigured();
    return buildBunnyCdnUrl(storageKey);
  },

  async resolveDeliveryUrl(storageKey) {
    return this.publicUrl(storageKey);
  },

  async saveBuffer(
    buffer,
    {
      filename,
      folder = "uploads",
      contentType,
      storageKey,
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

    try {
      await putObjectWithRetry(
        {
          storageKey: key,
          body: buffer,
          contentLength: buffer.length,
          contentType,
          timeoutMs: UPLOAD_TIMEOUT_MS,
        },
        { filename: safeName || filename },
      );

      const url = this.publicUrl(key);
      const saved = {
        key,
        url,
        mimeType: contentType || null,
        sizeBytes: buffer.length,
        provider: "bunny",
        publicId: bunnyObjectPath(key),
        resourceType: null,
        format: extensionOf(key) || null,
        bytes: buffer.length,
      };
      if (placement) {
        saved.storageMeta = buildStorageMeta(saved, placement);
        saved.folderPath = placement.folderPath;
        saved.category = placement.category;
      }
      return saved;
    } catch (err) {
      console.error(
        "[bunny] upload failed:",
        sanitizeErrorText(err?.message || err),
        `(key=${key}, bytes=${buffer.length})`,
      );
      throw wrapBunnyError(err, "Bunny upload failed");
    }
  },

  async saveFile(
    filePath,
    {
      filename,
      folder = "uploads",
      contentType,
      storageKey,
      placement,
      sizeBytes,
    } = {},
  ) {
    ensureConfigured();
    const safeName = sanitizeFilename(filename);
    const folderPath = placement?.folderPath
      ? normalizeMediaFolderPath(placement.folderPath)
      : normalizeMediaFolderPath(folder);
    const key =
      storageKey || generateStorageKey(folderPath, safeName || filename);

    let length = Number(sizeBytes || 0);
    if (!length) {
      const stat = await fs.promises.stat(filePath);
      length = Number(stat.size || 0);
    }

    try {
      await putObjectWithRetry(
        {
          storageKey: key,
          filePath,
          contentLength: length,
          contentType,
          timeoutMs: UPLOAD_TIMEOUT_MS,
        },
        { filename: safeName || filename },
      );

      const url = this.publicUrl(key);
      const saved = {
        key,
        url,
        mimeType: contentType || null,
        sizeBytes: length,
        provider: "bunny",
        publicId: bunnyObjectPath(key),
        resourceType: null,
        format: extensionOf(key) || null,
        bytes: length,
      };
      if (placement) {
        saved.storageMeta = buildStorageMeta(saved, placement);
        saved.folderPath = placement.folderPath;
        saved.category = placement.category;
      }
      return saved;
    } catch (err) {
      console.error(
        "[bunny] stream upload failed:",
        sanitizeErrorText(err?.message || err),
        `(key=${key}, bytes=${length})`,
      );
      throw wrapBunnyError(err, "Bunny upload failed");
    }
  },

  async exists(storageKey) {
    try {
      await this.head(storageKey);
      return true;
    } catch (err) {
      if (err instanceof AppError && err.code === "NOT_FOUND") return false;
      throw err;
    }
  },

  async head(storageKey) {
    ensureConfigured();
    const url = storageApiUrl(storageKey);
    try {
      const { res } = await requestOnce(url, {
        method: "GET",
        headers: authHeaders({ Range: "bytes=0-0" }),
        timeoutMs: HEAD_TIMEOUT_MS,
      });
      res.resume();

      if (res.statusCode === 404) {
        throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        throw wrapBunnyError({ statusCode: res.statusCode, message: "Unauthorized" });
      }
      if (res.statusCode >= 400) {
        throw wrapBunnyError({
          statusCode: res.statusCode,
          message: `Bunny HEAD failed (${res.statusCode})`,
        });
      }

      const contentRange = res.headers["content-range"];
      const contentLengthHeader = Number(res.headers["content-length"] || 0);
      const size = parseContentRangeSize(
        contentRange,
        res.statusCode === 206 ? undefined : contentLengthHeader,
      );

      return {
        size: Number(size || contentLengthHeader || 0),
        contentType: res.headers["content-type"] || null,
        fullPath: bunnyObjectPath(storageKey),
        resourceType: null,
        publicId: bunnyObjectPath(storageKey),
        version: null,
        secureUrl: this.publicUrl(storageKey),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw wrapBunnyError(err);
    }
  },

  async openReadStream(storageKey, { start, end } = {}) {
    ensureConfigured();
    const url = storageApiUrl(storageKey);
    const headers = authHeaders();
    if (start != null) {
      headers.Range = `bytes=${start}-${end != null ? end : ""}`;
    }

    try {
      const { res } = await requestOnce(url, {
        method: "GET",
        headers,
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
      });

      if (res.statusCode === 404) {
        res.resume();
        throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        throw wrapBunnyError({ statusCode: res.statusCode, message: "Unauthorized" });
      }
      if (res.statusCode >= 400) {
        res.resume();
        throw wrapBunnyError({
          statusCode: res.statusCode,
          message: `Bunny download failed (${res.statusCode})`,
        });
      }

      const contentLength =
        res.headers["content-length"] != null
          ? Number(res.headers["content-length"])
          : undefined;

      return {
        stream: res,
        contentLength,
        contentRange: res.headers["content-range"] || undefined,
        contentType: res.headers["content-type"] || undefined,
        fileSize: parseContentRangeSize(res.headers["content-range"], undefined),
        resourceType: null,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw wrapBunnyError(err, "Failed to fetch Bunny asset");
    }
  },

  async deleteObject(storageKey) {
    ensureConfigured();
    try {
      await deleteObjectWithRetry(storageKey);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw wrapBunnyError(err, "Failed to delete Bunny asset");
    }
  },

  async readBuffer(storageKey) {
    const { stream, contentLength } = await this.openReadStream(storageKey);
    const chunks = [];
    let total = 0;
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      total += buf.length;
      if (contentLength && total > contentLength * 2) {
        throw new AppError("حجم فایل غیرمنتظره است", 502, "STORAGE_FETCH");
      }
    }
    return Buffer.concat(chunks, total);
  },

  async createPresignedGetUrl(storageKey, ttl = env.signedUrlTtl) {
    ensureConfigured();
    const url = this.publicUrl(storageKey);
    if (env.bunnyCdnTokenKey) {
      return signBunnyCdnUrl(url, ttl);
    }
    // Without pull-zone token auth, an unsigned CDN URL is a public object.
    // Only return it for marketing assets; private files must be proxied.
    if (isPublicStorageKey(storageKey)) return url;
    return null;
  },
};
