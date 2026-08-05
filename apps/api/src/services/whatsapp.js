import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';

export async function getWhatsappNumber() {
  const setting = await prisma.setting.findUnique({ where: { key: 'whatsapp_number' } });
  return setting?.value?.number || env.whatsappNumber;
}

export async function buildWhatsappCta({ message, serviceId }) {
  const number = await getWhatsappNumber();
  let text = message || 'سلام، می‌خواهم درباره خدمات اپیکس معلومات بگیرم.';
  if (serviceId) text += `\n[service_id:${serviceId}]`;
  const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  return { number, message: text, url };
}

export async function buildManagerContact({ customerName, projectId }) {
  const number = await getWhatsappNumber();
  const text = `سلام، من ${customerName || 'مشتری'} هستم. Project ID: ${projectId}. لطفاً تماس بگیرید.`;
  return { number, message: text, url: `https://wa.me/${number}?text=${encodeURIComponent(text)}` };
}
