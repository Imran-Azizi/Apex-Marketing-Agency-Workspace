export const CUSTOMER_PAYMENT_METHODS = [
  { value: "CASH", label: "نقدی / حضوری" },
  { value: "HAWALA", label: "حواله" },
  { value: "HESAB_PAY", label: "حساب پی" },
  { value: "BANK_TRANSFER", label: "انتقال بانکی" },
] as const;

export const INVOICE_PAYMENT_METHODS = [
  { value: "HESAB_PAY", label: "حساب پی" },
  { value: "CASH", label: "نقدی / حضوری" },
  { value: "BANK_TRANSFER", label: "انتقال بانکی" },
] as const;

export type CustomerPaymentMethod =
  (typeof CUSTOMER_PAYMENT_METHODS)[number]["value"];

export type InvoicePaymentMethod =
  (typeof INVOICE_PAYMENT_METHODS)[number]["value"];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "نقدی / حضوری",
  HAWALA: "حواله",
  HESAB_PAY: "حساب پی",
  BANK_TRANSFER: "انتقال بانکی",
  CARD: "کارت",
  OTHER: "سایر",
};

export function paymentMethodLabel(method?: string | null): string {
  return PAYMENT_METHOD_LABELS[String(method || "").toUpperCase()] || "ثبت نشده";
}

export function isCustomerPaymentMethod(
  value: string,
): value is CustomerPaymentMethod {
  return CUSTOMER_PAYMENT_METHODS.some((method) => method.value === value);
}
