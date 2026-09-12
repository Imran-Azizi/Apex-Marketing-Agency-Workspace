import { resolveAssetSrc, storagePublicUrl } from "@/lib/api";
import { filePreviewUrl } from "@/lib/upload";

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function getUserInitials(name?: string | null): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

/** Canonical employee/user profile image src (CDN URL preferred). */
export function resolveProfileImageSrc(input?: {
  profileImage?: string | null;
  profileImageUrl?: string | null;
  url?: string | null;
  previewUrl?: string | null;
  meta?: unknown;
} | null): string | null {
  if (!input) return null;
  for (const value of [input.previewUrl, input.profileImageUrl, input.url]) {
    if (typeof value === "string" && value.trim()) {
      if (value.startsWith("blob:") || isAbsoluteHttpUrl(value)) {
        return value.trim();
      }
    }
  }
  if (input.profileImage) {
    return (
      resolveAssetSrc({
        storageKey: input.profileImage,
        meta: input.meta,
        url: input.profileImageUrl,
      }) ||
      storagePublicUrl(input.profileImage) ||
      filePreviewUrl(input.profileImage, input.meta)
    );
  }
  return null;
}
