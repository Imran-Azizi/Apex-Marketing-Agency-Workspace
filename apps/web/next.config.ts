import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  // Keep file tracing inside this monorepo (ignore unrelated parent lockfiles).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  eslint: {
    // Workspace ESLint peer resolution can fail on CI; types still gate the build.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-query",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
    ],
  },
  async redirects() {
    return [
      { source: "/narrators", destination: "/", permanent: true },
      { source: "/chat", destination: "/dashboard", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/نمونه-کارها/:slug",
        destination: "/portfolio/:slug",
      },
      {
        source: "/%D9%86%D9%85%D9%88%D9%86%D9%87-%DA%A9%D8%A7%D8%B1%D9%87%D8%A7/:slug",
        destination: "/portfolio/:slug",
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    // CoverImage / hero use 80–85; required allow-list for Next 15.5+ / 16.
    qualities: [75, 80, 82, 85, 90, 100],
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
    let apiOrigin = "http://localhost:4000";
    try {
      apiOrigin = new URL(apiUrl).origin;
    } catch {
      /* keep default */
    }
    const wsOrigin = apiOrigin.replace(/^http/, "ws");
    const isDev = process.env.NODE_ENV !== "production";
    const mediaOrigins = new Set<string>([apiOrigin]);
    try {
      const parsed = new URL(apiOrigin);
      const altHost =
        parsed.hostname === "localhost"
          ? "127.0.0.1"
          : parsed.hostname === "127.0.0.1"
            ? "localhost"
            : null;
      if (altHost) {
        mediaOrigins.add(
          `${parsed.protocol}//${altHost}${parsed.port ? `:${parsed.port}` : ""}`,
        );
      }
    } catch {
      /* keep apiOrigin only */
    }
    // media-src must include the API origin: authenticated <video>/<audio>
    // streams use http(s)://api/... — 'self' is the Next app only, and
    // `https:` does not cover local http://localhost:4000 development.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      // Next.js requires 'unsafe-inline' for styles. Webpack HMR in development
      // also needs 'unsafe-eval'. Production builds do not.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
      `media-src 'self' blob: data: https: ${[...mediaOrigins].join(" ")}`,
      "font-src 'self' data:",
      `connect-src 'self' ${apiOrigin} ${wsOrigin} https: wss:`,
    ].join("; ");

    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
