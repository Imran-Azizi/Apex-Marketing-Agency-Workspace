import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  "/api",
];

/** Real app routes that must not be treated as landing-page slugs. */
const STATIC_SLUGS = new Set([
  "services",
  "portfolio",
  "customers",
  "contact",
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
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
  "site.webmanifest",
  "opengraph-image",
  "twitter-image",
  "brand",
]);

const LOOKUP_TTL_MS = 60_000;
const lookupCache = new Map<string, { ok: boolean; exp: number }>();

function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function apiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
  ).replace(/\/+$/, "");
}

/** True when the public API has this item. On network failure, allow the request. */
async function publicItemExists(kind: "landing-pages" | "portfolio", slug: string) {
  const key = `${kind}:${slug}`;
  const hit = lookupCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.ok;
  try {
    const res = await fetch(
      `${apiBase()}/public/${kind}/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    const ok = res.ok;
    lookupCache.set(key, { ok, exp: Date.now() + LOOKUP_TTL_MS });
    return ok;
  } catch {
    return true;
  }
}

function missingPage(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/404/missing";
  return NextResponse.rewrite(url, { status: 404 });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPrivatePath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const parts = pathname.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });

  if (parts.length === 1 && !STATIC_SLUGS.has(parts[0]) && !parts[0].startsWith("_")) {
    const exists = await publicItemExists("landing-pages", parts[0]);
    if (!exists) return missingPage(request);
  }

  if (
    parts.length === 2 &&
    (parts[0] === "portfolio" || parts[0] === "نمونه-کارها")
  ) {
    const exists = await publicItemExists("portfolio", parts[1]);
    if (!exists) return missingPage(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$).*)",
  ],
};
