import crypto from "crypto";

export const LANDING_CONTENT_VERSION = 1;

export const ELEMENT_TYPES = Object.freeze([
  "heading",
  "paragraph",
  "text",
  "quote",
  "list",
  "image",
  "gallery",
  "slider",
  "before-after",
  "video",
  "audio",
  "button",
  "icon",
  "icon-button",
  "link",
  "social-links",
  "whatsapp-cta",
  "accordion",
  "faq",
  "tabs",
  "countdown",
  "divider",
  "spacer",
  "columns",
  "grid",
  "feature-cards",
  "pricing-cards",
  "testimonial-cards",
  "team-cards",
  "stats",
  "timeline",
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
const REMOVED_ELEMENT_TYPES = new Set([
  "html",
  "container",
  "rich-text",
  "newsletter-cta",
  "logo-showcase",
]);

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
    return {
      ok: false,
      message: "نامک فقط می‌تواند شامل حروف، عدد و خط تیره باشد",
    };
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
    mobileBackgroundImageKey: null,
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
    mobileBackgroundImageKey: null,
    backgroundGradient: "",
    backgroundOverlay: false,
    overlayColor: "#000000",
    overlayOpacity: 0.4,
    width: "default",
    minHeight: "",
    paddingY: 64,
    paddingX: 24,
    marginY: 0,
    borderRadius: 0,
    align: "center",
    verticalAlign: "top",
    gap: 24,
    hiddenOnMobile: false,
    hiddenOnTablet: false,
    hiddenOnDesktop: false,
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
  if (
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(
      raw,
    )
  ) {
    return raw;
  }
  return "";
}

function sanitizeGradient(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(linear|radial)-gradient\([^;]{0,200}\)$/i.test(raw)) return raw;
  return "";
}

function sanitizeImageItems(items, max = 12) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map((item) => {
    const src = item && typeof item === "object" ? item : {};
    return {
      alt: clip(src.alt, 120),
      imageKey: clip(src.imageKey, 500) || null,
      imageUrl:
        sanitizeUrl(src.imageUrl, { allowRelative: false }) || "",
      mobileImageKey: clip(src.mobileImageKey, 500) || null,
      mobileImageUrl:
        sanitizeUrl(src.mobileImageUrl, { allowRelative: false }) || "",
    };
  });
}

function sanitizeCardItems(items, max = 12) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map((item) => {
    const src = item && typeof item === "object" ? item : {};
    return {
      title: clip(src.title, 120),
      description: clip(src.description, 500),
      name: clip(src.name, 80),
      role: clip(src.role, 80),
      quote: clip(src.quote, 500),
      author: clip(src.author, 80),
      price: clip(src.price, 40),
      badge: clip(src.badge, 40),
      value: clip(src.value, 40),
      label: clip(src.label, 80),
      date: clip(src.date, 40),
      icon: ICON_NAMES.has(String(src.icon || ""))
        ? String(src.icon)
        : "Sparkles",
      rating: asNumber(src.rating, 5, 0, 5),
      url: sanitizeUrl(src.url) || "",
      features: Array.isArray(src.features)
        ? src.features.slice(0, 10).map((f) => clip(f, 120))
        : [],
      imageKey: clip(src.imageKey, 500) || null,
      imageUrl:
        sanitizeUrl(src.imageUrl, { allowRelative: false }) || "",
      mobileImageKey: clip(src.mobileImageKey, 500) || null,
      mobileImageUrl:
        sanitizeUrl(src.mobileImageUrl, { allowRelative: false }) || "",
    };
  });
}

function sanitizeFaqItems(items, max = 20) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map((item) => {
    const src = item && typeof item === "object" ? item : {};
    return {
      question: clip(src.question, 200),
      answer: clip(src.answer, 2000),
      label: clip(src.label, 80),
      content: clip(src.content, 2000),
    };
  });
}

function sanitizeSocialItems(items, max = 10) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map((item) => {
    const src = item && typeof item === "object" ? item : {};
    const platform = clip(src.platform, 40) || "link";
    return {
      platform,
      url: sanitizeUrl(src.url, { allowRelative: false }) || "",
    };
  });
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
    maxWidth: clip(src.maxWidth, 20) || extra.maxWidth || "100%",
    minHeight: clip(src.minHeight, 20),
    hiddenOnMobile: asBool(src.hiddenOnMobile, false),
    hiddenOnTablet: asBool(src.hiddenOnTablet, false),
    hiddenOnDesktop: asBool(src.hiddenOnDesktop, false),
    backgroundColor: sanitizeCssColor(src.backgroundColor),
    backgroundGradient: sanitizeGradient(src.backgroundGradient),
    borderColor: sanitizeCssColor(src.borderColor),
    borderWidth: asNumber(src.borderWidth, extra.borderWidth ?? 0, 0, 12),
    borderRadius: asNumber(src.borderRadius, extra.borderRadius ?? 0, 0, 80),
    objectFit: OBJECT_FIT_VALUES.has(src.objectFit)
      ? src.objectFit
      : extra.objectFit || "cover",
    opacity: asNumber(src.opacity, 1, 0.1, 1),
    boxShadow: clip(src.boxShadow, 120),
    gap: asNumber(src.gap, extra.gap ?? 16, 0, 80),
  };
}

function sanitizeElement(raw, depth = 0) {
  if (!raw || typeof raw !== "object" || depth > 6) return null;
  const type = ELEMENT_TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return null;
  const id = clip(raw.id, 80) || newBlockId(type);
  const contentIn =
    raw.content && typeof raw.content === "object" ? raw.content : {};
  const styles = sanitizeStyles(
    raw.styles,
    type === "heading" ? { fontSize: 32, fontWeight: 700 } : {},
  );
  const content = {};

  if (type === "heading") {
    content.text = clip(contentIn.text, 200, "عنوان");
    content.level = asNumber(contentIn.level, 2, 1, 4);
  } else if (type === "paragraph" || type === "text") {
    content.text = clip(contentIn.text, 8000);
  } else if (type === "quote") {
    content.text = clip(contentIn.text, 1000);
    content.author = clip(contentIn.author, 120);
  } else if (type === "list") {
    content.ordered = asBool(contentIn.ordered, false);
    content.items = Array.isArray(contentIn.items)
      ? contentIn.items.slice(0, 30).map((item) => clip(item, 300))
      : [];
  } else if (type === "image") {
    content.imageKey = clip(contentIn.imageKey, 500) || null;
    content.imageUrl =
      sanitizeUrl(contentIn.imageUrl, { allowRelative: false }) || "";
    content.mobileImageKey = clip(contentIn.mobileImageKey, 500) || null;
    content.mobileImageUrl =
      sanitizeUrl(contentIn.mobileImageUrl, { allowRelative: false }) || "";
    content.alt = clip(contentIn.alt, 160);
    content.linkUrl = sanitizeUrl(contentIn.linkUrl);
    content.linkNewTab = asBool(contentIn.linkNewTab, false);
    content.height = asNumber(contentIn.height, 0, 0, 1200);
  } else if (type === "gallery" || type === "slider") {
    content.items = sanitizeImageItems(contentIn.items, 12);
    if (type === "gallery") {
      content.columns = asNumber(contentIn.columns, 3, 1, 4);
    }
    if (type === "slider") {
      content.autoplay = asBool(contentIn.autoplay, true);
      content.interval = asNumber(contentIn.interval, 5000, 2000, 15000);
    }
  } else if (type === "before-after") {
    content.beforeKey = clip(contentIn.beforeKey, 500) || null;
    content.afterKey = clip(contentIn.afterKey, 500) || null;
    content.mobileBeforeKey = clip(contentIn.mobileBeforeKey, 500) || null;
    content.mobileAfterKey = clip(contentIn.mobileAfterKey, 500) || null;
    content.beforeAlt = clip(contentIn.beforeAlt, 120);
    content.afterAlt = clip(contentIn.afterAlt, 120);
    content.label = clip(contentIn.label, 40);
  } else if (type === "video") {
    content.videoKey = clip(contentIn.videoKey, 500) || null;
    content.videoUrl =
      sanitizeUrl(contentIn.videoUrl, { allowRelative: false }) || "";
    content.posterKey = clip(contentIn.posterKey, 500) || null;
    content.mobilePosterKey = clip(contentIn.mobilePosterKey, 500) || null;
    content.autoplay = asBool(contentIn.autoplay, false);
    content.muted = asBool(contentIn.muted, content.autoplay);
    content.loop = asBool(contentIn.loop, false);
    content.controls = asBool(contentIn.controls, true);
  } else if (type === "audio") {
    content.audioKey = clip(contentIn.audioKey, 500) || null;
    content.audioUrl =
      sanitizeUrl(contentIn.audioUrl, { allowRelative: false }) || "";
    content.title = clip(contentIn.title, 120);
    content.autoplay = asBool(contentIn.autoplay, false);
    content.loop = asBool(contentIn.loop, false);
  } else if (type === "button" || type === "link") {
    content.text = clip(contentIn.text, 80, "دکمه");
    content.url = sanitizeUrl(contentIn.url) || "#contact";
    content.openInNewTab = asBool(contentIn.openInNewTab, false);
    content.variant = ["brand", "outline", "secondary"].includes(
      contentIn.variant,
    )
      ? contentIn.variant
      : "brand";
  } else if (type === "icon-button") {
    const name = String(contentIn.name || "ArrowLeft");
    content.name = ICON_NAMES.has(name) ? name : "ArrowLeft";
    content.url = sanitizeUrl(contentIn.url) || "#contact";
    content.openInNewTab = asBool(contentIn.openInNewTab, false);
    content.variant = ["brand", "outline", "secondary"].includes(
      contentIn.variant,
    )
      ? contentIn.variant
      : "brand";
    content.size = asNumber(contentIn.size, 40, 24, 80);
  } else if (type === "social-links") {
    content.items = sanitizeSocialItems(contentIn.items, 10);
  } else if (type === "whatsapp-cta") {
    content.phone = clip(String(contentIn.phone || "").replace(/\D/g, ""), 20);
    content.message = clip(contentIn.message, 300);
    content.text = clip(contentIn.text, 80, "واتساپ");
  } else if (type === "accordion" || type === "faq") {
    content.items = sanitizeFaqItems(contentIn.items, 20);
  } else if (type === "tabs") {
    content.items = sanitizeFaqItems(contentIn.items, 10);
  } else if (type === "countdown") {
    content.targetDate = clip(contentIn.targetDate, 40);
    content.labels =
      contentIn.labels && typeof contentIn.labels === "object"
        ? {
            days: clip(contentIn.labels.days, 20),
            hours: clip(contentIn.labels.hours, 20),
            minutes: clip(contentIn.labels.minutes, 20),
            seconds: clip(contentIn.labels.seconds, 20),
          }
        : {};
  } else if (
    type === "feature-cards" ||
    type === "pricing-cards" ||
    type === "testimonial-cards" ||
    type === "team-cards" ||
    type === "stats" ||
    type === "timeline"
  ) {
    content.items = sanitizeCardItems(contentIn.items, 12);
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
    content.count = asNumber(contentIn.count, 2, 2, 4);
  } else if (type === "grid") {
    content.columns = asNumber(contentIn.columns, 3, 1, 4);
  }

  const element = { id, type, content, styles };
  if (clip(raw.label, 80)) element.label = clip(raw.label, 80);
  if (asBool(raw.locked, false)) element.locked = true;
  if (asBool(raw.hidden, false)) element.hidden = true;

  if (type === "columns") {
    const cols = Array.isArray(raw.columns) ? raw.columns : [[], []];
    const count = element.content.count;
    element.columns = Array.from({ length: count }, (_, i) => {
      const col = Array.isArray(cols[i]) ? cols[i] : [];
      return sanitizeElementList(col, depth + 1, 20);
    });
  }

  if (type === "grid") {
    const cols = Array.isArray(raw.columns) ? raw.columns : [[], [], []];
    const count = element.content.columns;
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
        for (const child of sanitizeElementList(
          children,
          depth + 1,
          max - out.length,
        )) {
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
  const settingsIn =
    raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const settings = {
    ...defaultSectionSettings(),
    backgroundColor: sanitizeCssColor(settingsIn.backgroundColor),
    backgroundImageKey: clip(settingsIn.backgroundImageKey, 500) || null,
    mobileBackgroundImageKey:
      clip(settingsIn.mobileBackgroundImageKey, 500) || null,
    backgroundGradient: sanitizeGradient(settingsIn.backgroundGradient),
    backgroundOverlay: asBool(settingsIn.backgroundOverlay, false),
    overlayColor: sanitizeCssColor(settingsIn.overlayColor) || "#000000",
    overlayOpacity: asNumber(settingsIn.overlayOpacity, 0.4, 0, 0.9),
    width: ["default", "wide", "full"].includes(settingsIn.width)
      ? settingsIn.width
      : "default",
    minHeight: clip(settingsIn.minHeight, 20),
    paddingY: asNumber(settingsIn.paddingY, 64, 0, 160),
    paddingX: asNumber(settingsIn.paddingX, 24, 0, 80),
    marginY: asNumber(settingsIn.marginY, 0, 0, 80),
    borderRadius: asNumber(settingsIn.borderRadius, 0, 0, 48),
    align: asAlign(settingsIn.align, "center"),
    verticalAlign: ["top", "center", "bottom"].includes(
      settingsIn.verticalAlign,
    )
      ? settingsIn.verticalAlign
      : "top",
    gap: asNumber(settingsIn.gap, 24, 0, 80),
    hiddenOnMobile: asBool(settingsIn.hiddenOnMobile, false),
    hiddenOnTablet: asBool(settingsIn.hiddenOnTablet, false),
    hiddenOnDesktop: asBool(settingsIn.hiddenOnDesktop, false),
  };

  const section = {
    id: clip(raw.id, 80) || newBlockId("section"),
    type,
    settings,
    elements: [],
  };
  if (clip(raw.label, 80)) section.label = clip(raw.label, 80);
  if (asBool(raw.locked, false)) section.locked = true;
  if (asBool(raw.hidden, false)) section.hidden = true;

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
    mobileBackgroundImageKey: clip(src.mobileBackgroundImageKey, 500) || null,
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
      add(el.content?.mobileImageKey);
      add(el.content?.videoKey);
      add(el.content?.posterKey);
      add(el.content?.mobilePosterKey);
      add(el.content?.audioKey);
      add(el.content?.beforeKey);
      add(el.content?.afterKey);
      add(el.content?.mobileBeforeKey);
      add(el.content?.mobileAfterKey);
      const items = el.content?.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          add(item?.imageKey);
          add(item?.mobileImageKey);
        }
      }
      if (Array.isArray(el.columns)) el.columns.forEach(walkElements);
    }
  };
  add(content?.hero?.backgroundImageKey);
  add(content?.hero?.mobileBackgroundImageKey);
  add(content?.hero?.backgroundVideoKey);
  add(content?.hero?.backgroundVideoPosterKey);
  for (const section of content?.sections || []) {
    add(section.settings?.backgroundImageKey);
    add(section.settings?.mobileBackgroundImageKey);
    walkElements(section.elements);
    if (Array.isArray(section.columns)) section.columns.forEach(walkElements);
  }
  return [...keys];
}

export function hydrateContentUrls(content, urlFor) {
  if (!content || typeof content !== "object") return content;

  const hydrateKeyedSrc = (obj, keyField, srcField, urlField) => {
    if (!obj || typeof obj !== "object") return;
    if (obj[keyField]) {
      obj[srcField] = urlFor(obj[keyField]) || obj[urlField] || null;
    } else if (obj[urlField]) {
      obj[srcField] = obj[urlField];
    }
  };

  const walkElements = (list = []) =>
    list.map((el) => {
      if (!el) return el;
      const next = {
        ...el,
        content: { ...el.content },
      };
      hydrateKeyedSrc(next.content, "imageKey", "imageSrc", "imageUrl");
      hydrateKeyedSrc(
        next.content,
        "mobileImageKey",
        "mobileImageSrc",
        "mobileImageUrl",
      );
      hydrateKeyedSrc(next.content, "videoKey", "videoSrc", "videoUrl");
      hydrateKeyedSrc(next.content, "audioKey", "audioSrc", "audioUrl");
      if (next.content.posterKey) {
        next.content.posterSrc = urlFor(next.content.posterKey);
      }
      if (next.content.mobilePosterKey) {
        next.content.mobilePosterSrc = urlFor(next.content.mobilePosterKey);
      }
      if (next.content.beforeKey) {
        next.content.beforeSrc = urlFor(next.content.beforeKey);
      }
      if (next.content.afterKey) {
        next.content.afterSrc = urlFor(next.content.afterKey);
      }
      if (next.content.mobileBeforeKey) {
        next.content.mobileBeforeSrc = urlFor(next.content.mobileBeforeKey);
      }
      if (next.content.mobileAfterKey) {
        next.content.mobileAfterSrc = urlFor(next.content.mobileAfterKey);
      }
      if (Array.isArray(next.content.items)) {
        next.content.items = next.content.items.map((item) => {
          if (!item || typeof item !== "object") return item;
          const copy = { ...item };
          hydrateKeyedSrc(copy, "imageKey", "imageSrc", "imageUrl");
          hydrateKeyedSrc(
            copy,
            "mobileImageKey",
            "mobileImageSrc",
            "mobileImageUrl",
          );
          return copy;
        });
      }
      if (Array.isArray(el.columns))
        next.columns = el.columns.map(walkElements);
      return next;
    });

  return {
    ...content,
    hero: {
      ...content.hero,
      backgroundImageSrc: content.hero?.backgroundImageKey
        ? urlFor(content.hero.backgroundImageKey)
        : null,
      mobileBackgroundImageSrc: content.hero?.mobileBackgroundImageKey
        ? urlFor(content.hero.mobileBackgroundImageKey)
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
        mobileBackgroundImageSrc: section.settings?.mobileBackgroundImageKey
          ? urlFor(section.settings.mobileBackgroundImageKey)
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
  if (hero?.enabled && String(hero.heading || "").trim().length >= 2)
    return true;
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
