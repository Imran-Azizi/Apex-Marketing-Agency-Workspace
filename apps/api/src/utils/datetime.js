/**
 * Centralized date/time presentation (12-hour clock).
 * Does not change stored timestamps — formatting only.
 *
 * Dari/Persian (fa): ق.ظ. / ب.ظ.
 * English (en): AM / PM
 */

export function formatFaDateTime(date, { locale = 'fa' } = {}) {
  const tag = locale === 'en' ? 'en-US' : 'fa-AF';
  return new Intl.DateTimeFormat(tag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(locale === 'en' ? {} : { numberingSystem: 'latn' }),
  }).format(new Date(date));
}

export function formatFaTime(date, { locale = 'fa', withSeconds = false } = {}) {
  const tag = locale === 'en' ? 'en-US' : 'fa-AF';
  return new Intl.DateTimeFormat(tag, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(withSeconds ? { second: '2-digit' } : {}),
    ...(locale === 'en' ? {} : { numberingSystem: 'latn' }),
  }).format(new Date(date));
}

export function formatFaDate(date, { locale = 'fa' } = {}) {
  const tag = locale === 'en' ? 'en-US' : 'fa-AF';
  return new Intl.DateTimeFormat(tag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(locale === 'en' ? {} : { numberingSystem: 'latn' }),
  }).format(new Date(date));
}
