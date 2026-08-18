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
