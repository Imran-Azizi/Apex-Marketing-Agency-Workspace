"use client";

/**
 * CRM invoice print / PDF helpers.
 * Uses the dedicated A4 HTML document from the API (not a dashboard screenshot).
 */
import { api } from "@/lib/api";

async function fetchInvoiceHtml(invoiceId: string, autoprint = false) {
  const { data } = await api.get<string>(
    `/crm/invoices/${invoiceId}/document.html${autoprint ? "?autoprint=1" : ""}`,
    {
      responseType: "text",
      transformResponse: [(raw) => raw],
      headers: { Accept: "text/html" },
    },
  );
  return typeof data === "string" ? data : String(data);
}

function sanitizeFilenamePart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function invoicePdfFilename(invoiceNumber?: string | null, invoiceId?: string) {
  const part =
    sanitizeFilenamePart(invoiceNumber || "") ||
    sanitizeFilenamePart(invoiceId || "") ||
    "invoice";
  return `APEX-Invoice-${part}.pdf`;
}

export async function printCrmInvoice(invoiceId: string) {
  let html = await fetchInvoiceHtml(invoiceId, false);
  html = html.replace(
    "if (params.get('autoprint') === '1')",
    "if (true)",
  );
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "apex-crm-invoice-print", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("پنجره چاپ مسدود شد. لطفاً pop-up را مجاز کنید.");
  }
  const revoke = () => URL.revokeObjectURL(url);
  win.addEventListener("afterprint", revoke, { once: true });
  setTimeout(revoke, 120_000);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderInvoiceSheet(html: string) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:120mm;height:auto;overflow:visible;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(host);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "invoice-pdf-render");
  iframe.style.cssText = "width:120mm;height:180mm;border:0;background:#fff;";
  host.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    host.remove();
    throw new Error("رندر فاکتور برای PDF ناموفق بود");
  }

  doc.open();
  doc.write(html);
  doc.close();

  await wait(120);
  if (doc.fonts?.ready) {
    try {
      await doc.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  await wait(180);

  const sheet =
    (doc.querySelector(".invoice-sheet") as HTMLElement | null) ||
    (doc.querySelector(".receipt-sheet") as HTMLElement | null);
  if (!sheet) {
    host.remove();
    throw new Error("قالب فاکتور یافت نشد");
  }

  iframe.style.height = `${Math.max(sheet.scrollHeight + 24, 640)}px`;
  await wait(80);

  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(sheet, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: sheet.scrollWidth,
    windowHeight: sheet.scrollHeight,
  });

  return {
    canvas,
    cleanup: () => {
      try {
        host.remove();
      } catch {
        /* ignore */
      }
    },
  };
}

async function canvasToInvoicePdf(canvas: HTMLCanvasElement) {
  const { jsPDF } = await import("jspdf");
  const pdfW = 105;
  const pdfH = Math.max(
    148,
    Math.min(220, (canvas.height * pdfW) / canvas.width),
  );
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pdfW, pdfH],
    compress: true,
  });
  const img = canvas.toDataURL("image/png");
  pdf.addImage(img, "PNG", 0, 0, pdfW, pdfH, undefined, "FAST");
  return pdf;
}

export async function buildCrmInvoicePdfBlob(invoiceId: string) {
  const html = await fetchInvoiceHtml(invoiceId, false);
  const { canvas, cleanup } = await renderInvoiceSheet(html);
  try {
    const pdf = await canvasToInvoicePdf(canvas);
    return pdf.output("blob") as Blob;
  } finally {
    cleanup();
  }
}

export async function downloadCrmInvoicePdf(
  invoiceId: string,
  invoiceNumber?: string | null,
) {
  const html = await fetchInvoiceHtml(invoiceId, false);
  const filename = invoicePdfFilename(invoiceNumber, invoiceId);
  const { canvas, cleanup } = await renderInvoiceSheet(html);
  try {
    const pdf = await canvasToInvoicePdf(canvas);
    pdf.save(filename);
  } finally {
    cleanup();
  }
  return { filename };
}
