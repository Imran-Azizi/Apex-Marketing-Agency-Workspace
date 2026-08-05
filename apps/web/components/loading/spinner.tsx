import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-8 w-8",
} as const;

interface SpinnerProps {
  size?: keyof typeof sizeMap;
  className?: string;
  label?: string;
}

/** Compact brand-aware spinner for buttons, inline states, and overlays. */
export function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}
    >
      <Loader2
        className={cn("animate-spin text-brand", sizeMap[size])}
        aria-hidden
      />
      {label ? <span className="text-sm">{label}</span> : null}
      {!label ? <span className="sr-only">در حال بارگذاری...</span> : null}
    </span>
  );
}
