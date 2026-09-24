import type { MetadataRoute } from "next";
import { fetchPublicJson, PUBLIC_REVALIDATE_SECONDS } from "@/lib/public-api";
import { portfolioWorkPath } from "@/lib/portfolio";
import { absoluteUrl, type PublicSeoIndex } from "@/lib/seo";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  const index = await fetchPublicJson<PublicSeoIndex>(
    "/public/seo-index",
    PUBLIC_REVALIDATE_SECONDS,
    ["public-portfolio", "public-landing-pages"],
  );

  for (const item of index?.portfolio || []) {
    if (!item.slug) continue;
    entries.push({
      url: absoluteUrl(portfolioWorkPath(item.slug)),
      lastModified: item.updatedAt ? new Date(item.updatedAt) : now,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const page of index?.landingPages || []) {
    if (!page.slug) continue;
    entries.push({
      url: absoluteUrl(`/${page.slug}`),
      lastModified: page.updatedAt ? new Date(page.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
