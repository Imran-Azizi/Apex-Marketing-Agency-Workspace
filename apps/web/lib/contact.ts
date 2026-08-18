import { z } from "zod";
import { toEnglishDigits } from "@/lib/utils";

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
    .refine((value) => {
      const digits = toEnglishDigits(value).replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }, "شماره تماس معتبر وارد کنید"),
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
