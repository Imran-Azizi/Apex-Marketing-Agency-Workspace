import type { ClientAssetItem } from "@/components/brief/client-assets-uploader";
import { formatDate } from "@/lib/utils";

export type WorkspaceTab = "company" | "assets" | "calendar";

export const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "company", label: "اطلاعات شرکت" },
  { id: "assets", label: "دارایی ها" },
  { id: "calendar", label: "تقویم محتوایی" },
];

export function parseWorkspaceTab(value: string | null | undefined): WorkspaceTab | null {
  return WORKSPACE_TABS.some((tab) => tab.id === value) ? (value as WorkspaceTab) : null;
}

export type CompanyProfile = {
  companyName: string;
  companyIntro: string | null;
  features: string[];
  audience: string | null;
  goal: string | null;
  mainMessage: string | null;
  cta: string | null;
  address: string | null;
  contactNumbers: string[];
  updatedAt?: string;
};

export type CalendarRow = {
  topic: string;
  contentType: string;
  language: string;
  publishDate: string | null;
};

export type ContentCalendar = {
  id: string;
  title: string;
  rows: CalendarRow[];
  createdAt: string;
  updatedAt: string;
};

export type ContractAsset = ClientAssetItem & {
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SharedPdf = { url: string; name: string; sizeBytes: number | null };

export type ShareInfo = {
  sharedAt: string;
  channel: "PORTAL" | "WHATSAPP";
  pdf?: SharedPdf | null;
};

export type WorkspaceShares = {
  company: ShareInfo | null;
  assets: ShareInfo | null;
  calendars: Record<string, ShareInfo>;
};

export type ContractWorkspace = {
  company: CompanyProfile | null;
  assets: ContractAsset[];
  calendars: ContentCalendar[];
  shares: WorkspaceShares;
  hasPortalAccount: boolean;
  calendarMaxRows: number;
};

export type PortalContractSummary = {
  id: string;
  code: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  sections: Array<"COMPANY" | "ASSETS" | "CALENDAR">;
  lastSharedAt: string | null;
};

export type PortalContractDetail = {
  id: string;
  code: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  company: CompanyProfile | null;
  assets: ContractAsset[];
  calendars: ContentCalendar[];
  shares: WorkspaceShares;
};

export const CALENDAR_MAX_ROWS = 31;

export const CONTENT_TYPE_OPTIONS = [
  "پوستر",
  "ریلز",
  "ویدیو",
  "استوری",
  "کاروسل",
  "پست متنی",
];

export const CONTENT_LANGUAGE_OPTIONS = ["دری", "پشتو", "انگلیسی", "دری و پشتو"];

export const ASSET_KIND_LABELS: Record<string, string> = {
  LOGO: "لوگوی برند",
  PRODUCT_IMAGE: "تصاویر محصول / خدمت",
  VIDEO: "ویدیوهای موجود",
  BRANDBOOK: "برندبوک / کاتالوگ / اسناد",
  CATALOG: "برندبوک / کاتالوگ / اسناد",
  PRONUNCIATION: "فایل صوتی",
  AUDIO: "فایل صوتی",
  REFERENCE: "ویدیو مرجع (لینک)",
  OTHER: "سایر دارایی‌ها",
};

/** Kinds in display order; CATALOG/AUDIO fold into BRANDBOOK/PRONUNCIATION. */
export const ASSET_GROUP_ORDER = [
  "LOGO",
  "PRODUCT_IMAGE",
  "VIDEO",
  "BRANDBOOK",
  "PRONUNCIATION",
  "REFERENCE",
  "OTHER",
] as const;

export function assetGroupKey(kind: string): (typeof ASSET_GROUP_ORDER)[number] {
  if (kind === "CATALOG") return "BRANDBOOK";
  if (kind === "AUDIO") return "PRONUNCIATION";
  return (ASSET_GROUP_ORDER as readonly string[]).includes(kind)
    ? (kind as (typeof ASSET_GROUP_ORDER)[number])
    : "OTHER";
}

export function referenceUrl(asset: Pick<ClientAssetItem, "meta" | "storageKey">): string | null {
  if (typeof asset.meta?.url === "string") return asset.meta.url;
  if (asset.storageKey?.startsWith("ref://")) {
    return decodeURIComponent(asset.storageKey.slice(6));
  }
  return null;
}

export function portalContractUrl(projectId: string, tab: WorkspaceTab): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/portal/contracts/${projectId}?tab=${tab}`;
}

function lines(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join("\n");
}

export function buildCalendarMessage({
  calendar,
  contractTitle,
  customerName,
  pdfUrl,
  portalUrl,
}: {
  calendar: ContentCalendar;
  contractTitle: string;
  customerName?: string | null;
  pdfUrl: string;
  portalUrl?: string | null;
}): string {
  const dates = calendar.rows
    .map((row) => row.publishDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  return lines(
    customerName ? `سلام ${customerName} عزیز،` : "سلام،",
    "",
    `تقویم محتوایی «${calendar.title}» مربوط به قرارداد «${contractTitle}» آماده شد.`,
    `تعداد محتوا: ${calendar.rows.length}`,
    dates.length > 0 &&
      `بازه نشر: ${formatDate(dates[0])} تا ${formatDate(dates[dates.length - 1])}`,
    "",
    "دانلود فایل PDF:",
    pdfUrl,
    portalUrl && "",
    portalUrl && `مشاهده در پورتال مشتری: ${portalUrl}`,
    "",
    "با احترام، تیم اپکس",
  );
}
