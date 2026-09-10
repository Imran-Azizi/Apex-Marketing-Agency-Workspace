import { z } from "zod";
import { isValidWhatsAppNumber, WHATSAPP_VALIDATION_MESSAGE } from "@/lib/phone";

export const CONTACT_SUBJECTS = [
  { value: "CONSULTATION", label: "مشاوره پروژه" },
  { value: "QUOTE", label: "درخواست قیمت" },
  { value: "COLLABORATION", label: "همکاری" },
  { value: "SUPPORT", label: "پشتیبانی" },
  { value: "OTHER", label: "سایر" },
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]["value"];

export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  CONSULTATION: "مشاوره پروژه",
  QUOTE: "درخواست قیمت",
  COLLABORATION: "همکاری",
  SUPPORT: "پشتیبانی",
  OTHER: "سایر",
};

export type ContactChannel = {
  id: "whatsapp" | "phone" | "email";
  label: string;
  value: string;
  href: string;
};

export type PublicContactInfo = {
  whatsapp: ContactChannel;
  phone: ContactChannel;
  email: ContactChannel;
  subjects: Array<{ value: string; label: string }>;
};

/** Hours copy already shown on the public contact panel. */
export const CONTACT_HOURS_TEXT =
  "ساعات پاسخگویی: همه‌روزه از ۹ صبح تا ۶ عصر";

export function configuredContactChannels(
  info: PublicContactInfo | undefined,
): ContactChannel[] {
  if (!info) return [];
  return [info.whatsapp, info.phone, info.email].filter(
    (channel) => Boolean(channel.value?.trim()) && Boolean(channel.href?.trim()),
  );
}

/**
 * Only allow sanitized WhatsApp deep links from our public contact API.
 * Prevents accidental rendering of arbitrary / injected href values.
 */
export function isSafeWhatsAppHref(
  href: string | null | undefined,
): href is string {
  if (!href?.trim()) return false;
  try {
    const url = new URL(href.trim());
    if (url.protocol !== "https:") return false;
    if (url.hostname === "wa.me") {
      return /^\d{8,15}$/.test(url.pathname.replace(/^\//, ""));
    }
    if (url.hostname === "api.whatsapp.com") {
      if (url.pathname !== "/send") return false;
      const phone = url.searchParams.get("phone");
      return Boolean(phone && /^\d{8,15}$/.test(phone));
    }
    return false;
  } catch {
    return false;
  }
}

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: ContactSubject | "";
  message: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  subject: string;
  subjectLabel: string;
  message: string;
  messagePreview?: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  crmCustomerId?: string | null;
  crmCustomer?: {
    id: string;
    customerCode: string | null;
    displayName: string | null;
  } | null;
};

export type ContactMessageListPayload = {
  items: ContactMessage[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
};

export type ContactMessageStats = {
  unreadCount: number;
  total: number;
  readCount: number;
};

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام باید حداقل ۲ حرف باشد")
    .max(80, "نام نباید بیشتر از ۸۰ حرف باشد"),
  email: z
    .string()
    .trim()
    .min(1, "ایمیل الزامی است")
    .email("ایمیل معتبر وارد کنید")
    .max(160, "ایمیل بیش از حد طولانی است"),
  phone: z
    .string()
    .trim()
    .min(1, "شماره تماس الزامی است")
    .refine(isValidWhatsAppNumber, WHATSAPP_VALIDATION_MESSAGE),
  company: z.string().trim().max(120, "نام شرکت بیش از حد طولانی است").optional().or(z.literal("")),
  subject: z.enum(
    ["CONSULTATION", "QUOTE", "COLLABORATION", "SUPPORT", "OTHER"],
    { required_error: "موضوع درخواست را انتخاب کنید" },
  ),
  message: z
    .string()
    .trim()
    .min(10, "پیام باید حداقل ۱۰ حرف باشد")
    .max(2000, "پیام نباید بیشتر از ۲۰۰۰ حرف باشد"),
});

export const CONTACT_SUCCESS_MESSAGE =
  "پیام شما با موفقیت ارسال شد. کارشناسان ما در اسرع وقت با شما تماس خواهند گرفت.";

export function contactSubjectLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return CONTACT_SUBJECT_LABELS[code as ContactSubject] || code;
}
