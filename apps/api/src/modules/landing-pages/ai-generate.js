/**
 * Landing page AI — full generate OR targeted patch edits via OpenRouter free models.
 * Default behavior is section/element-level editing that preserves IDs and unrelated content.
 */

import { z } from "zod";
import { AppError } from "../../utils/response.js";
import { completeWithModelFallback, extractJson } from "../../services/ai/index.js";
import { openRouterService } from "../../services/ai/openrouter.service.js";
import {
  ELEMENT_TYPES,
  SECTION_TYPES,
  newBlockId,
  sanitizeLandingContent,
} from "./content.js";

const ELEMENT_SET = new Set(ELEMENT_TYPES);
const SECTION_SET = new Set(SECTION_TYPES);

const ALLOWED_AI_ELEMENTS = new Set([
  "heading",
  "paragraph",
  "text",
  "quote",
  "list",
  "button",
  "link",
  "divider",
  "spacer",
  "faq",
  "accordion",
  "feature-cards",
  "pricing-cards",
  "testimonial-cards",
  "team-cards",
  "stats",
  "timeline",
  "whatsapp-cta",
  "social-links",
  "icon",
]);

const STYLE_KEYS = new Set([
  "fontSize",
  "fontWeight",
  "fontFamily",
  "color",
  "align",
  "lineHeight",
  "letterSpacing",
  "marginTop",
  "marginBottom",
  "padding",
  "width",
  "maxWidth",
  "minHeight",
  "hiddenOnMobile",
  "hiddenOnTablet",
  "hiddenOnDesktop",
  "backgroundColor",
  "backgroundGradient",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "objectFit",
  "opacity",
  "boxShadow",
  "gap",
]);

const SECTION_SETTING_KEYS = new Set([
  "backgroundColor",
  "backgroundGradient",
  "backgroundOverlay",
  "overlayColor",
  "overlayOpacity",
  "width",
  "minHeight",
  "paddingY",
  "paddingX",
  "marginY",
  "borderRadius",
  "align",
  "verticalAlign",
  "gap",
  "hiddenOnMobile",
  "hiddenOnTablet",
  "hiddenOnDesktop",
]);

const HERO_FIELD_KEYS = new Set([
  "enabled",
  "heading",
  "description",
  "ctaText",
  "ctaUrl",
  "ctaOpenInNewTab",
  "textAlign",
  "overlay",
  "overlayOpacity",
  "minHeight",
  "mobileMinHeight",
]);

export const generateLandingAiSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(8, "پرامپت باید حداقل ۸ کاراکتر باشد")
    .max(20000, "پرامپت نباید بیشتر از ۲۰۰۰۰ کاراکتر باشد"),
  pageTitle: z.string().trim().max(160).optional().nullable(),
  language: z.enum(["fa", "en"]).optional().default("fa"),
  tone: z
    .enum(["professional", "friendly", "luxury", "simple"])
    .optional()
    .default("professional"),
  /** edit = targeted patch (default). replace = full redesign. append = add sections. */
  mode: z.enum(["edit", "replace", "append"]).optional().default("edit"),
  currentContent: z.any().optional().nullable(),
  selection: z
    .object({
      kind: z.enum(["hero", "section", "element", "none"]).optional(),
      id: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
      elementId: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const REGENERATE_SYSTEM_PROMPT = `You are an expert landing-page strategist and Persian RTL copywriter.
Return ONLY valid JSON (no markdown fences) matching this schema:

{
  "intent": "regenerate",
  "hero": {
    "enabled": true,
    "heading": "string",
    "description": "string",
    "ctaText": "string",
    "ctaUrl": "#contact",
    "textAlign": "center"
  },
  "sections": [
    {
      "type": "content|cta|custom|video",
      "label": "string",
      "elements": [
        { "type": "heading", "text": "string", "level": 2 },
        { "type": "paragraph", "text": "string" },
        { "type": "button", "text": "string", "url": "#contact", "variant": "brand" },
        { "type": "list", "ordered": false, "items": ["string"] },
        { "type": "faq", "items": [{ "question": "string", "answer": "string" }] },
        { "type": "feature-cards", "items": [{ "title": "string", "description": "string", "icon": "Sparkles" }] },
        { "type": "stats", "items": [{ "value": "string", "label": "string" }] },
        { "type": "testimonial-cards", "items": [{ "quote": "string", "author": "string", "role": "string" }] },
        { "type": "pricing-cards", "items": [{ "title": "string", "price": "string", "description": "string", "badge": "", "url": "#contact", "features": ["string"] }] },
        { "type": "whatsapp-cta", "phone": "", "text": "string", "message": "string" },
        { "type": "divider" },
        { "type": "spacer", "height": 24 }
      ]
    }
  ],
  "metaDescription": "string"
}

Rules:
- Write all user-facing copy in the requested language (default Persian).
- Build a complete professional landing page: hero + 4 to 7 sections.
- Prefer these element types only: heading, paragraph, button, list, faq, feature-cards, stats, testimonial-cards, pricing-cards, whatsapp-cta, divider, spacer.
- Do NOT invent image/video URLs or media keys.
- No HTML tags inside text fields.`;

const EDIT_SYSTEM_PROMPT = `You are a precise landing-page editor AI.
You receive the CURRENT page structure (with real IDs) and a user edit request.
Your job is MINIMAL targeted edits. Never rebuild the whole page.

Return ONLY valid JSON (no markdown) with one of these shapes:

1) Targeted edit:
{
  "intent": "edit",
  "summary": "short description of changes",
  "ops": [ /* 1..12 operations */ ]
}

2) Need clarification (ONLY if target is truly ambiguous):
{
  "intent": "clarify",
  "question": "Persian question asking which section/element to change"
}

Allowed ops:
- { "op": "set_hero", "fields": { "heading"|"description"|"ctaText"|"ctaUrl"|"textAlign"|"overlay"|"overlayOpacity"|"enabled"|"minHeight"|"mobileMinHeight": value } }
- { "op": "set_section_settings", "sectionId": "sec-...", "settings": { "backgroundColor"|"paddingY"|"paddingX"|"gap"|"align"|"marginY"|"borderRadius"|"width"|...: value } }
- { "op": "set_section_label", "sectionId": "sec-...", "label": "string" }
- { "op": "patch_element", "sectionId": "sec-...", "elementId": "el-...", "content": { ...partial content fields }, "styles": { ...partial style fields }, "label": "optional" }
- { "op": "add_element", "sectionId": "sec-...", "afterElementId": "el-...|null", "element": { "type": "heading|paragraph|button|...", "text"?: "...", ... } }
- { "op": "delete_element", "sectionId": "sec-...", "elementId": "el-..." }
- { "op": "add_section", "afterSectionId": "sec-...|null", "section": { "type": "content|cta|custom", "label": "...", "elements": [ ... ] } }
- { "op": "delete_section", "sectionId": "sec-..." }

Rules:
- Use EXACT existing sectionId / elementId from the provided page context.
- Prefer selection context when the user says "this", "این", "همین", "selected".
- Change ONLY what the user asked. Leave all other sections/elements untouched.
- Preserve IDs. Do not recreate elements just to change text/color/spacing.
- For text changes use patch_element content.text (or items for cards/faq).
- For colors/spacing/typography use styles or section settings.
- Do NOT invent image/video URLs or media keys.
- If multiple changes are requested, return multiple ops.
- If the user asks for a brand-new full landing page / full redesign, set intent to "regenerate" and include full hero+sections like a new page.
- Output language for copy: match the page / user request (default Persian).`;

function clip(value, max = 500, fallback = "") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.slice(0, max);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultElementStyles(extra = {}) {
  return {
    fontSize: 16,
    fontWeight: 400,
    fontFamily: "",
    color: "#111827",
    align: "right",
    lineHeight: 1.7,
    letterSpacing: 0,
    marginTop: 0,
    marginBottom: 12,
    padding: 0,
    width: "100%",
    maxWidth: "100%",
    minHeight: "",
    hiddenOnMobile: false,
    hiddenOnTablet: false,
    hiddenOnDesktop: false,
    backgroundColor: "",
    backgroundGradient: "",
    borderColor: "",
    borderWidth: 0,
    borderRadius: 0,
    objectFit: "cover",
    opacity: 1,
    boxShadow: "",
    gap: 16,
    ...extra,
  };
}

function mapAiElement(raw) {
  if (!raw || typeof raw !== "object") return null;
  let type = String(raw.type || "").trim();
  if (type === "text") type = "paragraph";
  if (!ALLOWED_AI_ELEMENTS.has(type) || !ELEMENT_SET.has(type)) return null;

  const content = {};
  const styles = defaultElementStyles();
  const srcContent =
    raw.content && typeof raw.content === "object" ? raw.content : raw;

  switch (type) {
    case "heading":
      content.text = clip(srcContent.text, 200, "عنوان");
      content.level = Math.min(4, Math.max(1, Number(srcContent.level) || 2));
      Object.assign(styles, {
        fontSize: content.level === 1 ? 40 : content.level === 2 ? 32 : 24,
        fontWeight: 700,
        align: "center",
        color: "#111827",
      });
      break;
    case "paragraph":
      content.text = clip(srcContent.text, 4000);
      Object.assign(styles, { align: "center", color: "#4b5563", maxWidth: "720px" });
      break;
    case "quote":
      content.text = clip(srcContent.text, 1000);
      content.author = clip(srcContent.author, 120);
      break;
    case "list":
      content.ordered = Boolean(srcContent.ordered);
      content.items = asArray(srcContent.items)
        .map((item) => clip(item, 300))
        .filter(Boolean)
        .slice(0, 20);
      break;
    case "button":
    case "link":
      content.text = clip(srcContent.text, 80, "درخواست مشاوره");
      content.url = clip(srcContent.url, 200, "#contact") || "#contact";
      content.openInNewTab = Boolean(srcContent.openInNewTab);
      content.variant = ["brand", "outline", "secondary"].includes(srcContent.variant)
        ? srcContent.variant
        : "brand";
      styles.align = "center";
      break;
    case "divider":
      content.thickness = 1;
      styles.color = "#e5e7eb";
      styles.marginTop = 16;
      styles.marginBottom = 16;
      break;
    case "spacer":
      content.height = Math.min(160, Math.max(8, Number(srcContent.height) || 24));
      break;
    case "faq":
    case "accordion":
      content.items = asArray(srcContent.items)
        .slice(0, 12)
        .map((item) => ({
          question: clip(item?.question || item?.title, 200),
          answer: clip(item?.answer || item?.description || item?.content, 1200),
        }))
        .filter((item) => item.question || item.answer);
      styles.gap = 8;
      break;
    case "feature-cards":
    case "pricing-cards":
    case "testimonial-cards":
    case "team-cards":
    case "stats":
    case "timeline":
      content.items = asArray(srcContent.items)
        .slice(0, 8)
        .map((item) => ({
          title: clip(item?.title, 120),
          description: clip(item?.description, 500),
          name: clip(item?.name, 80),
          role: clip(item?.role, 80),
          quote: clip(item?.quote, 500),
          author: clip(item?.author, 80),
          price: clip(item?.price, 40),
          badge: clip(item?.badge, 40),
          value: clip(item?.value, 40),
          label: clip(item?.label, 80),
          date: clip(item?.date, 40),
          icon: clip(item?.icon, 40, "Sparkles") || "Sparkles",
          url: clip(item?.url, 200),
          features: asArray(item?.features)
            .map((f) => clip(f, 120))
            .filter(Boolean)
            .slice(0, 8),
        }));
      styles.gap = 24;
      if (type === "stats") styles.align = "center";
      break;
    case "whatsapp-cta":
      content.phone = clip(String(srcContent.phone || "").replace(/\D/g, ""), 20);
      content.message = clip(srcContent.message, 300);
      content.text = clip(srcContent.text, 80, "گفتگو در واتساپ");
      styles.align = "center";
      break;
    case "social-links":
      content.items = asArray(srcContent.items)
        .slice(0, 8)
        .map((item) => ({
          platform: clip(item?.platform, 40, "instagram"),
          url: clip(item?.url, 300),
        }))
        .filter((item) => item.url);
      styles.gap = 12;
      styles.align = "center";
      break;
    case "icon":
      content.name = clip(srcContent.name, 40, "Sparkles") || "Sparkles";
      content.size = Math.min(64, Math.max(16, Number(srcContent.size) || 32));
      content.url = clip(srcContent.url, 200);
      styles.align = "center";
      break;
    default:
      return null;
  }

  if (raw.styles && typeof raw.styles === "object") {
    for (const [key, value] of Object.entries(raw.styles)) {
      if (STYLE_KEYS.has(key)) styles[key] = value;
    }
  }

  return {
    id: newBlockId("el"),
    type,
    content,
    styles,
    label: clip(raw.label, 80) || undefined,
  };
}

function mapAiSection(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  let type = String(raw.type || "content").trim();
  if (!SECTION_SET.has(type)) type = "content";

  const elements = asArray(raw.elements)
    .map(mapAiElement)
    .filter(Boolean)
    .slice(0, 20);

  if (!elements.length) return null;

  const isCta = type === "cta";
  if (isCta) {
    for (const el of elements) {
      if (!el?.styles) continue;
      if (el.type === "heading" || el.type === "paragraph" || el.type === "text") {
        el.styles.color = "#f8fafc";
      }
    }
  }

  const settings = {
    backgroundColor: isCta ? "#0f172a" : "",
    backgroundImageKey: null,
    backgroundGradient: "",
    backgroundOverlay: false,
    overlayColor: "#000000",
    overlayOpacity: 0.4,
    width: "default",
    minHeight: "",
    paddingY: isCta ? 80 : 64,
    paddingX: 24,
    marginY: 0,
    borderRadius: 0,
    align: "center",
    verticalAlign: "top",
    gap: 16,
    hiddenOnMobile: false,
    hiddenOnTablet: false,
    hiddenOnDesktop: false,
  };

  if (raw.settings && typeof raw.settings === "object") {
    for (const [key, value] of Object.entries(raw.settings)) {
      if (SECTION_SETTING_KEYS.has(key)) settings[key] = value;
    }
  }

  return {
    id: newBlockId("sec"),
    type,
    label: clip(raw.label, 80, `بخش ${index + 1}`),
    elements,
    settings,
  };
}

export function blueprintToLandingContent(blueprint, { title = "" } = {}) {
  const src = blueprint && typeof blueprint === "object" ? blueprint : {};
  const heroIn = src.hero && typeof src.hero === "object" ? src.hero : {};
  const sections = asArray(src.sections)
    .map(mapAiSection)
    .filter(Boolean)
    .slice(0, 12);

  const content = sanitizeLandingContent(
    {
      version: 1,
      hero: {
        enabled: heroIn.enabled !== false,
        heading: clip(heroIn.heading, 160, title || "عنوان صفحه"),
        description: clip(heroIn.description, 500),
        ctaText: clip(heroIn.ctaText, 80, "ثبت درخواست"),
        ctaUrl: clip(heroIn.ctaUrl, 200, "#contact") || "#contact",
        ctaOpenInNewTab: false,
        textAlign: ["right", "center", "left"].includes(heroIn.textAlign)
          ? heroIn.textAlign
          : "center",
        overlay: true,
        overlayOpacity: 0.45,
        minHeight: "70vh",
        mobileMinHeight: "55vh",
        backgroundImageKey: null,
        backgroundVideoKey: null,
        backgroundVideoPosterKey: null,
      },
      sections:
        sections.length > 0
          ? sections
          : [
              {
                id: newBlockId("sec"),
                type: "content",
                label: "محتوا",
                elements: [
                  {
                    id: newBlockId("el"),
                    type: "heading",
                    content: { text: title || "عنوان", level: 2 },
                    styles: defaultElementStyles({
                      fontSize: 32,
                      fontWeight: 700,
                      align: "center",
                    }),
                  },
                ],
                settings: {},
              },
            ],
    },
    { title },
  );

  return {
    content,
    metaDescription: clip(src.metaDescription, 300),
  };
}

function buildMockBlueprint({ prompt, pageTitle, language }) {
  const isFa = language !== "en";
  const brand = pageTitle || (isFa ? "برند شما" : "Your Brand");
  return {
    intent: "regenerate",
    hero: {
      enabled: true,
      heading: isFa
        ? `${brand}؛ راه‌حل حرفه‌ای برای رشد کسب‌وکار`
        : `${brand}: grow with confidence`,
      description: isFa
        ? `بر اساس درخواست شما: ${clip(prompt, 180)}.`
        : `Based on your brief: ${clip(prompt, 180)}.`,
      ctaText: isFa ? "شروع همکاری" : "Get started",
      ctaUrl: "#contact",
      textAlign: "center",
    },
    sections: [
      {
        type: "content",
        label: isFa ? "خدمات" : "Services",
        elements: [
          { type: "heading", text: isFa ? "چه چیزی ارائه می‌دهیم؟" : "What we offer", level: 2 },
          {
            type: "feature-cards",
            items: [
              {
                title: isFa ? "طراحی حرفه‌ای" : "Professional design",
                description: isFa ? "ساختار تمیز و متمرکز بر تبدیل" : "Clean conversion-focused layout",
                icon: "Sparkles",
              },
              {
                title: isFa ? "پیام واضح" : "Clear messaging",
                description: isFa ? "متن کوتاه و قابل اقدام" : "Short actionable copy",
                icon: "Target",
              },
              {
                title: isFa ? "فراخوان اقدام" : "Strong CTA",
                description: isFa ? "مسیر ساده تا تماس" : "Simple path to contact",
                icon: "Send",
              },
            ],
          },
        ],
      },
      {
        type: "cta",
        label: isFa ? "تماس" : "Contact",
        elements: [
          { type: "heading", text: isFa ? "آماده شروع هستید؟" : "Ready to start?", level: 2 },
          { type: "button", text: isFa ? "ثبت درخواست" : "Contact us", url: "#contact" },
        ],
      },
    ],
    metaDescription: isFa
      ? `لندینگ حرفه‌ای ${brand}`
      : `Professional landing for ${brand}`,
  };
}

function summarizeElement(el) {
  const c = el.content || {};
  const preview =
    clip(c.text, 80) ||
    clip(c.title, 80) ||
    (Array.isArray(c.items) ? `${c.items.length} items` : "");
  return {
    id: el.id,
    type: el.type,
    label: el.label || null,
    preview: preview || null,
    styles: {
      color: el.styles?.color || null,
      fontSize: el.styles?.fontSize || null,
      backgroundColor: el.styles?.backgroundColor || null,
      align: el.styles?.align || null,
      marginTop: el.styles?.marginTop || null,
      marginBottom: el.styles?.marginBottom || null,
      padding: el.styles?.padding || null,
      borderRadius: el.styles?.borderRadius || null,
    },
  };
}

function buildPageContext(content, selection) {
  const sections = asArray(content?.sections).map((section, index) => ({
    index,
    id: section.id,
    type: section.type,
    label: section.label || `بخش ${index + 1}`,
    settings: {
      backgroundColor: section.settings?.backgroundColor || null,
      paddingY: section.settings?.paddingY ?? null,
      paddingX: section.settings?.paddingX ?? null,
      gap: section.settings?.gap ?? null,
      align: section.settings?.align || null,
    },
    elements: asArray(section.elements).map(summarizeElement),
  }));

  return {
    hero: {
      enabled: content?.hero?.enabled !== false,
      heading: clip(content?.hero?.heading, 120),
      description: clip(content?.hero?.description, 160),
      ctaText: clip(content?.hero?.ctaText, 60),
      textAlign: content?.hero?.textAlign || "center",
    },
    sections,
    selection: selection || { kind: "none" },
  };
}

function looksLikeFullRegenerate(prompt) {
  const text = String(prompt || "").toLowerCase();
  return /(بازطراحی کامل|صفحه جدید|از صفر|از اول بساز|کل صفحه را بساز|full\s*redesign|new\s*landing\s*page|rebuild\s*(the\s*)?page|create\s*a\s*(new\s*)?landing)/i.test(
    text,
  );
}

function resolveIntent(mode, prompt, currentContent) {
  const hasSections = asArray(currentContent?.sections).length > 0;
  if (mode === "replace" || looksLikeFullRegenerate(prompt) || !hasSections) {
    return "regenerate";
  }
  if (mode === "append") return "append";
  return "edit";
}

function pickStylePatch(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (STYLE_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function pickSettingsPatch(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SECTION_SETTING_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function pickHeroFields(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (HERO_FIELD_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function findSection(content, sectionId) {
  return asArray(content.sections).find((s) => s.id === sectionId) || null;
}

function findElementIndex(section, elementId) {
  return asArray(section?.elements).findIndex((el) => el.id === elementId);
}

function walkPatchElementContent(type, patch) {
  if (!patch || typeof patch !== "object") return {};
  const out = { ...patch };
  // Keep media keys intact unless explicitly cleared by empty string (ignored).
  for (const mediaKey of [
    "imageKey",
    "mobileImageKey",
    "videoKey",
    "audioKey",
    "posterKey",
    "mobilePosterKey",
    "beforeKey",
    "afterKey",
    "mobileBeforeKey",
    "mobileAfterKey",
    "imageUrl",
    "mobileImageUrl",
    "videoUrl",
    "audioUrl",
    "backgroundImageKey",
    "mobileBackgroundImageKey",
  ]) {
    if (out[mediaKey] === "") delete out[mediaKey];
  }
  if (type === "heading" && out.text != null) out.text = clip(out.text, 200);
  if ((type === "paragraph" || type === "text") && out.text != null) {
    out.text = clip(out.text, 8000);
  }
  if ((type === "button" || type === "link") && out.text != null) {
    out.text = clip(out.text, 80);
  }
  return out;
}

/**
 * Apply minimal ops onto existing content. Preserves IDs and untouched nodes.
 */
export function applyLandingOps(content, ops) {
  const next = cloneJson(content || { version: 1, hero: {}, sections: [] });
  if (!Array.isArray(next.sections)) next.sections = [];
  if (!next.hero || typeof next.hero !== "object") next.hero = {};

  let applied = 0;
  const errors = [];

  for (const rawOp of asArray(ops).slice(0, 20)) {
    if (!rawOp || typeof rawOp !== "object") continue;
    const op = String(rawOp.op || "").trim();

    try {
      if (op === "set_hero") {
        Object.assign(next.hero, pickHeroFields(rawOp.fields || rawOp));
        applied += 1;
        continue;
      }

      if (op === "set_section_settings") {
        const section = findSection(next, rawOp.sectionId);
        if (!section) {
          errors.push(`section not found: ${rawOp.sectionId}`);
          continue;
        }
        section.settings = {
          ...(section.settings || {}),
          ...pickSettingsPatch(rawOp.settings || {}),
        };
        applied += 1;
        continue;
      }

      if (op === "set_section_label") {
        const section = findSection(next, rawOp.sectionId);
        if (!section) {
          errors.push(`section not found: ${rawOp.sectionId}`);
          continue;
        }
        section.label = clip(rawOp.label, 80, section.label || "");
        applied += 1;
        continue;
      }

      if (op === "patch_element") {
        const section = findSection(next, rawOp.sectionId);
        if (!section) {
          errors.push(`section not found: ${rawOp.sectionId}`);
          continue;
        }
        const idx = findElementIndex(section, rawOp.elementId);
        if (idx < 0) {
          errors.push(`element not found: ${rawOp.elementId}`);
          continue;
        }
        const el = section.elements[idx];
        if (rawOp.content && typeof rawOp.content === "object") {
          el.content = {
            ...(el.content || {}),
            ...walkPatchElementContent(el.type, rawOp.content),
          };
        }
        // Convenience: allow top-level text on patch_element
        if (rawOp.text != null && el.content) {
          el.content.text = clip(rawOp.text, el.type === "heading" ? 200 : 8000);
        }
        if (rawOp.styles && typeof rawOp.styles === "object") {
          el.styles = {
            ...(el.styles || defaultElementStyles()),
            ...pickStylePatch(rawOp.styles),
          };
        }
        if (rawOp.label != null) el.label = clip(rawOp.label, 80);
        section.elements[idx] = el;
        applied += 1;
        continue;
      }

      if (op === "add_element") {
        const section = findSection(next, rawOp.sectionId);
        if (!section) {
          errors.push(`section not found: ${rawOp.sectionId}`);
          continue;
        }
        const mapped = mapAiElement(rawOp.element || rawOp);
        if (!mapped) {
          errors.push("invalid element to add");
          continue;
        }
        if (!Array.isArray(section.elements)) section.elements = [];
        const afterId = rawOp.afterElementId || null;
        const afterIdx = afterId
          ? section.elements.findIndex((el) => el.id === afterId)
          : -1;
        if (afterIdx >= 0) section.elements.splice(afterIdx + 1, 0, mapped);
        else section.elements.push(mapped);
        applied += 1;
        continue;
      }

      if (op === "delete_element") {
        const section = findSection(next, rawOp.sectionId);
        if (!section) {
          errors.push(`section not found: ${rawOp.sectionId}`);
          continue;
        }
        const before = asArray(section.elements).length;
        section.elements = asArray(section.elements).filter(
          (el) => el.id !== rawOp.elementId,
        );
        if (section.elements.length !== before) applied += 1;
        else errors.push(`element not found: ${rawOp.elementId}`);
        continue;
      }

      if (op === "add_section") {
        const mapped = mapAiSection(rawOp.section || rawOp, next.sections.length);
        if (!mapped) {
          errors.push("invalid section to add");
          continue;
        }
        const afterId = rawOp.afterSectionId || null;
        const afterIdx = afterId
          ? next.sections.findIndex((s) => s.id === afterId)
          : -1;
        if (afterIdx >= 0) next.sections.splice(afterIdx + 1, 0, mapped);
        else next.sections.push(mapped);
        applied += 1;
        continue;
      }

      if (op === "delete_section") {
        const before = next.sections.length;
        next.sections = next.sections.filter((s) => s.id !== rawOp.sectionId);
        if (next.sections.length !== before) applied += 1;
        else errors.push(`section not found: ${rawOp.sectionId}`);
        continue;
      }

      errors.push(`unsupported op: ${op}`);
    } catch (err) {
      errors.push(err?.message || "op failed");
    }
  }

  return {
    content: sanitizeLandingContent(next, {
      title: next.hero?.heading || "",
    }),
    applied,
    errors,
  };
}

function buildUserPrompt({
  prompt,
  pageTitle,
  language,
  tone,
  intent,
  pageContext,
}) {
  const toneLabel =
    {
      professional: "حرفه‌ای و معتبر",
      friendly: "دوستانه و نزدیک",
      luxury: "لوکس و برندینگ قوی",
      simple: "ساده و شفاف",
    }[tone] || "حرفه‌ای";

  if (intent === "edit" || intent === "append") {
    return [
      `Task: ${intent === "append" ? "APPEND sections/elements" : "TARGETED EDIT"}`,
      `Language: ${language === "en" ? "English" : "Persian (fa-IR)"}`,
      `Tone: ${toneLabel}`,
      pageTitle ? `Page title: ${pageTitle}` : null,
      "Current page context (JSON):",
      JSON.stringify(pageContext),
      "User request:",
      prompt,
      intent === "append"
        ? "Return edit ops that only ADD new sections/elements. Do not modify existing ones unless required."
        : "Return minimal edit ops. Preserve all unrelated sections/elements/IDs.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Language: ${language === "en" ? "English" : "Persian (fa-IR), RTL-friendly copy"}`,
    `Tone: ${toneLabel}`,
    pageTitle ? `Page title hint: ${pageTitle}` : null,
    "Create a complete landing page blueprint as JSON.",
    "User brief:",
    prompt,
  ]
    .filter(Boolean)
    .join("\n");
}

async function runAiJson({ system, userContent, accept }) {
  return completeWithModelFallback({
    agentType: "LANDING_PAGE",
    system,
    userContent,
    accept,
  });
}

export async function generateLandingContentFromPrompt(input) {
  const {
    prompt,
    pageTitle = "",
    language = "fa",
    tone = "professional",
    mode = "edit",
    currentContent = null,
    selection = null,
  } = input;

  const existing = currentContent && typeof currentContent === "object"
    ? currentContent
    : null;
  const intent = resolveIntent(mode, prompt, existing);
  const pageContext = existing
    ? buildPageContext(existing, selection)
    : null;

  const finishMockRegenerate = (warning, provider = "mock-fallback") => {
    const mocked = blueprintToLandingContent(
      buildMockBlueprint({ prompt, pageTitle, language }),
      { title: pageTitle || "" },
    );
    return {
      ...mocked,
      mode: "replace",
      intent: "regenerate",
      provider,
      model: "local-mock",
      warning,
      appliedOps: 0,
    };
  };

  if (!openRouterService.isConfigured()) {
    if (intent === "edit" && existing) {
      throw new AppError(
        "کلید OPENROUTER_API_KEY تنظیم نشده است؛ ویرایش هدفمند ممکن نیست.",
        401,
        "invalid_api_key",
      );
    }
    return finishMockRegenerate(
      "کلید OPENROUTER_API_KEY تنظیم نشده؛ نسخه آزمایشی محلی تولید شد.",
      "mock",
    );
  }

  try {
    if (intent === "edit" || intent === "append") {
      if (!existing) {
        // Nothing to edit — fall through to regenerate.
      } else {
        const result = await runAiJson({
          system: EDIT_SYSTEM_PROMPT,
          userContent: buildUserPrompt({
            prompt,
            pageTitle,
            language,
            tone,
            intent,
            pageContext,
          }),
          accept: (completion) => {
            const parsed = extractJson(completion.text);
            if (!parsed || typeof parsed !== "object" || parsed.raw) {
              const err = new Error("AI returned invalid edit JSON");
              err.code = "invalid_response";
              err.status = 400;
              throw err;
            }
            return parsed;
          },
        });

        const parsed = result.parsed || {};
        const parsedIntent = String(parsed.intent || "edit").toLowerCase();

        if (parsedIntent === "clarify") {
          return {
            content: sanitizeLandingContent(existing, {
              title: pageTitle || existing.hero?.heading || "",
            }),
            mode: "edit",
            intent: "clarify",
            clarify: true,
            question:
              clip(parsed.question, 400) ||
              "کدام بخش یا عنصر را باید تغییر دهم؟ لطفاً دقیق‌تر مشخص کنید.",
            provider: result.provider || "openrouter",
            model: result.model || "openrouter-free",
            appliedOps: 0,
            summary: null,
          };
        }

        if (parsedIntent === "regenerate" && parsed.hero && Array.isArray(parsed.sections)) {
          const mapped = blueprintToLandingContent(parsed, {
            title: pageTitle || "",
          });
          return {
            ...mapped,
            mode: "replace",
            intent: "regenerate",
            provider: result.provider || "openrouter",
            model: result.model || "openrouter-free",
            usage: result.usage || null,
            appliedOps: 0,
            summary: clip(parsed.summary, 200),
          };
        }

        const ops = asArray(parsed.ops);
        if (!ops.length) {
          throw new AppError(
            clip(parsed.question, 300) ||
              "هدف ویرایش مشخص نبود. بخش یا عنصر مورد نظر را دقیق‌تر بنویسید.",
            400,
            "AI_CLARIFY",
          );
        }

        const patched = applyLandingOps(existing, ops);
        if (!patched.applied) {
          throw new AppError(
            "هیچ تغییری اعمال نشد. شناسه بخش/عنصر را بررسی کنید یا دقیق‌تر توضیح دهید.",
            400,
            "AI_NO_OPS_APPLIED",
          );
        }

        return {
          content: patched.content,
          mode: "edit",
          intent: "edit",
          provider: result.provider || "openrouter",
          model: result.model || "openrouter-free",
          usage: result.usage || null,
          appliedOps: patched.applied,
          summary: clip(parsed.summary, 200),
          warning: patched.errors.length
            ? `برخی عملیات اعمال نشد: ${patched.errors.slice(0, 3).join("؛ ")}`
            : undefined,
        };
      }
    }

    // Full regenerate path
    const result = await runAiJson({
      system: REGENERATE_SYSTEM_PROMPT,
      userContent: buildUserPrompt({
        prompt,
        pageTitle,
        language,
        tone,
        intent: "regenerate",
        pageContext: null,
      }),
      accept: (completion) => {
        const parsed = extractJson(completion.text);
        if (!parsed || typeof parsed !== "object" || parsed.raw) {
          const err = new Error("AI returned invalid landing JSON");
          err.code = "invalid_response";
          err.status = 400;
          throw err;
        }
        if (!parsed.hero && !Array.isArray(parsed.sections)) {
          const err = new Error("AI JSON missing hero/sections");
          err.code = "invalid_response";
          err.status = 400;
          throw err;
        }
        return parsed;
      },
    });

    const mapped = blueprintToLandingContent(result.parsed, {
      title: pageTitle || "",
    });

    return {
      ...mapped,
      mode: intent === "append" ? "append" : "replace",
      intent: "regenerate",
      provider: result.provider || "openrouter",
      model: result.model || "openrouter-free",
      usage: result.usage || null,
      appliedOps: 0,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;

    const code = err?.code || "";
    const isFreeTierCongestion =
      code === "rate_limit" ||
      code === "invalid_response" ||
      code === "server_error" ||
      code === "timeout" ||
      code === "model_not_found" ||
      /rate.?limit|invalid (landing|edit) json|all free/i.test(
        String(err?.message || ""),
      );

    // Never wipe an existing page with mock content during targeted edits/appends.
    if ((intent === "edit" || intent === "append") && existing) {
      throw new AppError(
        code === "rate_limit"
          ? "مدل‌های رایگان موقتاً شلوغ‌اند. کمی بعد دوباره برای ویرایش هدفمند تلاش کنید."
          : err?.message || "ویرایش هدفمند ناموفق بود.",
        err?.status || 502,
        code || "AI_EDIT_FAILED",
      );
    }

    if (isFreeTierCongestion || process.env.AI_ALLOW_MOCK_FALLBACK === "true") {
      return finishMockRegenerate(
        code === "rate_limit"
          ? "مدل‌های رایگان OpenRouter موقتاً شلوغ‌اند؛ یک نسخه حرفه‌ای محلی ساخته شد."
          : "تولید آنلاین ناموفق بود؛ یک نسخه حرفه‌ای محلی جایگزین شد.",
      );
    }

    throw new AppError(
      code === "invalid_api_key"
        ? "کلید OpenRouter تنظیم نشده است."
        : err?.message || "تولید صفحه با هوش مصنوعی ناموفق بود.",
      err?.status || 502,
      code || "AI_GENERATE_FAILED",
    );
  }
}
