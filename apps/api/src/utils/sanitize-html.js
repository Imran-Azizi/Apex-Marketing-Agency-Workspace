import sanitizeHtml from "sanitize-html";

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
];

/**
 * Sanitize service (and similar) rich-text HTML.
 * Plain-text legacy values are returned unchanged (trimmed).
 */
export function sanitizeRichTextHtml(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (!looksLikeHtml) {
    return raw.length > 200_000 ? raw.slice(0, 200_000) : raw;
  }

  const clean = sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style", "class"],
      p: ["style", "class"],
      h1: ["style", "class"],
      h2: ["style", "class"],
      h3: ["style", "class"],
      h4: ["style", "class"],
      li: ["style", "class"],
      blockquote: ["style", "class"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
      }),
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
  }).trim();

  if (!clean || !clean.replace(/<[^>]+>/g, "").trim()) return null;
  return clean.length > 200_000 ? clean.slice(0, 200_000) : clean;
}
