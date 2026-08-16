import { cn } from "@/lib/utils";
import { ApexMark, APEX_BRAND_NAME, type ApexMarkTone } from "@/components/brand/apex-mark";

const MARK_SIZE = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-14 w-14",
  xl: "h-28 w-28",
  splash: "h-32 w-32",
} as const;

export type LogoSize = keyof typeof MARK_SIZE;
export type LogoVariant = "mark" | "lockup";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  subtitle?: string;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  /** Lighten the dark lockup for charcoal / sidebar surfaces. */
  onDark?: boolean;
  tone?: ApexMarkTone;
}

export function Logo({
  variant = "lockup",
  size = "md",
  subtitle,
  className,
  markClassName,
  wordmarkClassName,
  onDark = false,
  tone,
}: LogoProps) {
  const mark = (
    <ApexMark
      className={cn(MARK_SIZE[size], markClassName)}
      decorative={variant === "lockup"}
      tone={tone ?? (onDark ? "onDark" : "auto")}
    />
  );

  if (variant === "mark") {
    return <span className={cn("inline-flex", className)}>{mark}</span>;
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      {mark}
      {subtitle ? (
        <span
          className={cn(
            "min-w-0 truncate text-start text-[11px] leading-tight opacity-70",
            wordmarkClassName,
          )}
        >
          {subtitle}
        </span>
      ) : (
        <span className="sr-only">{APEX_BRAND_NAME}</span>
      )}
    </span>
  );
}
