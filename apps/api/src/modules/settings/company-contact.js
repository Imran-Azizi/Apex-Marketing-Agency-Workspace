/**
 * Company phone/email for invoices and other bills.
 * Settings (تنظیمات) win; env CONTACT_* is fallback only.
 */

import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

export function parseSettingString(value, keys = []) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of keys) {
      const next = value[key];
      if (typeof next === 'string' && next.trim()) return next.trim();
    }
  }
  return '';
}

export function resolveCompanyContact({
  emailValue,
  phoneValue,
  fallbackEmail = '',
  fallbackPhone = '',
} = {}) {
  const email =
    parseSettingString(emailValue, ['email', 'address', 'value']) ||
    String(fallbackEmail || '').trim();
  const phone =
    parseSettingString(phoneValue, ['number', 'phone', 'value']) ||
    String(fallbackPhone || '').trim();
  return {
    phone: phone || null,
    email: email || null,
  };
}

/**
 * Live contact used on invoice (and receipt) footers.
 * Newly generated / printed / downloaded bills pick up Settings immediately.
 */
export async function getCompanyContact() {
  const [emailSetting, phoneSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'contact_email' } }),
    prisma.setting.findUnique({ where: { key: 'contact_phone' } }),
  ]);
  return resolveCompanyContact({
    emailValue: emailSetting?.value,
    phoneValue: phoneSetting?.value,
    fallbackEmail: env.contactEmail,
    fallbackPhone: env.contactPhone,
  });
}
