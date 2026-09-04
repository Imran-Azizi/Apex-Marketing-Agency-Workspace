import path from "path";
import crypto from "crypto";
import {
  CHAT_ALLOWED_AUDIO_MIMES,
  CHAT_ALLOWED_DOC_MIMES,
  CHAT_ALLOWED_IMAGE_MIMES,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_VOICE_MAX_BYTES,
  CHAT_VOICE_MAX_DURATION_MS,
} from "./constants.js";
import { AppError } from "../../utils/response.js";
import { storage } from "../../services/storage.js";
import {
  MEDIA_ROOTS,
  UPLOAD_PURPOSE,
  sanitizeFilename,
  sanitizePathSegment,
} from "../../services/storage/media-manager.js";

function extFromName(name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if (!ext || ext.length > 10) return "";
  if (!/^\.[a-z0-9.]+$/i.test(ext)) return "";
  return ext;
}

function sniffKind(mime, isVoice) {
  const m = String(mime || "").toLowerCase();
  if (isVoice) return "VOICE";
  if (CHAT_ALLOWED_IMAGE_MIMES.has(m) || m.startsWith("image/")) return "IMAGE";
  if (CHAT_ALLOWED_AUDIO_MIMES.has(m) || m.startsWith("audio/")) return "AUDIO";
  if (CHAT_ALLOWED_DOC_MIMES.has(m)) return "DOCUMENT";
  return "OTHER";
}

/**
 * Validate chat upload without trusting client MIME/filename.
 * @returns {{ mimeType: string, kind: string, fileName: string, sizeBytes: number, durationMs: number|null }}
 */
export function validateChatUpload(file, { isVoice = false, durationMs } = {}) {
  if (!file?.buffer?.length) {
    throw new AppError("فایل خالی است", 400, "EMPTY_FILE");
  }

  const sizeBytes = file.buffer.length;
  const claimedMime = String(file.mimetype || "").toLowerCase();

  // Prefer magic-byte hints when available; fall back to claimed mime with allow-list.
  let mimeType = claimedMime;
  const buf = file.buffer;
  if (buf[0] === 0xff && buf[1] === 0xd8) mimeType = "image/jpeg";
  else if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    mimeType = "image/png";
  } else if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    mimeType = "application/pdf";
  } else if (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WAVE"
  ) {
    mimeType = "audio/wav";
  } else if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf) {
    // EBML → webm/mkv
    mimeType = claimedMime.startsWith("audio/") ? claimedMime : "audio/webm";
  }

  const max = isVoice ? CHAT_VOICE_MAX_BYTES : CHAT_ATTACHMENT_MAX_BYTES;
  if (sizeBytes > max) {
    throw new AppError("حجم فایل بیش از حد مجاز است", 400, "FILE_TOO_LARGE");
  }

  const kind = sniffKind(mimeType, isVoice);
  const allowed =
    (isVoice &&
      (CHAT_ALLOWED_AUDIO_MIMES.has(mimeType) ||
        mimeType.startsWith("audio/"))) ||
    (!isVoice &&
      (CHAT_ALLOWED_IMAGE_MIMES.has(mimeType) ||
        CHAT_ALLOWED_DOC_MIMES.has(mimeType) ||
        CHAT_ALLOWED_AUDIO_MIMES.has(mimeType) ||
        mimeType.startsWith("image/")));

  if (!allowed || kind === "OTHER") {
    throw new AppError("نوع فایل مجاز نیست", 400, "FILE_TYPE_NOT_ALLOWED");
  }

  let duration = null;
  if (isVoice) {
    const d = Number(durationMs);
    if (Number.isFinite(d) && d > 0) {
      if (d > CHAT_VOICE_MAX_DURATION_MS) {
        throw new AppError("مدت پیام صوتی بیش از حد مجاز است", 400, "VOICE_TOO_LONG");
      }
      duration = Math.round(d);
    }
  }

  const rawName = sanitizeFilename(file.originalname).slice(0, 120) || "file";
  const ext = extFromName(rawName) || extFromName(`.${mimeType.split("/")[1] || "bin"}`);
  const fileName = rawName.includes(".") ? rawName : `${rawName}${ext}`;

  return { mimeType, kind: isVoice ? "VOICE" : kind, fileName, sizeBytes, durationMs: duration };
}

/**
 * Save chat attachment under isolated storage key; returns metadata for message create.
 */
export async function saveChatAttachment(file, { conversationId, userId, isVoice, durationMs }) {
  const validated = validateChatUpload(file, { isVoice, durationMs });
  const conv = sanitizePathSegment(conversationId);
  const uid = sanitizePathSegment(userId);
  if (!conv || !uid) {
    throw new AppError("شناسه نامعتبر است", 400, "VALIDATION_ERROR");
  }

  const folderPath = `${MEDIA_ROOTS.UPLOADS}/chat/${conv}/${uid}`;
  const keySuffix = crypto.randomBytes(16).toString("hex");
  const ext = extFromName(validated.fileName) || "";
  const safeName = `${keySuffix}${ext}`;
  const storageKeyExplicit = `${folderPath}/${safeName}`;

  const saved = await storage.saveBuffer(file.buffer, {
    filename: safeName,
    contentType: validated.mimeType,
    storageKey: storageKeyExplicit,
    uploadContext: {
      purpose: UPLOAD_PURPOSE.CHAT_ATTACHMENT,
      conversationId: conv,
      userId: uid,
    },
  });

  const storageKey = saved?.key || saved?.storageKey || storageKeyExplicit;

  return {
    storageKey,
    fileName: validated.fileName,
    mimeType: validated.mimeType,
    sizeBytes: validated.sizeBytes,
    kind: validated.kind,
    durationMs: validated.durationMs,
  };
}
