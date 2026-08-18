import type { HeroSlide } from "@/lib/hero";

export type HeroStatusFilter = "ALL" | "active" | "inactive";

export type HeroSlideStats = {
  total: number;
  published: number;
  unpublished: number;
};

export type { HeroSlide };
