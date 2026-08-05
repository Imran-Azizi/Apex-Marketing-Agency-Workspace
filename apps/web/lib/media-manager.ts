/**
 * Client-side mirror of API media folder routing.
 * Keep upload purposes aligned with apps/api/src/services/storage/media-manager.js
 */

export const UPLOAD_PURPOSE = {
  PORTAL_ASSET: "portal-asset",
  PRODUCTION_FINAL: "production-final",
  NARRATION_AUDIO: "narration-audio",
  EMPLOYEE_PROFILE: "employee-profile",
  GENERIC: "generic",
} as const;

export type UploadPurpose =
  (typeof UPLOAD_PURPOSE)[keyof typeof UPLOAD_PURPOSE];

export const MEDIA_ROOTS = {
  IMAGES: "images",
  VIDEOS: "videos",
  DOCUMENTS: "documents",
  AUDIO: "audio",
  PROJECTS: "projects",
  USERS: "users",
  UPLOADS: "uploads",
} as const;

export type UploadContext = {
  purpose: UploadPurpose;
  projectId?: string;
  userId?: string;
  assetKind?: string;
  videoType?: "WATERMARKED" | "CLEAN";
  /** Legacy folder hint — server resolves the canonical path */
  folder?: string;
};

export type StorageMeta = {
  provider?: string | null;
  publicId?: string | null;
  folder?: string | null;
  folderPath?: string | null;
  cloudinaryFolder?: string | null;
  resourceType?: string | null;
  url?: string | null;
  category?: string | null;
  purpose?: string | null;
  format?: string | null;
  bytes?: number | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  images: "تصاویر",
  videos: "ویدیوها",
  documents: "اسناد",
  audio: "صوت",
  projects: "پروژه",
  users: "کاربران",
  uploads: "عمومی",
  reference: "لینک مرجع",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getStorageMeta(
  meta?: Record<string, unknown> | null,
): StorageMeta | null {
  const root = asRecord(meta);
  const storage = asRecord(root?.storage);
  return storage as StorageMeta | null;
}

export function getMediaCategory(
  storageKey?: string | null,
  opts?: {
    mimeType?: string | null;
    meta?: Record<string, unknown> | null;
  },
): string {
  const storage = getStorageMeta(opts?.meta);
  if (storage?.category) return String(storage.category);

  const key = String(storageKey || "");
  if (!key || key.startsWith("ref://")) return "reference";

  const first = key.split("/")[0];
  if (first === "images") return MEDIA_ROOTS.IMAGES;
  if (first === "videos") return MEDIA_ROOTS.VIDEOS;
  if (first === "documents") return MEDIA_ROOTS.DOCUMENTS;
  if (first === "audio") return MEDIA_ROOTS.AUDIO;
  if (first === "projects") {
    if (key.includes("/audio/")) return MEDIA_ROOTS.AUDIO;
    if (key.includes("/final/")) return MEDIA_ROOTS.VIDEOS;
    return MEDIA_ROOTS.PROJECTS;
  }
  if (first === "users") return MEDIA_ROOTS.IMAGES;

  const mime = String(opts?.mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return MEDIA_ROOTS.IMAGES;
  if (mime.startsWith("video/")) return MEDIA_ROOTS.VIDEOS;
  if (mime.startsWith("audio/")) return MEDIA_ROOTS.AUDIO;
  if (mime.includes("pdf") || mime.includes("document")) {
    return MEDIA_ROOTS.DOCUMENTS;
  }

  if (first === "profile-images") return MEDIA_ROOTS.IMAGES;
  if (first === "project-audio") return MEDIA_ROOTS.AUDIO;
  if (first === "production-watermarked" || first === "production-clean") {
    return MEDIA_ROOTS.VIDEOS;
  }
  if (first === "client-assets") {
    if (mime.startsWith("image/")) return MEDIA_ROOTS.IMAGES;
    if (mime.startsWith("video/")) return MEDIA_ROOTS.VIDEOS;
    if (mime.startsWith("audio/")) return MEDIA_ROOTS.AUDIO;
    return MEDIA_ROOTS.DOCUMENTS;
  }

  return MEDIA_ROOTS.UPLOADS;
}

export function getMediaFolderLabel(
  storageKey?: string | null,
  opts?: {
    mimeType?: string | null;
    meta?: Record<string, unknown> | null;
  },
): string {
  const storage = getStorageMeta(opts?.meta);
  if (storage?.folderPath) {
    const path = String(storage.folderPath);
    if (path.startsWith("projects/") && path.includes("/audio")) {
      return "صوت پروژه";
    }
    if (path.includes("/final/clean")) return "ویدیوی نهایی (پاک)";
    if (path.includes("/final/watermarked")) {
      return "ویدیوی نهایی (واترمارک)";
    }
    if (path.startsWith("projects/")) return "دارایی‌های پروژه";
    if (path.startsWith("users/")) return "پروفایل کاربر";
  }

  const key = String(storageKey || "");
  if (key.startsWith(`${MEDIA_ROOTS.USERS}/`)) return "پروفایل کاربر";
  if (key.startsWith(`${MEDIA_ROOTS.PROJECTS}/`)) {
    if (key.includes("/audio/")) return "صوت پروژه";
    if (key.includes("/final/clean")) return "ویدیوی نهایی (پاک)";
    if (key.includes("/final/watermarked")) {
      return "ویدیوی نهایی (واترمارک)";
    }
    return "دارایی‌های پروژه";
  }

  const category = getMediaCategory(storageKey, opts);
  return CATEGORY_LABELS[category] || category;
}

export function mergeUploadStorageMeta(
  existingMeta: Record<string, unknown> | undefined,
  uploaded: { storageMeta?: Record<string, unknown> | null },
): Record<string, unknown> | undefined {
  if (!uploaded.storageMeta) {
    return existingMeta && Object.keys(existingMeta).length
      ? existingMeta
      : undefined;
  }
  return {
    ...(existingMeta || {}),
    storage: uploaded.storageMeta,
  };
}

export type MediaLibraryGroup = {
  id: string;
  label: string;
  items: Array<{
    id: string;
    name: string;
    kind?: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    storageKey?: string;
    meta?: Record<string, unknown> | null;
    createdAt?: string | null;
  }>;
};

/** Group assets by Cloudinary media category for library views. */
export function groupAssetsByMediaCategory<
  T extends {
    id: string;
    name: string;
    kind?: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    storageKey?: string;
    meta?: Record<string, unknown> | null;
    createdAt?: string | null;
  },
>(assets: T[]): MediaLibraryGroup[] {
  const order = [
    MEDIA_ROOTS.IMAGES,
    MEDIA_ROOTS.VIDEOS,
    MEDIA_ROOTS.AUDIO,
    MEDIA_ROOTS.DOCUMENTS,
    MEDIA_ROOTS.PROJECTS,
    MEDIA_ROOTS.USERS,
    "reference",
    MEDIA_ROOTS.UPLOADS,
  ];

  const map = new Map<string, T[]>();
  for (const asset of assets) {
    const category = getMediaCategory(asset.storageKey, {
      mimeType: asset.mimeType,
      meta: asset.meta,
    });
    const list = map.get(category) || [];
    list.push(asset);
    map.set(category, list);
  }

  return order
    .filter((id) => map.has(id))
    .map((id) => ({
      id,
      label: CATEGORY_LABELS[id] || id,
      items: map.get(id)!,
    }));
}
