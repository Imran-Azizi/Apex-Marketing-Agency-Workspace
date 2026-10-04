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
  "img",
  "video",
  "source",
  "figure",
  "figcaption",
];

const MEDIA_TAG_RE = /<(img|video|source)\b/i;

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
      img: ["src", "alt", "title", "width", "height", "class", "loading", "decoding"],
      video: [
        "src",
        "poster",
        "controls",
        "playsinline",
        "preload",
        "muted",
        "loop",
        "width",
        "height",
        "class",
      ],
      source: ["src", "type"],
      figure: ["class"],
      figcaption: ["class"],
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
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: attribs.loading || "lazy",
          decoding: attribs.decoding || "async",
          class: attribs.class || "rich-text-image",
        },
      }),
      video: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          controls: "controls",
          playsinline: "playsinline",
          preload: attribs.preload || "metadata",
          class: attribs.class || "rich-text-video",
        },
      }),
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https"],
      video: ["http", "https"],
      source: ["http", "https"],
    },
  }).trim();

  if (!clean) return null;
  const hasText = clean.replace(/<[^>]+>/g, "").trim().length > 0;
  const hasMedia = MEDIA_TAG_RE.test(clean);
  if (!hasText && !hasMedia) return null;
  return clean.length > 200_000 ? clean.slice(0, 200_000) : clean;
}
