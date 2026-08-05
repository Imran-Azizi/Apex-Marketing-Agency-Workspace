"use client";

import { cn } from "@/lib/utils";
import {
  formatProgressPercentFa,
  resolveProgressPercent,
  type ProjectProgress,
} from "@/lib/project-progress";

export type ProjectProgressBarProps = {
  progress?: ProjectProgress | number | null;
  /** Fallback when progress payload is missing (legacy). */
  status?: string | null;
  /**
   * `full` — title + bar + percent
   * `compact` — muted title + bar + percent (cards/lists)
   * `inline` — thin bar + percent only
   */
  variant?: "full" | "compact" | "inline";
  className?: string;
  showTitle?: boolean;
};

/**
 * Global «پیشرفت پروژه» — percent bar only (no stage cards / extra metadata).
 */
export function ProjectProgressBar({
  progress,
  status,
  variant = "compact",
  className,
  showTitle = true,
}: ProjectProgressBarProps) {
  const percent = resolveProgressPercent(progress, status);

  const barHeight =
    variant === "full" ? "h-2.5" : variant === "compact" ? "h-2" : "h-1.5";

  return (
    <div
      dir="rtl"
      className={cn(
        "w-full min-w-0 text-start",
        variant === "full" && "space-y-2.5",
        variant === "compact" && "space-y-2",
        variant === "inline" && "space-y-1",
        className,
      )}
      role="group"
      aria-label="پیشرفت پروژه"
    >
      <div className="flex items-center justify-between gap-2">
        {showTitle && variant !== "inline" ? (
          <p
            className={cn(
              "font-semibold text-foreground",
              variant === "full"
                ? "text-sm"
                : "text-[11px] text-muted-foreground",
            )}
          >
            پیشرفت پروژه
          </p>
        ) : variant === "inline" ? (
          <span className="text-[11px] text-muted-foreground">پیشرفت</span>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "shrink-0 font-bold tabular-nums text-brand",
            variant === "full" ? "text-sm" : "text-[11px]",
          )}
        >
          {formatProgressPercentFa(percent)}
        </span>
      </div>

      <div
        className={cn("overflow-hidden rounded-full bg-muted", barHeight)}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`پیشرفت ${percent} درصد`}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
