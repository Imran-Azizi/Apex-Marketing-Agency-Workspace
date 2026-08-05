/**
 * Global Persian / Arabic-Indic → English (ASCII) digit normalization.
 *
 * Persian:  ۰۱۲۳۴۵۶۷۸۹
 * Arabic:   ٠١٢٣٤٥٦٧٨٩
 * English:  0123456789
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** @param {string} ch */
function mapEasternDigit(ch) {
  const p = PERSIAN_DIGITS.indexOf(ch);
  if (p >= 0) return String(p);
  const a = ARABIC_DIGITS.indexOf(ch);
  return a >= 0 ? String(a) : ch;
}

/**
 * Convert Persian and Arabic-Indic digits in a string to ASCII English digits.
 * Non-digit characters are left unchanged. Non-strings are returned as-is.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function toEnglishDigits(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  return value.replace(/[۰-۹٠-٩]/g, mapEasternDigit);
}

/**
 * True when the string contains at least one Persian or Arabic-Indic digit.
 * @param {unknown} value
 */
export function hasEasternDigits(value) {
  return typeof value === 'string' && /[۰-۹٠-٩]/.test(value);
}

/**
 * Deep-walk plain objects / arrays and normalize all string leaves.
 * Mutates in place and returns the same reference for Express middleware efficiency.
 * Skips Buffer, Date, and other non-plain objects.
 *
 * @template T
 * @param {T} input
 * @param {WeakSet<object>} [seen]
 * @returns {T}
 */
export function normalizeDigitsDeep(input, seen = new WeakSet()) {
  if (input == null) return input;

  if (typeof input === 'string') {
    return /** @type {T} */ (toEnglishDigits(input));
  }

  if (typeof input !== 'object') return input;

  if (input instanceof Date || Buffer.isBuffer(input)) return input;
  if (seen.has(input)) return input;
  seen.add(input);

  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      input[i] = normalizeDigitsDeep(input[i], seen);
    }
    return input;
  }

  // Only walk plain objects / Express query bags
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) return input;

  for (const key of Object.keys(input)) {
    input[key] = normalizeDigitsDeep(input[key], seen);
  }
  return input;
}
