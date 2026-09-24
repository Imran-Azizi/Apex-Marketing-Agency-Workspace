export const LANDING_CONTENT_VERSION = 1;

export const ELEMENT_TYPES = [
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
  hiddenOnMobile: boolean;
  hiddenOnDesktop: boolean;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  objectFit: "cover" | "contain" | "fill" | "none";
};

export type LandingElement = {
  id: string;
  type: LandingElementType;
  content: Record<string, unknown>;
  styles: LandingElementStyles;
  columns?: LandingElement[][];
};

export type LandingSectionSettings = {
  backgroundColor: string;
  backgroundImageKey: string | null;
  backgroundImageSrc?: string | null;
  width: "default" | "wide" | "full";
  minHeight: string;
  paddingY: number;
  paddingX: number;
  marginY: number;
  borderRadius: number;
  align: TextAlign;
};

export type LandingSection = {
  id: string;
  type: LandingSectionType;
  settings: LandingSectionSettings;
  elements: LandingElement[];
  columns?: LandingElement[][];
};

export type LandingHero = {
  enabled: boolean;
  heading: string;
  description: string;
  backgroundImageKey: string | null;
  backgroundImageSrc?: string | null;
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
    hiddenOnMobile: false,
    hiddenOnDesktop: false,
    backgroundColor: "",
    borderColor: "",
    borderWidth: 0,
    borderRadius: 0,
    objectFit: "cover",
    ...extra,
  };
}

export function defaultHero(title = ""): LandingHero {
  return {
    enabled: true,
    heading: title,
    description: "",
    backgroundImageKey: null,
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
    width: "default",
    minHeight: "",
    paddingY: 64,
    paddingX: 24,
    marginY: 0,
    borderRadius: 0,
    align: "center",
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
    case "image":
      return {
        id,
        type,
        content: {
          imageKey: null,
          imageUrl: "",
          alt: "",
          linkUrl: "",
          linkNewTab: false,
          height: 0,
        },
        styles: defaultElementStyles({ borderRadius: 16, objectFit: "cover" }),
      };
    case "video":
      return {
        id,
        type,
        content: {
          videoKey: null,
          videoUrl: "",
          posterKey: null,
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
    case "icon":
      return {
        id,
        type,
        content: { name: "Sparkles", size: 32, url: "" },
        styles: defaultElementStyles({ align: "center", color: "#c45c26" }),
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
        styles: defaultElementStyles(),
        columns: [[], []],
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
  if (copy.columns) copy.columns = copy.columns.map((col) => col.map(duplicateElement));
  return copy;
}

export function duplicateSection(section: LandingSection): LandingSection {
  const copy = cloneBlock(section);
  copy.id = newBlockId("section");
  copy.elements = (copy.elements || []).map(duplicateElement);
  if (copy.columns) copy.columns = copy.columns.map((col) => col.map(duplicateElement));
  return copy;
}

export const ELEMENT_PALETTE: Array<{
  type: LandingElementType;
  label: string;
}> = [
  { type: "heading", label: "عنوان" },
  { type: "paragraph", label: "پاراگراف" },
  { type: "text", label: "متن" },
  { type: "image", label: "تصویر" },
  { type: "video", label: "ویدیو" },
  { type: "audio", label: "صوت" },
  { type: "button", label: "دکمه" },
  { type: "icon", label: "آیکون" },
  { type: "link", label: "لینک" },
  { type: "divider", label: "خط جداکننده" },
  { type: "spacer", label: "فاصله" },
  { type: "columns", label: "ستون‌ها" },
];

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
