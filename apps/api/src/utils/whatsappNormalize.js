import { AppError } from './response.js';
import { toEnglishDigits } from './toEnglishDigits.js';

/**
 * Convert Persian / Arabic-Indic digits to ASCII, then strip non-digits.
 * Accepts common Afghan WhatsApp formats and returns digits-only E.164 without '+':
 *   0700123456  → 93700123456
 *   700123456   → 93700123456
 *   +93 700 123 456 → 93700123456
 *   0093700123456 → 93700123456
 */
export function normalizeWhatsapp(input) {
  if (input == null || String(input).trim() === '') {
    throw new AppError('شماره واتساپ الزامی است', 400, 'INVALID_WHATSAPP');
  }

  let raw = toEnglishDigits(String(input).trim());

  // Keep leading + for international notation, then digits only
  const hadPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');

  // International dial prefix 00 → drop it
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (hadPlus && digits.startsWith('0')) {
    // unlikely "+0700..." — treat as local after +
    digits = digits.replace(/^0+/, '');
  }

  // Local Afghan mobile: 07XXXXXXXX (10 digits) → 93 + drop leading 0
  if (/^07\d{8}$/.test(digits)) {
    return `93${digits.slice(1)}`;
  }

  // Local without trunk 0: 7XXXXXXXX (9 digits)
  if (/^7\d{8}$/.test(digits)) {
    return `93${digits}`;
  }

  // Already country-coded Afghan: 937XXXXXXXX (11 digits)
  if (/^937\d{8}$/.test(digits)) {
    return digits;
  }

  // Other international numbers (10–15 digits, not starting with 0)
  if (/^[1-9]\d{9,14}$/.test(digits)) {
    return digits;
  }

  throw new AppError(
    'فرمت شماره واتساپ نامعتبر است. مثال: 0700123456 یا +93700123456',
    400,
    'INVALID_WHATSAPP'
  );
}
