"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type TransitionEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ShowcaseCustomer } from "@/lib/customers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CustomerCard } from "./customer-card";

const GAP_PX = 14;
const AUTOPLAY_MS = 4800;
const RESUME_MS = 6500;
const DRAG_THRESHOLD = 42;

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

function useVisibleCount() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const compute = () => {
      const width = window.innerWidth;
      if (width >= 1280) setCount(4);
      else if (width >= 1024) setCount(3);
      else if (width >= 640) setCount(2);
      else setCount(1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return count;
}

export function CustomerCarousel({
  customers,
  className,
}: {
  customers: ShowcaseCustomer[];
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const visibleCount = useVisibleCount();
  const looping = customers.length > visibleCount;
  const liveId = useId();

  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [expandedCount, setExpandedCount] = useState(0);

  const offsetRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragDeltaRef = useRef(0);
  const resumeTimerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const cloneCount = looping ? visibleCount : 0;
  const slideWidth =
    viewportWidth > 0
      ? (viewportWidth - GAP_PX * (visibleCount - 1)) / visibleCount
      : 0;
  const step = slideWidth + GAP_PX;
  const ready = slideWidth > 0;

  const slides = looping
    ? [
        ...customers.slice(-cloneCount),
        ...customers,
        ...customers.slice(0, cloneCount),
      ]
    : customers;

  const pauseTemporarily = useCallback(() => {
    setPaused(true);
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      setPaused(false);
      resumeTimerRef.current = null;
    }, RESUME_MS);
  }, []);

  const jumpTo = useCallback((next: number) => {
    offsetRef.current = next;
    setAnimate(false);
    setOffset(next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
  }, []);

  const goTo = useCallback((next: number) => {
    offsetRef.current = next;
    setAnimate(true);
    setOffset(next);
  }, []);

  /** Autoplay direction: cards travel from left to right. */
  const moveRight = useCallback(() => {
    if (!looping) return;
    goTo(offsetRef.current - 1);
  }, [goTo, looping]);

  const moveLeft = useCallback(() => {
    if (!looping) return;
    goTo(offsetRef.current + 1);
  }, [goTo, looping]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const start = looping ? cloneCount : 0;
    offsetRef.current = start;
    setAnimate(false);
    setOffset(start);
    setDragX(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
  }, [customers.length, visibleCount, looping, cloneCount]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (
      !looping ||
      reducedMotion ||
      paused ||
      hovered ||
      hidden ||
      dragging ||
      expandedCount > 0
    ) {
      return;
    }
    const timer = window.setInterval(moveRight, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [
    looping,
    reducedMotion,
    paused,
    hovered,
    hidden,
    dragging,
    expandedCount,
    moveRight,
  ]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (!looping) return;
    const maxReal = cloneCount + customers.length;
    if (offsetRef.current < cloneCount) {
      jumpTo(offsetRef.current + customers.length);
      return;
    }
    if (offsetRef.current >= maxReal) {
      jumpTo(offsetRef.current - customers.length);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!looping || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a")) return;
    dragStartXRef.current = event.clientX;
    dragDeltaRef.current = 0;
    pointerIdRef.current = event.pointerId;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    pauseTemporarily();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const delta = event.clientX - dragStartXRef.current;
    dragDeltaRef.current = delta;
    setDragX(delta);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    if (pointerIdRef.current != null) {
      try {
        event.currentTarget.releasePointerCapture(pointerIdRef.current);
      } catch {
        /* already released */
      }
      pointerIdRef.current = null;
    }
    setDragging(false);
    const delta = dragDeltaRef.current;
    setDragX(0);
    if (Math.abs(delta) >= DRAG_THRESHOLD) {
      if (delta > 0) moveRight();
      else moveLeft();
    }
  }

  const translateX = looping && ready ? -(offset * step) + dragX : 0;

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={viewportRef}
        dir="ltr"
        className={cn(
          "overflow-hidden touch-pan-y",
          looping && "cursor-grab",
          dragging && "cursor-grabbing select-none",
        )}
        role="region"
        aria-roledescription="carousel"
        aria-labelledby={liveId}
        tabIndex={looping ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (!looping) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            pauseTemporarily();
            moveRight();
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            pauseTemporarily();
            moveLeft();
          }
        }}
      >
        <span id={liveId} className="sr-only">
          مشتریان ما
        </span>
        <div
          className={cn(
            "flex",
            looping ? "justify-start" : "flex-wrap justify-center",
            animate && !dragging && !reducedMotion && ready
              ? "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              : "transition-none",
          )}
          style={{
            gap: GAP_PX,
            transform: looping ? `translate3d(${translateX}px, 0, 0)` : undefined,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((customer, index) => (
            <div
              key={`${customer.id}-${index}`}
              className="min-w-0 shrink-0"
              style={{
                width: ready
                  ? slideWidth
                  : looping
                    ? `${100 / visibleCount}%`
                    : undefined,
                flex:
                  looping || ready
                    ? undefined
                    : "1 1 14rem",
                maxWidth: looping ? undefined : "17rem",
              }}
            >
              <CustomerCard
                customer={customer}
                index={looping ? Math.max(0, index - cloneCount) : index}
                className="animate-public-fade"
                onExpandedChange={(expanded) => {
                  setExpandedCount((count) =>
                    Math.max(0, count + (expanded ? 1 : -1)),
                  );
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {looping ? (
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-border/80 bg-card shadow-sm hover:border-brand/40 hover:bg-brand/10"
            aria-label="بعدی"
            onClick={() => {
              pauseTemporarily();
              moveRight();
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-border/80 bg-card shadow-sm hover:border-brand/40 hover:bg-brand/10"
            aria-label="قبلی"
            onClick={() => {
              pauseTemporarily();
              moveLeft();
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
