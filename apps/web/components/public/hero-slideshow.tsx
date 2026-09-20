"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { HeroSlideView } from "@/components/public/hero-slide";
import { HeroControls } from "@/components/public/hero-controls";
import {
  HERO_IMAGE_QUALITY_LAZY,
  HERO_IMAGE_QUALITY_LCP,
  HERO_MOBILE_BREAKPOINT_PX,
  HERO_STAGE_CLASSNAME,
  heroDurationMs,
  heroSlidePaintUrl,
  type HeroSlide,
} from "@/lib/hero";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD_PX = 48;
const TRANSITION_MS = 520;

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

function useHeroMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < HERO_MOBILE_BREAKPOINT_PX;
  });
  useEffect(() => {
    const mq = window.matchMedia(
      `(max-width: ${HERO_MOBILE_BREAKPOINT_PX - 1}px)`,
    );
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/** @deprecated Use heroSlidePaintUrl from @/lib/hero */
export function heroSlideDisplayUrl(
  slide: HeroSlide | undefined,
  options: {
    quality?: number;
    isMobile?: boolean;
  } = {},
): string | null {
  return heroSlidePaintUrl(slide, {
    isMobile: options.isMobile,
    quality: options.quality,
  });
}

const preloadCache = new Map<string, Promise<boolean>>();

function preloadImageUrl(url: string): Promise<boolean> {
  const existing = preloadCache.get(url);
  if (existing) return existing;

  const promise = new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const img = new window.Image();
    // Don't await decode() — onload is enough to paint from HTTP cache.
    img.decoding = "async";
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
    // Instant hit when server <link rel=preload> already warmed the cache.
    if (img.complete && img.naturalWidth > 0) {
      finish(true);
    }
  });

  preloadCache.set(url, promise);
  return promise;
}

function HeroSlideshowSkeleton() {
  return (
    <div
      className="hero-slideshow-skeleton absolute inset-0 z-[5] flex items-center justify-center"
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220_18%_14%)] via-[hsl(220_16%_10%)] to-[hsl(46_40%_18%/0.35)]" />
      <div className="hero-slideshow-shimmer absolute inset-0" />
      <div className="relative z-[1] flex w-[min(88%,22rem)] flex-col items-center gap-3 px-4">
        <div className="h-3 w-24 rounded-full bg-brand/30" />
        <div className="h-5 w-full max-w-[16rem] rounded-full bg-white/14" />
        <div className="h-5 w-[85%] rounded-full bg-white/10" />
        <div className="mt-2 h-10 w-36 rounded-xl bg-brand/35" />
      </div>
    </div>
  );
}

export { HERO_STAGE_CLASSNAME };

export function HeroSlideshow({
  slides,
  className,
}: {
  slides: HeroSlide[];
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const isMobileViewport = useHeroMobileViewport();
  /** Index of the fully loaded slide currently shown to the user. */
  const [activeIndex, setActiveIndex] = useState(0);
  /** Previous index kept briefly for crossfade (both images already loaded). */
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  /** Confirmed display URLs keyed by `${slideId}:${m|d}` — only paint when present. */
  const [readyUrls, setReadyUrls] = useState<Record<string, string>>({});

  const liveId = useId();
  const regionRef = useRef<HTMLElement>(null);
  const requestTokenRef = useRef(0);
  const activeIndexRef = useRef(0);
  const transitioningRef = useRef(false);
  const outgoingTimerRef = useRef<number | null>(null);
  const isMobileRef = useRef(isMobileViewport);
  isMobileRef.current = isMobileViewport;
  const swipeRef = useRef<{
    id: number;
    x: number;
    y: number;
    locked: boolean | null;
  } | null>(null);

  const total = slides.length;
  const safeActive = total ? activeIndex % total : 0;
  const current = slides[safeActive];
  const duration = heroDurationMs(current);
  const autoplay =
    bootstrapped && total > 1 && !reducedMotion && !paused && !docHidden;
  const viewportKey = isMobileViewport ? "m" : "d";

  activeIndexRef.current = safeActive;

  const cacheKeyFor = useCallback(
    (slideId: string) => `${slideId}:${viewportKey}`,
    [viewportKey],
  );

  const markUrlReady = useCallback((cacheKey: string, url: string) => {
    setReadyUrls((prev) =>
      prev[cacheKey] === url ? prev : { ...prev, [cacheKey]: url },
    );
  }, []);

  const ensureSlideReady = useCallback(
    async (index: number): Promise<string | null> => {
      if (!total) return null;
      const i = ((index % total) + total) % total;
      const slide = slides[i];
      if (!slide) return null;

      const quality =
        i === 0 ? HERO_IMAGE_QUALITY_LCP : HERO_IMAGE_QUALITY_LAZY;
      const url = heroSlidePaintUrl(slide, {
        quality,
        isMobile: isMobileRef.current,
      });
      const key = `${slide.id}:${isMobileRef.current ? "m" : "d"}`;
      if (!url) {
        markUrlReady(key, "");
        return "";
      }

      const ok = await preloadImageUrl(url);
      if (!ok) return null;
      markUrlReady(key, url);
      return url;
    },
    [markUrlReady, slides, total],
  );

  /**
   * Request a slide change. Keeps the current slide visible until the target
   * image is fully loaded, then crossfades image + text as one unit.
   */
  const requestGoTo = useCallback(
    async (next: number) => {
      if (!total) return;
      const target = ((next % total) + total) % total;
      const token = ++requestTokenRef.current;

      const url = await ensureSlideReady(target);
      if (token !== requestTokenRef.current) return;
      if (url == null) return;

      const from = activeIndexRef.current;
      if (target === from && bootstrapped) return;

      if (outgoingTimerRef.current != null) {
        window.clearTimeout(outgoingTimerRef.current);
        outgoingTimerRef.current = null;
      }

      if (bootstrapped && from !== target && !reducedMotion) {
        transitioningRef.current = true;
        setOutgoingIndex(from);
        setActiveIndex(target);
        outgoingTimerRef.current = window.setTimeout(() => {
          setOutgoingIndex(null);
          transitioningRef.current = false;
          outgoingTimerRef.current = null;
        }, TRANSITION_MS);
      } else {
        setOutgoingIndex(null);
        setActiveIndex(target);
        transitioningRef.current = false;
      }

      if (!bootstrapped) setBootstrapped(true);
    },
    [bootstrapped, ensureSlideReady, reducedMotion, total],
  );

  const goNext = useCallback(() => {
    void requestGoTo(activeIndexRef.current + 1);
  }, [requestGoTo]);

  const goPrev = useCallback(() => {
    void requestGoTo(activeIndexRef.current - 1);
  }, [requestGoTo]);

  const goTo = useCallback(
    (next: number) => {
      void requestGoTo(next);
    },
    [requestGoTo],
  );

  // Bootstrap first slide ASAP; prefetch slide 2 in parallel (does not block reveal).
  useEffect(() => {
    let cancelled = false;
    setBootstrapped(false);
    (async () => {
      const first = ensureSlideReady(0);
      if (total > 1) {
        void ensureSlideReady(1);
      }
      const url = await first;
      if (cancelled || url == null) return;
      setActiveIndex(0);
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.map((s) => `${s.id}:${s.imageUrl}:${s.mobileImageUrl}`).join("|")]);

  // When crossing mobile/desktop breakpoint, swap to the matching crop without a skeleton flash.
  useEffect(() => {
    if (!bootstrapped) return;
    void ensureSlideReady(activeIndexRef.current);
    if (total > 1) {
      void ensureSlideReady((activeIndexRef.current + 1) % total);
    }
  }, [bootstrapped, ensureSlideReady, total, viewportKey]);

  // Prefetch the next slide while the current one is showing.
  useEffect(() => {
    if (!bootstrapped || total < 2 || docHidden) return;
    const next = (safeActive + 1) % total;
    void ensureSlideReady(next);
  }, [bootstrapped, docHidden, ensureSlideReady, safeActive, total, viewportKey]);

  // Autoplay: when timer fires, request next — stays on current until ready.
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setTimeout(() => {
      void requestGoTo(activeIndexRef.current + 1);
    }, duration);
    return () => window.clearTimeout(id);
  }, [autoplay, duration, safeActive, requestGoTo]);

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

  useEffect(() => {
    return () => {
      if (outgoingTimerRef.current != null) {
        window.clearTimeout(outgoingTimerRef.current);
      }
    };
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (total < 2 || !bootstrapped) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select, [role='button']")) {
        return;
      }
      swipeRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        locked: null,
      };
    },
    [bootstrapped, total],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (swipe.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipe.locked = Math.abs(dx) >= Math.abs(dy);
    }
    if (swipe.locked) event.preventDefault();
  }, []);

  const endSwipe = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const swipe = swipeRef.current;
      if (!swipe || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x;
      const horizontal = swipe.locked === true;
      swipeRef.current = null;
      if (!horizontal || Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (dx > 0) goPrev();
      else goNext();
    },
    [goNext, goPrev],
  );

  if (!current && slides.length === 0) return null;

  const mountedIndexes = new Set<number>();
  if (bootstrapped) {
    mountedIndexes.add(safeActive);
    if (outgoingIndex != null) mountedIndexes.add(outgoingIndex);
    // Keep next warm in the DOM only if already ready (hidden).
    if (total > 1) {
      const next = (safeActive + 1) % total;
      const nextSlide = slides[next];
      if (nextSlide && readyUrls[cacheKeyFor(nextSlide.id)] != null) {
        mountedIndexes.add(next);
      }
    }
  }

  return (
    <section
      ref={regionRef}
      id="home"
      aria-roledescription="carousel"
      aria-label="اسلایدشو هیرو"
      aria-labelledby="hero-heading"
      aria-busy={!bootstrapped}
      className={cn(
        "relative isolate scroll-mt-[4.25rem] overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      <div
        className={cn(HERO_STAGE_CLASSNAME, "touch-pan-y")}
        aria-live="off"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endSwipe}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
      >
        {!bootstrapped ? <HeroSlideshowSkeleton /> : null}

        {slides.map((slide, i) => {
          if (!mountedIndexes.has(i)) return null;
          const url = readyUrls[cacheKeyFor(slide.id)];
          // Never mount a slide unit until its image URL is confirmed loaded.
          if (url == null) return null;
          const isActive = i === safeActive;
          const isOutgoing = outgoingIndex === i;

          return (
            <HeroSlideView
              key={`${slide.id}:${viewportKey}`}
              slide={slide}
              imageSrc={url || null}
              imageReady
              active={isActive}
              priority={i === 0}
              animate={!reducedMotion && bootstrapped}
              compact={false}
              transitionMs={reducedMotion ? 0 : TRANSITION_MS}
              layer={isActive ? "active" : isOutgoing ? "outgoing" : "idle"}
            />
          );
        })}

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-[4] transition-opacity duration-500",
            bootstrapped ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="pointer-events-auto">
            <HeroControls
              index={safeActive}
              total={total}
              durationMs={duration}
              running={autoplay}
              complete={reducedMotion || total < 2}
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
        {bootstrapped && current
          ? `اسلاید ${safeActive + 1} از ${total}: ${current.title}`
          : "در حال بارگذاری اسلایدشو"}
      </p>
    </section>
  );
}
