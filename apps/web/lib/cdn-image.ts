import type { ImageLoaderProps } from "next/image";

function isBunnyCdn(src: string): boolean {
  try {
    return /\.b-cdn\.net$/i.test(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * Direct Bunny Pull Zone URLs with width/quality hints.
 * When Bunny Optimizer is enabled the CDN returns a resized derivative;
 * otherwise the original file is still served and the browser fetches
 * only the srcset candidate it needs.
 */
export function publicCdnLoader({ src, width, quality }: ImageLoaderProps) {
  try {
    const url = new URL(src);
    if (!/\.b-cdn\.net$/i.test(url.hostname)) return src;
    url.searchParams.set("width", String(width));
    url.searchParams.set("quality", String(quality || 82));
    return url.toString();
  } catch {
    return src;
  }
}

export function isPublicCdnSrc(src: string | null | undefined): boolean {
  return Boolean(src && isBunnyCdn(src));
}
