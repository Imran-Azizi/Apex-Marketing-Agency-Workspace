import { resolveAssetSrc, storagePublicUrl } from "@/lib/api";

export const DEFAULT_HERO_DURATION_SECONDS = 5;

export const HERO_DURATION_OPTIONS = [
  { value: 1, label: "1 ثانیه" },
  { value: 2, label: "2 ثانیه" },
  { value: 3, label: "3 ثانیه" },
  { value: 4, label: "4 ثانیه" },
  { value: 5, label: "5 ثانیه" },
  { value: 6, label: "6 ثانیه" },
  { value: 7, label: "7 ثانیه" },
  { value: 8, label: "8 ثانیه" },
  { value: 9, label: "9 ثانیه" },
  { value: 10, label: "10 ثانیه" },
] as const;

/** Public-site destinations for per-slide CTA buttons (mirrors API catalog). */
export const HERO_BUTTON_DESTINATIONS = [
  { id: "home", label: "صفحه اصلی" },
  { id: "about", label: "درباره ما" },
  { id: "services", label: "خدمات" },
  { id: "portfolio", label: "نمونه‌کارها" },
  { id: "customers", label: "مشتریان ما" },
  { id: "contact", label: "تماس با ما / ارسال درخواست" },
] as const;

export const HERO_BUTTON_EXTERNAL = "external" as const;

export type HeroButtonDestinationId =
  | (typeof HERO_BUTTON_DESTINATIONS)[number]["id"]
  | typeof HERO_BUTTON_EXTERNAL;

export type HeroSlide = {
  id: string;
  title: string;
  description: string | null;
  imageKey?: string | null;
  imageUrl?: string | null;
  altText?: string | null;
  durationSeconds?: number;
  sortOrder?: number;
  isPublished?: boolean;
  buttonEnabled?: boolean;
  buttonText?: string | null;
  buttonDestination?: HeroButtonDestinationId | string | null;
  buttonUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type HeroSlideListResponse = {
  items: HeroSlide[];
  total: number;
  published: number;
  unpublished: number;
  page: number;
  pageSize: number;
};

export function heroImageSrc(slide: HeroSlide): string | null {
  return (
    resolveAssetSrc({
      imageUrl: slide.imageUrl,
      url: slide.imageUrl,
      storageKey: slide.imageKey,
    }) || (slide.imageKey ? storagePublicUrl(slide.imageKey) : null)
  );
}

/** Accepts 1–10 seconds, or legacy millisecond values from older slides. */
export function normalizeHeroDurationSeconds(
  value?: number | null,
): number {
  if (value == null) return DEFAULT_HERO_DURATION_SECONDS;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_HERO_DURATION_SECONDS;
  if (n >= 1000) {
    return Math.min(10, Math.max(1, Math.round(n / 1000)));
  }
  return Math.min(10, Math.max(1, Math.round(n)));
}

export function heroDurationMs(slide?: HeroSlide | null): number {
  return normalizeHeroDurationSeconds(slide?.durationSeconds) * 1000;
}

export function heroDurationLabel(seconds?: number | null): string {
  const value = normalizeHeroDurationSeconds(seconds);
  return HERO_DURATION_OPTIONS.find((item) => item.value === value)?.label
    ?? `${value} ثانیه`;
}

export function heroSlideHasButton(slide: Pick<
  HeroSlide,
  "buttonEnabled" | "buttonText" | "buttonDestination" | "buttonUrl"
>): boolean {
  if (!slide.buttonEnabled) return false;
  if (!String(slide.buttonText || "").trim()) return false;
  if (!slide.buttonDestination) return false;
  if (slide.buttonDestination === HERO_BUTTON_EXTERNAL) {
    return Boolean(String(slide.buttonUrl || "").trim());
  }
  return true;
}

/**
 * Responsive sizes for hero images — mobile gets smaller srcset candidates.
 * Quality is preserved via Next AVIF/WebP at high quality settings.
 */
export const HERO_IMAGE_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, (max-width: 1920px) 100vw, 1920px";

/**
 * Public hero stage: locked 16:9 frame (design canvas 1920×1080).
 * Full-bleed on all devices — width 100%, height = width × 9/16.
 */
export const HERO_STAGE_CLASSNAME =
  "hero-stage relative w-full overflow-hidden aspect-video bg-[hsl(220_22%_8%)]";
