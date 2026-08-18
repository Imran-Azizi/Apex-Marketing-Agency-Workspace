"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { HeroSlideView } from "@/components/public/hero-slide";
import { HeroControls } from "@/components/public/hero-controls";
import { heroDurationMs, heroImageSrc, type HeroSlide } from "@/lib/hero";
import { cn } from "@/lib/utils";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function HeroSlideshow({
  slides,
  className,
}: {
  slides: HeroSlide[];
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const [progress, setProgress] = useState(0);
  const liveId = useId();
  const regionRef = useRef<HTMLElement>(null);

  const total = slides.length;
  const safeIndex = total ? index % total : 0;
  const current = slides[safeIndex];
  const duration = heroDurationMs(current);
  const autoplay = total > 1 && !reducedMotion && !paused && !docHidden;

  const goTo = useCallback(
    (next: number) => {
      if (!total) return;
      setIndex(((next % total) + total) % total);
      setProgress(0);
    },
    [total],
  );

  const goPrev = useCallback(() => goTo(safeIndex - 1), [goTo, safeIndex]);
  const goNext = useCallback(() => goTo(safeIndex + 1), [goTo, safeIndex]);

  useEffect(() => {
    if (safeIndex >= total && total > 0) setIndex(0);
  }, [safeIndex, total]);

  useEffect(() => {
    if (!autoplay) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - started) / duration;
      if (t >= 1) {
        setProgress(1);
        goNext();
        return;
      }
      setProgress(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoplay, duration, safeIndex, goNext]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = regionRef.current;
      if (!root) return;
      const active = document.activeElement;
      if (!active || !root.contains(active)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, goTo, total]);

  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!current) return null;

  const firstSrc = heroImageSrc(slides[0]);
  const nearby = new Set(
    [safeIndex, (safeIndex + 1) % total, (safeIndex - 1 + total) % total].filter(
      (i) => i >= 0,
    ),
  );

  return (
    <section
      ref={regionRef}
      id="home"
      aria-roledescription="carousel"
      aria-label="اسلایدشو هیرو"
      aria-labelledby="hero-heading"
      className={cn(
        "relative isolate scroll-mt-20 overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      {firstSrc ? (
        <link rel="preload" as="image" href={firstSrc} />
      ) : null}

      <div
        className="relative min-h-[32rem] sm:min-h-[38rem] lg:min-h-[min(88vh,46rem)]"
        aria-live="off"
      >
        {slides.map((slide, i) =>
          nearby.has(i) || i === 0 ? (
            <HeroSlideView
              key={slide.id}
              slide={slide}
              active={i === safeIndex}
              priority={i === 0}
              animate={!reducedMotion}
            />
          ) : null,
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2]">
          <div className="pointer-events-auto">
            <HeroControls
              index={safeIndex}
              total={total}
              progress={reducedMotion || total < 2 ? 1 : progress}
              paused={paused || reducedMotion}
              onPrev={goPrev}
              onNext={goNext}
              onGoTo={goTo}
              onTogglePause={() => setPaused((v) => !v)}
            />
          </div>
        </div>
      </div>

      <p id={liveId} className="sr-only" aria-live="polite">
        اسلاید {safeIndex + 1} از {total}: {current.title}
      </p>
    </section>
  );
}
