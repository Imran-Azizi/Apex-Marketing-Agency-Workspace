import path from 'path';
import { AppError } from '../../utils/response.js';
import { SECURITY } from '../../config/security.js';
import { resolveStorageKey } from '../../services/storage/object-delete.js';

/** Supported narration audio formats (extension → MIME allow-list). */
export const NARRATION_AUDIO_EXTENSIONS = Object.freeze([
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'flac',
  'webm',
]);

export const NARRATION_AUDIO_MIME = Object.freeze(
  new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/x-aac',
    'audio/ogg',
    'audio/vorbis',
    'audio/flac',
    'audio/x-flac',
    'audio/webm',
  ]),
);

const AUDIO_EXT_RE = new RegExp(
  `\\.(${NARRATION_AUDIO_EXTENSIONS.join('|')})$`,
  'i',
);

const FORMAT_HINT =
  'فقط فایل‌های صوتی MP3، WAV، M4A، AAC، OGG، FLAC یا WebM مجاز است';

/**
 * @param {string | null | undefined} name
 */
export function narrationAudioExtension(name) {
  const ext = path.extname(String(name || '')).slice(1).toLowerCase();
  return ext || null;
}

/**
 * Validate narration audio by extension and MIME (not extension alone).
 * Empty / octet-stream MIME is allowed when the extension is known.
 *
 * @param {{ name?: string | null, mimeType?: string | null, sizeBytes?: number | null }} file
 */
export function assertNarrationAudioFile(file = {}) {
  const name = String(file.name || '').trim();
  const mimeRaw = String(file.mimeType || '').trim().toLowerCase();
  const ext = narrationAudioExtension(name);
  const okExt = Boolean(ext && NARRATION_AUDIO_EXTENSIONS.includes(ext));

  if (!okExt) {
    throw new AppError(FORMAT_HINT, 400, 'INVALID_AUDIO');
  }

  if (
    mimeRaw &&
    mimeRaw !== 'application/octet-stream' &&
    !NARRATION_AUDIO_MIME.has(mimeRaw)
  ) {
    throw new AppError(FORMAT_HINT, 400, 'INVALID_AUDIO');
  }

  if (file.sizeBytes != null) {
    const size = Number(file.sizeBytes);
    if (!Number.isFinite(size) || size < 0) {
      throw new AppError('اندازه فایل نامعتبر است', 400, 'INVALID_AUDIO');
    }
    if (size > SECURITY.upload.maxFileBytes) {
      throw new AppError('حجم فایل بیش از حد مجاز است', 400, 'FILE_TOO_LARGE');
    }
  }

  return { ext, mimeType: mimeRaw || null };
}

/**
 * Ensure a storage key is safe and scoped to this project's narration audio.
 * Legacy `project-audio/` keys are accepted for older uploads.
 *
 * @param {string | null | undefined} storageKey
 * @param {string} projectId
 */
export function assertNarrationAudioStorageKey(storageKey, projectId) {
  const key = resolveStorageKey(storageKey);
  if (!key) {
    throw new AppError('کلید ذخیره‌سازی فایل نامعتبر است', 400, 'INVALID_STORAGE_KEY');
  }

  const projectPrefix = `projects/${projectId}/audio/`;
  const ok =
    key.startsWith(projectPrefix) ||
    key.startsWith('project-audio/') ||
    (key.startsWith('audio/') && key.includes(projectId));

  if (!ok) {
    throw new AppError(
      'مسیر فایل صوتی با این پروژه هم‌خوانی ندارد',
      403,
      'INVALID_STORAGE_KEY',
    );
  }

  return key;
}

export { AUDIO_EXT_RE, FORMAT_HINT };
