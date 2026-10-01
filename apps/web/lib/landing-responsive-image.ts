/** Match Tailwind `lg` — below this, prefer the small-screen image when present. */
export const LANDING_MOBILE_IMAGE_BREAKPOINT_PX = 1024;

export function resolveResponsiveImageSrcs({
  desktopSrc,
  mobileSrc,
}: {
  desktopSrc?: string | null;
  mobileSrc?: string | null;
}): {
  largeSrc: string | null;
  smallSrc: string | null;
  hasBoth: boolean;
} {
  const desktop = String(desktopSrc || "").trim();
  const mobile = String(mobileSrc || "").trim();
  const largeSrc = desktop || mobile || null;
  const smallSrc = mobile || desktop || null;
  const hasBoth = Boolean(desktop && mobile && desktop !== mobile);
  return { largeSrc, smallSrc, hasBoth };
}

/** Pick the active src for contexts that only accept one URL (e.g. video poster). */
export function pickResponsiveImageSrc(
  desktopSrc?: string | null,
  mobileSrc?: string | null,
  viewportWidth?: number,
): string | null {
  const { largeSrc, smallSrc } = resolveResponsiveImageSrcs({
    desktopSrc,
    mobileSrc,
  });
  if (!largeSrc) return null;
  const width =
    viewportWidth ??
    (typeof window !== "undefined" ? window.innerWidth : LANDING_MOBILE_IMAGE_BREAKPOINT_PX);
  return width < LANDING_MOBILE_IMAGE_BREAKPOINT_PX ? smallSrc : largeSrc;
}
