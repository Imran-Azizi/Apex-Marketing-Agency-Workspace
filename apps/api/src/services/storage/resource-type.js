/**
 * Map MIME / file extension → Cloudinary resource_type.
 * Audio is uploaded as "video" (Cloudinary streaming path).
 */

const IMAGE_EXT = new Set([
  "jpg",
  "jpeg",
  "jfif",
  "jpe",
  "jif",
  "png",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "ico",
  "avif",
  "heic",
  "heif",
]);

/** Extensions Cloudinary often normalizes away from the original filename. */
const JPEG_FAMILY = new Set(["jpg", "jpeg", "jfif", "jpe", "jif"]);

/**
 * Delivery `format` for reconstructed CDN URLs.
 * Prefer omitting format so Cloudinary serves the stored asset (e.g. .jfif → .jpg).
 * @param {string | undefined} ext
 * @returns {string | undefined}
 */
export function deliveryFormatForExtension(ext) {
  if (!ext) return undefined;
  const normalized = String(ext).toLowerCase();
  if (JPEG_FAMILY.has(normalized)) return undefined;
  return normalized;
}

const VIDEO_EXT = new Set([
  "mp4",
  "mov",
  "webm",
  "mkv",
  "avi",
  "m4v",
  "mpeg",
  "mpg",
  "3gp",
  "ogv",
]);

const AUDIO_EXT = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "flac",
  "wma",
  "opus",
]);

/**
 * @param {string} keyOrName
 * @returns {string | undefined}
 */
export function extensionOf(keyOrName) {
  const base = String(keyOrName || "").split(/[\\/]/).pop() || "";
  const match = /\.([a-z0-9]+)$/i.exec(base);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Cloudinary public_id (no file extension).
 * @param {string} storageKey
 */
export function toCloudinaryPublicId(storageKey) {
  return String(storageKey || "").replace(/\.[^./\\]+$/, "");
}

/**
 * @param {{ contentType?: string | null, filename?: string | null, storageKey?: string | null }} input
 * @returns {"image" | "video" | "raw"}
 */
export function resolveCloudinaryResourceType({
  contentType,
  filename,
  storageKey,
} = {}) {
  const mime = String(contentType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "video";

  const ext =
    extensionOf(filename) || extensionOf(storageKey) || extensionOf(mime);
  if (ext && IMAGE_EXT.has(ext)) return "image";
  if (ext && VIDEO_EXT.has(ext)) return "video";
  if (ext && AUDIO_EXT.has(ext)) return "video";
  return "raw";
}
