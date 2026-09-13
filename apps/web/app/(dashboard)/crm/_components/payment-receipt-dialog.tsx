"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Loader2, Printer } from "lucide-react";
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
import { BillDocumentFooter } from "@/components/brand/bill-document-footer";
import type { PaymentReceipt } from "./payment-types";

function formatReceiptAmount(amount: number) {
  return `${Number(amount).toLocaleString("fa-AF", {
    numberingSystem: "latn",
  })} افغانی`;
}

function formatReceiptDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-AF", {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
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
        className="max-h-[94vh] gap-0 overflow-hidden rounded-2xl border-border/50 bg-muted/40 p-0 sm:max-w-[440px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>رسید پرداخت</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(94vh-4.5rem)] overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          {isLoading && <ModalLoader label="در حال آماده‌سازی رسید..." />}
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

        <DialogFooter className="flex-wrap gap-2 border-t border-border/40 bg-card/95 px-4 py-3.5 sm:gap-2 sm:px-6">
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
            چاپ رسید
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
  const paymentNo = receipt.payment.paymentNumber?.trim() || "—";
  const customerName = receipt.customer.personName?.trim() || "—";
  const videoCount =
    receipt.videoCount != null && Number(receipt.videoCount) > 0
      ? String(Math.round(Number(receipt.videoCount)))
      : receipt.invoice?.videoCount != null &&
          Number(receipt.invoice.videoCount) > 0
        ? String(Math.round(Number(receipt.invoice.videoCount)))
        : "—";
  const totalAmount = receipt.finance?.totalAmount ?? 0;
  const paidAmount = receipt.payment.amount;
  const method =
    receipt.payment.methodLabel &&
    receipt.payment.methodLabel !== "ثبت نشده"
      ? receipt.payment.methodLabel
      : paymentMethodLabel(receipt.payment.method);
  const recorder = receipt.payment.recordedByName?.trim() || "—";
  const metaRows = (receipt.payment.methodMetaRows || []).filter(
    (row) => row?.label && row?.value,
  );

  const rows: Array<{
    label: string;
    value: string;
    amount?: boolean;
    emphasize?: boolean;
    ltr?: boolean;
  }> = [
    { label: "شماره رسید", value: paymentNo, ltr: true },
    { label: "تاریخ پرداخت", value: formatReceiptDate(paidAt) },
    { label: "نام مشتری", value: customerName },
    { label: "تعداد ویدیو", value: videoCount },
    {
      label: "مبلغ مجموعی",
      value: formatReceiptAmount(totalAmount),
      amount: true,
      emphasize: true,
    },
    {
      label: "مبلغ پرداخت شده",
      value: formatReceiptAmount(paidAmount),
      amount: true,
      emphasize: true,
    },
    { label: "روش پرداخت", value: method },
    ...metaRows.map((row) => ({
      label: row.label,
      value: row.value,
      ltr: Boolean(row.ltr),
    })),
    { label: "ثبت‌کننده", value: recorder },
  ];

  return (
    <article
      dir="rtl"
      className={cn(
        "mx-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-slate-900",
        "shadow-[0_18px_40px_-12px_rgba(15,23,42,0.12)] dark:shadow-black/40",
      )}
    >
      <header className="px-6 pb-4 pt-6 text-center">
        <div className="flex flex-col items-center gap-1">
          <ApexMark className="h-12 w-12" decorative tone="onLight" />
          <p className="text-[9px] font-bold tracking-[0.14em] text-slate-500">
            APEX SMART MARKETING
          </p>
        </div>
        <div className="mt-4 inline-flex items-center justify-center rounded-md bg-[#1e3a5f] px-5 py-2">
          <h2 className="text-sm font-bold tracking-tight text-white">
            رسید پرداخت
          </h2>
        </div>
      </header>

      <div className="px-5 pb-3">
        <div className="overflow-hidden rounded-xl border border-slate-200/90">
          {rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className={cn(
                "flex items-center justify-between gap-3 px-3.5 py-3",
                index < rows.length - 1 &&
                  "border-b border-dashed border-slate-200",
                index === rows.length - 1 && "bg-slate-50/90",
              )}
            >
              <span className="shrink-0 text-[11.5px] font-semibold text-slate-600">
                {row.label}
              </span>
              <span
                className={cn(
                  "min-w-0 text-end text-[12.5px] font-bold leading-snug text-slate-900",
                  row.amount && "tabular-nums text-[#c9a227]",
                  row.amount && "text-[13px]",
                  row.ltr && "[direction:ltr] [unicode-bidi:isolate]",
                )}
                dir={row.ltr ? "ltr" : undefined}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <BillDocumentFooter
        phone={receipt.company?.phone}
        email={receipt.company?.email}
        website={receipt.company?.website}
      />
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
        title="چاپ رسید"
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
