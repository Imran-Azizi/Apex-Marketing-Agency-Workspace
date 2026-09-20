/**
 * Shared allow-lists for Client Assets image uploads (logos / product images).
 * Keep in sync with `apps/web/lib/client-asset-images.ts`.
 */

import path from 'path';
import { AppError } from '../../utils/response.js';
import { SECURITY } from '../../config/security.js';

export const CLIENT_ASSET_IMAGE_EXTENSIONS = Object.freeze([
  'jpg',
  'jpeg',
  'jfif',
  'jpe',
  'jif',
  'png',
  'webp',
  'gif',
  'svg',
  'bmp',
  'tif',
  'tiff',
  'avif',
]);

/** Extra design formats historically allowed for logos only. */
export const CLIENT_ASSET_LOGO_EXTRA_EXTENSIONS = Object.freeze([
  'ai',
  'eps',
  'psd',
]);

export const CLIENT_ASSET_IMAGE_MIME = Object.freeze(
  new Set([
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/bmp',
    'image/x-ms-bmp',
    'image/x-bmp',
    'image/tiff',
    'image/tif',
    'image/avif',
  ]),
);

export const CLIENT_ASSET_LOGO_EXTRA_MIME = Object.freeze(
  new Set([
    'application/postscript',
    'application/illustrator',
    'application/eps',
    'application/x-eps',
    'image/vnd.adobe.photoshop',
    'application/x-photoshop',
    'application/photoshop',
    'image/psd',
  ]),
);

const FORMAT_HINT =
  'فقط تصاویر JPG/JPEG/JFIF، PNG، WEBP، GIF، SVG، BMP، TIFF یا AVIF مجاز است';

/**
 * @param {string | null | undefined} name
 */
export function clientAssetImageExtension(name) {
  const ext = path.extname(String(name || '')).slice(1).toLowerCase();
  return ext || null;
}

/**
 * @param {string | null | undefined} kind
 */
export function isClientAssetImageKind(kind) {
  const k = String(kind || '').toUpperCase();
  return k === 'LOGO' || k === 'PRODUCT_IMAGE';
}

/**
 * Validate logo / product image by extension + MIME (not extension alone).
 *
 * @param {{ name?: string | null, mimeType?: string | null, sizeBytes?: number | null, kind?: string | null }} file
 */
export function assertClientAssetImageFile(file = {}) {
  const name = String(file.name || '').trim();
  const mimeRaw = String(file.mimeType || '').trim().toLowerCase();
  const kind = String(file.kind || '').toUpperCase();
  const ext = clientAssetImageExtension(name);

  const allowedExts =
    kind === 'LOGO'
      ? [...CLIENT_ASSET_IMAGE_EXTENSIONS, ...CLIENT_ASSET_LOGO_EXTRA_EXTENSIONS]
      : [...CLIENT_ASSET_IMAGE_EXTENSIONS];

  if (!ext || !allowedExts.includes(ext)) {
    throw new AppError(
      kind === 'LOGO'
        ? `${FORMAT_HINT} (برای لوگو: AI، EPS، PSD نیز مجاز است)`
        : FORMAT_HINT,
      400,
      'INVALID_IMAGE',
    );
  }

  const allowedMimes =
    kind === 'LOGO'
      ? new Set([...CLIENT_ASSET_IMAGE_MIME, ...CLIENT_ASSET_LOGO_EXTRA_MIME])
      : CLIENT_ASSET_IMAGE_MIME;

  if (
    mimeRaw &&
    mimeRaw !== 'application/octet-stream' &&
    !allowedMimes.has(mimeRaw)
  ) {
    throw new AppError(FORMAT_HINT, 400, 'INVALID_IMAGE');
  }

  if (file.sizeBytes != null) {
    const size = Number(file.sizeBytes);
    if (!Number.isFinite(size) || size < 0) {
      throw new AppError('اندازه فایل نامعتبر است', 400, 'INVALID_IMAGE');
    }
    if (size > SECURITY.upload.maxFileBytes) {
      throw new AppError('حجم فایل بیش از حد مجاز است', 400, 'FILE_TOO_LARGE');
    }
  }

  return { ext, mimeType: mimeRaw || null };
}

/**
 * Whether a multer upload should be treated as SVG (needs sanitization).
 */
export function isSvgUpload({ originalname, mimetype } = {}) {
  const ext = clientAssetImageExtension(originalname);
  const mime = String(mimetype || '').toLowerCase();
  return ext === 'svg' || mime === 'image/svg+xml';
}

export { FORMAT_HINT };
