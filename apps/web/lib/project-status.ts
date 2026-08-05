/**
 * Shared Dari labels for project statuses.
 * DB/API keep English enum codes; UI must never show those codes to users.
 */

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  NEW_MANAGER_REVIEW: "بررسی مدیر",
  CONTENT_GENERATION: "تولید محتوا",
  INTERNAL_CONTENT_REVIEW: "بازبینی داخلی محتوا",
  WAITING_CLIENT_CONTENT_APPROVAL: "منتظر تأیید محتوا",
  CONTENT_REVISION: "اصلاح محتوا",
  NARRATION_RECORDING: "ضبط نریشن",
  PRODUCTION_EDITING: "تولید",
  PRODUCTION: "تولید",
  MANAGER_FINAL_REVIEW: "بازبینی نهایی مدیر",
  FINAL_REVISION: "اصلاح نهایی",
  WAITING_CLIENT_FINAL_APPROVAL: "منتظر تأیید نهایی",
  WAITING_PAYMENT: "منتظر پرداخت",
  READY_TO_DOWNLOAD: "آماده دانلود",
  COMPLETED: "تکمیل‌شده",
  ON_HOLD: "متوقف",
  CANCELED: "لغوشده",
};

export const CUSTOMER_FACING_STATUS_LABELS: Record<string, string> = {
  INFO_RECEIVED: "اطلاعات دریافت شد",
  PREPARING_CONTENT: "در حال آماده‌سازی",
  WAITING_YOUR_APPROVAL: "منتظر تأیید شما",
  IN_PRODUCTION: "در تولید",
  FINAL_REVIEW: "بازبینی نهایی",
  WAITING_PAYMENT: "منتظر پرداخت",
  READY_DELIVERY: "آماده تحویل",
  COMPLETED: "تکمیل‌شده",
};

/** Progress % fallback for manager UI based on internal workflow status.
 * Kept in sync with apps/api/src/services/projectProgress.js.
 * Prefer `project.progress` from the API when available.
 */
export const PROJECT_STATUS_PROGRESS: Record<string, number> = {
  NEW_MANAGER_REVIEW: 8,
  CONTENT_GENERATION: 18,
  INTERNAL_CONTENT_REVIEW: 28,
  WAITING_CLIENT_CONTENT_APPROVAL: 38,
  CONTENT_REVISION: 34,
  NARRATION_RECORDING: 48,
  PRODUCTION_EDITING: 62,
  PRODUCTION: 62,
  MANAGER_FINAL_REVIEW: 72,
  FINAL_REVISION: 68,
  WAITING_CLIENT_FINAL_APPROVAL: 82,
  WAITING_PAYMENT: 90,
  READY_TO_DOWNLOAD: 95,
  COMPLETED: 100,
  ON_HOLD: 15,
  CANCELED: 0,
};

const UNKNOWN = "نامشخص";

export function getProjectStatusLabel(status: string | null | undefined): string {
  if (!status) return UNKNOWN;
  return PROJECT_STATUS_LABELS[status] || UNKNOWN;
}

export function getCustomerFacingStatusLabel(
  status: string | null | undefined,
): string {
  if (!status) return UNKNOWN;
  return CUSTOMER_FACING_STATUS_LABELS[status] || UNKNOWN;
}

export function getProjectProgress(status: string | null | undefined): number {
  if (!status) return 0;
  return PROJECT_STATUS_PROGRESS[status] ?? 0;
}
