import { resolveAssetSrc, storagePublicUrl } from "@/lib/api";
import { isPublicCdnSrc } from "@/lib/cdn-image";

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
  /** Optional mobile-optimized crop key (manager). */
  mobileImageKey?: string | null;
  /** Optional mobile-optimized crop URL (public + manager). */
  mobileImageUrl?: string | null;
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

/**
 * Master design canvas for desktop hero uploads (16:9).
 * Export at this size for crisp desktop LCP; CDN derives smaller widths.
 */
export const HERO_IMAGE_MASTER_WIDTH = 1920;
export const HERO_IMAGE_MASTER_HEIGHT = 1080;

/** Optional 2× retina master when source quality allows (still 16:9). */
export const HERO_IMAGE_RETINA_WIDTH = 2560;
export const HERO_IMAGE_RETINA_HEIGHT = 1440;

/** Recommended mobile hero crop (3:4) — matches public mobile stage. */
export const HERO_MOBILE_IMAGE_WIDTH = 1080;
export const HERO_MOBILE_IMAGE_HEIGHT = 1440;

/** Match Tailwind `lg` — below this, prefer mobileImageUrl when present. */
export const HERO_MOBILE_BREAKPOINT_PX = 1024;

export function heroDesktopImageSrc(slide: HeroSlide): string | null {
  return (
    resolveAssetSrc({
      imageUrl: slide.imageUrl,
      url: slide.imageUrl,
      storageKey: slide.imageKey,
    }) || (slide.imageKey ? storagePublicUrl(slide.imageKey) : null)
  );
}

export function heroMobileImageSrc(slide: HeroSlide): string | null {
  const mobile =
    resolveAssetSrc({
      imageUrl: slide.mobileImageUrl,
      url: slide.mobileImageUrl,
      storageKey: slide.mobileImageKey,
    }) || (slide.mobileImageKey ? storagePublicUrl(slide.mobileImageKey) : null);
  return mobile || heroDesktopImageSrc(slide);
}

/** @deprecated Prefer heroDesktopImageSrc / heroMobileImageSrc */
export function heroImageSrc(slide: HeroSlide): string | null {
  return heroDesktopImageSrc(slide);
}

export function heroImageSrcForViewport(
  slide: HeroSlide,
  viewportWidth?: number,
): string | null {
  const width =
    viewportWidth ??
    (typeof window !== "undefined" ? window.innerWidth : HERO_MOBILE_BREAKPOINT_PX);
  if (width < HERO_MOBILE_BREAKPOINT_PX) {
    return heroMobileImageSrc(slide);
  }
  return heroDesktopImageSrc(slide);
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
 * Display-width hints for Next/Bunny srcset.
 * Mobile gets full viewport width; desktop caps at the 1920 master canvas.
 */
export const HERO_IMAGE_SIZES =
  "(max-width: 430px) 100vw, (max-width: 768px) 100vw, (max-width: 1280px) 100vw, 1440px";

/** First-slide quality — lean for fast LCP while still sharp. */
export const HERO_IMAGE_QUALITY_LCP = 72;

/** Neighbor / later slides — smaller payload for snappy advances. */
export const HERO_IMAGE_QUALITY_LAZY = 64;

/**
 * Public hero stage shell.
 * Responsive heights live on `.hero-stage` in globals.css (never purged).
 * Mobile/tablet use a shorter cinematic frame; desktop is full-viewport.
 */
export const HERO_STAGE_CLASSNAME = "hero-stage";

/** Cap CDN widths so phones/desktops never pull full master files. */
export const HERO_DISPLAY_WIDTH_MOBILE = 750;
export const HERO_DISPLAY_WIDTH_DESKTOP = 1440;

/** Bunny (or raw) URL with width/quality for a single preload candidate. */
export function heroOptimizedImageUrl(
  src: string,
  width: number,
  quality: number = HERO_IMAGE_QUALITY_LCP,
): string {
  if (!isPublicCdnSrc(src)) return src;
  try {
    const url = new URL(src);
    url.searchParams.set("width", String(width));
    url.searchParams.set("quality", String(quality));
    return url.toString();
  } catch {
    return src;
  }
}

/**
 * Exact display URL used by both server preload and client slideshow.
 * Keeping these identical is critical so the browser hits HTTP cache
 * instead of downloading the hero twice.
 */
export function heroSlidePaintUrl(
  slide: HeroSlide | undefined,
  options: {
    isMobile?: boolean;
    quality?: number;
  } = {},
): string | null {
  if (!slide) return null;
  const isMobile = options.isMobile ?? true;
  const quality = options.quality ?? HERO_IMAGE_QUALITY_LCP;
  const src = isMobile
    ? heroMobileImageSrc(slide)
    : heroDesktopImageSrc(slide);
  if (!src) return null;
  if (!isPublicCdnSrc(src)) return src;
  const width = isMobile
    ? HERO_DISPLAY_WIDTH_MOBILE
    : HERO_DISPLAY_WIDTH_DESKTOP;
  return heroOptimizedImageUrl(src, width, quality);
}

/**
 * Build preload descriptors for the first hero image so LCP can start
 * before client hydration. Uses the exact same URL as the client paint path.
 */
export function heroLcpPreload(
  slide?: HeroSlide | null,
  variant: "auto" | "desktop" | "mobile" = "auto",
): {
  href: string;
  imageSizes: string;
} | null {
  if (!slide) return null;

  const isMobile =
    variant === "mobile"
      ? true
      : variant === "desktop"
        ? false
        : Boolean(slide.mobileImageUrl || slide.mobileImageKey);

  const href = heroSlidePaintUrl(slide, {
    isMobile,
    quality: HERO_IMAGE_QUALITY_LCP,
  });
  if (!href) return null;

  return {
    href,
    imageSizes: isMobile
      ? `(max-width: ${HERO_MOBILE_BREAKPOINT_PX - 1}px) 100vw, 100vw`
      : `(min-width: ${HERO_MOBILE_BREAKPOINT_PX}px) 100vw, 100vw`,
  };
}
