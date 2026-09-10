import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { whatsappDigitsForLink } from '../utils/whatsappNormalize.js';

const DEFAULT_PUBLIC_MESSAGE =
  'سلام، می‌خواهم درباره خدمات اپیکس معلومات بگیرم.';

const MAX_MESSAGE_LENGTH = 500;

function settingNumber(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return String(value.number || value.phone || value.value || '').trim();
  }
  return '';
}

function settingMessage(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return String(value.message || value.text || value.value || '').trim();
  }
  return '';
}

export async function getWhatsappNumber() {
  const setting = await prisma.setting.findUnique({
    where: { key: 'whatsapp_number' },
  });
  return settingNumber(setting?.value) || env.whatsappNumber;
}

export async function getWhatsappDefaultMessage() {
  const setting = await prisma.setting.findUnique({
    where: { key: 'whatsapp_default_message' },
  });
  return settingMessage(setting?.value) || DEFAULT_PUBLIC_MESSAGE;
}

/**
 * Build a sanitized wa.me deep link for the configured APEX business number.
 * Returns null url when the configured number is missing/invalid.
 */
export async function buildWhatsappCta({ message, serviceId } = {}) {
  const rawNumber = await getWhatsappNumber();
  const number = whatsappDigitsForLink(rawNumber);
  if (!number) {
    return { number: null, message: null, url: null };
  }

  let text =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : await getWhatsappDefaultMessage();
  text = text.slice(0, MAX_MESSAGE_LENGTH);

  if (
    typeof serviceId === 'string' &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(serviceId.trim())
  ) {
    text += `\n[service_id:${serviceId.trim()}]`;
  }

  const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  return { number, message: text, url };
}

export async function buildManagerContact({ customerName, projectId }) {
  const cta = await buildWhatsappCta({
    message: `سلام، من ${customerName || 'مشتری'} هستم. Project ID: ${projectId || ''}. لطفاً تماس بگیرید.`,
  });
  return cta;
}
