import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";
import { toEnglishDigits } from "./utils";

export const WHATSAPP_VALIDATION_MESSAGE =
  "لطفاً یک شماره واتساپ معتبر وارد کنید.";

/** Incomplete E.164 while typing / after country select (e.g. "+971", "+1202"). */
const PARTIAL_E164 = /^\+[1-9]\d{0,14}$/;

export function isValidWhatsAppNumber(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  return isValidPhoneNumber(toEnglishDigits(value).trim());
}

export const whatsappFieldSchema = z
  .string()
  .min(1, WHATSAPP_VALIDATION_MESSAGE)
  .refine(isValidWhatsAppNumber, WHATSAPP_VALIDATION_MESSAGE);

/**
 * Convert stored/raw values for react-phone-number-input.
 * Keeps partial international values so the selected country does not reset to default.
 */
export function toPhoneInputValue(
  raw: string | undefined | null,
): string | undefined {
  if (!raw?.trim()) return undefined;

  const value = toEnglishDigits(raw).trim();
  if (value.startsWith("+")) {
    const compact = value.replace(/[^\d+]/g, "");
    if (!PARTIAL_E164.test(compact)) return undefined;
    // Valid complete numbers and in-progress international input both pass through.
    return compact;
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

  // Digits-only international identity already stored without '+'.
  if (digits.length >= 8 && digits.length <= 15 && PARTIAL_E164.test(`+${digits}`)) {
    return `+${digits}`;
  }

  return undefined;
}

export function normalizeWhatsAppForSubmit(value: string | undefined | null): string {
  const input = toEnglishDigits(String(value || "")).trim();
  if (!isValidPhoneNumber(input)) {
    throw new Error(WHATSAPP_VALIDATION_MESSAGE);
  }
  const parsed = parsePhoneNumberFromString(input);
  return parsed?.number || input;
}
