"use client";

import { useState, type ReactNode } from "react";
import { CoverImage } from "@/components/media/cover-image";
import { isPublicCdnSrc, publicCdnLoader } from "@/lib/cdn-image";
import {
  LANDING_MOBILE_IMAGE_BREAKPOINT_PX,
  resolveResponsiveImageSrcs,
} from "@/lib/landing-responsive-image";
import { cn } from "@/lib/utils";

function optimizedSrc(src: string, width: number, quality = 82) {
  if (!isPublicCdnSrc(src)) return src;
  return publicCdnLoader({ src, width, quality });
}

/**
 * Renders desktop vs mobile landing images with a real CSS media switch.
 * When both sources exist, `<picture>` ensures only the matching asset is
 * requested. When only one exists, that image is used on every screen.
 */
export function ResponsiveCoverImage({
  desktopSrc,
  mobileSrc,
  alt,
  desktopSizes = "(max-width: 1280px) 100vw, 960px",
  mobileSizes = "100vw",
  className,
  priority = false,
  quality = 82,
  fallback,
}: {
  desktopSrc?: string | null;
  mobileSrc?: string | null;
  alt: string;
  desktopSizes?: string;
  mobileSizes?: string;
  className?: string;
  priority?: boolean;
  quality?: number;
  fallback?: ReactNode;
}) {
  const { largeSrc, smallSrc, hasBoth } = resolveResponsiveImageSrcs({
    desktopSrc,
    mobileSrc,
  });
  const [failed, setFailed] = useState(false);

  if (!largeSrc || failed) {
    return fallback ? <>{fallback}</> : null;
  }

  // Single asset → keep CoverImage (CDN loader + next/image).
  if (!hasBoth || !smallSrc) {
    return (
      <CoverImage
        src={largeSrc}
        alt={alt}
        sizes={desktopSizes}
        className={className}
        priority={priority}
        quality={quality}
        fallback={fallback}
      />
    );
  }

  const mobileQuery = `(max-width: ${LANDING_MOBILE_IMAGE_BREAKPOINT_PX - 1}px)`;
  const desktopQuery = `(min-width: ${LANDING_MOBILE_IMAGE_BREAKPOINT_PX}px)`;

  return (
    <picture className="absolute inset-0 block h-full w-full">
      {/* Small screens → small/mobile image */}
      <source
        media={mobileQuery}
        srcSet={optimizedSrc(smallSrc, 1080, quality)}
        sizes={mobileSizes}
      />
      {/* Large screens → large/desktop image */}
      <source
        media={desktopQuery}
        srcSet={optimizedSrc(largeSrc, 1920, quality)}
        sizes={desktopSizes}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={optimizedSrc(largeSrc, 1920, quality)}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding={priority ? "sync" : "async"}
        sizes={desktopSizes}
        className={cn("h-full w-full object-cover", className)}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}

/** Optional wrapper when the parent is not already `relative`. */
export function ResponsiveCoverImageFrame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>{children}</div>
  );
}
