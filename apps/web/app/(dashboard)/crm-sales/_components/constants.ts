export const PIPELINE_STAGES = [
  "NEW_LEAD",
  "CONTACTED",
  "INFORMATION_SENT",
  "PROPOSAL_PRICE_SENT",
  "WAITING_DECISION",
  "ORDER_CONFIRMED",
  "DEPOSIT_PENDING",
  "DEPOSIT_CONFIRMED",
  "PORTAL_INVITED",
  "PROJECT_CREATED",
  "DELIVERED",
  "REPEAT_CUSTOMER",
  "LOST_CANCELED",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "سرنخ جدید",
  CONTACTED: "تماس گرفته‌شده",
  INFORMATION_SENT: "اطلاعات ارسال‌شده",
  PROPOSAL_PRICE_SENT: "پیشنهاد / قیمت ارسال‌شده",
  WAITING_DECISION: "در انتظار تصمیم",
  ORDER_CONFIRMED: "سفارش تأییدشده",
  DEPOSIT_PENDING: "در انتظار بیعانه",
  DEPOSIT_CONFIRMED: "بیعانه تأییدشده",
  PORTAL_INVITED: "دعوت پورتال",
  PROJECT_CREATED: "پروژه ایجادشده",
  DELIVERED: "تحویل‌شده",
  REPEAT_CUSTOMER: "مشتری تکراری",
  LOST_CANCELED: "از‌دست‌رفته / لغوشده",
  INTERESTED: "اطلاعات ارسال‌شده",
  PRICE_SENT: "پیشنهاد / قیمت ارسال‌شده",
  COMPLETED: "تحویل‌شده",
  CANCELED: "از‌دست‌رفته / لغوشده",
};

export const CRM_CATEGORIES = [
  "GHOST",
  "INTERESTED",
  "FOLLOW_UP",
  "OUR_CUSTOMERS",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  GHOST: "سرنخ‌های روح",
  INTERESTED: "سرنخ‌های علاقمند",
  FOLLOW_UP: "سرنخ‌های قابل پیگیری",
  OUR_CUSTOMERS: "مشتریان ما",
};

export const SALES_MANUAL_STAGES = [
  "NEW_LEAD",
  "CONTACTED",
  "INFORMATION_SENT",
  "PROPOSAL_PRICE_SENT",
  "WAITING_DECISION",
  "ORDER_CONFIRMED",
  "DEPOSIT_PENDING",
  "LOST_CANCELED",
  "REPEAT_CUSTOMER",
] as const;

export const AUTOMATIC_STAGES = [
  "DEPOSIT_CONFIRMED",
  "PORTAL_INVITED",
  "PROJECT_CREATED",
  "DELIVERED",
] as const;

export type StageControl =
  | "manual"
  | "automatic"
  | "completed"
  | "canceled"
  | "repeat";

export function stageControl(stage?: string | null): StageControl {
  const value = String(stage || "NEW_LEAD");
  if (value === "LOST_CANCELED" || value === "CANCELED") return "canceled";
  if (value === "DELIVERED" || value === "COMPLETED") return "completed";
  if (value === "REPEAT_CUSTOMER") return "repeat";
  if ((AUTOMATIC_STAGES as readonly string[]).includes(value)) return "automatic";
  return "manual";
}

export function isAutomaticStage(stage?: string | null): boolean {
  return (AUTOMATIC_STAGES as readonly string[]).includes(String(stage || ""));
}

export function manualStageOptions(
  _current?: string,
  _role?: string | null,
): string[] {
  return [...PIPELINE_STAGES];
}

export const TRANSFER_BLOCKED_STAGES = new Set<string>([
  "DELIVERED",
  "LOST_CANCELED",
]);

export function canTransferToManagement(customer: {
  pipelineStage?: string | null;
  convertedAt?: string | null;
  isConverted?: boolean;
}): boolean {
  if (customer.isConverted || customer.convertedAt) return false;
  const stage = customer.pipelineStage || "NEW_LEAD";
  return !TRANSFER_BLOCKED_STAGES.has(stage);
}

export type TransferBlockReason = "delivered" | "lost" | "already";

export function getTransferBlockReason(customer: {
  pipelineStage?: string | null;
  convertedAt?: string | null;
  isConverted?: boolean;
}): TransferBlockReason | null {
  if (customer.isConverted || customer.convertedAt) return "already";
  const stage = customer.pipelineStage || "NEW_LEAD";
  if (stage === "DELIVERED") return "delivered";
  if (stage === "LOST_CANCELED") return "lost";
  return null;
}

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: "واتساپ",
  WHATSAPP_WEBSITE: "واتساپ / وب‌سایت عمومی",
  WEBSITE: "وب‌سایت",
  WEBSITE_CONTACT: "فرم تماس وب‌سایت",
  INSTAGRAM: "اینستاگرام",
  FACEBOOK: "فیسبوک",
  TELEGRAM: "تلگرام",
  GOOGLE_SEARCH: "جستجوی گوگل",
  REFERRAL: "معرفی",
  WALK_IN: "مراجعه حضوری",
  PHONE_CALL: "تماس تلفنی",
  ADVERTISEMENT: "تبلیغات",
  MANUAL: "ورود دستی",
  OTHER: "سایر",
};

export const LEAD_SOURCE_CODES = Object.keys(LEAD_SOURCE_LABELS);

export function formatLeadSource(source: string | null | undefined): string {
  if (!source) return "—";
  if (source.startsWith("OTHER:")) {
    const detail = source.slice(6).trim();
    return detail ? `سایر: ${detail}` : LEAD_SOURCE_LABELS.OTHER;
  }
  return LEAD_SOURCE_LABELS[source] || source;
}

export function isWhatsAppLeadSource(source: string | null | undefined): boolean {
  return source === "WHATSAPP" || source === "WHATSAPP_WEBSITE";
}

export function parseLeadSource(source: string | null | undefined): {
  source: string;
  sourceOther: string;
} {
  if (!source) return { source: "", sourceOther: "" };
  if (source.startsWith("OTHER:")) {
    return { source: "OTHER", sourceOther: source.slice(6) };
  }
  if (LEAD_SOURCE_CODES.includes(source)) {
    return { source, sourceOther: "" };
  }
  return { source: "OTHER", sourceOther: source };
}

export function stageBadgeVariant(stage?: string | null) {
  const control = stageControl(stage);
  if (control === "canceled") return "destructive" as const;
  if (control === "completed") return "success" as const;
  if (control === "repeat") return "brand" as const;
  if (control === "automatic") return "warning" as const;
  const value = String(stage || "");
  if (value === "DEPOSIT_PENDING" || value === "WAITING_DECISION") {
    return "warning" as const;
  }
  if (value === "ORDER_CONFIRMED") return "brand" as const;
  return "secondary" as const;
}

export function categoryBadgeVariant(category?: string | null) {
  const value = String(category || "");
  if (value === "OUR_CUSTOMERS") return "brand" as const;
  if (value === "FOLLOW_UP") return "warning" as const;
  if (value === "INTERESTED") return "success" as const;
  if (value === "GHOST") return "secondary" as const;
  return "outline" as const;
}
