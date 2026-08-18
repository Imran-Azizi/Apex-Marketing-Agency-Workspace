import { resolveAssetSrc, storagePublicUrl } from "@/lib/api";

export const CUSTOMER_DESCRIPTION_MAX = 280;

export type ShowcaseCustomer = {
  id: string;
  name: string;
  companyName: string;
  description: string | null;
  imageKey?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ShowcaseCustomerListResponse = {
  items: ShowcaseCustomer[];
  total: number;
  published: number;
  unpublished: number;
  page: number;
  pageSize: number;
};

export function customerImageSrc(customer: ShowcaseCustomer): string | null {
  return (
    resolveAssetSrc({
      imageUrl: customer.imageUrl,
      url: customer.imageUrl,
      storageKey: customer.imageKey,
    }) || (customer.imageKey ? storagePublicUrl(customer.imageKey) : null)
  );
}
