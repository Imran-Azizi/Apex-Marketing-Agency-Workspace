export type PosterStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SENT_TO_CUSTOMER";

export type PosterItem = {
  id: string;
  projectId: string;
  crmCustomerId?: string;
  fileId: string;
  version: number;
  notes?: string | null;
  status: PosterStatus | string;
  statusLabel?: string | null;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
  createdAt: string;
  updatedAt?: string;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  deliveredAt?: string | null;
  deliveredById?: string | null;
  deliveredByName?: string | null;
  isLatest?: boolean;
  isLatestDelivered?: boolean;
};

export type PostersPayload = {
  project: {
    id: string;
    code: string;
    title: string;
    status: string;
  };
  items: PosterItem[];
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    sent: number;
  };
};

export const POSTER_STATUS_LABELS: Record<PosterStatus, string> = {
  PENDING_REVIEW: "در انتظار تایید",
  APPROVED: "تایید شده",
  REJECTED: "رد شده",
  SENT_TO_CUSTOMER: "ارسال شده به مشتری",
};

export const ACCEPTED_POSTER_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

export function isAcceptedPosterFile(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) =>
    name.endsWith(ext),
  );
}

export function validatePosterFile(file: File): string | null {
  if (!isAcceptedPosterFile(file)) {
    return "فقط فایل‌های تصویری (JPG، PNG، WebP، GIF) مجاز هستند";
  }
  return null;
}
