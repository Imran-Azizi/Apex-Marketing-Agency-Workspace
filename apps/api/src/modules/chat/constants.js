/** Manager / Admin roles that always may chat with anyone. */
export const CHAT_MANAGER_ROLES = new Set(["MANAGER", "ADMIN"]);

/** Staff roles treated as employees for E2E policy (not managers). */
export const CHAT_EMPLOYEE_ROLES = new Set([
  "SALES",
  "EDITOR",
  "NARRATOR",
  "FINANCE",
  "PROJECT_MANAGER",
]);

export const CHAT_MESSAGE_BODY_MAX = 8000;
export const CHAT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const CHAT_VOICE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const CHAT_VOICE_MAX_DURATION_MS = 5 * 60 * 1000; // 5 min

export const CHAT_ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const CHAT_ALLOWED_DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export const CHAT_ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp3",
]);

export const CHAT_REACTION_EMOJIS = new Set([
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
]);

export function isChatManagerRole(roleCode) {
  return CHAT_MANAGER_ROLES.has(String(roleCode || "").toUpperCase());
}

export function isChatEmployeeRole(roleCode) {
  return CHAT_EMPLOYEE_ROLES.has(String(roleCode || "").toUpperCase());
}

export function directConversationKey(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function orderedUserPair(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a };
}

export function previewFromMessage({ type, body, attachmentKind }) {
  if (type === "VOICE" || attachmentKind === "VOICE") return "🎤 پیام صوتی";
  if (type === "IMAGE" || attachmentKind === "IMAGE") return "📷 تصویر";
  if (type === "FILE" || attachmentKind === "DOCUMENT") return "📎 فایل";
  const text = String(body || "").trim();
  if (!text) return "پیام";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
