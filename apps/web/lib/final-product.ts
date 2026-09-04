export type FinalVideoType = "WATERMARKED" | "CLEAN";

export type FinalVideoStatus =
  | "DRAFT"
  | "UPLOADED"
  | "PENDING_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "SENT_TO_CUSTOMER"
  | "VIEWED_BY_CUSTOMER"
  | "APPROVED_BY_CUSTOMER";

export type FinalVideoDeliveryState =
  | "PENDING_REVIEW"
  | "AWAITING_DELIVERY"
  | "REVISION"
  | "SENT";

export type FinalVideoItem = {
  id: string;
  name: string;
  kind: string;
  videoType: FinalVideoType | string | null;
  videoTypeLabel?: string | null;
  status: FinalVideoStatus | string;
  statusLabel?: string | null;
  deliveryState?: FinalVideoDeliveryState | string | null;
  deliveryStateLabel?: string | null;
  isNew?: boolean;
  awaitingDelivery?: boolean;
  alreadySent?: boolean;
  version: number;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
  sentToCustomer?: boolean;
  sentAt?: string | null;
  sentBy?: string | null;
  sentByName?: string | null;
  allowDownload?: boolean;
  approvedAt?: string | null;
  revisionNotes?: string | null;
  revisionRequestedAt?: string | null;
  reviewedBy?: string | null;
  viewedAt?: string | null;
  customerApprovedAt?: string | null;
};

export type FinalProductsPayload = {
  project: {
    id: string;
    code: string;
    title: string;
    status: string;
  };
  task: {
    id: string;
    status: string;
    version: number;
    submittedAt?: string | null;
    revisionNotes?: string | null;
    editorUser?: { id: string; fullName: string } | null;
  } | null;
  items: FinalVideoItem[];
  counts: {
    total: number;
    watermarked: number;
    clean: number;
    sent: number;
    pending: number;
    pendingReview?: number;
    awaitingDelivery?: number;
  };
};

export const VIDEO_TYPE_LABELS: Record<FinalVideoType, string> = {
  WATERMARKED: "نسخه دارای واترمارک",
  CLEAN: "نسخه بدون واترمارک",
};

export const FINAL_STATUS_LABELS: Record<FinalVideoStatus, string> = {
  DRAFT: "پیش‌نویس",
  UPLOADED: "در انتظار بررسی",
  PENDING_REVIEW: "در انتظار بررسی",
  REVISION_REQUESTED: "نیازمند اصلاح",
  APPROVED: "تأیید شده",
  SENT_TO_CUSTOMER: "ارسال‌شده برای مشتری",
  VIEWED_BY_CUSTOMER: "مشاهده‌شده توسط مشتری",
  APPROVED_BY_CUSTOMER: "ویدیو تایید شد",
};

export const DELIVERY_STATE_LABELS: Record<FinalVideoDeliveryState, string> = {
  PENDING_REVIEW: "ویدیوی جدید — در انتظار بررسی",
  AWAITING_DELIVERY: "آماده ارسال به مشتری",
  REVISION: "نیازمند اصلاح",
  SENT: "ارسال‌شده به مشتری",
};

export function resolveItemDeliveryState(
  item: Pick<
    FinalVideoItem,
    "deliveryState" | "sentToCustomer" | "status" | "alreadySent" | "awaitingDelivery" | "isNew"
  >,
): FinalVideoDeliveryState {
  if (
    item.deliveryState === "PENDING_REVIEW" ||
    item.deliveryState === "AWAITING_DELIVERY" ||
    item.deliveryState === "REVISION" ||
    item.deliveryState === "SENT"
  ) {
    return item.deliveryState;
  }
  if (item.alreadySent || item.sentToCustomer) return "SENT";
  if (
    item.status === "SENT_TO_CUSTOMER" ||
    item.status === "VIEWED_BY_CUSTOMER" ||
    item.status === "APPROVED_BY_CUSTOMER"
  ) {
    return "SENT";
  }
  if (item.status === "REVISION_REQUESTED") return "REVISION";
  if (item.awaitingDelivery || item.status === "APPROVED") return "AWAITING_DELIVERY";
  return "PENDING_REVIEW";
}

export const ACCEPTED_VIDEO_TYPES =
  "video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv";

export function isAcceptedVideoFile(file: File): boolean {
  if (file.type && file.type.startsWith("video/")) return true;
  const name = file.name.toLowerCase();
  return [".mp4", ".webm", ".mov", ".mkv", ".avi"].some((ext) =>
    name.endsWith(ext),
  );
}

export function validateFinalVideoFile(file: File): string | null {
  if (!isAcceptedVideoFile(file)) {
    return "فقط فایل‌های ویدیویی (MP4، WebM، MOV، MKV) مجاز هستند";
  }
  return null;
}
