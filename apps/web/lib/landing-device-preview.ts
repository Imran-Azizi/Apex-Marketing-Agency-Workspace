/**
 * Landing page device preview — industry-standard CSS viewport widths.
 * Breakpoints align with Tailwind `md` (768) and `lg` (1024).
 */

export type LandingPreviewDevice = "mobile" | "tablet" | "desktop";

/** Standard responsive ranges (CSS viewport width). */
export const LANDING_BREAKPOINTS = {
  mobile: { min: 320, max: 767 },
  tablet: { min: 768, max: 1023 },
  desktop: { min: 1024, max: 2560 },
} as const;

/** Tailwind / published-site breakpoint edges. */
export const LANDING_BP = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;

export const LANDING_PREVIEW_DEVICES: {
  id: LandingPreviewDevice;
  label: string;
  labelFa: string;
  width: number;
  rangeLabel: string;
}[] = [
  {
    id: "mobile",
    label: "Mobile",
    labelFa: "موبایل",
    width: 375,
    rangeLabel: "320–767px",
  },
  {
    id: "tablet",
    label: "Tablet",
    labelFa: "تبلت",
    width: 768,
    rangeLabel: "768–1023px",
  },
  {
    id: "desktop",
    label: "Desktop",
    labelFa: "دسکتاپ",
    width: 1440,
    rangeLabel: "1024px+",
  },
];

export function landingPreviewWidth(device: LandingPreviewDevice): number {
  return (
    LANDING_PREVIEW_DEVICES.find((item) => item.id === device)?.width ?? 1440
  );
}

/** Map a CSS viewport width to the active breakpoint band. */
export function landingDeviceFromWidth(width: number): LandingPreviewDevice {
  const w = Math.round(Number(width) || 1440);
  if (w < LANDING_BP.md) return "mobile";
  if (w < LANDING_BP.lg) return "tablet";
  return "desktop";
}

export function formatLandingViewportLabel(width: number): string {
  return `${Math.round(width)} × Auto`;
}

/**
 * Editor-only override so visibility helpers can respect the active
 * device preview without threading props through every render call site.
 * Public pages leave this null and keep CSS media queries.
 */
let activeLandingPreviewDevice: LandingPreviewDevice | null = null;

let activeLandingPreviewWidth: number | null = null;

export function setActiveLandingPreviewDevice(
  device: LandingPreviewDevice | null,
  width?: number | null,
) {
  activeLandingPreviewDevice = device;
  activeLandingPreviewWidth =
    width != null ? Math.round(Number(width) || 0) || null : null;
}

export function getActiveLandingPreviewDevice(): LandingPreviewDevice | null {
  return activeLandingPreviewDevice;
}

export function getActiveLandingPreviewWidth(): number | null {
  return activeLandingPreviewWidth;
}

/** True when the preview width is below the desktop image breakpoint (1024). */
export function landingPreviewUsesMobileImage(
  deviceOrWidth: LandingPreviewDevice | number | null | undefined,
): boolean {
  if (typeof deviceOrWidth === "number") {
    return deviceOrWidth < LANDING_BP.lg;
  }
  return deviceOrWidth === "mobile" || deviceOrWidth === "tablet";
}
