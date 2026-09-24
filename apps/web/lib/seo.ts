import type { Metadata } from "next";
import {
  COMPANY_INTRO_DESCRIPTION,
  COMPANY_INTRO_TITLE,
} from "@/lib/company";

/** Public brand name used in titles, Open Graph, and structured data. */
export const SITE_NAME = COMPANY_INTRO_TITLE;
export const SITE_NAME_SHORT = "اپیکس";
export const SITE_LOCALE = "fa_AF";
export const SITE_LANGUAGE = "fa-AF";

/** Fallback when the CMS company description has not been saved yet. */
export const DEFAULT_DESCRIPTION = COMPANY_INTRO_DESCRIPTION;

/**
 * Production origin. Prefer NEXT_PUBLIC_SITE_URL. Otherwise use the origin of
 * NEXT_PUBLIC_API_URL (https://smartapex.tech/api/v1 → https://smartapex.tech).
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) {
    try {
      const url = new URL(api);
      const local =
        url.hostname === "localhost" || url.hostname === "127.0.0.1";
      // Production serves the site and /api on one host. Local API is a
      // different port, so keep canonicals on the Next.js origin.
      if (!local) return url.origin;
    } catch {
      /* ignore malformed API URL */
    }
  }
  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const INDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
};

export function truncateMeta(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

type PageSeoInput = {
  title: string;
  description: string;
  /** Path only, e.g. "/" or "/نمونه-کارها/slug". */
  path: string;
  image?: string | null;
  imageAlt?: string;
  ogType?: "website" | "article" | "video.other";
  index?: boolean;
};

/**
 * Page metadata. Titles are absolute so the public title template does not
 * append the brand a second time.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  ogType = "website",
  index = true,
}: PageSeoInput): Metadata {
  const desc = truncateMeta(description);
  const url = absoluteUrl(path);
  const imageUrl = image ? absoluteUrl(image) : undefined;
  return {
    title: { absolute: title },
    description: desc,
    alternates: { canonical: url },
    robots: index ? INDEX_ROBOTS : NOINDEX_ROBOTS,
    openGraph: {
      title,
      description: desc,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: ogType,
      ...(imageUrl
        ? { images: [{ url: imageUrl, alt: imageAlt || title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export function homeTitle() {
  return `${SITE_NAME} | ویدیو تبلیغاتی، برندینگ و بازاریابی`;
}

export function homeDescription(cmsDescription?: string | null) {
  const fromCms = cmsDescription?.replace(/\s+/g, " ").trim();
  return fromCms || DEFAULT_DESCRIPTION;
}

/** Search-console tokens. Empty values are omitted so nothing fake is emitted. */
export function searchVerification(): Metadata["verification"] | undefined {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type SeoIndexEntry = {
  slug: string;
  updatedAt: string | null;
};

export type PublicSeoIndex = {
  portfolio: SeoIndexEntry[];
  landingPages: SeoIndexEntry[];
};
