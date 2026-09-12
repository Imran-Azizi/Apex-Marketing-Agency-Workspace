import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { stripStoragePrefix } from "./media-manager.js";

const SKIP_PREFIXES = ["ref://", "inline:", "data:", "blob:"];

/**
 * Normalize a stored reference (storage key, CDN URL, or storage API URL)
 * into an application storage key suitable for Bunny deleteObject.
 * Returns null when there is nothing to delete.
 */
export function resolveStorageKey(input) {
  if (input == null) return null;
  let raw = String(input).trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (
    SKIP_PREFIXES.some((p) => lower === p.replace(/:$/, "") || lower.startsWith(p))
  ) {
    return null;
  }
  if (raw.startsWith("local:")) return null;

  raw = raw.replace(/\\/g, "/");

  // Absolute / protocol-relative URL → pathname
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    try {
      const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
      raw = decodeURIComponent(url.pathname || "");
    } catch {
      return null;
    }
  }

  raw = raw.replace(/^\/+/, "");
  if (!raw || raw.includes("..")) return null;

  // Strip accidental storage-zone name from path
  const zone = String(env.bunnyStorageZone || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (zone && (raw === zone || raw.startsWith(`${zone}/`))) {
    raw = raw.slice(zone.length).replace(/^\/+/, "");
  }

  // Application keys never include the Bunny path prefix
  raw = stripStoragePrefix(raw);

  if (!raw || raw.length > 500) return null;
  return raw;
}

export function collectStorageKeys(...candidates) {
  const keys = new Set();
  for (const value of candidates) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const key = resolveStorageKey(item);
        if (key) keys.add(key);
      }
      continue;
    }
    const key = resolveStorageKey(value);
    if (key) keys.add(key);
  }
  return [...keys];
}

/**
 * Delete one object from Bunny. When `required` is true (default), failure
 * aborts the caller so the DB record is not marked deleted while the file remains.
 * HTTP 404 from Bunny is treated as success (already gone).
 */
export async function deleteStoredObject(
  deleteObjectFn,
  keyOrUrl,
  { required = true, logTag = "storage" } = {},
) {
  const key = resolveStorageKey(keyOrUrl);
  if (!key) {
    return { deleted: false, skipped: true, key: null };
  }

  try {
    await deleteObjectFn(key);
    return { deleted: true, key };
  } catch (err) {
    const status = Number(err?.status || err?.statusCode || 0);
    const code = String(err?.code || "");
    if (status === 404 || code === "NOT_FOUND") {
      return { deleted: true, key, alreadyGone: true };
    }

    console[required ? "error" : "warn"](
      `[${logTag}] Bunny deleteObject ${required ? "failed" : "skipped (best-effort)"}`,
      {
        key,
        code: err?.code || null,
        status: status || null,
        message: err?.message || String(err),
      },
    );

    if (required) {
      throw new AppError(
        "حذف فایل از فضای ذخیره‌سازی ناموفق بود. لطفاً دوباره تلاش کنید.",
        status === 503 ? 503 : 502,
        "STORAGE_DELETE_FAILED",
        { key },
      );
    }

    return { deleted: false, key, error: err };
  }
}

export async function deleteStoredObjects(
  deleteObjectFn,
  keysOrUrls,
  { required = true, logTag = "storage" } = {},
) {
  const keys = collectStorageKeys(keysOrUrls);
  const results = [];
  for (const key of keys) {
    results.push(
      await deleteStoredObject(deleteObjectFn, key, { required, logTag }),
    );
  }
  return {
    keys,
    deletedCount: results.filter((r) => r.deleted).length,
    results,
  };
}
