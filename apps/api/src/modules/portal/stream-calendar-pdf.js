import path from "path";
import { storage } from "../../services/storage.js";

function pipeFileStream(stream, res) {
  stream.on("error", (err) => {
    console.error("[portal/calendar-pdf] stream error:", err?.message || err);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: { code: "STREAM_FAILED", message: "خواندن فایل ناموفق بود" },
      });
      return;
    }
    res.destroy(err);
  });
  res.on("close", () => {
    if (!stream.destroyed) stream.destroy();
  });
  stream.pipe(res);
}

/**
 * Stream a shared content-calendar PDF to the portal customer (same-origin API).
 * Avoids browser CORS failures against the public CDN hostname.
 */
export async function streamPortalCalendarPdf(req, res, pdf) {
  const storageKey = pdf.storageKey;
  const head = await storage.head(storageKey);
  const fileSize = head.size;
  const contentType =
    (head.contentType && head.contentType !== "application/octet-stream"
      ? head.contentType
      : null) || "application/pdf";
  const downloadName =
    (typeof pdf.name === "string" && pdf.name.trim()) ||
    path.basename(storageKey) ||
    "calendar.pdf";

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  );

  const { stream, contentLength } = await storage.openReadStream(storageKey);
  const length = contentLength ?? fileSize ?? pdf.sizeBytes;
  if (length != null && Number.isFinite(Number(length))) {
    res.setHeader("Content-Length", Number(length));
  }
  pipeFileStream(stream, res);
}
