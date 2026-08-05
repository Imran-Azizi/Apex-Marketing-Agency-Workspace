/** Shared portal dashboard helpers */

export function projectPaymentLabel(status: string): string {
  if (status === "WAITING_PAYMENT") return "منتظر پرداخت";
  if (status === "COMPLETED" || status === "READY_DELIVERY") return "تسویه‌شده";
  return "در جریان";
}

export function formatPersianDateLong(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-AF", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      numberingSystem: "latn",
    }).format(date);
  } catch {
    return date.toLocaleDateString("fa-AF");
  }
}
