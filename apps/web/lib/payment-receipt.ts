"use client";

/**
 * Payment receipt print / PDF helpers.
 * Reuses the API HTML receipt (same branding as on-screen preview).
 */
import { api, apiGet } from "@/lib/api";
import type { PaymentReceipt } from "@/app/(dashboard)/crm/_components/payment-types";

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

function sanitizeFilenamePart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function receiptPdfFilename(paymentNumber?: string | null, paymentId?: string) {
  const part =
    sanitizeFilenamePart(paymentNumber || "") ||
    sanitizeFilenamePart(paymentId || "") ||
    "receipt";
  return `Payment-Receipt-${part}.pdf`;
}

/**
 * Open a dedicated print-only window and trigger the browser print dialog.
 * Does not download a file.
 */
export async function printPaymentReceipt(paymentId: string) {
  const html = await fetchReceiptHtml(paymentId, true);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "apex-payment-receipt-print", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("پنجره چاپ مسدود شد. لطفاً pop-up را مجاز کنید.");
  }
  // Keep blob alive long enough for print rendering
  const revoke = () => URL.revokeObjectURL(url);
  win.addEventListener("afterprint", revoke, { once: true });
  setTimeout(revoke, 120_000);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderReceiptSheet(html: string): Promise<{
  canvas: HTMLCanvasElement;
  cleanup: () => void;
}> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:120mm;height:auto;overflow:visible;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(host);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "receipt-pdf-render");
  iframe.style.cssText = "width:120mm;height:170mm;border:0;background:#fff;";
  host.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    host.remove();
    throw new Error("رندر رسید برای PDF ناموفق بود");
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for iframe document + fonts/layout
  await wait(80);
  if (doc.fonts?.ready) {
    try {
      await doc.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  await wait(120);

  const sheet = doc.querySelector(".sheet") as HTMLElement | null;
  if (!sheet) {
    host.remove();
    throw new Error("قالب رسید یافت نشد");
  }

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

/**
 * Generate an A6 PDF of the payment receipt and download it in-place
 * (no new tab / navigation).
 */
export async function downloadPaymentReceiptPdf(paymentId: string) {
  const [receipt, html] = await Promise.all([
    apiGet<PaymentReceipt>(`/crm/payments/${paymentId}/receipt`),
    fetchReceiptHtml(paymentId, false),
  ]);

  const filename = receiptPdfFilename(
    receipt.payment.paymentNumber,
    receipt.payment.id || paymentId,
  );

  const { canvas, cleanup } = await renderReceiptSheet(html);
  try {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [105, 148],
      compress: true,
    });

    const img = canvas.toDataURL("image/png");
    pdf.addImage(img, "PNG", 0, 0, 105, 148, undefined, "FAST");
    pdf.save(filename);
  } finally {
    cleanup();
  }

  return { filename, receipt };
}
