import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Convert Persian / Arabic-Indic digits to English (ASCII) digits.
 * Leaves all other characters unchanged.
 *
 * Example: "۰۹۸۷۶۵۴۳۲۱" → "0987654321"
 */
export function toEnglishDigits(value: string): string {
  if (!value) return value;
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const p = PERSIAN_DIGITS.indexOf(ch);
    if (p >= 0) return String(p);
    const a = ARABIC_DIGITS.indexOf(ch);
    return a >= 0 ? String(a) : ch;
  });
}

/** Locale options that keep Dari/Pashto formatting but force Latin digits. */
const FA_LATN = { numberingSystem: "latn" as const };

/** App UI language for date/time presentation. */
export type DateTimeLocale = "fa" | "en";

function resolveDateTimeLocale(locale: DateTimeLocale = "fa") {
  return locale === "en" ? "en-US" : "fa-AF";
}

/** Shared 12-hour clock options (Dari: ق.ظ./ب.ظ. · English: AM/PM). */
const TIME_12H = {
  hour: "numeric" as const,
  minute: "2-digit" as const,
  hour12: true as const,
};

function withLocaleOptions(
  locale: DateTimeLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions {
  return locale === "fa" ? { ...FA_LATN, ...options } : options;
}

export function formatDate(date: string | Date, locale: DateTimeLocale = "fa") {
  return new Intl.DateTimeFormat(
    resolveDateTimeLocale(locale),
    withLocaleOptions(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  ).format(new Date(date));
}

/**
 * 12-hour time with localized day period.
 * Dari/Persian (fa-AF): e.g. 3:30:05 ب.ظ.
 * English (en-US): e.g. 3:30:05 PM
 */
export function formatTime(date: string | Date, locale: DateTimeLocale = "fa") {
  return new Intl.DateTimeFormat(
    resolveDateTimeLocale(locale),
    withLocaleOptions(locale, {
      ...TIME_12H,
      second: "2-digit",
    }),
  ).format(new Date(date));
}

/**
 * Date + 12-hour time with localized day period.
 * Dari/Persian (fa-AF): e.g. ۶ اسد ۱۴۰۵، 3:30 ب.ظ.
 * English (en-US): e.g. Aug 6, 2026, 3:30 PM
 */
export function formatDateTime(
  date: string | Date,
  locale: DateTimeLocale = "fa",
) {
  return new Intl.DateTimeFormat(
    resolveDateTimeLocale(locale),
    withLocaleOptions(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...TIME_12H,
    }),
  ).format(new Date(date));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fa-AF", {
    ...FA_LATN,
    style: "currency",
    currency: "AFN",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Display-only phone formatting. Does not mutate stored values.
 * Supports common Afghanistan WhatsApp/mobile patterns.
 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "—";

  const raw = toEnglishDigits(value.trim());
  const digits = raw.replace(/\D/g, "");

  // Local Afghan mobile: 07XXXXXXXX (10 digits) → 0789 577 024
  if (/^07\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  // Country code without plus: 937XXXXXXXX → +93 789 577 024
  if (/^93\d{9}$/.test(digits)) {
    return `+93 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }

  // Already international with leading 0 after country strip handled above;
  // 9-digit national (no leading 0): 7XXXXXXXX → 789 577 024
  if (/^7\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  // Preserve original if pattern is unknown, but normalize internal spaces lightly
  return raw.replace(/\s+/g, " ");
}

/**
 * Normalize a phone/WhatsApp value to international digits for wa.me links.
 * Returns null when the number cannot be used for WhatsApp.
 */
export function toWhatsAppDigits(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  let digits = toEnglishDigits(value).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) {
    digits = `93${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith("7")) {
    digits = `93${digits}`;
  }

  // Accept standard Afghanistan WhatsApp or other E.164-ish numbers.
  if (/^93\d{9}$/.test(digits) || /^\d{10,15}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Universal WhatsApp chat URL.
 * Opens WhatsApp Desktop/app when available, otherwise WhatsApp Web.
 */
export function buildWhatsAppChatUrl(
  value: string | null | undefined,
  message?: string,
): string | null {
  const digits = toWhatsAppDigits(value);
  if (!digits) return null;

  const url = new URL(`https://wa.me/${digits}`);
  if (message?.trim()) {
    url.searchParams.set("text", message.trim());
  }
  return url.toString();
}
