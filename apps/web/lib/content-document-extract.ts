/**
 * Extract plain text from content-import documents (txt / docx / pdf / doc)
 * without extra npm dependencies — used by Scenario / Narration / Storyboard upload.
 */

const DOC_EXT = new Set([".doc", ".docx", ".pdf", ".txt"]);
const LEGACY_TEXT_EXT = new Set([".md", ".markdown", ".csv", ".json"]);

const DOC_MIME = new Set([
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word",
  "application/octet-stream",
]);

export const CONTENT_DOCUMENT_ACCEPT =
  ".txt,.doc,.docx,.pdf,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const CONTENT_DOCUMENT_ACCEPT_WITH_JSON =
  `${CONTENT_DOCUMENT_ACCEPT},.md,.markdown,.json,text/markdown,application/json`;

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function getContentDocumentKind(
  file: File,
): "txt" | "docx" | "doc" | "pdf" | "json" | "markdown" | "unsupported" {
  const ext = fileExt(file.name);
  const mime = String(file.type || "").toLowerCase();

  if (ext === ".txt" || mime === "text/plain") return "txt";
  if (ext === ".docx" || mime.includes("wordprocessingml")) return "docx";
  if (ext === ".doc" || mime === "application/msword") return "doc";
  if (ext === ".pdf" || mime === "application/pdf") return "pdf";
  if (ext === ".json" || mime === "application/json") return "json";
  if (ext === ".md" || ext === ".markdown" || mime === "text/markdown") {
    return "markdown";
  }
  return "unsupported";
}

export function isSupportedContentDocumentFile(file: File): boolean {
  const kind = getContentDocumentKind(file);
  if (kind === "unsupported") return false;
  if (kind === "json" || kind === "markdown") return true;
  return DOC_EXT.has(fileExt(file.name)) || DOC_MIME.has(String(file.type || "").toLowerCase());
}

export function assertSupportedContentDocumentFile(file: File): void {
  if (isSupportedContentDocumentFile(file)) return;
  throw new Error(
    "فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل TXT، DOC، DOCX یا PDF انتخاب کنید.",
  );
}

async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export async function readFileAsUtf8Text(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود"));
    reader.readAsText(file, "UTF-8");
  });
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("مرورگر از استخراج فایل فشرده پشتیبانی نمی‌کند.");
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("مرورگر از استخراج فایل فشرده پشتیبانی نمی‌کند.");
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy]).stream().pipeThrough(
    new DecompressionStream("deflate"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(
  buffer: ArrayBuffer,
  entryName: string,
): Promise<Uint8Array | null> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;

  while (offset + 30 < bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compression = view.getUint16(offset + 8, true);
    let compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
    const filename = new TextDecoder("utf-8").decode(nameBytes);
    const dataStart = offset + 30 + nameLen + extraLen;

    // Data descriptor (sizes unknown in local header)
    if (compSize === 0 && (view.getUint16(offset + 6, true) & 0x08) !== 0) {
      // Fall through to central directory scan below by continuing search —
      // for Word-exported docx, sizes are normally present.
      offset = dataStart;
      continue;
    }

    const data = bytes.subarray(dataStart, dataStart + compSize);
    if (filename === entryName || filename.endsWith("/" + entryName)) {
      if (compression === 0) return data;
      if (compression === 8) return inflateRaw(data);
      throw new Error("فشرده‌سازی این فایل Word پشتیبانی نمی‌شود.");
    }
    offset = dataStart + Math.max(compSize, 1);
  }

  // Central directory fallback for data-descriptor zips
  const cdSig = 0x02014b50;
  for (let i = 0; i + 46 < bytes.length; i++) {
    if (view.getUint32(i, true) !== cdSig) continue;
    const compression = view.getUint16(i + 10, true);
    const compSize = view.getUint32(i + 20, true);
    const nameLen = view.getUint16(i + 28, true);
    const extraLen = view.getUint16(i + 30, true);
    const commentLen = view.getUint16(i + 32, true);
    const localOffset = view.getUint32(i + 42, true);
    const nameBytes = bytes.subarray(i + 46, i + 46 + nameLen);
    const filename = new TextDecoder("utf-8").decode(nameBytes);
    if (filename !== entryName && !filename.endsWith("/" + entryName)) {
      i += 45 + nameLen + extraLen + commentLen;
      continue;
    }
    if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = bytes.subarray(dataStart, dataStart + compSize);
    if (compression === 0) return data;
    if (compression === 8) return inflateRaw(data);
    throw new Error("فشرده‌سازی این فایل Word پشتیبانی نمی‌شود.");
  }

  return null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function docxXmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<w:tab\b[^/]*\/>/gi, "\t")
    .replace(/<w:br\b[^/]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<w:p\b[^>]*>/gi, "")
    .replace(/<w:t\b[^>]*>/gi, "")
    .replace(/<\/w:t>/gi, "");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeXmlEntities(stripped)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocxText(file: File): Promise<string> {
  const buffer = await readAsArrayBuffer(file);
  const entry = await readZipEntry(buffer, "word/document.xml");
  if (!entry) {
    throw new Error("ساختار فایل DOCX نامعتبر است.");
  }
  const xml = new TextDecoder("utf-8").decode(entry);
  const text = docxXmlToText(xml);
  if (!text.trim()) {
    throw new Error("متن قابل استخراج در فایل DOCX یافت نشد.");
  }
  return text;
}

function extractPdfLiteralStrings(payload: string): string {
  const out: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(payload))) {
    let raw = match[0].slice(1, -1);
    raw = raw
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/\\(\d{1,3})/g, (_, oct) =>
        String.fromCharCode(parseInt(oct, 8)),
      );
    if (raw.trim()) out.push(raw);
  }

  const hexRe = /<([0-9A-Fa-f\s]+)>/g;
  while ((match = hexRe.exec(payload))) {
    const hex = match[1].replace(/\s+/g, "");
    if (hex.length < 4 || hex.length % 2 !== 0) continue;
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    // Prefer UTF-16BE when BOM or high bytes suggest it
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      let s = "";
      for (let i = 2; i + 1 < bytes.length; i += 2) {
        s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
      }
      if (s.trim()) out.push(s);
    } else if (bytes.every((b, i) => i % 2 === 0 && b === 0)) {
      let s = "";
      for (let i = 1; i < bytes.length; i += 2) s += String.fromCharCode(bytes[i]);
      if (s.trim()) out.push(s);
    } else {
      const s = new TextDecoder("utf-8", { fatal: false }).decode(
        new Uint8Array(bytes),
      );
      if (s.trim()) out.push(s);
    }
  }

  return out.join("");
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await readAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  const asLatin1 = Array.from(bytes, (b) => String.fromCharCode(b)).join("");

  if (!asLatin1.startsWith("%PDF")) {
    throw new Error("فایل PDF نامعتبر است.");
  }

  const chunks: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRe.exec(asLatin1))) {
    const headerSlice = asLatin1.slice(
      Math.max(0, match.index - 220),
      match.index,
    );
    const rawStream = match[1];
    // Convert latin1 string back to bytes
    const streamBytes = new Uint8Array(rawStream.length);
    for (let i = 0; i < rawStream.length; i++) {
      streamBytes[i] = rawStream.charCodeAt(i) & 0xff;
    }

    let payload = rawStream;
    if (/\/Filter\s*\/FlateDecode/i.test(headerSlice)) {
      try {
        const inflated = await inflateZlib(streamBytes);
        payload = new TextDecoder("latin1").decode(inflated);
      } catch {
        try {
          const inflated = await inflateRaw(streamBytes);
          payload = new TextDecoder("latin1").decode(inflated);
        } catch {
          continue;
        }
      }
    }

    if (!/BT[\s\S]*?ET/.test(payload) && !/\(/.test(payload)) continue;
    const piece = extractPdfLiteralStrings(payload);
    if (piece.trim()) chunks.push(piece);
  }

  // Also scan uncompressed page content in the whole file for simple PDFs
  if (!chunks.length) {
    const direct = extractPdfLiteralStrings(asLatin1);
    if (direct.trim()) chunks.push(direct);
  }

  const text = chunks
    .join("\n")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    throw new Error(
      "استخراج متن از این PDF ممکن نشد. فایل را به صورت TXT یا DOCX ذخیره کنید و دوباره تلاش کنید.",
    );
  }
  return text;
}

/**
 * Heuristic extraction for legacy binary .doc (OLE) files.
 * Works for many Word docs that store body text as UTF-16LE runs.
 */
function extractDocBinaryText(buffer: ArrayBuffer): string {
  const view = new DataView(buffer);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const cleaned = current.replace(/\0/g, "").trim();
    if (cleaned.length >= 12) chunks.push(cleaned);
    current = "";
  };

  for (let i = 0; i + 1 < view.byteLength; i += 2) {
    const code = view.getUint16(i, true);
    if (code === 0x000d || code === 0x000a || code === 0x000b) {
      current += "\n";
      continue;
    }
    if (code === 0x0009) {
      current += "\t";
      continue;
    }
    // Printable BMP including Arabic/Persian ranges
    const printable =
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0x0600 && code <= 0x06ff) ||
      (code >= 0x0750 && code <= 0x077f) ||
      (code >= 0x08a0 && code <= 0x08ff) ||
      (code >= 0xfb50 && code <= 0xfdff) ||
      (code >= 0xfe70 && code <= 0xfeff) ||
      (code >= 0x00a0 && code <= 0x024f);
    if (printable) {
      current += String.fromCharCode(code);
    } else {
      flush();
    }
  }
  flush();

  // Prefer the longest coherent chunk (usually the body)
  chunks.sort((a, b) => b.length - a.length);
  const text = (chunks[0] || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

async function extractDocText(file: File): Promise<string> {
  const buffer = await readAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  // OLE compound file signature: D0 CF 11 E0 A1 B1 1A E1
  const isOle =
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;

  if (!isOle) {
    // Some .doc downloads are actually docx/rtf mislabeled
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return extractDocxText(file);
    }
    const asText = await readFileAsUtf8Text(file);
    if (asText.trim().length >= 12) return asText;
  }

  const text = extractDocBinaryText(buffer);
  if (!text.trim()) {
    throw new Error(
      "استخراج متن از این فایل DOC ممکن نشد. لطفاً آن را به DOCX، PDF یا TXT ذخیره کنید.",
    );
  }
  return text;
}

/**
 * Extract exact document text for manual content import.
 * Line breaks are preserved as closely as the format allows.
 */
export async function extractContentDocumentText(file: File): Promise<string> {
  assertSupportedContentDocumentFile(file);
  const kind = getContentDocumentKind(file);

  if (kind === "txt" || kind === "markdown" || kind === "json") {
    const text = await readFileAsUtf8Text(file);
    if (!text.trim()) throw new Error("فایل خالی است.");
    return text;
  }
  if (kind === "docx") return extractDocxText(file);
  if (kind === "pdf") return extractPdfText(file);
  if (kind === "doc") return extractDocText(file);

  throw new Error(
    "فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل TXT، DOC، DOCX یا PDF انتخاب کنید.",
  );
}

export function isLegacyTextExtAllowed(name: string): boolean {
  return LEGACY_TEXT_EXT.has(fileExt(name));
}
