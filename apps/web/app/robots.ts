import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

const PRIVATE_PREFIXES = [
  "/login",
  "/portal",
  "/dashboard",
  "/manager",
  "/crm",
  "/crm-sales",
  "/projects",
  "/employees",
  "/finance",
  "/editor",
  "/narrator",
  "/project-manager",
  "/catalog",
  "/backup",
  "/settings",
  "/sales",
  "/sales-assistant",
  "/business-assistant",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/brand/", "/_next/static/", "/_next/image"],
        disallow: PRIVATE_PREFIXES,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
