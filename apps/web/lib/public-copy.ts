import { COMPANY_INTRO_DESCRIPTION } from "@/lib/company";

export const PUBLIC_COPY_MAX = 800;

export const PUBLIC_COPY_KEYS = {
  company: "public_company_description",
  services: "public_services_description",
  portfolio: "public_portfolio_description",
  customers: "public_customers_description",
  contact: "public_contact_description",
} as const;

export type PublicCopyField = keyof typeof PUBLIC_COPY_KEYS;

export type PublicSiteCopy = {
  company: string;
  services: string;
  portfolio: string;
  customers: string;
  contact: string;
};

export const PUBLIC_COPY_FIELDS: Array<{
  field: PublicCopyField;
  key: (typeof PUBLIC_COPY_KEYS)[PublicCopyField];
  section: string;
  label: string;
  hint: string;
}> = [
  {
    field: "company",
    key: PUBLIC_COPY_KEYS.company,
    section: "شرکت تبلیغاتی اپیکس",
    label: "شرکت تبلیغاتی اپیکس — توضیحات بخش",
    hint: "متن زیر عنوان بخش «درباره ما» و پاورقی وب‌سایت",
  },
  {
    field: "services",
    key: PUBLIC_COPY_KEYS.services,
    section: "خدمات ما",
    label: "خدمات ما — توضیحات بخش",
    hint: "متن زیر عنوان بخش خدمات در صفحه اصلی",
  },
  {
    field: "portfolio",
    key: PUBLIC_COPY_KEYS.portfolio,
    section: "نمونه های کاری",
    label: "نمونه های کاری — توضیحات بخش",
    hint: "متن زیر عنوان بخش نمونه‌کارها در صفحه اصلی",
  },
  {
    field: "customers",
    key: PUBLIC_COPY_KEYS.customers,
    section: "مشتریان ما",
    label: "مشتریان ما — توضیحات بخش",
    hint: "متن زیر عنوان بخش مشتریان در صفحه اصلی",
  },
  {
    field: "contact",
    key: PUBLIC_COPY_KEYS.contact,
    section: "تماس با ما",
    label: "تماس با ما — توضیحات بخش",
    hint: "متن زیر عنوان بخش تماس و فرم درخواست",
  },
];

export function readPublicCopyText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const raw = obj.text ?? obj.description ?? obj.value;
    return typeof raw === "string" ? raw : "";
  }
  return "";
}

export const EMPTY_PUBLIC_SITE_COPY: PublicSiteCopy = {
  company: "",
  services: "",
  portfolio: "",
  customers: "",
  contact: "",
};

/** Shown in تنظیمات only when a setting row has not been saved yet. */
export const PUBLIC_COPY_BOOTSTRAP: PublicSiteCopy = {
  company: COMPANY_INTRO_DESCRIPTION,
  services:
    "خدمات شرکت اپیکس، ساخت ویدیوهای تبلیغاتی است که با استفاده از موشن گرافیک، فوتیج‌های ارسالی و سرویس‌های هوش مصنوعی تولید می‌شوند.",
  portfolio: "",
  customers:
    "برندها و سازمان‌هایی که به اپیکس اعتماد کرده‌اند و در ساخت روایت تصویری خود با ما همکاری داشته‌اند.",
  contact:
    "برای مشاوره پروژه، دریافت پیشنهاد همکاری یا گفتگو درباره تولید محتوای حرفه‌ای، فرم را ارسال کنید یا از راه‌های ارتباطی مستقیم استفاده کنید.",
};
