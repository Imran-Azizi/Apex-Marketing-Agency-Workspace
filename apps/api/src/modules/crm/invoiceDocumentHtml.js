import {
  escapeHtml,
  formatReceiptAmount,
  splitReceiptDateTime,
} from "./paymentReceiptHtml.js";
import {
  BILL_BRAND_CSS,
  buildBillBrandHeaderHtml,
  buildBillFooterHtml,
} from "./billBranding.js";

export const INVOICE_STATUS_LABELS = {
  DRAFT: "پیش‌نویس",
  ISSUED: "صادر شده",
  PARTIALLY_PAID: "پرداخت جزئی",
  PAID: "پرداخت شده",
  OVERDUE: "سررسید گذشته",
  CANCELED: "لغو شده",
};

export function invoiceStatusLabel(status) {
  return INVOICE_STATUS_LABELS[String(status || "").toUpperCase()] || status || "—";
}

function dash(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

/**
 * Compact professional RTL invoice HTML for print / PDF.
 * Matches the APEX payment-receipt layout (navy badge, gold amounts, field rows).
 */
export function buildInvoiceDocumentHtml(invoice) {
  const esc = escapeHtml;
  const issued = invoice.issuedAt || invoice.createdAt;
  const { datePart } = splitReceiptDateTime(issued);
  const number = dash(invoice.invoiceNumber);
  const customer = invoice.customer || {};
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.paidAmount || 0);
  const status = invoiceStatusLabel(invoice.status);
  const method = dash(invoice.paymentMethodLabel);
  const recorder = String(invoice.recordedByName || "").trim();
  const notes = String(invoice.notes || "").trim();
  const videoCount =
    invoice.videoCount != null && Number(invoice.videoCount) > 0
      ? String(Math.round(Number(invoice.videoCount)))
      : "—";
  const metaRows = Array.isArray(invoice.paymentMethodMetaRows)
    ? invoice.paymentMethodMetaRows.filter((row) => row?.label && row?.value)
    : [];

  const summaryRows = [
    { label: "شماره فاکتور", value: number, ltr: true },
    { label: "تاریخ صدور", value: datePart },
    { label: "نام مشتری", value: dash(customer.personName) },
    { label: "تعداد ویدیو", value: videoCount },
    {
      label: "مبلغ مجموعی",
      value: formatReceiptAmount(total),
      amount: true,
    },
    {
      label: "مبلغ قابل پرداخت",
      value: formatReceiptAmount(paid),
      amount: true,
    },
    { label: "روش پرداخت", value: method },
    ...metaRows.map((row) => ({
      label: String(row.label),
      value: String(row.value),
      ltr: Boolean(row.ltr),
    })),
    { label: "وضعیت پرداخت", value: status },
    ...(recorder ? [{ label: "ثبت‌کننده", value: recorder }] : []),
  ];
  if (summaryRows.length) summaryRows[summaryRows.length - 1].last = true;

  const summaryHtml = summaryRows
    .map(
      (row) => `
      <div class="row${row.last ? " last" : ""}">
        <span class="label">${esc(row.label)}</span>
        <span class="value${row.amount ? " amount" : ""}${row.ltr ? " ltr" : ""}"${row.ltr ? ' dir="ltr"' : ""}>${esc(row.value)}</span>
      </div>`,
    )
    .join("");

  const title = `فاکتور — ${number}`;

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    @page { size: A6 portrait; margin: 8mm; }
    :root {
      --brand-soft: #c9a227;
      --title-bg: #1e3a5f;
      --ink: #1f2937;
      --muted: #64748b;
      --line: #e2e8f0;
      --soft: #f8fafc;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--soft);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.45;
    }
    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px 12px;
    }
    .invoice-sheet {
      width: 105mm;
      max-width: 100%;
      background: #fff;
      border: 1px solid #dbe3ec;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.14);
    }
    .header {
      padding: 18px 16px 10px;
      text-align: center;
    }
    .brand-sub {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.16em;
      color: #94a3b8;
    }
    .title-badge {
      display: inline-flex;
      margin-top: 10px;
      padding: 7px 18px;
      border-radius: 8px;
      background: var(--title-bg);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
    }
    ${BILL_BRAND_CSS}
    .body { padding: 6px 14px 10px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px dashed var(--line);
      min-height: 38px;
    }
    .row.last {
      border-bottom: 0;
      background: #f8fafc;
    }
    .label {
      flex-shrink: 0;
      font-size: 11.5px;
      font-weight: 650;
      color: var(--muted);
    }
    .value {
      min-width: 0;
      text-align: left;
      font-size: 12.5px;
      font-weight: 750;
      color: var(--ink);
      word-break: break-word;
    }
    .value.ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .value.amount {
      color: var(--brand-soft);
      font-variant-numeric: tabular-nums;
      font-size: 13px;
    }
    .notes {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .notes h3 {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .notes p { font-size: 12px; white-space: pre-wrap; }
    .row, .notes { break-inside: avoid; }
    @media print {
      body, .page { background: #fff !important; }
      .page { min-height: auto; padding: 0; display: block; }
      .invoice-sheet {
        width: 100%;
        max-width: none;
        margin: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <article class="invoice-sheet" data-invoice-id="${esc(invoice.id || "")}">
      ${buildBillBrandHeaderHtml({ titleBadge: "فاکتور" })}
      <div class="body">
        <div class="card">${summaryHtml}</div>
        ${
          notes
            ? `<div class="notes"><h3>یادداشت فاکتور</h3><p>${esc(notes)}</p></div>`
            : ""
        }
      </div>
      ${buildBillFooterHtml(invoice.company || {})}
    </article>
  </div>
  <script>
    const params = new URLSearchParams(location.search);
    if (params.get('autoprint') === '1') {
      const runPrint = () => {
        try { window.focus(); } catch (_) {}
        window.print();
      };
      if (document.readyState === 'complete') {
        setTimeout(runPrint, 180);
      } else {
        window.addEventListener('load', () => setTimeout(runPrint, 180));
      }
    }
  </script>
</body>
</html>`;
}
