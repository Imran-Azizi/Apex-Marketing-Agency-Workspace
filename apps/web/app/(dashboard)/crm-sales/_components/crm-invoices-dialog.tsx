"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Download,
  FileText,
  Loader2,
  Printer,
  Receipt,
  Send,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import {
  buildWhatsAppChatUrl,
  cn,
  formatCurrency,
} from "@/lib/utils";
import {
  buildCrmInvoicePdfBlob,
  downloadCrmInvoicePdf,
  invoicePdfFilename,
  printCrmInvoice,
} from "@/lib/crm-invoice-document";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/shared/empty-state";
import { crmSalesText } from "./copy";
import { InvoiceDocument } from "./invoice-document";
import type {
  CrmCustomer,
  CrmInvoice,
  CrmInvoiceListResponse,
  CrmInvoiceStatus,
} from "./types";

const STATUS_LABEL_KEYS: Record<
  CrmInvoiceStatus,
  | "invoiceStatusDraft"
  | "invoiceStatusIssued"
  | "invoiceStatusPartial"
  | "invoiceStatusPaid"
  | "invoiceStatusOverdue"
  | "invoiceStatusCanceled"
> = {
  DRAFT: "invoiceStatusDraft",
  ISSUED: "invoiceStatusIssued",
  PARTIALLY_PAID: "invoiceStatusPartial",
  PAID: "invoiceStatusPaid",
  OVERDUE: "invoiceStatusOverdue",
  CANCELED: "invoiceStatusCanceled",
};

const STATUS_VARIANTS: Record<
  string,
  "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  ISSUED: "outline",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELED: "secondary",
};

function invoiceStatusLabel(status: string) {
  const key = STATUS_LABEL_KEYS[status as CrmInvoiceStatus];
  return key ? crmSalesText(key) : status;
}

function money(value: string | number | undefined) {
  return formatCurrency(Number(value || 0));
}

function formatInvoiceDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-AF", {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function shareText(invoice: CrmInvoice) {
  return crmSalesText("invoiceSendMessage", {
    name: invoice.customer?.personName || "مشتری",
    number: invoice.invoiceNumber,
    total: money(invoice.total),
    paid: money(invoice.paidAmount),
  });
}

interface CrmInvoicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CrmCustomer | null;
  initialInvoiceId?: string | null;
}

export function CrmInvoicesDialog({
  open,
  onOpenChange,
  customer,
  initialInvoiceId = null,
}: CrmInvoicesDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"print" | "pdf" | "send" | "share" | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setBusy(null);
      return;
    }
    setSelectedId(initialInvoiceId);
  }, [open, initialInvoiceId, customer?.id]);

  const listQuery = useQuery({
    queryKey: ["crm-customer-invoices", customer?.id],
    queryFn: () =>
      apiGet<CrmInvoiceListResponse>(`/crm/customers/${customer!.id}/invoices`),
    enabled: open && Boolean(customer?.id),
  });

  const detailQuery = useQuery({
    queryKey: ["crm-invoice", selectedId],
    queryFn: () => apiGet<CrmInvoice>(`/crm/invoices/${selectedId}`),
    enabled: open && Boolean(selectedId),
  });

  const invoices = listQuery.data?.items || [];
  const selected =
    detailQuery.data || invoices.find((row) => row.id === selectedId) || null;
  const showingDetail = Boolean(selectedId);

  const runPrint = async () => {
    if (!selected?.id || busy) return;
    setBusy("print");
    try {
      await printCrmInvoice(selected.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : crmSalesText("invoicePrintFailed"));
    } finally {
      setBusy(null);
    }
  };

  const runPdf = async () => {
    if (!selected?.id || busy) return;
    setBusy("pdf");
    try {
      const { filename } = await downloadCrmInvoicePdf(
        selected.id,
        selected.invoiceNumber,
      );
      toast.success(crmSalesText("invoicePdfDownloaded"), { description: filename });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : crmSalesText("invoicePdfFailed"));
    } finally {
      setBusy(null);
    }
  };

  const runSend = () => {
    if (!selected || busy) return;
    const phone = selected.customer?.whatsappRaw || selected.customer?.phone;
    const url = buildWhatsAppChatUrl(phone, shareText(selected));
    if (!url) {
      toast.error(crmSalesText("invoiceSendFailed"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const runShare = async () => {
    if (!selected?.id || busy) return;
    setBusy("share");
    const text = shareText(selected);
    const title = crmSalesText("invoiceShareTitle", {
      number: selected.invoiceNumber,
    });
    try {
      if (typeof navigator.share === "function") {
        try {
          const blob = await buildCrmInvoicePdfBlob(selected.id);
          const file = new File(
            [blob],
            invoicePdfFilename(selected.invoiceNumber, selected.id),
            { type: "application/pdf" },
          );
          const payload: ShareData = { title, text, files: [file] };
          if (!navigator.canShare || navigator.canShare(payload)) {
            await navigator.share(payload);
            return;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success(crmSalesText("invoiceShareCopied"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : crmSalesText("invoiceShareFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setBusy(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        dir="rtl"
        overlayClassName="bg-black/50 backdrop-blur-[2px]"
        closeClassName="end-4 top-4 h-9 w-9 rounded-xl hover:bg-muted/80 focus:ring-brand/30"
        className={cn(
          "flex max-h-[min(94dvh,56rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-border/60 p-0 shadow-2xl sm:rounded-2xl",
          showingDetail ? "max-w-[440px] bg-muted/40" : "max-w-2xl",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/50 bg-card px-5 pb-4 pe-14 pt-5 text-start sm:px-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
              <FileText className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-base font-bold tracking-tight sm:text-lg">
                {showingDetail
                  ? crmSalesText("invoiceViewDocument")
                  : crmSalesText("invoiceSectionTitle")}
              </DialogTitle>
              <p className="truncate text-sm text-muted-foreground">
                {customer?.personName || customer?.companyName || "—"}
                {customer?.customerCode ? ` · ${customer.customerCode}` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            showingDetail ? "px-3 py-4 sm:px-5" : "px-5 py-5 sm:px-6",
            "[scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent]",
          )}
        >
          {showingDetail ? (
            detailQuery.isLoading && !selected ? (
              <ModalLoader />
            ) : detailQuery.isError || !selected ? (
              <ErrorState
                title={crmSalesText("invoiceLoadFailed")}
                onRetry={() => detailQuery.refetch()}
              />
            ) : (
              <InvoiceDocument invoice={selected} />
            )
          ) : listQuery.isLoading ? (
            <ModalLoader />
          ) : listQuery.isError ? (
            <ErrorState
              title={crmSalesText("invoiceLoadFailed")}
              onRetry={() => listQuery.refetch()}
            />
          ) : invoices.length === 0 ? (
            <EmptyState
              title={crmSalesText("invoiceEmpty")}
              description={crmSalesText("invoiceEmptyHint")}
              className="border-border/50 py-12"
            />
          ) : (
            <ul className="space-y-2">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(invoice.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card px-3.5 py-3 text-start transition-colors hover:border-border hover:bg-muted/30"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                      <Receipt className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          dir="ltr"
                          className="truncate font-mono text-sm font-semibold tracking-wide"
                        >
                          {invoice.invoiceNumber}
                        </span>
                        <Badge
                          variant={STATUS_VARIANTS[invoice.status] || "outline"}
                          className="shrink-0"
                        >
                          {invoiceStatusLabel(invoice.status)}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatInvoiceDate(invoice.issuedAt || invoice.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block text-sm font-bold tabular-nums">
                        {money(invoice.total)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-row flex-wrap items-center justify-start gap-2 border-t border-border/50 bg-card/95 px-4 py-3.5 sm:flex-row sm:justify-start sm:space-x-0 sm:px-6">
          {showingDetail ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={() => setSelectedId(null)}
                disabled={!!busy}
              >
                <ArrowRight className="h-4 w-4" />
                {crmSalesText("invoiceBackToList")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={() => onOpenChange(false)}
                disabled={!!busy}
              >
                {crmSalesText("invoiceClose")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={runPrint}
                disabled={!selected || !!busy}
              >
                {busy === "print" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {crmSalesText("invoicePrint")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={runPdf}
                disabled={!selected || !!busy}
              >
                {busy === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {crmSalesText("invoiceDownloadPdf")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={runSend}
                disabled={!selected || !!busy}
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {crmSalesText("invoiceSendCustomer")}
                </span>
                <span className="sm:hidden">ارسال</span>
              </Button>
              <Button
                type="button"
                variant="brand"
                className="h-9 rounded-xl shadow-sm"
                onClick={runShare}
                disabled={!selected || !!busy}
              >
                {busy === "share" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                {crmSalesText("invoiceShare")}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg"
              onClick={() => onOpenChange(false)}
            >
              {crmSalesText("invoiceClose")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
