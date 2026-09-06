"use client";

import { ApexMark } from "@/components/brand/apex-mark";
import { BillDocumentFooter } from "@/components/brand/bill-document-footer";
import { cn } from "@/lib/utils";
import { crmSalesText } from "./copy";
import type { CrmInvoice } from "./types";

function formatInvoiceAmount(amount: string | number | undefined) {
  return `${Number(amount || 0).toLocaleString("fa-AF", {
    numberingSystem: "latn",
  })} افغانی`;
}

function formatInvoiceDate(value?: string | Date | null) {
  if (!value) return "—";
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

function dash(value?: string | null) {
  const text = String(value || "").trim();
  return text || "—";
}

export function InvoiceDocument({ invoice }: { invoice: CrmInvoice }) {
  const customer = invoice.customer;
  const videoCount =
    invoice.videoCount != null && Number(invoice.videoCount) > 0
      ? String(Math.round(Number(invoice.videoCount)))
      : "—";
  const rows: Array<{
    label: string;
    value: string;
    amount?: boolean;
    ltr?: boolean;
  }> = [
    { label: crmSalesText("invoiceNumber"), value: invoice.invoiceNumber, ltr: true },
    {
      label: crmSalesText("invoiceIssuedAt"),
      value: formatInvoiceDate(invoice.issuedAt || invoice.createdAt),
    },
    {
      label: crmSalesText("invoiceCustomerName"),
      value: dash(customer?.personName),
    },
    { label: crmSalesText("invoiceVideoCount"), value: videoCount },
    {
      label: crmSalesText("invoiceGrandTotal"),
      value: formatInvoiceAmount(invoice.total),
      amount: true,
    },
    {
      label: crmSalesText("invoicePaid"),
      value: formatInvoiceAmount(invoice.paidAmount),
      amount: true,
    },
    {
      label: crmSalesText("invoicePaymentMethod"),
      value: dash(invoice.paymentMethodLabel),
    },
    ...(invoice.paymentMethodMetaRows || [])
      .filter((row) => row?.label && row?.value)
      .map((row) => ({
        label: row.label,
        value: row.value,
        ltr: Boolean(row.ltr),
      })),
    {
      label: crmSalesText("invoiceStatus"),
      value: dash(invoice.statusLabel) || crmSalesText("invoiceStatusIssued"),
    },
    ...(invoice.recordedByName
      ? [
          {
            label: crmSalesText("invoiceRecordedBy"),
            value: invoice.recordedByName,
          },
        ]
      : []),
    {
      label: crmSalesText("invoiceRemainingAmount"),
      value: formatInvoiceAmount(invoice.remainingAmount),
      amount: true,
    },
  ];

  return (
    <article
      dir="rtl"
      className={cn(
        "mx-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-slate-900",
        "shadow-[0_18px_40px_-12px_rgba(15,23,42,0.12)] dark:shadow-black/40",
      )}
    >
      <header className="px-5 pb-3 pt-5 text-center">
        <div className="flex flex-col items-center gap-1">
          <ApexMark className="h-12 w-12" decorative tone="onLight" />
          <p className="text-[9px] font-bold tracking-[0.16em] text-slate-500">
            APEX SMART MARKETING
          </p>
        </div>
        <div className="mt-3 inline-flex items-center justify-center rounded-md bg-[#1e3a5f] px-5 py-2">
          <h2 className="text-sm font-bold tracking-tight text-white">
            {crmSalesText("invoiceOfficial")}
          </h2>
        </div>
      </header>

      <div className="space-y-3 px-4 pb-3">
        <div className="overflow-hidden rounded-xl border border-slate-200/90">
          {rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className={cn(
                "flex items-center justify-between gap-3 px-3.5 py-3",
                index < rows.length - 1 && "border-b border-dashed border-slate-200",
                index === rows.length - 1 && "bg-slate-50/90",
              )}
            >
              <span className="shrink-0 text-[11.5px] font-semibold text-slate-600">
                {row.label}
              </span>
              <span
                className={cn(
                  "min-w-0 text-end text-[12.5px] font-bold leading-snug text-slate-900",
                  row.amount && "tabular-nums text-[13px] text-[#c9a227]",
                  row.ltr && "[direction:ltr] [unicode-bidi:isolate]",
                )}
                dir={row.ltr ? "ltr" : undefined}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {invoice.notes ? (
          <div className="rounded-xl border border-slate-200/90 px-3.5 py-2.5 text-start">
            <p className="text-[10px] font-semibold text-slate-500">
              {crmSalesText("invoiceNotesSection")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed">
              {invoice.notes}
            </p>
          </div>
        ) : null}
      </div>

      <BillDocumentFooter
        phone={invoice.company?.phone}
        email={invoice.company?.email}
        website={invoice.company?.website}
      />
    </article>
  );
}
