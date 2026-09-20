export type VideoStorageStatus =
  | "UPLOADED"
  | "UNDER_REVIEW"
  | "IN_PORTFOLIO"
  | "PUBLISHED";

export type VideoStorageItem = {
  id: string;
  title: string;
  description: string | null;
  originalFilename: string;
  storageKey: string;
  thumbnailKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  status: VideoStorageStatus;
  processingStatus: "PENDING" | "READY" | "FAILED";
  uploadedByUserId: string;
  uploadedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  portfolioItemId: string | null;
  portfolioStatus: "PUBLISHED" | "UNPUBLISHED" | null;
  inPortfolio: boolean;
  publishedPublic: boolean;
  createdAt: string;
  updatedAt: string;
  /** Absolute signed playback URL — use for <video src>. */
  playbackUrl: string;
  /** Absolute signed thumbnail URL — use for card posters. */
  thumbnailUrl: string | null;
  hasThumbnail?: boolean;
  streamUrl: string;
  thumbnailStreamUrl: string | null;
  canSendToPortfolio: boolean;
};

export type VideoStorageListPayload = {
  items: VideoStorageItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type VideoStorageStats = {
  total: number;
  inPortfolio: number;
  published: number;
};

export type VideoUploaderOption = {
  id: string;
  fullName: string;
  email: string;
};

export type PortfolioFilter = "ALL" | "IN" | "OUT";
export type PublishedFilter = "ALL" | "YES" | "NO";

export const STATUS_LABELS: Record<VideoStorageStatus, string> = {
  UPLOADED: "آپلود شد",
  UNDER_REVIEW: "در حال بررسی",
  IN_PORTFOLIO: "در نمونه‌کارها",
  PUBLISHED: "در وبسایت عمومی",
};

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
