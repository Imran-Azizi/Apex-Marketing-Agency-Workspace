import { resolveAssetSrc, storagePublicUrl } from "@/lib/api";

/** Max services shown on the public homepage before “مشاهده همه خدمات”. */
export const PUBLIC_SERVICES_PREVIEW_LIMIT = 6;

export const SERVICE_DETAIL_BASE = "/services";

export type PublicService = {
  id: string;
  name: string;
  title?: string;
  slug: string;
  description: string | null;
  imageKey?: string | null;
  imageUrl?: string | null;
  startingPrice?: string | null;
  sortOrder?: number;
  displayOrder?: number;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  isPublished?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceListResponse = {
  items: PublicService[];
  total: number;
  page: number;
  pageSize: number;
};

export function serviceTitle(service: PublicService): string {
  return service.title || service.name || "خدمت";
}

export function serviceImageSrc(service: PublicService): string | null {
  return (
    resolveAssetSrc({
      imageUrl: service.imageUrl,
      url: service.imageUrl,
      storageKey: service.imageKey,
    }) || (service.imageKey ? storagePublicUrl(service.imageKey) : null)
  );
}

export function servicePath(slug: string) {
  return `${SERVICE_DETAIL_BASE}/${encodeURIComponent(slug)}`;
}

/** Card / CTA destination: custom CTA when set, otherwise the public detail page. */
export function resolveServiceHref(service: PublicService): string {
  const custom = service.ctaHref?.trim();
  if (custom) return custom;
  if (service.slug) return servicePath(service.slug);
  return "/#services";
}

export function isExternalServiceHref(href: string) {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

export async function fetchPublicServiceDetail(
  slug: string,
): Promise<PublicService | null> {
  const base =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  const res = await fetch(
    `${base}/public/services/${encodeURIComponent(decoded)}`,
    { next: { revalidate: 60, tags: ["public-services"] } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load service: ${res.status}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    data?: PublicService;
  };
  if (!json?.success || !json.data) return null;
  return json.data;
}
