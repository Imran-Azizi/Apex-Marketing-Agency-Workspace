/** Shared narration audio format rules (frontend). Keep in sync with API `modules/narration/audio.js`. */

export const NARRATION_AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "webm",
] as const;

export const NARRATION_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/ogg",
  "audio/vorbis",
  "audio/flac",
  "audio/x-flac",
  "audio/webm",
]);

/** Hard cap aligned with API `SECURITY.upload.maxFileBytes` (5 GB). */
export const NARRATION_AUDIO_MAX_BYTES = 5 * 1024 * 1024 * 1024;

export const NARRATION_AUDIO_ACCEPT = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".flac",
  ".webm",
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/webm",
].join(",");

const FORMAT_HINT =
  "فقط فایل‌های صوتی MP3، WAV، M4A، AAC، OGG، FLAC یا WebM مجاز است";

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

export type NarrationAudioValidation =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Client-side gate before upload. Server still re-validates.
 */
export function validateNarrationAudioFile(file: File): NarrationAudioValidation {
  if (!file || file.size <= 0) {
    return { ok: false, message: "فایل صوتی انتخاب نشده است" };
  }
  if (file.size > NARRATION_AUDIO_MAX_BYTES) {
    return { ok: false, message: "حجم فایل بیش از حد مجاز است" };
  }

  const ext = extensionOf(file.name);
  const okExt = (NARRATION_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
  if (!okExt) {
    return { ok: false, message: FORMAT_HINT };
  }

  const mime = String(file.type || "")
    .trim()
    .toLowerCase();
  if (
    mime &&
    mime !== "application/octet-stream" &&
    !NARRATION_AUDIO_MIME_TYPES.has(mime)
  ) {
    return { ok: false, message: FORMAT_HINT };
  }

  return { ok: true };
}

/** Formats that most Chromium/Firefox/Safari builds can play natively. */
export function isLikelyBrowserPlayableAudio(
  mimeType?: string | null,
  fileName?: string | null,
): boolean {
  const mime = String(mimeType || "")
    .toLowerCase();
  const ext = extensionOf(String(fileName || ""));

  if (
    mime.includes("mpeg") ||
    mime.includes("mp3") ||
    mime.includes("wav") ||
    mime.includes("mp4") ||
    mime.includes("m4a") ||
    mime.includes("aac") ||
    mime.includes("ogg") ||
    mime.includes("webm")
  ) {
    return true;
  }

  return ["mp3", "wav", "m4a", "aac", "ogg", "oga", "webm"].includes(ext);
}
