export const LANDING_CONTENT_VERSION = 1;

export const ELEMENT_TYPES = [
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
  // Kept for legacy pages that already contain layout blocks (not in palette).
  "columns",
  "grid",
  "feature-cards",
  "pricing-cards",
  "testimonial-cards",
  "team-cards",
  "stats",
  "timeline",
] as const;

/** Removed from the editor; stripped safely when loading/saving. */
export const REMOVED_ELEMENT_TYPES = [
  "html",
  "container",
  "rich-text",
  "newsletter-cta",
  "logo-showcase",
] as const;

export type LandingElementType = (typeof ELEMENT_TYPES)[number];

export const SECTION_TYPES = [
  "content",
  "columns-2",
  "columns-3",
  "image-text",
  "video",
  "cta",
  "custom",
] as const;

export type LandingSectionType = (typeof SECTION_TYPES)[number];

export type TextAlign = "right" | "center" | "left";

export type LandingElementStyles = {
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  color: string;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  marginTop: number;
  marginBottom: number;
  padding: number;
  width: string;
  maxWidth: string;
  minHeight: string;
  hiddenOnMobile: boolean;
  hiddenOnTablet: boolean;
  hiddenOnDesktop: boolean;
  backgroundColor: string;
  backgroundGradient: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  objectFit: "cover" | "contain" | "fill" | "none";
  opacity: number;
  boxShadow: string;
  gap: number;
};

export type LandingElement = {
  id: string;
  type: LandingElementType;
  content: Record<string, unknown>;
  styles: LandingElementStyles;
  columns?: LandingElement[][];
  label?: string;
  locked?: boolean;
  hidden?: boolean;
};

export type LandingSectionSettings = {
  backgroundColor: string;
  backgroundImageKey: string | null;
  backgroundImageSrc?: string | null;
  mobileBackgroundImageKey?: string | null;
  mobileBackgroundImageSrc?: string | null;
  backgroundGradient: string;
  backgroundOverlay: boolean;
  overlayColor: string;
  overlayOpacity: number;
  width: "default" | "wide" | "full";
  minHeight: string;
  paddingY: number;
  paddingX: number;
  marginY: number;
  borderRadius: number;
  align: TextAlign;
  verticalAlign: "top" | "center" | "bottom";
  gap: number;
  hiddenOnMobile: boolean;
  hiddenOnTablet: boolean;
  hiddenOnDesktop: boolean;
};

export type LandingSection = {
  id: string;
  type: LandingSectionType;
  settings: LandingSectionSettings;
  elements: LandingElement[];
  columns?: LandingElement[][];
  label?: string;
  locked?: boolean;
  hidden?: boolean;
};

export type LandingHero = {
  enabled: boolean;
  heading: string;
  description: string;
  backgroundImageKey: string | null;
  backgroundImageSrc?: string | null;
  mobileBackgroundImageKey?: string | null;
  mobileBackgroundImageSrc?: string | null;
  backgroundVideoKey: string | null;
  backgroundVideoSrc?: string | null;
  backgroundVideoPosterKey: string | null;
  backgroundVideoPosterSrc?: string | null;
  ctaText: string;
  ctaUrl: string;
  ctaOpenInNewTab: boolean;
  textAlign: TextAlign;
  overlay: boolean;
  overlayOpacity: number;
  minHeight: string;
  mobileMinHeight: string;
};

export type LandingContent = {
  version: number;
  hero: LandingHero;
  sections: LandingSection[];
};

export const ICON_OPTIONS = [
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
] as const;

export type LandingIconName = (typeof ICON_OPTIONS)[number];

export const ELEMENT_PALETTE_GROUPS = [
  {
    label: "محتوا",
    items: [
      { type: "heading" as const, label: "عنوان" },
      { type: "paragraph" as const, label: "پاراگراف" },
      { type: "text" as const, label: "متن" },
      { type: "quote" as const, label: "نقل‌قول" },
      { type: "list" as const, label: "فهرست" },
      { type: "divider" as const, label: "خط جداکننده" },
      { type: "spacer" as const, label: "فاصله" },
    ],
  },
  {
    label: "رسانه",
    items: [
      { type: "image" as const, label: "تصویر" },
      { type: "gallery" as const, label: "گالری" },
      { type: "slider" as const, label: "اسلایدر" },
      { type: "before-after" as const, label: "قبل و بعد" },
      { type: "video" as const, label: "ویدیو" },
      { type: "audio" as const, label: "صوت" },
    ],
  },
  {
    label: "تعاملی",
    items: [
      { type: "button" as const, label: "دکمه" },
      { type: "icon-button" as const, label: "دکمه آیکون" },
      { type: "link" as const, label: "لینک" },
      { type: "icon" as const, label: "آیکون" },
      { type: "social-links" as const, label: "شبکه‌های اجتماعی" },
      { type: "whatsapp-cta" as const, label: "واتساپ" },
      { type: "accordion" as const, label: "آکاردئون" },
      { type: "faq" as const, label: "سوالات متداول" },
      { type: "tabs" as const, label: "تب‌ها" },
      { type: "countdown" as const, label: "شمارش معکوس" },
    ],
  },
  {
    label: "کارت‌ها",
    items: [
      { type: "feature-cards" as const, label: "کارت ویژگی" },
      { type: "pricing-cards" as const, label: "قیمت‌گذاری" },
      { type: "testimonial-cards" as const, label: "نظرات" },
      { type: "team-cards" as const, label: "تیم" },
      { type: "stats" as const, label: "آمار" },
      { type: "timeline" as const, label: "خط زمانی" },
    ],
  },
] as const;

export const ELEMENT_PALETTE: Array<{
  type: LandingElementType;
  label: string;
}> = ELEMENT_PALETTE_GROUPS.flatMap((g) => [...g.items]);

export const SECTION_PALETTE: Array<{
  type: LandingSectionType;
  label: string;
}> = [
  { type: "content", label: "بخش محتوا" },
  { type: "columns-2", label: "دو ستون" },
  { type: "columns-3", label: "سه ستون" },
  { type: "image-text", label: "تصویر و متن" },
  { type: "video", label: "بخش ویدیو" },
  { type: "cta", label: "فراخوان اقدام" },
  { type: "custom", label: "بخش سفارشی" },
];

export const ELEMENT_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ELEMENT_PALETTE.map((item) => [item.type, item.label])),
  columns: "ستون‌ها",
  grid: "شبکه",
};

export function newBlockId(prefix = "el"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultElementStyles(
  extra: Partial<LandingElementStyles> = {},
): LandingElementStyles {
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

export function normalizeSectionSettings(
  settings: Partial<LandingSectionSettings> = {},
): LandingSectionSettings {
  return { ...defaultSectionSettings(), ...settings };
}

export function normalizeElement(element: LandingElement): LandingElement {
  return {
    ...element,
    styles: defaultElementStyles(element.styles || {}),
    columns: element.columns?.map((col) => col.map(normalizeElement)),
  };
}

export function defaultHero(title = ""): LandingHero {
  return {
    enabled: true,
    heading: title,
    description: "",
    backgroundImageKey: null,
    mobileBackgroundImageKey: null,
    backgroundVideoKey: null,
    backgroundVideoPosterKey: null,
    ctaText: "ثبت درخواست",
    ctaUrl: "#contact",
    ctaOpenInNewTab: false,
    textAlign: "center",
    overlay: true,
    overlayOpacity: 0.45,
    minHeight: "70vh",
    mobileMinHeight: "55vh",
  };
}

export function defaultSectionSettings(): LandingSectionSettings {
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

export function defaultLandingContent(title = ""): LandingContent {
  return {
    version: LANDING_CONTENT_VERSION,
    hero: defaultHero(title),
    sections: [],
  };
}

export function createElement(type: LandingElementType): LandingElement {
  const id = newBlockId(type);
  switch (type) {
    case "heading":
      return {
        id,
        type,
        content: { text: "عنوان جدید", level: 2 },
        styles: defaultElementStyles({
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.35,
          marginBottom: 16,
        }),
      };
    case "paragraph":
    case "text":
      return {
        id,
        type,
        content: { text: "متن خود را اینجا بنویسید." },
        styles: defaultElementStyles(),
      };
    case "quote":
      return {
        id,
        type,
        content: { text: "نقل‌قول الهام‌بخش شما.", author: "" },
        styles: defaultElementStyles({
          fontSize: 20,
          padding: 24,
          borderRadius: 12,
          backgroundColor: "#f9fafb",
        }),
      };
    case "list":
      return {
        id,
        type,
        content: {
          ordered: false,
          items: ["مورد اول", "مورد دوم", "مورد سوم"],
        },
        styles: defaultElementStyles({ align: "right" }),
      };
    case "image":
      return {
        id,
        type,
        content: {
          imageKey: null,
          imageUrl: "",
          mobileImageKey: null,
          mobileImageUrl: "",
          alt: "",
          linkUrl: "",
          linkNewTab: false,
          height: 0,
        },
        styles: defaultElementStyles({ borderRadius: 16, objectFit: "cover" }),
      };
    case "gallery":
      return {
        id,
        type,
        content: {
          items: [{ alt: "تصویر ۱" }, { alt: "تصویر ۲" }, { alt: "تصویر ۳" }],
          columns: 3,
        },
        styles: defaultElementStyles({ gap: 12 }),
      };
    case "slider":
      return {
        id,
        type,
        content: {
          items: [{ alt: "اسلاید ۱" }, { alt: "اسلاید ۲" }],
          autoplay: true,
          interval: 5000,
        },
        styles: defaultElementStyles({ borderRadius: 16 }),
      };
    case "before-after":
      return {
        id,
        type,
        content: {
          beforeKey: null,
          afterKey: null,
          mobileBeforeKey: null,
          mobileAfterKey: null,
          beforeAlt: "قبل",
          afterAlt: "بعد",
          label: "بکشید",
        },
        styles: defaultElementStyles({ borderRadius: 16 }),
      };
    case "video":
      return {
        id,
        type,
        content: {
          videoKey: null,
          videoUrl: "",
          posterKey: null,
          mobilePosterKey: null,
          autoplay: false,
          muted: true,
          loop: false,
          controls: true,
        },
        styles: defaultElementStyles({ borderRadius: 16 }),
      };
    case "audio":
      return {
        id,
        type,
        content: {
          audioKey: null,
          audioUrl: "",
          title: "",
          autoplay: false,
          loop: false,
        },
        styles: defaultElementStyles(),
      };
    case "button":
    case "link":
      return {
        id,
        type,
        content: {
          text: type === "link" ? "لینک" : "ثبت درخواست",
          url: "#contact",
          openInNewTab: false,
          variant: "brand",
        },
        styles: defaultElementStyles({
          align: "center",
          padding: 4,
          borderRadius: 12,
        }),
      };
    case "icon-button":
      return {
        id,
        type,
        content: {
          name: "ArrowLeft",
          url: "#contact",
          openInNewTab: false,
          variant: "brand",
          size: 40,
        },
        styles: defaultElementStyles({ align: "center", color: "#ffffff" }),
      };
    case "icon":
      return {
        id,
        type,
        content: { name: "Sparkles", size: 32, url: "" },
        styles: defaultElementStyles({ align: "center", color: "#c45c26" }),
      };
    case "social-links":
      return {
        id,
        type,
        content: {
          items: [
            { platform: "instagram", url: "https://instagram.com" },
            { platform: "telegram", url: "https://t.me" },
          ],
        },
        styles: defaultElementStyles({ align: "center", gap: 12 }),
      };
    case "whatsapp-cta":
      return {
        id,
        type,
        content: {
          phone: "",
          message: "سلام",
          text: "پیام در واتساپ",
        },
        styles: defaultElementStyles({ align: "center" }),
      };
    case "accordion":
    case "faq":
      return {
        id,
        type,
        content: {
          items: [
            {
              question: "سوال اول؟",
              answer: "پاسخ سوال اول.",
            },
            {
              question: "سوال دوم؟",
              answer: "پاسخ سوال دوم.",
            },
          ],
        },
        styles: defaultElementStyles({ gap: 8 }),
      };
    case "tabs":
      return {
        id,
        type,
        content: {
          items: [
            { label: "تب ۱", content: "محتوای تب اول" },
            { label: "تب ۲", content: "محتوای تب دوم" },
          ],
        },
        styles: defaultElementStyles(),
      };
    case "countdown":
      return {
        id,
        type,
        content: {
          targetDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          labels: {
            days: "روز",
            hours: "ساعت",
            minutes: "دقیقه",
            seconds: "ثانیه",
          },
        },
        styles: defaultElementStyles({ align: "center" }),
      };
    case "divider":
      return {
        id,
        type,
        content: { thickness: 1 },
        styles: defaultElementStyles({ marginTop: 16, marginBottom: 16 }),
      };
    case "spacer":
      return {
        id,
        type,
        content: { height: 32 },
        styles: defaultElementStyles({ marginBottom: 0 }),
      };
    case "columns":
      return {
        id,
        type,
        content: { count: 2 },
        styles: defaultElementStyles({ gap: 16 }),
        columns: [[], []],
      };
    case "grid":
      return {
        id,
        type,
        content: { columns: 3 },
        styles: defaultElementStyles({ gap: 16 }),
        columns: [[], [], []],
      };
    case "feature-cards":
      return {
        id,
        type,
        content: {
          items: [
            {
              title: "ویژگی ۱",
              description: "توضیح کوتاه.",
              icon: "Sparkles",
            },
            {
              title: "ویژگی ۲",
              description: "توضیح کوتاه.",
              icon: "Shield",
            },
            {
              title: "ویژگی ۳",
              description: "توضیح کوتاه.",
              icon: "Zap",
            },
          ],
        },
        styles: defaultElementStyles({ gap: 24 }),
      };
    case "pricing-cards":
      return {
        id,
        type,
        content: {
          items: [
            {
              title: "پایه",
              price: "رایگان",
              description: "برای شروع",
              features: ["ویژگی ۱", "ویژگی ۲"],
              url: "#contact",
            },
            {
              title: "حرفه‌ای",
              price: "۹۹۰,۰۰۰ ت",
              description: "محبوب",
              features: ["همه ویژگی‌ها", "پشتیبانی"],
              badge: "محبوب",
              url: "#contact",
            },
          ],
        },
        styles: defaultElementStyles({ gap: 24 }),
      };
    case "testimonial-cards":
      return {
        id,
        type,
        content: {
          items: [
            {
              quote: "تجربه عالی!",
              author: "مشتری",
              role: "مدیر",
              rating: 5,
            },
          ],
        },
        styles: defaultElementStyles({ gap: 24 }),
      };
    case "team-cards":
      return {
        id,
        type,
        content: {
          items: [{ name: "نام", role: "سمت" }],
        },
        styles: defaultElementStyles({ gap: 24 }),
      };
    case "stats":
      return {
        id,
        type,
        content: {
          items: [
            { value: "۱۰۰+", label: "مشتری" },
            { value: "۵۰+", label: "پروژه" },
          ],
        },
        styles: defaultElementStyles({ gap: 32, align: "center" }),
      };
    case "timeline":
      return {
        id,
        type,
        content: {
          items: [
            { title: "مرحله ۱", description: "توضیح", date: "۱۴۰۳" },
            { title: "مرحله ۲", description: "توضیح", date: "۱۴۰۴" },
          ],
        },
        styles: defaultElementStyles({ gap: 16 }),
      };
    default:
      return { id, type, content: {}, styles: defaultElementStyles() };
  }
}

export function createSection(type: LandingSectionType): LandingSection {
  const id = newBlockId("section");
  const settings = defaultSectionSettings();
  if (type === "cta") {
    settings.backgroundColor = "#111827";
    settings.paddingY = 72;
  }
  if (type === "columns-2" || type === "image-text") {
    return { id, type, settings, elements: [], columns: [[], []] };
  }
  if (type === "columns-3") {
    return { id, type, settings, elements: [], columns: [[], [], []] };
  }
  const elements: LandingElement[] = [];
  if (type === "cta") {
    elements.push(
      createElement("heading"),
      createElement("paragraph"),
      createElement("button"),
    );
    elements[0].content.text = "آماده شروع هستید؟";
    elements[0].styles.color = "#ffffff";
    elements[0].styles.align = "center";
    elements[1].content.text = "فرم ثبت درخواست در پایین صفحه آماده است.";
    elements[1].styles.color = "#e5e7eb";
    elements[1].styles.align = "center";
  }
  if (type === "video") {
    elements.push(createElement("video"));
  }
  return { id, type, settings, elements };
}

export function cloneBlock<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function duplicateElement(element: LandingElement): LandingElement {
  const copy = cloneBlock(element);
  copy.id = newBlockId(element.type);
  if (copy.columns)
    copy.columns = copy.columns.map((col) => col.map(duplicateElement));
  return copy;
}

export function duplicateSection(section: LandingSection): LandingSection {
  const copy = cloneBlock(section);
  copy.id = newBlockId("section");
  copy.elements = (copy.elements || []).map(duplicateElement);
  if (copy.columns)
    copy.columns = copy.columns.map((col) => col.map(duplicateElement));
  return copy;
}

export function str(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

const REMOVED_SET = new Set<string>(REMOVED_ELEMENT_TYPES);

export function filterRemovedElements(
  list: LandingElement[] = [],
): LandingElement[] {
  const out: LandingElement[] = [];
  for (const el of list) {
    if (!el || typeof el !== "object") continue;
    if (REMOVED_SET.has(el.type as string)) {
      // Promote nested children from legacy container-like shapes if present.
      const children = (el as { children?: LandingElement[] }).children;
      if (Array.isArray(children)) {
        out.push(...filterRemovedElements(children));
      }
      continue;
    }
    out.push({
      ...el,
      columns: el.columns?.map((col) => filterRemovedElements(col)),
    });
  }
  return out;
}

export function stripRemovedFromContent(content: LandingContent): LandingContent {
  return {
    ...content,
    sections: content.sections.map((section) => ({
      ...section,
      elements: filterRemovedElements(section.elements || []),
      columns: section.columns?.map((col) => filterRemovedElements(col)),
    })),
  };
}

export function findElementInSection(
  section: LandingSection | undefined,
  elementId: string,
): LandingElement | null {
  if (!section) return null;
  const walk = (list: LandingElement[] = []): LandingElement | null => {
    for (const el of list) {
      if (el.id === elementId) return el;
      for (const col of el.columns || []) {
        const found = walk(col);
        if (found) return found;
      }
    }
    return null;
  };
  return (
    walk(section.elements) ||
    (section.columns || []).reduce<LandingElement | null>(
      (found, col) => found || walk(col),
      null,
    )
  );
}

export function walkAllElements(
  content: LandingContent,
  visitor: (el: LandingElement, sectionId: string) => void,
) {
  for (const section of content.sections) {
    const walk = (list: LandingElement[]) => {
      for (const el of list) {
        visitor(el, section.id);
        for (const col of el.columns || []) walk(col);
      }
    };
    walk(section.elements || []);
    for (const col of section.columns || []) walk(col);
  }
}
