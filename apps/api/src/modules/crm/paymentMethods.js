/** Payment methods accepted when recording customer payments. */
export const CUSTOMER_PAYMENT_METHODS = Object.freeze([
  'CASH',
  'HAWALA',
  'HESAB_PAY',
]);

const CUSTOMER_PAYMENT_METHOD_SET = new Set(CUSTOMER_PAYMENT_METHODS);

export function isCustomerPaymentMethod(value) {
  return CUSTOMER_PAYMENT_METHOD_SET.has(String(value || '').toUpperCase());
}

/** User-facing Dari labels, including legacy values for historical records. */
export function formatPaymentMethod(value) {
  const labels = {
    CASH: 'حضوری',
    HAWALA: 'حواله',
    HESAB_PAY: 'حساب پی',
    BANK_TRANSFER: 'انتقال بانکی',
    CARD: 'کارت',
    OTHER: 'سایر',
  };
  return labels[String(value || '').toUpperCase()] || 'ثبت نشده';
}
