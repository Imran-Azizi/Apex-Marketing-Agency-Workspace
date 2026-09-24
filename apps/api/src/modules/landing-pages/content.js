import crypto from "crypto";

export const LANDING_CONTENT_VERSION = 1;

export const ELEMENT_TYPES = Object.freeze([
  "heading",
  "paragraph",
  "text",
  "image",
  "video",
  "audio",
  "button",
  "icon",
  "divider",
  "spacer",
  "columns",
  "link",
]);

export const SECTION_TYPES = Object.freeze([
  "content",
  "columns-2",
  "columns-3",
  "image-text",
  "video",
  "cta",
  "custom",
]);

export const RESERVED_SLUGS = Object.freeze([
  "",
  "api",
  "login",
  "portal",
  "dashboard",
  "manager",
  "crm",
  "crm-sales",
  "projects",
  "employees",
  "finance",
  "editor",
  "narrator",
  "project-manager",
  "catalog",
  "backup",
  "settings",
  "sales",
  "sales-assistant",
  "business-assistant",
  "services",
  "customers",
  "portfolio",
  "contact",
  "brand",
  "favicon.ico",
  "site.webmanifest",
  "narrators",
  "chat",
  "mixed",
  "landing-pages",
  "landingpage",
  "_next",
  "نمونه-کارها",
]);

const RESERVED_SET = new Set(RESERVED_SLUGS);

const ALIGN_VALUES = new Set(["right", "center", "left"]);
const OBJECT_FIT_VALUES = new Set(["cover", "contain", "fill", "none"]);
const ICON_NAMES = new Set([
  "Sparkles",
  "Star",
  "Heart",
  "Check",
  "CheckCircle2",
  "Phone",
  "Mail",
  "MapPin",
  "Play",
  "Pause",
  "ArrowLeft",
  "ArrowRight",
  "ChevronLeft",
  "ChevronRight",
  "Globe",
  "Users",
  "BriefcaseBusiness",
  "Camera",
  "Film",
  "Image",
  "Music",
  "Mic",
  "MessageCircle",
  "Send",
  "Shield",
  "Award",
  "Zap",
  "Target",
  "Clock",
  "Calendar",
  "Building2",
  "Handshake",
  "Quote",
  "CircleHelp",
  "Info",
  "ExternalLink",
]);

/** Legacy element types removed from the builder; strip or flatten on sanitize. */
const REMOVED_ELEMENT_TYPES = new Set(["html", "container"]);

export function newBlockId(prefix = "el") {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

export function slugify(input) {
  const raw = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return raw;
}

export function isReservedSlug(slug) {
  const value = String(slug || "")
    .trim()
    .toLowerCase();
  if (!value) return true;
  if (RESERVED_SET.has(value)) return true;
  if (value.startsWith("_")) return true;
  return false;
}

export function assertValidSlug(slug) {
  const value = slugify(slug);
  if (!value || value.length < 2) {
    return { ok: false, message: "نامک باید حداقل ۲ کاراکتر باشد" };
  }
  if (isReservedSlug(value)) {
    return { ok: false, message: "این نامک رزرو شده است و قابل استفاده نیست" };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(value)) {
    return { ok: false, message: "نامک فقط می‌تواند شامل حروف، عدد و خط تیره باشد" };
  }
  return { ok: true, slug: value };
}

export function defaultLandingContent(title = "") {
  return {
    version: LANDING_CONTENT_VERSION,
    hero: defaultHero(title),
    sections: [],
  };
}

export function defaultHero(title = "") {
  return {
    enabled: true,
    heading: String(title || "").trim(),
    description: "",
    backgroundImageKey: null,
    backgroundVideoKey: null,
    backgroundVideoPosterKey: null,
    ctaText: "",
    ctaUrl: "",
    ctaOpenInNewTab: false,
    textAlign: "center",
    overlay: true,
    overlayOpacity: 0.45,
    minHeight: "70vh",
    mobileMinHeight: "55vh",
  };
}

export function defaultSectionSettings() {
  return {
    backgroundColor: "",
    backgroundImageKey: null,
    width: "default",
    minHeight: "",
    paddingY: 64,
    paddingX: 24,
    marginY: 0,
    borderRadius: 0,
    align: "center",
  };
}

function clip(value, max, fallback = "") {
  const text = value == null ? fallback : String(value);
  return text.slice(0, max);
}

function asBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asAlign(value, fallback = "right") {
  const v = String(value || "").toLowerCase();
  return ALIGN_VALUES.has(v) ? v : fallback;
}

function sanitizeUrl(value, { allowRelative = true } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("#") && allowRelative) return raw.slice(0, 200);
  if (allowRelative && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw.slice(0, 500);
  }
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return "";
    return parsed.toString().slice(0, 500);
  } catch {
    return "";
  }
}

function sanitizeCssColor(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(raw)) {
    return raw;
  }
  return "";
}

function sanitizeStyles(raw = {}, extra = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    fontSize: asNumber(src.fontSize, extra.fontSize ?? 16, 10, 96),
    fontWeight: asNumber(src.fontWeight, extra.fontWeight ?? 400, 100, 900),
    fontFamily: clip(src.fontFamily, 80),
    color: sanitizeCssColor(src.color) || extra.color || "",
    align: asAlign(src.align, extra.align || "right"),
    lineHeight: asNumber(src.lineHeight, extra.lineHeight ?? 1.6, 0.8, 3),
    letterSpacing: asNumber(src.letterSpacing, 0, -2, 12),
    marginTop: asNumber(src.marginTop, 0, 0, 160),
    marginBottom: asNumber(src.marginBottom, extra.marginBottom ?? 12, 0, 160),
    padding: asNumber(src.padding, extra.padding ?? 0, 0, 80),
    width: clip(src.width, 20) || extra.width || "100%",
    hiddenOnMobile: asBool(src.hiddenOnMobile, false),
    hiddenOnDesktop: asBool(src.hiddenOnDesktop, false),
    backgroundColor: sanitizeCssColor(src.backgroundColor),
    borderColor: sanitizeCssColor(src.borderColor),
    borderWidth: asNumber(src.borderWidth, extra.borderWidth ?? 0, 0, 12),
    borderRadius: asNumber(src.borderRadius, extra.borderRadius ?? 0, 0, 80),
    objectFit: OBJECT_FIT_VALUES.has(src.objectFit) ? src.objectFit : extra.objectFit || "cover",
  };
}

function sanitizeElement(raw, depth = 0) {
  if (!raw || typeof raw !== "object" || depth > 6) return null;
  const type = ELEMENT_TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return null;
  const id = clip(raw.id, 80) || newBlockId(type);
  const contentIn = raw.content && typeof raw.content === "object" ? raw.content : {};
  const styles = sanitizeStyles(raw.styles, type === "heading" ? { fontSize: 32, fontWeight: 700 } : {});
  const content = {};

  if (type === "heading") {
    content.text = clip(contentIn.text, 200, "عنوان");
    content.level = asNumber(contentIn.level, 2, 1, 4);
  } else if (type === "paragraph" || type === "text") {
    content.text = clip(contentIn.text, 8000);
  } else if (type === "image") {
    content.imageKey = clip(contentIn.imageKey, 500) || null;
    content.imageUrl = sanitizeUrl(contentIn.imageUrl, { allowRelative: false }) || "";
    content.alt = clip(contentIn.alt, 160);
    content.linkUrl = sanitizeUrl(contentIn.linkUrl);
    content.linkNewTab = asBool(contentIn.linkNewTab, false);
    content.height = asNumber(contentIn.height, 0, 0, 1200);
  } else if (type === "video") {
    content.videoKey = clip(contentIn.videoKey, 500) || null;
    content.videoUrl = sanitizeUrl(contentIn.videoUrl, { allowRelative: false }) || "";
    content.posterKey = clip(contentIn.posterKey, 500) || null;
    content.autoplay = asBool(contentIn.autoplay, false);
    content.muted = asBool(contentIn.muted, content.autoplay);
    content.loop = asBool(contentIn.loop, false);
    content.controls = asBool(contentIn.controls, true);
  } else if (type === "audio") {
    content.audioKey = clip(contentIn.audioKey, 500) || null;
    content.audioUrl = sanitizeUrl(contentIn.audioUrl, { allowRelative: false }) || "";
    content.title = clip(contentIn.title, 120);
    content.autoplay = asBool(contentIn.autoplay, false);
    content.loop = asBool(contentIn.loop, false);
  } else if (type === "button" || type === "link") {
    content.text = clip(contentIn.text, 80, "دکمه");
    content.url = sanitizeUrl(contentIn.url) || "#contact";
    content.openInNewTab = asBool(contentIn.openInNewTab, false);
    content.variant = ["brand", "outline", "secondary"].includes(contentIn.variant)
      ? contentIn.variant
      : "brand";
  } else if (type === "icon") {
    const name = String(contentIn.name || "Sparkles");
    content.name = ICON_NAMES.has(name) ? name : "Sparkles";
    content.size = asNumber(contentIn.size, 32, 12, 96);
    content.url = sanitizeUrl(contentIn.url);
  } else if (type === "divider") {
    content.thickness = asNumber(contentIn.thickness, 1, 1, 8);
  } else if (type === "spacer") {
    content.height = asNumber(contentIn.height, 32, 8, 240);
  } else if (type === "columns") {
    content.count = asNumber(contentIn.count, 2, 2, 3);
  }

  const element = { id, type, content, styles };

  if (type === "columns") {
    const cols = Array.isArray(raw.columns) ? raw.columns : [[], []];
    const count = element.content.count;
    element.columns = Array.from({ length: count }, (_, i) => {
      const col = Array.isArray(cols[i]) ? cols[i] : [];
      return sanitizeElementList(col, depth + 1, 20);
    });
  }

  return element;
}

/**
 * Sanitize a list of elements. Legacy `html` is dropped; legacy `container`
 * children are promoted so existing pages keep nested content without crashing.
 */
function sanitizeElementList(list, depth = 0, max = 40) {
  if (!Array.isArray(list) || depth > 6) return [];
  const out = [];
  for (const raw of list) {
    if (out.length >= max) break;
    if (!raw || typeof raw !== "object") continue;
    if (REMOVED_ELEMENT_TYPES.has(raw.type)) {
      if (raw.type === "container") {
        const children = Array.isArray(raw.children) ? raw.children : [];
        for (const child of sanitizeElementList(children, depth + 1, max - out.length)) {
          if (out.length >= max) break;
          out.push(child);
        }
      }
      continue;
    }
    const el = sanitizeElement(raw, depth);
    if (el) out.push(el);
  }
  return out;
}

function sanitizeSection(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const type = SECTION_TYPES.includes(raw.type) ? raw.type : "content";
  const settingsIn = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const settings = {
    ...defaultSectionSettings(),
    backgroundColor: sanitizeCssColor(settingsIn.backgroundColor),
    backgroundImageKey: clip(settingsIn.backgroundImageKey, 500) || null,
    width: ["default", "wide", "full"].includes(settingsIn.width)
      ? settingsIn.width
      : "default",
    minHeight: clip(settingsIn.minHeight, 20),
    paddingY: asNumber(settingsIn.paddingY, 64, 0, 160),
    paddingX: asNumber(settingsIn.paddingX, 24, 0, 80),
    marginY: asNumber(settingsIn.marginY, 0, 0, 80),
    borderRadius: asNumber(settingsIn.borderRadius, 0, 0, 48),
    align: asAlign(settingsIn.align, "center"),
  };

  const section = {
    id: clip(raw.id, 80) || newBlockId("section"),
    type,
    settings,
    elements: [],
  };

  if (type === "columns-2" || type === "columns-3" || type === "image-text") {
    const count = type === "columns-3" ? 3 : 2;
    const cols = Array.isArray(raw.columns) ? raw.columns : [];
    section.columns = Array.from({ length: count }, (_, i) => {
      const col = Array.isArray(cols[i]) ? cols[i] : [];
      return sanitizeElementList(col, 0, 20);
    });
  } else {
    const elements = Array.isArray(raw.elements) ? raw.elements : [];
    section.elements = sanitizeElementList(elements, 0, 40);
  }

  return section;
}

function sanitizeHero(raw, fallbackTitle = "") {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: asBool(src.enabled, true),
    heading: clip(src.heading, 160, fallbackTitle),
    description: clip(src.description, 600),
    backgroundImageKey: clip(src.backgroundImageKey, 500) || null,
    backgroundVideoKey: clip(src.backgroundVideoKey, 500) || null,
    backgroundVideoPosterKey: clip(src.backgroundVideoPosterKey, 500) || null,
    ctaText: clip(src.ctaText, 80),
    ctaUrl: sanitizeUrl(src.ctaUrl) || "#contact",
    ctaOpenInNewTab: asBool(src.ctaOpenInNewTab, false),
    textAlign: asAlign(src.textAlign, "center"),
    overlay: asBool(src.overlay, true),
    overlayOpacity: asNumber(src.overlayOpacity, 0.45, 0, 0.9),
    minHeight: clip(src.minHeight, 20) || "70vh",
    mobileMinHeight: clip(src.mobileMinHeight, 20) || "55vh",
  };
}

export function sanitizeLandingContent(raw, { title = "" } = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const sections = Array.isArray(src.sections) ? src.sections : [];
  return {
    version: LANDING_CONTENT_VERSION,
    hero: sanitizeHero(src.hero, title),
    sections: sections
      .slice(0, 40)
      .map((section, i) => sanitizeSection(section, i))
      .filter(Boolean),
  };
}

export function collectMediaKeys(content) {
  const keys = new Set();
  const add = (key) => {
    if (key && typeof key === "string") keys.add(key);
  };
  const walkElements = (list = []) => {
    for (const el of list) {
      if (!el) continue;
      add(el.content?.imageKey);
      add(el.content?.videoKey);
      add(el.content?.posterKey);
      add(el.content?.audioKey);
      if (Array.isArray(el.columns)) el.columns.forEach(walkElements);
    }
  };
  add(content?.hero?.backgroundImageKey);
  add(content?.hero?.backgroundVideoKey);
  add(content?.hero?.backgroundVideoPosterKey);
  for (const section of content?.sections || []) {
    add(section.settings?.backgroundImageKey);
    walkElements(section.elements);
    if (Array.isArray(section.columns)) section.columns.forEach(walkElements);
  }
  return [...keys];
}

export function hydrateContentUrls(content, urlFor) {
  if (!content || typeof content !== "object") return content;
  const walkElements = (list = []) =>
    list.map((el) => {
      if (!el) return el;
      const next = {
        ...el,
        content: { ...el.content },
      };
      if (next.content.imageKey) {
        next.content.imageSrc = urlFor(next.content.imageKey) || next.content.imageUrl || null;
      } else if (next.content.imageUrl) {
        next.content.imageSrc = next.content.imageUrl;
      }
      if (next.content.videoKey) {
        next.content.videoSrc = urlFor(next.content.videoKey) || next.content.videoUrl || null;
      } else if (next.content.videoUrl) {
        next.content.videoSrc = next.content.videoUrl;
      }
      if (next.content.posterKey) {
        next.content.posterSrc = urlFor(next.content.posterKey);
      }
      if (next.content.audioKey) {
        next.content.audioSrc = urlFor(next.content.audioKey) || next.content.audioUrl || null;
      } else if (next.content.audioUrl) {
        next.content.audioSrc = next.content.audioUrl;
      }
      if (Array.isArray(el.columns)) next.columns = el.columns.map(walkElements);
      return next;
    });

  return {
    ...content,
    hero: {
      ...content.hero,
      backgroundImageSrc: content.hero?.backgroundImageKey
        ? urlFor(content.hero.backgroundImageKey)
        : null,
      backgroundVideoSrc: content.hero?.backgroundVideoKey
        ? urlFor(content.hero.backgroundVideoKey)
        : null,
      backgroundVideoPosterSrc: content.hero?.backgroundVideoPosterKey
        ? urlFor(content.hero.backgroundVideoPosterKey)
        : null,
    },
    sections: (content.sections || []).map((section) => ({
      ...section,
      settings: {
        ...section.settings,
        backgroundImageSrc: section.settings?.backgroundImageKey
          ? urlFor(section.settings.backgroundImageKey)
          : null,
      },
      elements: walkElements(section.elements || []),
      columns: Array.isArray(section.columns)
        ? section.columns.map(walkElements)
        : undefined,
    })),
  };
}

export function hasPublishableContent(content) {
  const hero = content?.hero;
  if (hero?.enabled && String(hero.heading || "").trim().length >= 2) return true;
  for (const section of content?.sections || []) {
    if ((section.elements || []).length) return true;
    if ((section.columns || []).some((col) => col.length)) return true;
  }
  return false;
}

export function contentsEqual(a, b) {
  try {
    return JSON.stringify(a || null) === JSON.stringify(b || null);
  } catch {
    return false;
  }
}
