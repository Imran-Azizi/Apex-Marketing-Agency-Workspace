import path from "path";
import { AppError } from "../../utils/response.js";
import { storage } from "../../services/storage.js";

function pipeFileStream(stream, res) {
  stream.on("error", (err) => {
    console.error("[chat/attachment] stream error:", err?.message || err);
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
 * Stream a chat attachment after ACL checks (supports Range for audio/video).
 */
export async function streamChatAttachment(req, res, attachment) {
  const storageKey = attachment.storageKey;
  if (!storageKey) {
    throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
  }

  const head = await storage.head(storageKey);
  const fileSize = head.size;
  const range = req.headers.range;
  const inferredExt = String(storageKey || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  const inferredMime =
    inferredExt === "webm"
      ? "audio/webm"
      : inferredExt === "ogg"
        ? "audio/ogg"
        : inferredExt === "mp3"
          ? "audio/mpeg"
          : inferredExt === "wav"
            ? "audio/wav"
            : inferredExt === "pdf"
              ? "application/pdf"
              : inferredExt === "png"
                ? "image/png"
                : inferredExt === "jpg" || inferredExt === "jpeg"
                  ? "image/jpeg"
                  : null;

  const contentType =
    attachment.mimeType ||
    (head.contentType && head.contentType !== "application/octet-stream"
      ? head.contentType
      : null) ||
    inferredMime ||
    head.contentType ||
    "application/octet-stream";

  const isAv =
    String(contentType).startsWith("video/") ||
    String(contentType).startsWith("audio/") ||
    head.resourceType === "video";

  if (isAv && storage.isCloudinary?.()) {
    try {
      const url = await storage.createPresignedGetUrl(storageKey);
      if (url) {
        res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
        res.redirect(302, url);
        return;
      }
    } catch (err) {
      console.warn(
        "[chat/attachment] CDN redirect failed, proxying:",
        err?.message || err,
      );
    }
  }

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(
      attachment.fileName || path.basename(storageKey) || "file",
    )}`,
  );

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start >= fileSize
    ) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    const chunkEnd = Math.min(end, fileSize - 1);
    const { stream, contentLength, contentRange } =
      await storage.openReadStream(storageKey, {
        start,
        end: chunkEnd,
      });
    res.status(206);
    res.setHeader(
      "Content-Range",
      contentRange || `bytes ${start}-${chunkEnd}/${fileSize}`,
    );
    res.setHeader("Content-Length", contentLength ?? chunkEnd - start + 1);
    pipeFileStream(stream, res);
    return;
  }

  const { stream, contentLength } = await storage.openReadStream(storageKey);
  res.setHeader("Content-Length", contentLength ?? fileSize ?? attachment.sizeBytes);
  pipeFileStream(stream, res);
}
