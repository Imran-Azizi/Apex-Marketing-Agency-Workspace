import { formatPaymentMethod } from './paymentMethods.js';

/**
 * Shared receipt display helpers (view formatting only — does not change stored values).
 * Print target: A6 portrait (105 × 148 mm).
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

  // 12-hour clock with localized day period (ق.ظ. / ب.ظ.)
  const timePart = new Intl.DateTimeFormat('fa-AF', {
    numberingSystem: 'latn',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return { datePart, timePart };
}

/** Safe combined string with Unicode isolates for plain-text contexts. */
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

const ICONS = {
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M7 15h3"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="16.2" cy="15.2" r="2.8"/><path d="M16.2 14v1.4l.9.6"/></svg>`,
  penUser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><path d="M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12z"/><path d="M5 20a7 7 0 0 1 10.2-6.1"/><path d="M15 16.6 16.3 20l3.2-1.2-1.3-3.4z"/><path d="m16.4 19.8 1.4 1.4"/></svg>`,
  badge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><path d="M12 3 14.5 8.5 20.5 9.3 16 13.5 17.2 19.5 12 16.7 6.8 19.5 8 13.5 3.5 9.3 9.5 8.5 12 3z"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9z"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 14.5h2"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 3h6l4 4v14H8V3z"/><path d="M14 3v4h4"/><path d="m10 13 1.6 1.6L15.5 11"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16 14l4 1.5V19a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z"/></svg>`,
};

export function formatPaymentVerification(status) {
  const map = {
    VERIFIED: 'تایید شده',
    PENDING: 'در انتظار تأیید',
    REJECTED: 'رد شده',
  };
  return map[String(status || '').toUpperCase()] || String(status || '—');
}

/**
 * A6 professional RTL payment receipt HTML (no QR, no thank-you / validity cards).
 * @param {object} receipt - payload from getPaymentReceipt()
 */
export function buildPaymentReceiptHtml(receipt) {
  const paidAt = receipt.payment.paidAt || receipt.payment.createdAt;
  const recorderName = (receipt.payment.recordedByName || '').trim() || '—';
  const customerName = (receipt.customer.personName || '').trim() || '—';
  const paymentNo = (receipt.payment.paymentNumber || receipt.payment.reference || '').trim();
  const amountText = formatReceiptAmount(receipt.payment.amount);
  const statusText = formatPaymentVerification(receipt.payment.verification);
  const methodText =
    receipt.payment.methodLabel || formatPaymentMethod(receipt.payment.method);
  const { datePart, timePart } = splitReceiptDateTime(paidAt);
  const esc = escapeHtml;

  const dateTimeHtml = timePart
    ? `<span class="dt">${esc(datePart)}</span><span class="sep"> - </span><span class="tm" dir="ltr">${esc(timePart)}</span>`
    : `<span class="dt">${esc(datePart)}</span>`;

  /** @type {Array<{ label: string, valueHtml: string, icon: string, amount?: boolean }>} */
  const rowDefs = [
    { label: 'نام مشتری', valueHtml: esc(customerName), icon: 'user' },
    { label: 'مبلغ پرداخت', valueHtml: esc(amountText), icon: 'card', amount: true },
    { label: 'روش پرداخت', valueHtml: esc(methodText), icon: 'wallet' },
    { label: 'تاریخ و زمان', valueHtml: dateTimeHtml, icon: 'calendar' },
    { label: 'وضعیت', valueHtml: esc(statusText), icon: 'badge' },
    { label: 'ثبت‌کننده', valueHtml: esc(recorderName), icon: 'penUser' },
  ];

  if (receipt.contract?.title) {
    rowDefs.push({
      label: 'قرارداد / پروژه',
      valueHtml: esc(String(receipt.contract.title).trim() || '—'),
      icon: 'folder',
    });
  }
  if (
    receipt.contract &&
    receipt.contract.remainingBalance != null &&
    Number.isFinite(Number(receipt.contract.remainingBalance))
  ) {
    rowDefs.push({
      label: 'مانده حساب',
      valueHtml: esc(formatReceiptAmount(receipt.contract.remainingBalance)),
      icon: 'wallet',
      amount: true,
    });
  }

  const compact = rowDefs.length > 5;
  const rows = rowDefs
    .map(
      (row) => `
      <div class="row">
        <div class="key">
          <div class="icon">${ICONS[row.icon]}</div>
          <span class="label">${esc(row.label)}</span>
        </div>
        <div class="value${row.amount ? ' amount' : ''}"><span>${row.valueHtml}</span></div>
      </div>`,
    )
    .join('');

  const refHtml = paymentNo
    ? `<p class="ref" dir="ltr">${esc(paymentNo)}</p>`
    : '';

  const title = paymentNo
    ? `رسید پرداخت — ${paymentNo}`
    : 'رسید پرداخت — A6';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <style>
    @page {
      size: A6 portrait;
      margin: 0;
    }
    :root {
      --brand: #d4af37;
      --brand-deep: #1f2937;
      --brand-soft: #b8962e;
      --ink: #1f2937;
      --muted: #9ca3af;
      --line: #e5e7eb;
      --soft: #f3f4f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
    }
    body {
      font-family: Tahoma, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--soft);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px 12px;
    }
    .sheet {
      width: 105mm;
      height: 148mm;
      background: #fff;
      border: 1px solid #dbe3ec;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.18);
    }
    .sheet.compact .header { padding-top: 10px; }
    .sheet.compact .title-block { margin-top: 8px; padding: 7px 0; }
    .sheet.compact .body { padding-top: 8px; }
    .sheet.compact .row { min-height: 36px; padding: 7px 10px; }
    .sheet.compact .icon { width: 24px; height: 24px; border-radius: 6px; }
    .sheet.compact .icon svg { width: 12px; height: 12px; }
    .sheet.compact .label { font-size: 9.5px; }
    .sheet.compact .value { font-size: 11px; }
    .sheet.compact .value.amount { font-size: 11.5px; }
    .sheet.compact .note { padding: 6px 4px 6px; font-size: 7px; }
    .accent {
      height: 3px;
      background: linear-gradient(90deg, #e8c547, #d4af37 55%, #1f2937);
      flex-shrink: 0;
    }
    .header {
      padding: 12px 14px 0;
      flex-shrink: 0;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .brand-row {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .mark {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      display: block;
    }
    .mark svg {
      width: 18px;
      height: 18px;
      display: block;
    }
    .brand-name {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.12em;
      color: var(--brand-deep);
      line-height: 1;
    }
    .brand-sub {
      margin-top: 3px;
      font-size: 8px;
      color: var(--muted);
      font-weight: 500;
      letter-spacing: 0.01em;
    }
    .doc {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid rgba(212,175,55,.25);
      background: rgba(212,175,55,.1);
      color: var(--brand-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .doc svg { width: 14px; height: 14px; }
    .title-block {
      margin-top: 12px;
      padding: 9px 0;
      border-top: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
      text-align: center;
    }
    .title {
      font-size: 16px;
      font-weight: 900;
      color: var(--brand-deep);
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .ref {
      margin-top: 4px;
      font-size: 8.5px;
      color: var(--muted);
      font-weight: 500;
      letter-spacing: 0.04em;
    }
    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 12px 12px 0;
      min-height: 0;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
    }
    .row {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 46px;
      padding: 11px 11px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .row:last-child { border-bottom: 0; }
    .key {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
      background: #fff;
      padding-inline-end: 8px;
    }
    .icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(212,175,55,.1);
      color: var(--brand-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid rgba(212,175,55,.2);
    }
    .icon svg { width: 14px; height: 14px; }
    .label {
      font-size: 10.5px;
      color: #334155;
      font-weight: 650;
      white-space: nowrap;
    }
    .value {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.4;
      pointer-events: none;
    }
    .value > span {
      max-width: 58%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }
    .value.amount {
      color: var(--brand-soft);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
    .value .sep { color: #cbd5e1; margin: 0 3px; }
    .value .tm {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      display: inline-block;
    }
    .note {
      margin-top: auto;
      padding: 10px 4px 9px;
      text-align: center;
      font-size: 7.5px;
      line-height: 1.55;
      color: var(--muted);
    }
    .contact {
      margin-top: auto;
      background: var(--brand-deep);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 12px;
      font-size: 8.5px;
      font-weight: 650;
      flex-shrink: 0;
    }
    .contact span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .contact svg {
      width: 10px;
      height: 10px;
      opacity: 0.85;
    }
    @media print {
      body, .page { background: #fff !important; }
      .page {
        min-height: auto;
        padding: 0;
        display: block;
      }
      .sheet {
        width: 105mm;
        height: 148mm;
        margin: 0;
        border: 0;
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="sheet${compact ? ' compact' : ''}" data-payment-id="${esc(receipt.payment.id || '')}" data-payment-number="${esc(paymentNo)}">
      <div class="accent" aria-hidden="true"></div>
      <header class="header">
        <div class="header-top">
          <div>
            <div class="brand-row">
              <div class="brand-name">APEX SMART</div>
            </div>
            <div class="brand-sub">سیستم مدیریت مشتریان و پروژه‌ها</div>
          </div>
          <div class="doc" aria-hidden="true">${ICONS.receipt}</div>
        </div>
        <div class="title-block">
          <h1 class="title">رسید پرداخت</h1>
          ${refHtml}
        </div>
      </header>

      <div class="body">
        <div class="card">${rows}</div>
        <p class="note">این رسید به‌عنوان تأیید پرداخت صادر گردیده است.</p>
      </div>

      <div class="contact">
        <span>
          ${ICONS.globe}
          www.apex.com
        </span>
        <span>
          ${ICONS.phone}
          0700123456
        </span>
      </div>
    </div>
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
