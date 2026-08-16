import { resolveAssetSrc, storagePublicUrl } from "@/lib/api";

export type PublicService = {
  id: string;
  name: string;
  title?: string;
  slug: string;
  description: string | null;
  imageKey?: string | null;
  imageUrl?: string | null;
  startingPrice?: string | null;
  revisionCount?: number;
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
