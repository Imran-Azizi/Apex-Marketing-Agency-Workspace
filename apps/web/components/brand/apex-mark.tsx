import { cn } from "@/lib/utils";

export const APEX_BRAND_NAME = "اپیکس";
export const APEX_LOGO_SRC = "/brand/apex-logo.png";

export type ApexMarkTone = "auto" | "onDark" | "onLight";

export function ApexMark({
  className,
  title = APEX_BRAND_NAME,
  decorative = false,
  tone = "auto",
}: {
  className?: string;
  title?: string;
  decorative?: boolean;
  /**
   * auto — invert in dark theme
   * onDark — always light (sidebars)
   * onLight — never invert (print / white paper)
   */
  tone?: ApexMarkTone;
}) {
  return (
    <img
      src={APEX_LOGO_SRC}
      alt={decorative ? "" : title}
      aria-hidden={decorative || undefined}
      className={cn(
        "block shrink-0 object-contain object-center",
        tone === "onDark" && "brightness-0 invert",
        tone === "auto" && "dark:brightness-0 dark:invert",
        className,
      )}
    />
  );
}
