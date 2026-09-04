import { toEnglishDigits } from "@/lib/utils";

/**
 * Ensure any displayed text uses English digits (display-only).
 */
export function withEnglishDigits(
  value: string | number | null | undefined,
): string {
  if (value == null) return "";
  return toEnglishDigits(String(value));
}

export function formatCount(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString("en-US");
}

export function formatMoneyEn(value: number | null | undefined): string {
  return `${Number(value || 0).toLocaleString("en-US")} AFN`;
}

export function formatDateTimeEn(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}
