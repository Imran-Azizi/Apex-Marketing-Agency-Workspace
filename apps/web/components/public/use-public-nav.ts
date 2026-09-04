"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPortfolioWorkPath } from "@/lib/portfolio";
import {
  scrollToSection,
  type PublicSectionId,
} from "@/components/public/use-active-section";

/** Shared home-section navigation used by the public header and footer. */
export function usePublicSectionNav() {
  const pathname = usePathname();
  const router = useRouter();
  const onHome = pathname === "/";

  const goToSection = useCallback(
    (id: PublicSectionId, event?: MouseEvent) => {
      event?.preventDefault();
      if (onHome) {
        scrollToSection(id);
        return;
      }
      router.push(`/#${id}`);
    },
    [onHome, router],
  );

  return { pathname, onHome, goToSection };
}

export function isPublicNavActive(
  id: PublicSectionId,
  ctx: { onHome: boolean; pathname: string; activeSection: string },
) {
  if (id === "portfolio" && isPortfolioWorkPath(ctx.pathname)) return true;
  if (!ctx.onHome) return false;
  return ctx.activeSection === id;
}

/**
 * True after the page has left the very top. Uses IntersectionObserver on a
 * zero-height sentinel so we do not attach a scroll listener.
 */
export function usePublicHeaderElevated() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setElevated(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-12px 0px 0px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, elevated };
}
