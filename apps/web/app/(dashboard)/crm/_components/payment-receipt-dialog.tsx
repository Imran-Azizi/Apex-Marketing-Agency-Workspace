"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CreditCard,
  Download,
  Eye,
  Globe,
  Phone,
  Printer,
  Receipt,
  User,
  UserRoundPen,
} from "lucide-react";
import type { ReactNode } from "react";
import { api, apiGet } from "@/lib/api";
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
import type { PaymentReceipt } from "./payment-types";

/** A6 portrait: 105 × 148 mm */
const A6_W = "105mm";
const A6_H = "148mm";

async function fetchReceiptHtml(paymentId: string, autoprint = false) {
  const { data } = await api.get<string>(
    `/crm/payments/${paymentId}/receipt.html${autoprint ? "?autoprint=1" : ""}`,
    {
      responseType: "text",
      transformResponse: [(raw) => raw],
      headers: { Accept: "text/html" },
    },
  );
  return typeof data === "string" ? data : String(data);
}

function openHtmlInNewWindow(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("پنجره رسید مسدود شد. لطفاً pop-up را مجاز کنید.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function formatReceiptAmount(amount: number) {
  return `${Number(amount).toLocaleString("fa-AF", {
    numberingSystem: "latn",
  })} افغانی`;
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

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return {
    datePart,
    timePart: `${hours}:${minutes} ${ampm}`,
  };
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
  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ["payment-receipt", paymentId],
    queryFn: () => apiGet<PaymentReceipt>(`/crm/payments/${paymentId}/receipt`),
    enabled: open && !!paymentId,
  });

  const handlePrint = async () => {
    if (!paymentId) return;
    try {
      const html = await fetchReceiptHtml(paymentId, true);
      openHtmlInNewWindow(html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "چاپ ناموفق بود");
    }
  };

  const handleDownloadPdf = async () => {
    if (!paymentId) return;
    try {
      const html = await fetchReceiptHtml(paymentId, true);
      openHtmlInNewWindow(html);
      toast.message("برای دانلود PDF", {
        description:
          "در پنجره چاپ، اندازه کاغذ را A6 انتخاب کنید و سپس Save as PDF بزنید.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "دانلود ناموفق بود");
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
          >
            بستن
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!receipt}
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            چاپ
          </Button>
          <Button
            type="button"
            variant="brand"
            className="rounded-xl shadow-md shadow-brand/20"
            disabled={!receipt}
            onClick={handleDownloadPdf}
          >
            <Download className="h-4 w-4" />
            دانلود PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApexMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-block size-5 shrink-0", className)}
      aria-hidden
    >
      <span className="absolute start-[6px] top-0 size-[7px] rotate-45 bg-brand" />
      <span className="absolute start-0 top-[6px] size-[7px] rotate-45 bg-brand/70" />
      <span className="absolute end-0 top-[6px] size-[7px] rotate-45 bg-brand/70" />
      <span className="absolute start-[6px] bottom-0 size-[7px] rotate-45 bg-brand/45" />
    </span>
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
      label: "تاریخ و زمان",
      icon: CalendarClock,
      content: <ReceiptDateTimeValue value={paidAt} />,
    },
    {
      label: "ثبت‌کننده",
      icon: UserRoundPen,
      content: recorderName,
    },
  ];

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
      {/* Brand accent strip */}
      <div className="h-[3px] bg-gradient-to-l from-teal-800 via-teal-600 to-teal-500" />

      <header className="px-4 pb-0 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-start">
            <div className="inline-flex items-center gap-1.5">
              <ApexMark />
              <span className="text-[15px] font-black tracking-[0.12em] text-teal-800">
                APEX
              </span>
            </div>
            <p className="mt-0.5 text-[8.5px] font-medium tracking-wide text-slate-400">
              سیستم مدیریت مشتریان و پروژه‌ها
            </p>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-teal-700/12 bg-teal-50/80 text-teal-700">
            <Receipt className="size-3.5" strokeWidth={1.7} />
          </div>
        </div>

        <div className="mt-3.5 border-y border-slate-100 py-2.5 text-center">
          <h2 className="text-[17px] font-black tracking-tight text-teal-800">
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

      <div className="flex flex-1 flex-col px-3.5 pb-0 pt-3">
        {/* Main fields — icon+label right, value centered (reference layout) */}
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
          {rows.map((row, index) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className={cn(
                  "relative flex min-h-[48px] items-center px-3 py-3",
                  index < rows.length - 1 &&
                    "border-b border-dashed border-slate-200",
                )}
              >
                <div className="relative z-[1] flex shrink-0 items-center gap-2 bg-white pe-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-700/10">
                    <Icon className="size-[15px]" strokeWidth={1.7} />
                  </span>
                  <span className="whitespace-nowrap text-[11px] font-semibold text-slate-700">
                    {row.label}
                  </span>
                </div>
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 flex items-center justify-center px-3",
                    "text-[12.5px] font-bold leading-snug text-slate-900",
                    row.amount && "text-[13.5px] tabular-nums text-teal-700",
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

      <div className="mt-auto flex items-center justify-between gap-2 bg-teal-800 px-3.5 py-2 text-[9px] font-semibold text-white">
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

export async function printPaymentReceipt(paymentId: string) {
  const html = await fetchReceiptHtml(paymentId, true);
  openHtmlInNewWindow(html);
}

export function PaymentReceiptActions({
  paymentId,
  onView,
}: {
  paymentId: string;
  onView: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-lg"
        onClick={onView}
        title="مشاهده رسید"
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
        onClick={async () => {
          try {
            await printPaymentReceipt(paymentId);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "چاپ ناموفق بود");
          }
        }}
      >
        <Printer className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">چاپ</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="rounded-lg"
        title="دانلود PDF"
        onClick={async () => {
          try {
            await printPaymentReceipt(paymentId);
            toast.message("برای دانلود PDF", {
              description:
                "اندازه کاغذ را A6 انتخاب کنید، سپس Save as PDF بزنید.",
            });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "دانلود ناموفق بود");
          }
        }}
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">PDF</span>
      </Button>
    </div>
  );
}
