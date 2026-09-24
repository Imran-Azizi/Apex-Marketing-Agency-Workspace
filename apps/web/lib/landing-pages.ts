import type { LandingContent } from "@/lib/landing-content";
import { defaultLandingContent } from "@/lib/landing-content";

export const RESERVED_LANDING_SLUGS = new Set([
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
  "sitemap.xml",
  "robots.txt",
  "opengraph-image",
  "twitter-image",
]);

export function slugifyLanding(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function validateLandingSlug(slug: string): string | null {
  const value = slugifyLanding(slug);
  if (!value || value.length < 2) return "نامک باید حداقل ۲ کاراکتر باشد";
  if (RESERVED_LANDING_SLUGS.has(value) || value.startsWith("_")) {
    return "این نامک رزرو شده است";
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(value)) {
    return "نامک فقط می‌تواند شامل حروف، عدد و خط تیره باشد";
  }
  return null;
}

export type LandingPageSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED";
  isPublished: boolean;
  publishedAt: string | null;
  hasUnpublishedChanges?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LandingPage = LandingPageSummary & {
  content: LandingContent;
  createdById?: string | null;
  updatedById?: string | null;
};

export type LandingPageListResponse = {
  items: LandingPageSummary[];
  total: number;
  published: number;
  unpublished: number;
  page: number;
  pageSize: number;
};

export type PublicLandingPage = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  content: LandingContent;
  publishedAt: string | null;
};

export function ensureLandingContent(value: unknown, title = ""): LandingContent {
  if (value && typeof value === "object" && "hero" in (value as object)) {
    const content = value as LandingContent;
    return {
      version: content.version || 1,
      hero: { ...defaultLandingContent(title).hero, ...content.hero },
      sections: Array.isArray(content.sections) ? content.sections : [],
    };
  }
  return defaultLandingContent(title);
}
