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
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
};

export default nextConfig;
