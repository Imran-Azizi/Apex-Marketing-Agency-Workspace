/**
 * Display-only helpers for payment receipts.
 * Resolves video count and payment method from existing records — never writes.
 */

import { formatPaymentMethod } from './paymentMethods.js';

export function toPositiveInt(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && value !== null && typeof value.toNumber === 'function') {
    value = value.toNumber();
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function parseVideoCountFromText(text) {
  const src = String(text || '');
  if (!src.trim()) return null;
  const match = src.match(/(\d+)\s*(ویدیوها|ویدیو|videos|video)/i);
  if (!match) return null;
  return toPositiveInt(match[1]);
}

export function videoCountFromInvoiceItems(items) {
  if (!Array.isArray(items) || !items.length) return null;
  if (items.length === 1) return toPositiveInt(items[0].quantity);
  const videoLike = items.filter((item) =>
    /ویدیو|video/i.test(String(item.description || '')),
  );
  const pool = videoLike.length ? videoLike : items;
  const sum = pool.reduce((total, item) => total + (toPositiveInt(item.quantity) || 0), 0);
  return toPositiveInt(sum);
}

/**
 * Prefer invoice.videoCount, then opportunity, then line items, then text, then project count.
 */
export function resolveReceiptVideoCount({
  invoiceVideoCount,
  opportunityVideoCount,
  invoiceItems,
  invoiceNotes,
  invoiceDescription,
  agreedTerms,
  projectCount,
} = {}) {
  return (
    toPositiveInt(invoiceVideoCount) ||
    toPositiveInt(opportunityVideoCount) ||
    videoCountFromInvoiceItems(invoiceItems) ||
    parseVideoCountFromText(invoiceDescription) ||
    parseVideoCountFromText(invoiceNotes) ||
    parseVideoCountFromText(agreedTerms) ||
    toPositiveInt(projectCount) ||
    null
  );
}

export function formatReceiptVideoCount(value) {
  const n = toPositiveInt(value);
  return n != null ? String(n) : '—';
}

export function resolveReceiptPaymentMethod({ method, methodLabel, invoiceMethod } = {}) {
  const labeled = String(methodLabel || '').trim();
  if (labeled && labeled !== 'ثبت نشده' && labeled !== '—') return labeled;
  const fromPayment = formatPaymentMethod(method);
  if (fromPayment && fromPayment !== 'ثبت نشده') return fromPayment;
  const fromInvoice = formatPaymentMethod(invoiceMethod);
  if (fromInvoice && fromInvoice !== 'ثبت نشده') return fromInvoice;
  return labeled || fromPayment || '—';
}
