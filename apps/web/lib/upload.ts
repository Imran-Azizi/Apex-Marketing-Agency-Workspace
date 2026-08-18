import {
  api,
  ensureCsrf,
  API_BASE,
  ApiError,
  resolveAssetSrc,
  storagePublicUrl,
  type ApiEnvelope,
} from "@/lib/api";
import { AUTH_PANEL_HEADER, resolveClientAuthPanel } from "@/lib/auth-panel";
import { UPLOAD_PURPOSE, type UploadContext } from "@/lib/media-manager";

export type { UploadContext };
export { UPLOAD_PURPOSE };

export type UploadedFile = {
  key: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  folderPath?: string | null;
  category?: string | null;
  storageMeta?: Record<string, unknown> | null;
  provider?: string;
  publicId?: string;
  resourceType?: string;
};

function resolveUploadContext(context: UploadContext | string): UploadContext {
  if (typeof context === "string") {
    return { purpose: UPLOAD_PURPOSE.GENERIC, folder: context };
  }
  return context;
}

function encodedStorageKeyPath(storageKey: string): string {
  return storageKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/** Build /files/raw URL with panel so cookie auth resolves correctly. */
export function authenticatedRawFileUrl(storageKey: string): string {
  const panel = resolveClientAuthPanel();
  const base = `${API_BASE}/files/raw/${encodedStorageKeyPath(storageKey)}`;
  return panel ? `${base}?panel=${encodeURIComponent(panel)}` : base;
}

function authFetchHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const panel = resolveClientAuthPanel();
  if (panel) headers[AUTH_PANEL_HEADER] = panel;
  return headers;
}

/**
 * Fetch a stored file as a Blob via the authenticated API client
 * (sends X-APEX-Panel + cookies, retries after silent refresh).
 */
async function fetchRawFileBlob(storageKey: string): Promise<Blob> {
  const panel = resolveClientAuthPanel();
  try {
    const response = await api.get<Blob>(
      `/files/raw/${encodedStorageKeyPath(storageKey)}`,
      {
        responseType: "blob",
        params: panel ? { panel } : undefined,
      },
    );
    const blob = response.data;
    const contentType = String(response.headers?.["content-type"] || "");
    if (
      contentType.includes("application/json") ||
      (blob.type && blob.type.includes("application/json"))
    ) {
      const text = await blob.text();
      try {
        const parsed = JSON.parse(text) as ApiEnvelope;
        throw new ApiError(
          parsed.error?.message || "دریافت فایل ناموفق بود",
          400,
          parsed.error?.code || "FILE_FETCH_FAILED",
        );
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError("دریافت فایل ناموفق بود", 400, "FILE_FETCH_FAILED");
      }
    }
    return blob;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "دریافت فایل ناموفق بود",
      401,
      "FILE_FETCH_FAILED",
    );
  }
}

export async function uploadFileWithProgress(
  file: File,
  context: UploadContext | string = { purpose: UPLOAD_PURPOSE.PORTAL_ASSET },
  onProgress?: (
    percent: number,
    detail?: { loaded: number; total: number },
  ) => void,
): Promise<UploadedFile> {
  await ensureCsrf();
  const ctx = resolveUploadContext(context);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("purpose", ctx.purpose);
  if (ctx.projectId) fd.append("projectId", ctx.projectId);
  if (ctx.userId) fd.append("userId", ctx.userId);
  if (ctx.assetKind) fd.append("assetKind", ctx.assetKind);
  if (ctx.videoType) fd.append("videoType", ctx.videoType);
  if (ctx.folder) fd.append("folder", ctx.folder);

  const { data } = await api.post<ApiEnvelope<UploadedFile>>(
    "/files/upload",
    fd,
    {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      transformRequest: [
        (body, headers) => {
          if (headers && typeof headers === "object") {
            // Let the browser set multipart boundary
            delete (headers as Record<string, unknown>)["Content-Type"];
          }
          return body;
        },
      ],
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        const percent = Math.min(
          100,
          Math.round((event.loaded / event.total) * 100),
        );
        onProgress(percent, { loaded: event.loaded, total: event.total });
      },
    },
  );

  if (!data.success || !data.data) {
    throw new ApiError(
      data.error?.message || "آپلود ناموفق",
      400,
      data.error?.code || "UPLOAD_FAILED",
    );
  }
  return data.data;
}

export function filePreviewUrl(
  storageKey: string,
  meta?: unknown,
): string | null {
  return resolveAssetSrc({ storageKey, meta }) || storagePublicUrl(storageKey);
}

function guessMimeFromStorageKey(storageKey: string): string | null {
  const name = storageKey.split("/").pop()?.toLowerCase() || "";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".png")) return "image/png";
  if (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".jfif") ||
    name.endsWith(".jpe") ||
    name.endsWith(".jif")
  ) {
    return "image/jpeg";
  }
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return null;
}

function typedFileBlob(
  blob: Blob,
  mimeType?: string | null,
  storageKey?: string,
) {
  const preferred =
    (mimeType && mimeType !== "application/octet-stream" ? mimeType : null) ||
    (blob.type && blob.type !== "application/octet-stream"
      ? blob.type
      : null) ||
    (storageKey ? guessMimeFromStorageKey(storageKey) : null);
  if (preferred && blob.type !== preferred) {
    return new Blob([blob], { type: preferred });
  }
  return blob;
}

/**
 * Always fetch via authenticated /files/raw and return a blob: URL.
 * Required for PDF iframe preview — Cloudinary/CDN URLs are often blocked by
 * X-Frame-Options when embedded cross-origin.
 */
export async function fetchAuthenticatedFileBlobUrl(
  storageKey: string,
  mimeType?: string | null,
): Promise<string | null> {
  if (!storageKey || storageKey.startsWith("ref://")) return null;
  try {
    const blob = typedFileBlob(
      await fetchRawFileBlob(storageKey),
      mimeType,
      storageKey,
    );
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function fetchAuthenticatedPreview(
  storageKey: string,
): Promise<string | null> {
  if (!storageKey || storageKey.startsWith("ref://")) return null;
  const publicUrl = filePreviewUrl(storageKey);
  if (publicUrl) {
    // Prefer public static URL when available (same-origin cookies not required for <img>/<video>)
    return publicUrl;
  }
  return fetchAuthenticatedFileBlobUrl(storageKey);
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Number + unit for RTL UIs so the unit stays on the right of the value. */
export function formatFileSizeParts(bytes?: number | null): {
  value: string;
  unit: string;
} | null {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return null;
  if (bytes < 1024) return { value: String(bytes), unit: "B" };
  if (bytes < 1024 * 1024) {
    return { value: (bytes / 1024).toFixed(1), unit: "KB" };
  }
  if (bytes < 1024 * 1024 * 1024) {
    return { value: (bytes / (1024 * 1024)).toFixed(1), unit: "MB" };
  }
  return { value: (bytes / (1024 * 1024 * 1024)).toFixed(2), unit: "GB" };
}

/** Download a stored file with cookies (works across web/API origins). */
export async function downloadStoredFile(
  storageKey: string,
  filename?: string,
): Promise<void> {
  if (!storageKey || storageKey.startsWith("ref://")) {
    throw new Error("فایل قابل دانلود نیست");
  }

  // Always use authenticated raw stream — public CDN redirects break CORS with credentials.
  const blob = typedFileBlob(
    await fetchRawFileBlob(storageKey),
    guessMimeFromStorageKey(storageKey),
    storageKey,
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename?.trim() || storageKey.split("/").pop() || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Download via authenticated media stream (ACL-checked by file id). */
export async function downloadMediaFile(
  fileId: string,
  filename?: string,
): Promise<void> {
  const { mediaStreamUrl } = await import("@/lib/media");
  const res = await fetch(mediaStreamUrl(fileId), {
    credentials: "include",
    headers: authFetchHeaders(),
  });
  if (!res.ok) {
    throw new Error("دانلود ناموفق بود");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename?.trim() || "video.mp4";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function formatDurationLabel(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s} ثانیه`;
  if (s === 0) return `${m} دقیقه`;
  return `${m} دقیقه و ${s} ثانیه`;
}

export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration)
        ? Math.round(video.duration)
        : null;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

export type ReferenceProvider =
  | "youtube"
  | "vimeo"
  | "gdrive"
  | "direct"
  | "unknown";

export function detectReferenceProvider(url: string): ReferenceProvider {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("vimeo.com")) return "vimeo";
    if (host.includes("drive.google.com") || host.includes("docs.google.com"))
      return "gdrive";
    return "direct";
  } catch {
    return "unknown";
  }
}

export function isValidReferenceUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const provider = detectReferenceProvider(u.toString());
    return provider !== "unknown" || Boolean(u.hostname);
  } catch {
    return false;
  }
}
