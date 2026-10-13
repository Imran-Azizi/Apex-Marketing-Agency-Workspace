"use client";

/**
 * Renders a content calendar to an A4 PDF in the browser.
 * Pages are drawn as HTML then rasterised so Dari/Pashto text shapes correctly.
 */
import type { CalendarRow, ContentCalendar } from "@/lib/contract-workspace";
import { formatDate } from "@/lib/utils";

export type CalendarPdfContext = {
  contractTitle: string;
  contractCode?: string | null;
  customerName?: string | null;
};

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const FIRST_PAGE_ROWS = 15;
const NEXT_PAGE_ROWS = 20;
const BRAND = "#D4AF35";
const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const HIGHLIGHT_TYPES = new Set(["ریلز", "ویدیو", "استوری"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paginate(rows: CalendarRow[]): CalendarRow[][] {
  const pages: CalendarRow[][] = [rows.slice(0, FIRST_PAGE_ROWS)];
  for (let start = FIRST_PAGE_ROWS; start < rows.length; start += NEXT_PAGE_ROWS) {
    pages.push(rows.slice(start, start + NEXT_PAGE_ROWS));
  }
  return pages;
}

function publishRange(rows: CalendarRow[]): string | null {
  const dates = rows
    .map((row) => row.publishDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (!dates.length) return null;
  const first = formatDate(dates[0]);
  const last = formatDate(dates[dates.length - 1]);
  return first === last ? first : `${first} تا ${last}`;
}

function infoItem(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<div style="min-width:0">
    <div style="font-size:11px;color:${MUTED};margin-bottom:3px">${escapeHtml(label)}</div>
    <div style="font-size:13px;font-weight:700;color:${INK};word-break:break-word">${escapeHtml(value)}</div>
  </div>`;
}

function headerHtml(
  calendar: ContentCalendar,
  context: CalendarPdfContext,
  compact: boolean,
): string {
  const issued = formatDate(new Date());
  if (compact) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid ${BRAND};margin-bottom:18px">
      <div style="font-size:16px;font-weight:800;color:${INK}">${escapeHtml(calendar.title)}</div>
      <div style="font-size:11px;color:${MUTED}">${escapeHtml(context.contractTitle)}</div>
    </div>`;
  }
  const range = publishRange(calendar.rows);
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:3px solid ${BRAND}">
      <div style="min-width:0">
        <div style="font-size:12px;font-weight:700;color:${BRAND};margin-bottom:6px">تقویم محتوایی</div>
        <div style="font-size:24px;font-weight:800;color:${INK};line-height:1.4;word-break:break-word">${escapeHtml(calendar.title)}</div>
      </div>
      <img data-pdf-logo src="/brand/apex-logo.png" alt="" style="height:52px;width:auto;object-fit:contain;flex-shrink:0" />
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 20px;margin:18px 0 22px;padding:16px 18px;border:1px solid ${LINE};border-radius:12px;background:#FAFAF7">
      ${infoItem("قرارداد", context.contractTitle)}
      ${infoItem("مشتری", context.customerName)}
      ${infoItem("کد قرارداد", context.contractCode)}
      ${infoItem("تعداد محتوا", String(calendar.rows.length))}
      ${infoItem("بازه نشر", range)}
      ${infoItem("تاریخ صدور", issued)}
    </div>`;
}

function tableHtml(rows: CalendarRow[], offset: number): string {
  const head = ["شماره", "موضوع", "نوعیت محتوا", "زبان", "تاریخ نشر"]
    .map(
      (label, index) =>
        `<th style="padding:11px 10px;font-size:12px;font-weight:700;color:#fff;text-align:${index === 0 ? "center" : "right"};${index === 0 ? "width:56px;" : ""}${index >= 2 ? "width:112px;" : ""}">${label}</th>`,
    )
    .join("");
  const body = rows
    .map((row, index) => {
      const highlight = HIGHLIGHT_TYPES.has(row.contentType);
      // html2canvas draws glyphs a few px below the DOM line box; the extra bottom padding re-centres them.
      const chip = `<span style="display:inline-block;box-sizing:border-box;height:24px;line-height:17px;padding:0 10px 6px;border-radius:999px;font-size:11px;font-weight:700;vertical-align:middle;${
        highlight
          ? "background:#FEF3C7;color:#92400E;border:1px solid #FCD34D"
          : `background:#F3F4F6;color:${INK};border:1px solid ${LINE}`
      }">${escapeHtml(row.contentType)}</span>`;
      return `<tr style="background:${index % 2 ? "#FAFAFA" : "#FFFFFF"};border-bottom:1px solid ${LINE}">
        <td style="padding:10px;text-align:center;font-size:12px;font-weight:700;color:${MUTED}">${offset + index + 1}</td>
        <td style="padding:10px;font-size:13px;font-weight:600;color:${INK};line-height:1.6;word-break:break-word">${escapeHtml(row.topic)}</td>
        <td style="padding:10px">${chip}</td>
        <td style="padding:10px;font-size:12px;color:${INK}">${escapeHtml(row.language)}</td>
        <td style="padding:10px;font-size:12px;color:${INK};white-space:nowrap">${row.publishDate ? escapeHtml(formatDate(row.publishDate)) : "—"}</td>
      </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;border:1px solid ${LINE};border-radius:10px;overflow:hidden">
    <thead><tr style="background:${INK}">${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function footerHtml(page: number, total: number): string {
  return `<div style="position:absolute;left:48px;right:48px;bottom:32px;display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid ${LINE};font-size:11px;color:${MUTED}">
    <span>APEX Smart Marketing</span>
    <span>صفحه ${page} از ${total}</span>
  </div>`;
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => {
              img.remove();
              resolve();
            }, { once: true });
          }),
    ),
  ).then(() => undefined);
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function calendarPdfFilename(calendar: ContentCalendar, contractCode?: string | null): string {
  const code = sanitizeFilenamePart(contractCode || "") || "contract";
  return `APEX-Content-Calendar-${code}-${calendar.id.slice(-6)}.pdf`;
}

/** Rasterises each A4 page of the calendar (shared by the PDF builder). */
export async function renderCalendarPages(
  calendar: ContentCalendar,
  context: CalendarPdfContext,
): Promise<HTMLCanvasElement[]> {
  const pages = paginate(calendar.rows);
  const fontFamily = getComputedStyle(document.body).fontFamily || "Tahoma, sans-serif";

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-20000px;top:0;pointer-events:none;z-index:-1;";
  host.innerHTML = pages
    .map((rows, index) => {
      const offset = index === 0 ? 0 : FIRST_PAGE_ROWS + (index - 1) * NEXT_PAGE_ROWS;
      return `<div data-pdf-page dir="rtl" style="position:relative;box-sizing:border-box;width:${PAGE_WIDTH}px;min-height:${PAGE_HEIGHT}px;padding:44px 48px 90px;background:#fff;color:${INK};font-family:${fontFamily};text-align:right">
        ${headerHtml(calendar, context, index > 0)}
        ${tableHtml(rows, offset)}
        ${footerHtml(index + 1, pages.length)}
      </div>`;
    })
    .join("");
  document.body.appendChild(host);

  try {
    await waitForImages(host);
    if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined);

    const { default: html2canvas } = await import("html2canvas");
    const canvases: HTMLCanvasElement[] = [];
    for (const sheet of Array.from(host.querySelectorAll<HTMLElement>("[data-pdf-page]"))) {
      canvases.push(
        await html2canvas(sheet, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: sheet.scrollWidth,
          windowHeight: sheet.scrollHeight,
        }),
      );
    }
    return canvases;
  } finally {
    host.remove();
  }
}

export async function buildCalendarPdf(
  calendar: ContentCalendar,
  context: CalendarPdfContext,
): Promise<File> {
  const [canvases, { jsPDF }] = await Promise.all([
    renderCalendarPages(calendar, context),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  canvases.forEach((canvas, index) => {
    // Pages that grew past A4 (very long topics) are scaled down to fit.
    const ratio = canvas.height / canvas.width;
    const height = Math.min(pageHeightMm, pageWidthMm * ratio);
    const width = height / ratio;
    if (index > 0) pdf.addPage();
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      (pageWidthMm - width) / 2,
      0,
      width,
      height,
      undefined,
      "FAST",
    );
  });

  const blob = pdf.output("blob") as Blob;
  return new File([blob], calendarPdfFilename(calendar, context.contractCode), {
    type: "application/pdf",
  });
}

export function downloadFile(file: File | Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
