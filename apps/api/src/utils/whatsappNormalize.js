import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppError } from './response.js';
import { toEnglishDigits } from './toEnglishDigits.js';

export const WHATSAPP_VALIDATION_MESSAGE =
  'لطفاً یک شماره واتساپ معتبر وارد کنید.';

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function tryParse(raw, defaultCountry) {
  try {
    return defaultCountry
      ? parsePhoneNumberFromString(raw, defaultCountry)
      : parsePhoneNumberFromString(raw);
  } catch {
    return null;
  }
}

function expandLegacyAfghanAliases(digits, bucket) {
  if (/^07\d{8}$/.test(digits)) {
    bucket.add(digits);
    bucket.add(`93${digits.slice(1)}`);
    return;
  }
  if (/^93\d{9}$/.test(digits)) {
    bucket.add(digits);
    bucket.add(`0${digits.slice(2)}`);
    return;
  }
  if (/^7\d{8}$/.test(digits)) {
    bucket.add(digits);
    bucket.add(`93${digits}`);
    bucket.add(`0${digits}`);
  }
}

/**
 * All normalized keys that may exist in the database for the same WhatsApp identity.
 * Keeps legacy Afghanistan local numbers compatible with international E.164 entries.
 */
export function getWhatsappLookupKeys(input, options = {}) {
  const parsed = parseInternationalPhone(input, options);
  if (!parsed) return [];

  const keys = new Set([parsed.digits]);
  expandLegacyAfghanAliases(parsed.digits, keys);

  if (parsed.country === 'AF' && parsed.nationalNumber) {
    const national = String(parsed.nationalNumber);
    keys.add(`93${national}`);
    keys.add(`0${national}`);
  }

  return [...keys];
}

export function whatsappNumbersMatch(a, b) {
  if (!a || !b) return false;
  try {
    const left = new Set(getWhatsappLookupKeys(a));
    for (const key of getWhatsappLookupKeys(b)) {
      if (left.has(key)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Parse any WhatsApp-compatible international phone number into a stable identity.
 * Numbers are accepted globally. Legacy Afghanistan local numbers (07…) are normalized to E.164.
 */
export function parseInternationalPhone(input, { required = true } = {}) {
  if (input == null || String(input).trim() === '') {
    if (required) {
      throw new AppError('شماره واتساپ الزامی است', 400, 'INVALID_WHATSAPP');
    }
    return null;
  }

  const original = String(input).trim();
  let raw = toEnglishDigits(original).trim();

  if (raw.startsWith('00')) {
    raw = `+${raw.slice(2)}`;
  }

  const digits = digitsOnly(raw);
  let parsed = null;

  if (raw.startsWith('+')) {
    parsed = tryParse(raw);
  } else if (/^0?7\d{8}$/.test(digits)) {
    const localAf = digits.length === 9 ? `0${digits}` : digits;
    parsed = tryParse(localAf, 'AF');
  } else if (digits.length >= 8 && digits.length <= 15) {
    parsed = tryParse(`+${digits}`) || tryParse(raw);
  }

  if (parsed && parsed.isValid()) {
    const e164 = parsed.number;
    const normalized = e164.replace(/\D/g, '');
    return {
      raw: original,
      e164,
      digits: normalized,
      country: parsed.country || null,
      nationalNumber: parsed.nationalNumber || null,
      countryCallingCode: parsed.countryCallingCode || null,
    };
  }

  throw new AppError(WHATSAPP_VALIDATION_MESSAGE, 400, 'INVALID_WHATSAPP');
}

/**
 * Convert to digits-only E.164 without '+'.
 * Backward-compatible identity key used by CrmCustomer.normalizedWhatsapp.
 */
export function normalizeWhatsapp(input, options) {
  return parseInternationalPhone(input, options).digits;
}

export function formatE164Display(input) {
  try {
    const parsed = parseInternationalPhone(input, { required: false });
    if (!parsed) return input || '';
    const phone = tryParse(parsed.e164);
    return phone ? phone.formatInternational() : parsed.e164;
  } catch {
    const digits = digitsOnly(input);
    if (/^07\d{8}$/.test(digits)) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    if (/^\d{10,15}$/.test(digits)) return `+${digits}`;
    return String(input || '');
  }
}

export function whatsappDigitsForLink(input) {
  try {
    return parseInternationalPhone(input, { required: false })?.digits || null;
  } catch {
    const digits = digitsOnly(input);
    if (/^07\d{8}$/.test(digits)) return `93${digits.slice(1)}`;
    if (/^\d{10,15}$/.test(digits)) return digits;
    return null;
  }
}
