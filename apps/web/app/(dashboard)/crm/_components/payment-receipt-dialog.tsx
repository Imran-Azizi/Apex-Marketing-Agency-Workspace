"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Download,
  Eye,
  FolderKanban,
  Globe,
  HandCoins,
  Loader2,
  Phone,
  Printer,
  Receipt,
  User,
  UserRoundPen,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { apiGet } from "@/lib/api";
import { paymentMethodLabel } from "@/lib/payment-methods";
import {
  downloadPaymentReceiptPdf,
  printPaymentReceipt,
} from "@/lib/payment-receipt";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalLoader } from "@/components/loading/section-loader";
import { ErrorState } from "@/components/loading/error-state";
import { ApexMark } from "@/components/brand/apex-mark";
import type { PaymentReceipt } from "./payment-types";

/** A6 portrait: 105 × 148 mm */
const A6_W = "105mm";
const A6_H = "148mm";

function formatReceiptAmount(amount: number) {
  return `${Number(amount).toLocaleString("fa-AF", {
    numberingSystem: "latn",
  })} افغانی`;
}

function formatPaymentVerification(status: string | null | undefined) {
  const map: Record<string, string> = {
    VERIFIED: "تایید شده",
    PENDING: "در انتظار تأیید",
    REJECTED: "رد شده",
  };
  const key = String(status || "").toUpperCase();
  return map[key] || status || "—";
}

/** Split date/time so RTL Persian date and LTR time never scramble. */
function splitReceiptDateTime(value: string | Date): {
  datePart: string;
  timePart: string;
} {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { datePart: "—", timePart: "" };
  }

  const datePart = new Intl.DateTimeFormat("fa-AF", {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("fa-AF", {
    numberingSystem: "latn",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return { datePart, timePart };
}

function ReceiptDateTimeValue({ value }: { value: string | Date }) {
  const { datePart, timePart } = splitReceiptDateTime(value);
  if (!timePart) {
    return <span>{datePart}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline justify-start gap-x-1">
      <span>{datePart}</span>
      <span className="text-muted-foreground/40" aria-hidden>
        -
      </span>
      <span dir="ltr" className="tabular-nums [unicode-bidi:isolate]">
        {timePart}
      </span>
    </span>
  );
}

interface PaymentReceiptDialogProps {
  paymentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentReceiptDialog({
  paymentId,
  open,
  onOpenChange,
}: PaymentReceiptDialogProps) {
  const [busy, setBusy] = useState<"print" | "pdf" | null>(null);

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ["payment-receipt", paymentId],
    queryFn: () => apiGet<PaymentReceipt>(`/crm/payments/${paymentId}/receipt`),
    enabled: open && !!paymentId,
  });

  const handlePrint = async () => {
    if (!paymentId || busy) return;
    setBusy("print");
    try {
      await printPaymentReceipt(paymentId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "چاپ ناموفق بود");
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!paymentId || busy) return;
    setBusy("pdf");
    try {
      const { filename } = await downloadPaymentReceiptPdf(paymentId);
      toast.success("PDF دانلود شد", { description: filename });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "دانلود PDF ناموفق بود");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[94vh] gap-0 overflow-y-auto rounded-2xl border-border/50 bg-muted p-0 sm:max-w-[460px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>رسید پرداخت</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center px-3 py-5 sm:px-5 sm:py-6">
          {isLoading && (
            <ModalLoader label="در حال آماده‌سازی رسید..." />
          )}
          {error && (
            <ErrorState
              title="بارگذاری رسید ناموفق بود"
              description={
                error instanceof Error
                  ? error.message
                  : "لطفاً دوباره تلاش کنید."
              }
              className="w-full border-none bg-transparent py-12"
            />
          )}
          {receipt && <ReceiptPreview receipt={receipt} />}
        </div>

        <DialogFooter className="gap-2 border-t border-border/40 bg-card/95 px-4 py-3.5 sm:gap-2 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={!!busy}
          >
            بستن
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!receipt || !!busy}
            onClick={handlePrint}
          >
            {busy === "print" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            چاپ
          </Button>
          <Button
            type="button"
            variant="brand"
            className="rounded-xl shadow-md shadow-brand/20"
            disabled={!receipt || !!busy}
            onClick={handleDownloadPdf}
          >
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            دانلود PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptPreview({ receipt }: { receipt: PaymentReceipt }) {
  const paidAt = receipt.payment.paidAt || receipt.payment.createdAt;
  const recorderName = receipt.payment.recordedByName?.trim() || "—";
  const customerName = receipt.customer.personName?.trim() || "—";
  const paymentNo = receipt.payment.paymentNumber?.trim() || null;

  const rows: Array<{
    label: string;
    icon: typeof User;
    amount?: boolean;
    content: ReactNode;
  }> = [
    {
      label: "نام مشتری",
      icon: User,
      content: customerName,
    },
    {
      label: "مبلغ پرداخت",
      icon: CreditCard,
      amount: true,
      content: formatReceiptAmount(receipt.payment.amount),
    },
    {
      label: "روش پرداخت",
      icon: HandCoins,
      content:
        receipt.payment.methodLabel ||
        paymentMethodLabel(receipt.payment.method),
    },
    {
      label: "تاریخ و زمان",
      icon: CalendarClock,
      content: <ReceiptDateTimeValue value={paidAt} />,
    },
    {
      label: "وضعیت",
      icon: BadgeCheck,
      content: formatPaymentVerification(receipt.payment.verification),
    },
    {
      label: "ثبت‌کننده",
      icon: UserRoundPen,
      content: recorderName,
    },
  ];

  if (receipt.contract?.title) {
    rows.push({
      label: "قرارداد / پروژه",
      icon: FolderKanban,
      content: receipt.contract.title,
    });
  }
  if (
    receipt.contract &&
    receipt.contract.remainingBalance != null &&
    Number.isFinite(Number(receipt.contract.remainingBalance))
  ) {
    rows.push({
      label: "مانده حساب",
      icon: Wallet,
      amount: true,
      content: formatReceiptAmount(receipt.contract.remainingBalance),
    });
  }

  const compact = rows.length > 5;

  return (
    <article
      dir="rtl"
      style={{ width: A6_W, minHeight: A6_H }}
      className={cn(
        /* Intentional paper surface for print fidelity in both themes */
        "flex flex-col overflow-hidden bg-white text-slate-900",
        "rounded-sm border border-slate-200/90",
        "shadow-[0_18px_40px_-12px_rgba(15,23,42,0.18)] dark:shadow-black/50",
      )}
    >
      <div className="h-[3px] bg-gradient-to-l from-[#1f2937] via-[#d4af37] to-[#e8c547]" />

      <header className={cn("px-4 pb-0", compact ? "pt-3" : "pt-3.5")}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-start">
            <div className="inline-flex items-center gap-1.5">
              <ApexMark className="h-10 w-10" decorative tone="onLight" />
            </div>
            <p className="mt-0.5 text-[8.5px] font-medium tracking-wide text-slate-400">
              سیستم مدیریت مشتریان و پروژه‌ها
            </p>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#d4af37]/25 bg-[#d4af37]/10 text-[#b8962e]">
            <Receipt className="size-3.5" strokeWidth={1.7} />
          </div>
        </div>

        <div
          className={cn(
            "border-y border-slate-100 text-center",
            compact ? "mt-2.5 py-2" : "mt-3.5 py-2.5",
          )}
        >
          <h2 className="text-[17px] font-black tracking-tight text-[#1f2937]">
            رسید پرداخت
          </h2>
          {paymentNo && (
            <p
              className="mt-1 text-[9px] font-medium tracking-wide text-slate-400"
              dir="ltr"
            >
              {paymentNo}
            </p>
          )}
        </div>
      </header>

      <div className={cn("flex flex-1 flex-col px-3.5 pb-0", compact ? "pt-2" : "pt-3")}>
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
          {rows.map((row, index) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className={cn(
                  "relative flex items-center px-3",
                  compact ? "min-h-[38px] py-2" : "min-h-[48px] py-3",
                  index < rows.length - 1 &&
                    "border-b border-dashed border-slate-200",
                )}
              >
                <div className="relative z-[1] flex shrink-0 items-center gap-2 bg-white pe-2">
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-lg bg-[#d4af37]/10 text-[#b8962e] ring-1 ring-[#d4af37]/20",
                      compact ? "size-7" : "size-8",
                    )}
                  >
                    <Icon
                      className={compact ? "size-[13px]" : "size-[15px]"}
                      strokeWidth={1.7}
                    />
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap font-semibold text-slate-700",
                      compact ? "text-[10px]" : "text-[11px]",
                    )}
                  >
                    {row.label}
                  </span>
                </div>
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 flex items-center justify-center px-3",
                    "font-bold leading-snug text-slate-900",
                    compact ? "text-[11.5px]" : "text-[12.5px]",
                    row.amount && "tabular-nums text-[#b8962e]",
                    row.amount && !compact && "text-[13.5px]",
                  )}
                >
                  <span className="max-w-[58%] truncate text-center">
                    {row.content}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-auto px-1 pb-2.5 pt-3 text-center text-[8px] leading-relaxed text-slate-400">
          این رسید به‌عنوان تأیید پرداخت صادر گردیده است.
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 bg-[#1f2937] px-3.5 py-2 text-[9px] font-semibold text-white">
        <span className="inline-flex items-center gap-1.5" dir="ltr">
          <Globe className="size-2.5 opacity-80" />
          www.apex.com
        </span>
        <span className="inline-flex items-center gap-1.5" dir="ltr">
          <Phone className="size-2.5 opacity-80" />
          0700123456
        </span>
      </div>
    </article>
  );
}

export { printPaymentReceipt, downloadPaymentReceiptPdf };

export function PaymentReceiptActions({
  paymentId,
  onView,
}: {
  paymentId: string;
  onView: () => void;
}) {
  const [busy, setBusy] = useState<"print" | "pdf" | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-lg"
        onClick={onView}
        title="مشاهده رسید"
        disabled={!!busy}
      >
        <Eye className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">مشاهده رسید</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-lg"
        title="چاپ"
        disabled={!!busy}
        onClick={async () => {
          setBusy("print");
          try {
            await printPaymentReceipt(paymentId);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "چاپ ناموفق بود");
          } finally {
            setBusy(null);
          }
        }}
      >
        {busy === "print" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">چاپ</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="rounded-lg"
        title="دانلود PDF"
        disabled={!!busy}
        onClick={async () => {
          setBusy("pdf");
          try {
            const { filename } = await downloadPaymentReceiptPdf(paymentId);
            toast.success("PDF دانلود شد", { description: filename });
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "دانلود PDF ناموفق بود",
            );
          } finally {
            setBusy(null);
          }
        }}
      >
        {busy === "pdf" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">PDF</span>
      </Button>
    </div>
  );
}
