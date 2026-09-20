"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type HorizontalScrollProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Show a bordered card-style frame around the scroll area. Default true. */
  bordered?: boolean;
  /** Optional minimum width applied to the inner content track. */
  minWidth?: string | number;
  /** Extra classes for the scrollable viewport. */
  viewportClassName?: string;
  /**
   * Show a custom horizontal scrollbar when content overflows.
   * Needed on mobile/WebKit where native scrollbars are hidden.
   * Default true.
   */
  showScrollbar?: boolean;
  /**
   * @deprecated Overflow-driven only — the track never appears when content fits.
   * Kept for call-site compatibility.
   */
  alwaysVisibleScrollbar?: boolean;
};

/** Ignore sub-pixel / border rounding that is not real overflow. */
const OVERFLOW_EPSILON_PX = 2;

function isRtlElement(el: HTMLElement) {
  return getComputedStyle(el).direction === "rtl";
}

function getMaxScroll(el: HTMLElement) {
  return Math.max(el.scrollWidth - el.clientWidth, 0);
}

function getScrollProgress(el: HTMLElement) {
  const max = getMaxScroll(el);
  if (max <= OVERFLOW_EPSILON_PX) return 0;
  return Math.min(Math.abs(el.scrollLeft) / max, 1);
}

function setScrollProgress(el: HTMLElement, progress: number) {
  const max = getMaxScroll(el);
  if (max <= OVERFLOW_EPSILON_PX) return;
  const p = Math.min(Math.max(progress, 0), 1);

  if (!isRtlElement(el)) {
    el.scrollLeft = p * max;
    return;
  }

  el.scrollLeft = -p * max;
  if (p > 0.01 && Math.abs(el.scrollLeft) < 1) {
    el.scrollLeft = p * max;
  }
}

/**
 * Reusable horizontal scroll frame for wide tables and chip rows.
 * Custom scrollbar and horizontal panning activate only when content
 * genuinely overflows the viewport width.
 */
export function HorizontalScroll({
  children,
  className,
  bordered = true,
  minWidth,
  viewportClassName,
  showScrollbar = true,
  alwaysVisibleScrollbar: _alwaysVisibleScrollbar = false,
  ...props
}: HorizontalScrollProps) {
  void _alwaysVisibleScrollbar;

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startProgress: number;
  } | null>(null);

  const [metrics, setMetrics] = React.useState({
    overflow: false,
    thumbRatio: 1,
    thumbOffset: 0,
  });

  const updateMetrics = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    const max = getMaxScroll(el);
    const overflow = max > OVERFLOW_EPSILON_PX;
    const thumbRatio = overflow
      ? Math.max(el.clientWidth / el.scrollWidth, 0.2)
      : 1;
    const progress = getScrollProgress(el);
    const thumbOffset = progress * (1 - thumbRatio);

    setMetrics((prev) => {
      if (
        prev.overflow === overflow &&
        Math.abs(prev.thumbRatio - thumbRatio) < 0.001 &&
        Math.abs(prev.thumbOffset - thumbOffset) < 0.001
      ) {
        return prev;
      }
      return { overflow, thumbRatio, thumbOffset };
    });
  }, []);

  React.useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    updateMetrics();

    const onScroll = () => updateMetrics();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateMetrics);
    });
    ro.observe(el);
    const child = el.firstElementChild;
    if (child) ro.observe(child);

    window.addEventListener("resize", updateMetrics);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [updateMetrics, children]);

  function progressFromClientX(clientX: number) {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return 0;

    const rect = track.getBoundingClientRect();
    const thumbWidth = rect.width * metrics.thumbRatio;
    const usable = Math.max(rect.width - thumbWidth, 1);
    const rtl = isRtlElement(viewport);

    const raw = rtl
      ? (rect.right - clientX - thumbWidth / 2) / usable
      : (clientX - rect.left - thumbWidth / 2) / usable;

    return Math.min(Math.max(raw, 0), 1);
  }

  function onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!metrics.overflow) return;
    if ((event.target as HTMLElement).dataset.thumb === "true") return;
    const el = viewportRef.current;
    if (!el) return;
    setScrollProgress(el, progressFromClientX(event.clientX));
    updateMetrics();
  }

  function onThumbPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!metrics.overflow) return;
    event.preventDefault();
    event.stopPropagation();
    const el = viewportRef.current;
    if (!el) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startProgress: getScrollProgress(el),
    };
  }

  function onThumbPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = viewportRef.current;
    const track = trackRef.current;
    if (!drag || !el || !track || drag.pointerId !== event.pointerId) return;

    const rect = track.getBoundingClientRect();
    const thumbWidth = rect.width * metrics.thumbRatio;
    const usable = Math.max(rect.width - thumbWidth, 1);
    const rtl = isRtlElement(el);
    const deltaX = event.clientX - drag.startX;
    const deltaProgress = (rtl ? -deltaX : deltaX) / usable;
    setScrollProgress(
      el,
      Math.min(Math.max(drag.startProgress + deltaProgress, 0), 1),
    );
  }

  function onThumbPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div
      className={cn(
        "max-w-full min-w-0 overflow-x-hidden",
        bordered && "overflow-hidden rounded-lg border bg-card",
        className,
      )}
      {...props}
    >
      <div
        ref={viewportRef}
        className={cn(
          "w-full max-w-full overscroll-x-contain",
          "[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          metrics.overflow ? "overflow-x-auto" : "overflow-x-hidden",
          viewportClassName,
        )}
      >
        {minWidth != null ? (
          <div
            style={{
              minWidth:
                typeof minWidth === "number" ? `${minWidth}px` : minWidth,
            }}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </div>

      {showScrollbar && metrics.overflow ? (
        <div className={cn("pt-2", bordered ? "px-2.5 pb-2.5" : "pb-1.5")}>
          <div
            ref={trackRef}
            role="scrollbar"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (metrics.thumbOffset /
                Math.max(1 - metrics.thumbRatio, 0.001)) *
                100,
            )}
            className="relative h-2.5 w-full cursor-pointer rounded-full bg-muted"
            onPointerDown={onTrackPointerDown}
          >
            <div
              data-thumb="true"
              className="absolute top-0 h-2.5 cursor-grab rounded-full bg-foreground/45 active:cursor-grabbing hover:bg-foreground/60 dark:bg-foreground/55 dark:hover:bg-foreground/70"
              style={{
                width: `${metrics.thumbRatio * 100}%`,
                insetInlineStart: `${metrics.thumbOffset * 100}%`,
              }}
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
              onPointerCancel={onThumbPointerUp}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
