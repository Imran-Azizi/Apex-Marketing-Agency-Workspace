import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";
import { toEnglishDigits } from "./utils";

export const WHATSAPP_VALIDATION_MESSAGE =
  "لطفاً یک شماره واتساپ معتبر وارد کنید.";

export function isValidWhatsAppNumber(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  return isValidPhoneNumber(value);
}

export const whatsappFieldSchema = z
  .string()
  .min(1, WHATSAPP_VALIDATION_MESSAGE)
  .refine(isValidWhatsAppNumber, WHATSAPP_VALIDATION_MESSAGE);

/**
 * Convert stored/raw values to E.164 for react-phone-number-input.
 */
export function toPhoneInputValue(
  raw: string | undefined | null,
): string | undefined {
  if (!raw?.trim()) return undefined;

  const value = toEnglishDigits(raw).trim();
  if (value.startsWith("+")) {
    return isValidPhoneNumber(value) ? value : undefined;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;

  const candidates = [
    `+${digits}`,
    digits.length === 10 && digits.startsWith("0")
      ? parsePhoneNumberFromString(digits, "AF")?.number
      : undefined,
    digits.length === 9 && digits.startsWith("7")
      ? parsePhoneNumberFromString(`0${digits}`, "AF")?.number
      : undefined,
    parsePhoneNumberFromString(digits)?.number,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (isValidPhoneNumber(candidate)) return candidate;
  }

  return digits.length >= 8 ? `+${digits}` : undefined;
}

export function normalizeWhatsAppForSubmit(value: string | undefined | null): string {
  const input = String(value || "").trim();
  if (!isValidPhoneNumber(input)) {
    throw new Error(WHATSAPP_VALIDATION_MESSAGE);
  }
  const parsed = parsePhoneNumberFromString(input);
  return parsed?.number || input;
}
