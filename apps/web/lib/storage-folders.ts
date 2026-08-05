/**
 * @deprecated Use UPLOAD_PURPOSE from @/lib/media-manager
 */
export {
  UPLOAD_PURPOSE,
  MEDIA_ROOTS,
  type UploadContext,
  type UploadPurpose,
} from "@/lib/media-manager";

/** Legacy folder names still accepted by the API during transition. */
export const LEGACY_UPLOAD_FOLDERS = [
  "uploads",
  "client-assets",
  "project-audio",
  "production-watermarked",
  "production-clean",
  "profile-images",
  "samples",
] as const;
