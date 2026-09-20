/** Client Assets image rules — keep in sync with API `modules/files/image-formats.js`. */

export const CLIENT_ASSET_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "jfif",
  "jpe",
  "jif",
  "png",
  "webp",
  "gif",
  "svg",
  "bmp",
  "tif",
  "tiff",
  "avif",
] as const;

export const CLIENT_ASSET_LOGO_EXTRA_EXTENSIONS = [
  "ai",
  "eps",
  "psd",
] as const;

export const CLIENT_ASSET_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/x-ms-bmp",
  "image/x-bmp",
  "image/tiff",
  "image/tif",
  "image/avif",
]);

export const CLIENT_ASSET_LOGO_EXTRA_MIME_TYPES = new Set([
  "application/postscript",
  "application/illustrator",
  "application/eps",
  "application/x-eps",
  "image/vnd.adobe.photoshop",
  "application/x-photoshop",
  "application/photoshop",
  "image/psd",
]);

/** Aligned with API `SECURITY.upload.maxFileBytes` (5 GB). */
export const CLIENT_ASSET_MAX_BYTES = 5 * 1024 * 1024 * 1024;

const RASTER_ACCEPT = [
  ".jpg",
  ".jpeg",
  ".jfif",
  ".jpe",
  ".jif",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/avif",
].join(",");

export const CLIENT_ASSET_PRODUCT_IMAGE_ACCEPT = RASTER_ACCEPT;

export const CLIENT_ASSET_LOGO_ACCEPT = [
  RASTER_ACCEPT,
  ".ai",
  ".eps",
  ".psd",
  "application/postscript",
  "image/vnd.adobe.photoshop",
].join(",");

export const CLIENT_ASSET_PRODUCT_IMAGE_HINT =
  "JPG, JPEG, JFIF, PNG, WEBP, GIF, SVG, BMP, TIFF, AVIF";

export const CLIENT_ASSET_LOGO_HINT =
  "JPG, JPEG, JFIF, PNG, WEBP, GIF, SVG, BMP, TIFF, AVIF · AI, EPS, PSD";

const FORMAT_HINT =
  "فقط تصاویر JPG/JPEG/JFIF، PNG، WEBP، GIF، SVG، BMP، TIFF یا AVIF مجاز است";

export const CLIENT_ASSET_IMAGE_NAME_RE =
  /\.(png|jpe?g|jfif|jpe|jif|gif|webp|svg|bmp|tiff?|avif)$/i;

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

export type ClientAssetImageValidation =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Client-side gate for LOGO / PRODUCT_IMAGE before upload.
 */
export function validateClientAssetImageFile(
  file: File,
  kind: "LOGO" | "PRODUCT_IMAGE",
): ClientAssetImageValidation {
  if (!file || file.size <= 0) {
    return { ok: false, message: "فایل انتخاب نشده است" };
  }
  if (file.size > CLIENT_ASSET_MAX_BYTES) {
    return { ok: false, message: "حجم فایل بیش از حد مجاز است" };
  }

  const ext = extensionOf(file.name);
  const allowedExts =
    kind === "LOGO"
      ? [
          ...(CLIENT_ASSET_IMAGE_EXTENSIONS as readonly string[]),
          ...(CLIENT_ASSET_LOGO_EXTRA_EXTENSIONS as readonly string[]),
        ]
      : [...(CLIENT_ASSET_IMAGE_EXTENSIONS as readonly string[])];

  if (!allowedExts.includes(ext)) {
    return {
      ok: false,
      message:
        kind === "LOGO"
          ? `${FORMAT_HINT} (برای لوگو: AI، EPS، PSD نیز مجاز است)`
          : FORMAT_HINT,
    };
  }

  const mime = String(file.type || "")
    .trim()
    .toLowerCase();
  const allowedMimes =
    kind === "LOGO"
      ? new Set([
          ...CLIENT_ASSET_IMAGE_MIME_TYPES,
          ...CLIENT_ASSET_LOGO_EXTRA_MIME_TYPES,
        ])
      : CLIENT_ASSET_IMAGE_MIME_TYPES;

  if (
    mime &&
    mime !== "application/octet-stream" &&
    !allowedMimes.has(mime)
  ) {
    return { ok: false, message: FORMAT_HINT };
  }

  return { ok: true };
}

export function isClientAssetDisplayImage(
  mimeType?: string | null,
  fileName?: string | null,
): boolean {
  if (mimeType?.startsWith("image/")) return true;
  return CLIENT_ASSET_IMAGE_NAME_RE.test(String(fileName || ""));
}
