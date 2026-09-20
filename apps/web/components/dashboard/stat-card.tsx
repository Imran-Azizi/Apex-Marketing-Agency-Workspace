"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_CARD, TONE_ICON, type SurfaceTone } from "@/lib/theme-tones";

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  tone = "default",
  className,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: Exclude<SurfaceTone, "info">;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md",
        TONE_CARD[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="break-words text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
            {value}
          </p>
          {hint ? (
            <p className="break-words text-[11px] leading-5 text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            TONE_ICON[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}
