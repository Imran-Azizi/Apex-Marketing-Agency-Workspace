export type AuthAudience =
  | "team"
  | "manager"
  | "admin"
  | "editor"
  | "narrator"
  | "sales"
  | "portal"
  | "portal-recover"
  | "portal-register";

export const INTERNAL_AUTH_AUDIENCES = [
  "manager",
  "admin",
  "editor",
  "narrator",
  "sales",
] as const;

export type InternalAuthAudience = (typeof INTERNAL_AUTH_AUDIENCES)[number];

export function isInternalAuthAudience(
  value: string,
): value is InternalAuthAudience {
  return (INTERNAL_AUTH_AUDIENCES as readonly string[]).includes(value);
}

export interface AuthAudienceCopy {
  documentTitle: string;
  eyebrow: string;
  title: string;
  description: string;
}

export const AUTH_AUDIENCE_COPY: Record<AuthAudience, AuthAudienceCopy> = {
  team: {
    documentTitle: "ورود تیم — اپیکس",
    eyebrow: "ورک‌اسپیس اپیکس",
    title: "ورود به سیستم",
    description: "با ایمیل سازمانی وارد فضای کاری تیم شوید.",
  },
  manager: {
    documentTitle: "ورود مدیران — اپیکس",
    eyebrow: "پنل مدیریت",
    title: "ورود مدیران",
    description: "به فضای مدیریت تیم، مشتریان و پروژه‌ها وارد شوید.",
  },
  admin: {
    documentTitle: "ورود مدیر سیستم — اپیکس",
    eyebrow: "مدیریت سیستم",
    title: "ورود مدیر سیستم",
    description: "دسترسی مدیریتی و امنیتی به پیکربندی پلتفرم اپیکس.",
  },
  editor: {
    documentTitle: "ورود ادیتور — اپیکس",
    eyebrow: "فضای تدوین",
    title: "ورود ادیتور",
    description: "به فضای کاری تدوین، متریال و خروجی پروژه‌ها وارد شوید.",
  },
  narrator: {
    documentTitle: "ورود نریتور — اپیکس",
    eyebrow: "فضای روایت",
    title: "ورود نریتور",
    description: "به فضای کاری روایت، اسکریپت و نسخه‌های صوتی وارد شوید.",
  },
  sales: {
    documentTitle: "ورود فروش — اپیکس",
    eyebrow: "فضای فروش",
    title: "ورود فروش",
    description: "به فضای کاری فروش، تعاملات و پیگیری مشتریان وارد شوید.",
  },
  portal: {
    documentTitle: "پورتال مشتری — اپیکس",
    eyebrow: "پورتال مشتری",
    title: "ورود به پورتال",
    description: "با شماره واتساپ وارد فضای پروژه‌ها و سفارش‌های خود شوید.",
  },
  "portal-recover": {
    documentTitle: "بازیابی رمز عبور — اپیکس",
    eyebrow: "پورتال مشتری",
    title: "بازیابی رمز عبور",
    description: "شماره واتساپ حساب خود را وارد کنید تا کد بازیابی ارسال شود.",
  },
  "portal-register": {
    documentTitle: "ثبت‌نام پورتال — اپیکس",
    eyebrow: "پورتال مشتری",
    title: "ایجاد حساب پورتال",
    description: "دعوت شما تأیید شد — حساب پورتال را با یک رمز امن کامل کنید.",
  },
};

export function getAuthAudienceCopy(audience: AuthAudience): AuthAudienceCopy {
  return AUTH_AUDIENCE_COPY[audience];
}
