"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { isPublicCdnSrc, publicCdnLoader } from "@/lib/cdn-image";
import { cn } from "@/lib/utils";

export function CoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
  fallback,
  /**
   * Unused for Bunny CDN (custom loader). Kept so call sites can still
   * request Next.js optimization for other hosts if needed.
   */
  optimize = false,
  quality = 82,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  fallback?: ReactNode;
  optimize?: boolean;
  quality?: number;
}) {
  const [failed, setFailed] = useState(false);
  const [direct, setDirect] = useState(false);
  const bunny = Boolean(src && isPublicCdnSrc(src));
  const remote = Boolean(src && /^https?:\/\//i.test(src));
  const useBunnyLoader = bunny && !direct;
  const useNextOptimizer = Boolean(optimize && remote && !bunny && !direct);

  if (!src || failed) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <Image
      key={`${src}:${useBunnyLoader ? "bunny" : useNextOptimizer ? "next" : "raw"}`}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      quality={quality}
      loader={useBunnyLoader ? publicCdnLoader : undefined}
      unoptimized={!useBunnyLoader && !useNextOptimizer}
      className={cn("h-full w-full object-cover", className)}
      onError={() => {
        if (useBunnyLoader || useNextOptimizer) {
          setDirect(true);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
