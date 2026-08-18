export const MIXED_SLUG = "mixed";
export const MIXED_LABEL = "کتگوری مختلط";
export const PUBLIC_PREVIEW_LIMIT = 6;
export const PORTFOLIO_WORK_BASE = "/نمونه-کارها";

export function portfolioWorkPath(slug: string) {
  return `${PORTFOLIO_WORK_BASE}/${slug}`;
}

export function isPortfolioWorkPath(pathname: string) {
  let decoded = pathname || "";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = pathname || "";
  }
  return (
    decoded === PORTFOLIO_WORK_BASE ||
    decoded.startsWith(`${PORTFOLIO_WORK_BASE}/`) ||
    /^\/portfolio\/[^/]+/.test(decoded)
  );
}

export async function fetchPublicPortfolioDetail(
  slug: string,
): Promise<PublicPortfolioDetail | null> {
  const base =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  const res = await fetch(
    `${base}/public/portfolio/${encodeURIComponent(decoded)}`,
    { next: { revalidate: 60 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error("PORTFOLIO_DETAIL_FETCH_FAILED");
  }
  const json = (await res.json()) as {
    success?: boolean;
    data?: PublicPortfolioDetail;
  };
  if (!json?.success || !json.data) return null;
  return json.data;
}

export type PortfolioStatus = "PUBLISHED" | "UNPUBLISHED";

export type PortfolioCategoryRef = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
};

export type PublicPortfolioTab = {
  id: string;
  slug: string;
  name: string;
  kind: "mixed" | "category";
  videoCount: number;
  sortOrder?: number;
};

export type PublicPortfolioItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  category: { id: string; name: string; slug: string } | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  video: {
    mimeType: string;
    streamPath: string;
  };
};

export type PublicPortfolioList = {
  category: {
    id?: string;
    slug: string;
    name: string;
    kind: "mixed" | "category";
  };
  items: PublicPortfolioItem[];
  total: number;
};

export type PublicPortfolioDetail = PublicPortfolioItem & {
  related: PublicPortfolioItem[];
};

export type PublicPortfolioTabs = {
  tabs: PublicPortfolioTab[];
};

export type PortfolioAdminItem = {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: PortfolioStatus;
  sortOrder: number;
  storageKey: string | null;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  inMixed: boolean;
  mixedSortOrder: number | null;
  categories: PortfolioCategoryRef[];
  project: {
    id: string;
    code: string;
    title: string;
    status: string;
    completedAt: string | null;
    serviceName: string | null;
  } | null;
  video: {
    id: string | null;
    name: string;
    kind: string;
    videoType: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    version: number;
  } | null;
  publishedBy: { id: string; fullName: string } | null;
};

export type PortfolioListPayload = {
  items: PortfolioAdminItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type PortfolioStats = {
  total: number;
  published: number;
  categories: number;
  mixed: number;
};

export type PortfolioAdminCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioStatusFilter = "ALL" | "PUBLISHED" | "UNPUBLISHED";
export type PortfolioMixedFilter = "ALL" | "IN" | "OUT";
