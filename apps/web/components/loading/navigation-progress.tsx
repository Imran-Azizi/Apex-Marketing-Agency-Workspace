"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Slim top progress bar for App Router navigations.
 * Starts on internal link clicks; completes when the URL settles.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(0);
  const timers = useRef<number[]>([]);
  const active = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const complete = useCallback(() => {
    if (!active.current) return;
    clearTimers();
    setValue(100);
    const hide = window.setTimeout(() => {
      setVisible(false);
      setValue(0);
      active.current = false;
    }, 220);
    timers.current.push(hide);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    active.current = true;
    setVisible(true);
    setValue(12);
    const t1 = window.setTimeout(() => setValue(42), 120);
    const t2 = window.setTimeout(() => setValue(68), 380);
    const t3 = window.setTimeout(() => setValue(82), 900);
    timers.current.push(t1, t2, t3);
  }, [clearTimers]);

  // Complete whenever the route URL changes.
  useEffect(() => {
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only URL identity
  }, [pathname, searchParams?.toString()]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const next = `${url.pathname}${url.search}`;
        const current = `${window.location.pathname}${window.location.search}`;
        if (next === current) return;
        start();
      } catch {
        // ignore malformed hrefs
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2.5px]",
        visible ? "opacity-100" : "opacity-0",
        "transition-opacity duration-200",
      )}
    >
      <div
        className="ms-auto h-full rounded-full bg-brand shadow-[0_0_8px_hsl(var(--brand)/0.55)] transition-[width] duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
