export type FinalVideoType = "WATERMARKED" | "CLEAN";

export type FinalVideoStatus =
  | "DRAFT"
  | "UPLOADED"
  | "APPROVED"
  | "SENT_TO_CUSTOMER"
  | "VIEWED_BY_CUSTOMER"
  | "APPROVED_BY_CUSTOMER";

export type FinalVideoItem = {
  id: string;
  name: string;
  kind: string;
  videoType: FinalVideoType | string | null;
  videoTypeLabel?: string | null;
  status: FinalVideoStatus | string;
  statusLabel?: string | null;
  version: number;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
  sentToCustomer?: boolean;
  sentAt?: string | null;
  allowDownload?: boolean;
  approvedAt?: string | null;
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
  };
};

export const VIDEO_TYPE_LABELS: Record<FinalVideoType, string> = {
  WATERMARKED: "نسخه دارای واترمارک",
  CLEAN: "نسخه بدون واترمارک",
};

export const FINAL_STATUS_LABELS: Record<FinalVideoStatus, string> = {
  DRAFT: "پیش‌نویس",
  UPLOADED: "آپلود شده",
  APPROVED: "تأیید شده",
  SENT_TO_CUSTOMER: "ارسال‌شده برای مشتری",
  VIEWED_BY_CUSTOMER: "مشاهده‌شده توسط مشتری",
  APPROVED_BY_CUSTOMER: "ویدیو تایید شد",
};

export const ACCEPTED_VIDEO_TYPES =
  "video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv";

export const MAX_FINAL_VIDEO_BYTES = 200 * 1024 * 1024;

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
  if (file.size > MAX_FINAL_VIDEO_BYTES) {
    return "حجم فایل نباید بیشتر از ۲۰۰ مگابایت باشد";
  }
  return null;
}
