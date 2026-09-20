"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeroControls({
  index,
  total,
  durationMs,
  running,
  paused,
  complete = false,
  onPrev,
  onNext,
  onGoTo,
  onTogglePause,
}: {
  index: number;
  total: number;
  durationMs: number;
  running: boolean;
  paused: boolean;
  complete?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (next: number) => void;
  onTogglePause: () => void;
}) {
  if (total < 1) return null;
  const current = String(index + 1).padStart(2, "0");
  const count = String(total).padStart(2, "0");

  const controlBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/55 text-white shadow-md shadow-black/25 backdrop-blur-md transition hover:border-brand/60 hover:bg-black/65 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 disabled:opacity-40 sm:h-10 sm:w-10";

  return (
    <div className="hero-controls-dock relative z-[3]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-1.5 px-3 pb-2.5 pt-2.5 sm:gap-3 sm:px-6 sm:pb-5 sm:pt-2 lg:px-8 lg:pb-8">
        <p
          className="shrink-0 pr-12 text-[0.625rem] font-semibold tabular-nums tracking-[0.14em] text-white min-[375px]:text-[0.6875rem] sm:pr-0 sm:text-sm [text-shadow:0_1px_2px_rgb(0_0_0_/_0.55),0_6px_16px_rgb(0_0_0_/_0.4)]"
          aria-hidden
        >
          <span className="text-brand">{current}</span>
          <span className="mx-1 text-white/50 sm:mx-1.5">/</span>
          <span>{count}</span>
        </p>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2">
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
                  "relative h-1.5 overflow-hidden rounded-full transition-all duration-300 sm:h-1.5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70",
                  "before:absolute before:-inset-y-3 before:-inset-x-1.5 before:content-['']",
                  active
                    ? "w-6 bg-brand/40 min-[375px]:w-7 sm:w-12"
                    : "w-1.5 bg-white/45 hover:bg-white/65 min-[375px]:w-2 sm:w-2.5",
                )}
              >
                {active ? (
                  <span
                    key={index}
                    className={cn(
                      "absolute inset-y-0 start-0 rounded-full bg-brand",
                      complete ? "w-full" : "hero-progress-fill",
                    )}
                    style={
                      complete
                        ? undefined
                        : {
                            animationDuration: `${Math.max(200, durationMs)}ms`,
                            animationPlayState: running ? "running" : "paused",
                          }
                    }
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {total > 1 ? (
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={paused ? "ادامه پخش خودکار" : "توقف پخش خودکار"}
              className={cn(controlBtn, "hidden min-[360px]:flex")}
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
            className={controlBtn}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={total < 2}
            aria-label="اسلاید بعدی"
            className={controlBtn}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
