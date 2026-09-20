import { AppError } from "../../utils/response.js";
import { assertProjectAccess } from "../../services/projectAccess.js";
import { assertConversationMember } from "../chat/authz.js";
import {
  isCleanFinalStorageKey,
  isPublicStorageKey,
  stripStoragePrefix,
} from "../../services/storage/media-manager.js";
import { prisma } from "../../db/prisma.js";
import { isFullAccessRole } from "../../services/permissions/catalog.js";
import { hasAnyPermission } from "../../services/permissions/effective.js";

export function normalizeStorageKey(input) {
  const key = String(input || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("//")) {
    throw new AppError("شناسه فایل نامعتبر است", 400, "INVALID_KEY");
  }
  if (key.length > 500) {
    throw new AppError("شناسه فایل نامعتبر است", 400, "INVALID_KEY");
  }
  return key;
}

/**
 * Object-level ACL for storage-key streaming (/files and /files/raw).
 * Public marketing prefixes are readable without a session.
 */
export async function assertRawStorageAccess(storageKey, auth) {
  const key = normalizeStorageKey(storageKey);
  if (isCleanFinalStorageKey(key)) {
    throw new AppError(
      "از مسیر امن رسانه استفاده کنید",
      403,
      "USE_MEDIA_ROUTE",
    );
  }
  if (isPublicStorageKey(key)) return key;

  if (!auth) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }
  if (auth.audience === "PORTAL") {
    throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
  }

  const role = String(auth.roleCode || "").toUpperCase();
  if (role === "MANAGER" || role === "ADMIN") return key;

  const unprefixed = stripStoragePrefix(key);
  const parts = unprefixed.split("/").filter(Boolean);

  if (
    (parts[0] === "videos" && parts[1] === "storage") ||
    (parts[0] === "images" && parts[1] === "video-storage")
  ) {
    if (
      !hasAnyPermission(
        auth.permissions,
        ["video_storage.view"],
        auth.roleCode,
      )
    ) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    if (isFullAccessRole(auth.roleCode)) return key;

    const owned = await prisma.companyVideo.findFirst({
      where: {
        deletedAt: null,
        uploadedByUserId: auth.userId,
        OR: [{ storageKey: key }, { thumbnailKey: key }],
      },
      select: { id: true },
    });
    if (!owned) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    return key;
  }

  if (parts[0] === "projects" && parts[1]) {
    await assertProjectAccess(parts[1], auth);
    return key;
  }

  if (parts[0] === "uploads" && parts[1] === "chat" && parts[2] && auth.userId) {
    await assertConversationMember(parts[2], auth.userId);
    return key;
  }

  if (parts[0] === "users" && parts[1]) {
    if (parts[1] === auth.userId) return key;
    // Staff peers (chat, assignments, directories) may load each other's avatars.
    if (auth.audience !== "PORTAL") return key;
    throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
  }

  if (parts[0] === "profile-images") {
    if (auth.audience !== "PORTAL") return key;
    throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
  }

  return key;
}
