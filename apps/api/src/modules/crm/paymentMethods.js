import { AppError } from '../../utils/response.js';

/** Payment methods accepted when recording customer payments. */
export const CUSTOMER_PAYMENT_METHODS = Object.freeze([
  'CASH',
  'HAWALA',
  'HESAB_PAY',
  'BANK_TRANSFER',
]);

/** Methods offered on CRM & Sales invoices. */
export const INVOICE_PAYMENT_METHODS = Object.freeze([
  'HESAB_PAY',
  'CASH',
  'BANK_TRANSFER',
]);

const CUSTOMER_PAYMENT_METHOD_SET = new Set(CUSTOMER_PAYMENT_METHODS);
const INVOICE_PAYMENT_METHOD_SET = new Set(INVOICE_PAYMENT_METHODS);

export function isCustomerPaymentMethod(value) {
  return CUSTOMER_PAYMENT_METHOD_SET.has(String(value || '').toUpperCase());
}

export function isInvoicePaymentMethod(value) {
  return INVOICE_PAYMENT_METHOD_SET.has(String(value || '').toUpperCase());
}

/** User-facing Dari labels, including legacy values for historical records. */
export function formatPaymentMethod(value) {
  const labels = {
    CASH: 'نقدی / حضوری',
    HAWALA: 'حواله',
    HESAB_PAY: 'حساب پی',
    BANK_TRANSFER: 'انتقال بانکی',
    CARD: 'کارت',
    OTHER: 'سایر',
  };
  return labels[String(value || '').toUpperCase()] || 'ثبت نشده';
}

function trimText(value) {
  return String(value || '').trim();
}

/**
 * Keep only the fields that belong to the selected payment method.
 */
export function sanitizePaymentMethodMeta(method, meta = {}) {
  const src = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  const code = String(method || '').toUpperCase();
  if (code === 'HESAB_PAY') {
    return { hesabPayAccount: trimText(src.hesabPayAccount) };
  }
  if (code === 'CASH') {
    const next = {
      officeAddress: trimText(src.officeAddress),
      responsiblePhone: trimText(src.responsiblePhone),
    };
    const name = trimText(src.responsibleName);
    if (name) next.responsibleName = name;
    return next;
  }
  if (code === 'BANK_TRANSFER') {
    const next = {};
    const card = trimText(src.bankCardNumber);
    if (card) next.bankCardNumber = card;
    return next;
  }
  if (code === 'HAWALA') {
    const next = {};
    const info = trimText(src.bankInfo);
    if (info) next.bankInfo = info;
    return next;
  }
  return {};
}

export function assertPaymentMethodMeta(method, meta = {}) {
  const code = String(method || '').toUpperCase();
  const clean = sanitizePaymentMethodMeta(code, meta);
  if (code === 'HESAB_PAY' && !clean.hesabPayAccount) {
    throw new AppError('شماره حساب پی الزامی است', 400, 'VALIDATION');
  }
  if (code === 'CASH') {
    if (!clean.officeAddress) {
      throw new AppError('آدرس دفتر برای پرداخت نقدی / حضوری الزامی است', 400, 'VALIDATION');
    }
    if (!clean.responsiblePhone) {
      throw new AppError('شماره تماس مسئول دفتر الزامی است', 400, 'VALIDATION');
    }
  }
  if (code === 'BANK_TRANSFER' && !clean.bankCardNumber) {
    throw new AppError('شماره کارت بانکی الزامی است', 400, 'VALIDATION');
  }
  return clean;
}

/** Display rows for method-specific meta on receipts and invoices. */
export function formatPaymentMethodMetaRows(method, meta = {}) {
  const code = String(method || '').toUpperCase();
  const clean = sanitizePaymentMethodMeta(code, meta);
  const rows = [];
  if (code === 'HESAB_PAY' && clean.hesabPayAccount) {
    rows.push({ label: 'شماره حساب پی', value: clean.hesabPayAccount, ltr: true });
  }
  if (code === 'CASH') {
    if (clean.officeAddress) {
      rows.push({ label: 'آدرس دفتر', value: clean.officeAddress });
    }
    if (clean.responsiblePhone) {
      rows.push({
        label: 'شماره تماس مسئول دفتر',
        value: clean.responsiblePhone,
        ltr: true,
      });
    }
  }
  if (code === 'HAWALA' && clean.bankInfo) {
    rows.push({ label: 'جزئیات حواله', value: clean.bankInfo });
  }
  if (code === 'BANK_TRANSFER' && clean.bankCardNumber) {
    rows.push({ label: 'شماره کارت بانکی', value: clean.bankCardNumber, ltr: true });
  }
  return rows;
}
