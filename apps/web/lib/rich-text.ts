import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "span",
  "img",
  "video",
  "source",
  "figure",
  "figcaption",
];

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "class",
  "style",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "controls",
  "playsinline",
  "preload",
  "poster",
  "muted",
  "loop",
  "loading",
  "decoding",
];

const MEDIA_TAG_RE = /<(img|video|source)\b/i;

/** True when the string looks like stored HTML (not legacy plain text). */
export function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** True when HTML contains embeddable media nodes. */
export function richTextHasMedia(value: string | null | undefined): boolean {
  if (!value) return false;
  return MEDIA_TAG_RE.test(value);
}

/** Strip tags for excerpts, SEO meta, and admin list previews. */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|figure)>/gi, "\n")
    .replace(/<(img|video)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Sanitize HTML before rendering. Plain text is escaped into a paragraph. */
export function sanitizeRichText(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (!looksLikeHtml(trimmed)) {
    const escaped = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
  }

  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/** Empty TipTap docs like `<p></p>` should save as null — but media-only is valid. */
export function isEmptyRichText(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  if (richTextHasMedia(value)) return false;
  return !stripHtml(value).trim();
}
