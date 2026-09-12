import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { invalidatePublicSiteCopyCache } from '../public/cache.js';
import { notifyWebSiteCopyRevalidate } from '../../services/web-revalidate.js';

export const PUBLIC_COPY_MAX = 800;

/** Existing Setting.key values — snake_case like contact_email. */
export const PUBLIC_COPY_KEYS = {
  company: 'public_company_description',
  services: 'public_services_description',
  portfolio: 'public_portfolio_description',
  customers: 'public_customers_description',
  contact: 'public_contact_description',
};

/**
 * Used only when a setting row does not exist yet (fresh DB / pre-migration).
 * Once a row is saved, that stored value is used even if it is empty.
 */
export const PUBLIC_COPY_DEFAULTS = {
  company:
    'اولین شرکت معیاری تولید اعلانات تبلیغاتی حرفه ای با هوش مصنوعی ما به کیفیت خلاقیت و نتیجه معتقدیم',
  services:
    'خدمات شرکت اپیکس، ساخت ویدیوهای تبلیغاتی است که با استفاده از موشن گرافیک، فوتیج‌های ارسالی و سرویس‌های هوش مصنوعی تولید می‌شوند.',
  portfolio: '',
  customers:
    'برندها و سازمان‌هایی که به اپیکس اعتماد کرده‌اند و در ساخت روایت تصویری خود با ما همکاری داشته‌اند.',
  contact:
    'برای مشاوره پروژه، دریافت پیشنهاد همکاری یا گفتگو درباره تولید محتوای حرفه‌ای، فرم را ارسال کنید یا از راه‌های ارتباطی مستقیم استفاده کنید.',
};

const PUBLIC_COPY_KEY_SET = new Set(Object.values(PUBLIC_COPY_KEYS));

export function isPublicCopyKey(key) {
  return PUBLIC_COPY_KEY_SET.has(String(key || ''));
}

export function sanitizePublicCopyText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parsePublicCopyValue(value) {
  if (typeof value === 'string') {
    return sanitizePublicCopyText(value).slice(0, PUBLIC_COPY_MAX);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = value.text ?? value.description ?? value.value ?? '';
    return sanitizePublicCopyText(raw).slice(0, PUBLIC_COPY_MAX);
  }
  return '';
}

export function publicCopyPayload(text) {
  return { text: sanitizePublicCopyText(text).slice(0, PUBLIC_COPY_MAX) };
}

export function normalizePublicCopyInput(raw) {
  let candidate = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    candidate = raw.text ?? raw.description ?? raw.value ?? '';
  }
  if (candidate == null) {
    throw new AppError('متن توضیحات الزامی است', 400, 'VALIDATION');
  }
  if (typeof candidate !== 'string') {
    throw new AppError('متن توضیحات نامعتبر است', 400, 'VALIDATION');
  }
  const text = sanitizePublicCopyText(candidate);
  if (text.length > PUBLIC_COPY_MAX) {
    throw new AppError(
      `توضیحات نباید بیشتر از ${PUBLIC_COPY_MAX} کاراکتر باشد`,
      400,
      'VALIDATION',
    );
  }
  return publicCopyPayload(text);
}

export async function getPublicSiteCopy() {
  const keys = Object.values(PUBLIC_COPY_KEYS);
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const copy = {};
  for (const [field, key] of Object.entries(PUBLIC_COPY_KEYS)) {
    const row = byKey.get(key);
    copy[field] = row
      ? parsePublicCopyValue(row.value)
      : PUBLIC_COPY_DEFAULTS[field];
  }
  return copy;
}

export async function afterPublicCopyMutation() {
  invalidatePublicSiteCopyCache();
  void notifyWebSiteCopyRevalidate();
}
