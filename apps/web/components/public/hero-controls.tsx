"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeroControls({
  index,
  total,
  progress,
  paused,
  onPrev,
  onNext,
  onGoTo,
  onTogglePause,
}: {
  index: number;
  total: number;
  progress: number;
  paused: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (next: number) => void;
  onTogglePause: () => void;
}) {
  if (total < 1) return null;
  const current = String(index + 1).padStart(2, "0");
  const count = String(total).padStart(2, "0");

  return (
    <div className="relative z-[2] mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 pb-6 pt-2 sm:px-6 sm:pb-8 lg:px-8">
      <p
        className="font-semibold tabular-nums tracking-[0.18em] text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.45),0_6px_16px_rgb(0_0_0_/_0.35)]"
        aria-hidden
      >
        <span className="text-brand">{current}</span>
        <span className="mx-1.5 text-white/50">/</span>
        <span>{count}</span>
      </p>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const active = i === index;
          return (
            <button
              key={i}
              type="button"
              aria-label={`اسلاید ${i + 1} از ${total}`}
              aria-current={active ? "true" : undefined}
              onClick={() => onGoTo(i)}
              className={cn(
                "relative h-1.5 overflow-hidden rounded-full transition-all duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70",
                active ? "w-10 bg-brand/35 sm:w-14" : "w-2.5 bg-white/35 hover:bg-white/55",
              )}
            >
              {active ? (
                <span
                  className="absolute inset-y-0 start-0 rounded-full bg-brand"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        {total > 1 ? (
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={paused ? "ادامه پخش خودکار" : "توقف پخش خودکار"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
          >
            {paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrev}
          disabled={total < 2}
          aria-label="اسلاید قبلی"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={total < 2}
          aria-label="اسلاید بعدی"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
