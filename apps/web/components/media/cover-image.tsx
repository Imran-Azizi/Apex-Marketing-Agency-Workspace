"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
  fallback,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const remote = Boolean(src && /^https?:\/\//i.test(src));

  if (!src || failed) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={remote}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
