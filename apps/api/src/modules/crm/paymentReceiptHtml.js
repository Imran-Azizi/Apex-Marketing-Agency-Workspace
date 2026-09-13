import {
  formatReceiptVideoCount,
  resolveReceiptPaymentMethod,
} from './receiptDisplay.js';
import {
  BILL_BRAND_CSS,
  buildBillBrandHeaderHtml,
  buildBillFooterHtml,
} from './billBranding.js';

/**
 * Shared receipt display helpers (view formatting only — does not change stored values).
 * Print target: compact A6 / A4-friendly portrait receipt.
 */

export function formatReceiptAmount(amount) {
  return `${Number(amount).toLocaleString('fa-AF', {
    numberingSystem: 'latn',
  })} افغانی`;
}

/** Split Persian date and Latin 12h time to avoid RTL reordering bugs. */
export function splitReceiptDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { datePart: '—', timePart: '' };
  }

  const datePart = new Intl.DateTimeFormat('fa-AF', {
    calendar: 'persian',
    numberingSystem: 'latn',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('fa-AF', {
    numberingSystem: 'latn',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return { datePart, timePart };
}

export function formatReceiptDateTime(value) {
  const { datePart, timePart } = splitReceiptDateTime(value);
  if (!timePart) return datePart;
  return `${datePart} - \u2066${timePart}\u2069`;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatPaymentVerification(status) {
  const map = {
    VERIFIED: 'تایید شده',
    PENDING: 'در انتظار تأیید',
    REJECTED: 'رد شده',
  };
  return map[String(status || '').toUpperCase()] || String(status || '—');
}

/**
 * Minimal professional RTL payment receipt HTML.
 * @param {object} receipt - payload from getPaymentReceipt()
 */
export function buildPaymentReceiptHtml(receipt) {
  const esc = escapeHtml;
  const paidAt = receipt.payment.paidAt || receipt.payment.createdAt;
  const { datePart } = splitReceiptDateTime(paidAt);
  const paymentNo = (receipt.payment.paymentNumber || '').trim() || '—';
  const customerName = (receipt.customer?.personName || '').trim() || '—';
  const videoCount = formatReceiptVideoCount(
    receipt.videoCount ?? receipt.invoice?.videoCount,
  );
  const totalAmount = Number(receipt.finance?.totalAmount || 0);
  const paidAmount = Number(receipt.payment.amount || 0);
  const methodText = resolveReceiptPaymentMethod({
    method: receipt.payment.method,
    methodLabel: receipt.payment.methodLabel,
    invoiceMethod: receipt.invoice?.paymentMethod,
  });
  const recorder = (receipt.payment.recordedByName || '').trim() || '—';
  const metaRows = Array.isArray(receipt.payment.methodMetaRows)
    ? receipt.payment.methodMetaRows.filter((row) => row?.label && row?.value)
    : [];

  const rows = [
    { label: 'شماره رسید', value: paymentNo, ltr: true },
    { label: 'تاریخ پرداخت', value: datePart },
    { label: 'نام مشتری', value: customerName },
    { label: 'تعداد ویدیو', value: videoCount },
    {
      label: 'مبلغ مجموعی',
      value: formatReceiptAmount(totalAmount),
      amount: true,
      emphasize: true,
    },
    {
      label: 'مبلغ پرداخت شده',
      value: formatReceiptAmount(paidAmount),
      amount: true,
      emphasize: true,
    },
    { label: 'روش پرداخت', value: methodText },
    ...metaRows.map((row) => ({
      label: String(row.label),
      value: String(row.value),
      ltr: Boolean(row.ltr),
    })),
    { label: 'ثبت‌کننده', value: recorder },
  ];

  const rowsHtml = rows
    .map(
      (row, index) => `
      <div class="row${index === rows.length - 1 ? ' last' : ''}">
        <span class="label">${esc(row.label)}</span>
        <span class="value${row.amount ? ' amount' : ''}${row.ltr ? ' ltr' : ''}"${row.ltr ? ' dir="ltr"' : ''}>${esc(row.value)}</span>
      </div>`,
    )
    .join('');

  const title =
    paymentNo && paymentNo !== '—'
      ? `رسید پرداخت — ${paymentNo}`
      : 'رسید پرداخت';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
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
      padding: 20px 12px;
    }
    .receipt-sheet {
      width: 105mm;
      max-width: 100%;
      background: #fff;
      border: 1px solid #dbe3ec;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.14);
    }
    .header {
      padding: 20px 18px 14px;
      text-align: center;
    }
    .brand-sub {
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #94a3b8;
    }
    ${BILL_BRAND_CSS}
    .title-badge {
      display: inline-flex;
      margin-top: 14px;
      padding: 8px 20px;
      border-radius: 6px;
      background: var(--title-bg);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
    }
    .body { padding: 8px 14px 10px; }
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
      font-size: 11px;
      font-weight: 650;
      color: var(--muted);
    }
    .value {
      min-width: 0;
      text-align: left;
      font-size: 12px;
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
      font-size: 12.5px;
    }
    @media print {
      body, .page { background: #fff !important; }
      .page {
        min-height: auto;
        padding: 0;
        display: block;
      }
      .receipt-sheet {
        width: 100%;
        max-width: none;
        margin: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .row { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <article class="receipt-sheet" data-payment-id="${esc(receipt.payment.id || '')}">
      ${buildBillBrandHeaderHtml({ titleBadge: 'رسید پرداخت' })}
      <div class="body">
        <div class="card">${rowsHtml}</div>
      </div>
      ${buildBillFooterHtml(receipt.company || {})}
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
        setTimeout(runPrint, 120);
      } else {
        window.addEventListener('load', () => setTimeout(runPrint, 120));
      }
    }
  </script>
</body>
</html>`;
}
