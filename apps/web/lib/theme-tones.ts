/**
 * Shared light/dark surface tones aligned with the Manager panel.
 * Prefer these over bare amber/emerald classes that break dark mode.
 */

export type SurfaceTone =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

/** Card / panel border + background for KPI tiles and similar. */
export const TONE_CARD: Record<SurfaceTone, string> = {
  default: "border-border/70 bg-card",
  brand: "border-brand/20 bg-brand/[0.04]",
  success:
    "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20",
  warning:
    "border-amber-200/70 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20",
  danger: "border-destructive/20 bg-destructive/[0.04]",
  info: "border-sky-200/70 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20",
};

/** Icon chip background + foreground. */
export const TONE_ICON: Record<SurfaceTone, string> = {
  default: "bg-muted text-muted-foreground",
  brand: "bg-brand/10 text-brand",
  success:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

/** Inline revision / warning callout (banner inside cards). */
export const ALERT_CALLOUT =
  "rounded-xl border border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";

/** Larger revision banner (workspace headers). */
export const ALERT_BANNER =
  "rounded-2xl border border-amber-200/90 bg-amber-50/90 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";

export const ALERT_ICON =
  "text-amber-600 dark:text-amber-400";

/** Card border accent when item needs revision. */
export const ALERT_CARD_BORDER =
  "border-amber-300/80 dark:border-amber-800/60";

export const SUCCESS_ICON =
  "text-emerald-600 dark:text-emerald-400";

/** Progress / legend pigment bars (solid hues stay readable in both themes). */
export const STATUS_PIGMENT = {
  brand: "bg-brand",
  info: "bg-sky-500 dark:bg-sky-400",
  warning: "bg-amber-500 dark:bg-amber-400",
  caution: "bg-orange-500 dark:bg-orange-400",
  success: "bg-emerald-500 dark:bg-emerald-400",
  muted: "bg-muted-foreground",
} as const;
