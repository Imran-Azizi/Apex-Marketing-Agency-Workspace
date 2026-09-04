"use client";

import { useEffect, useState } from "react";

/** Landing sections used by public header internal navigation. */
export const PUBLIC_SECTION_IDS = [
  "home",
  "services",
  "portfolio",
  "customers",
  "contact",
] as const;

export type PublicSectionId = (typeof PUBLIC_SECTION_IDS)[number];

export const PUBLIC_NAV_ITEMS: Array<{ id: PublicSectionId; label: string }> = [
  { id: "home", label: "خانه" },
  { id: "services", label: "خدمات" },
  { id: "portfolio", label: "نمونه‌کارها" },
  { id: "customers", label: "مشتریان ما" },
  { id: "contact", label: "تماس با ما" },
];

/** Matches the public header bar (`h-[4.25rem]`). */
export const PUBLIC_HEADER_HEIGHT_CLASS = "h-[4.25rem]";
export const HEADER_OFFSET_PX = 72;
export const NO_PUBLIC_SECTIONS: readonly string[] = [];

export function scrollToSection(id: PublicSectionId | string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  if (id === "home") {
    history.replaceState(null, "", window.location.pathname);
  } else {
    history.replaceState(null, "", `#${id}`);
  }
}

function readActiveSection(ids: readonly string[]): string {
  const fallback = ids[0] || "home";
  const spyLine = HEADER_OFFSET_PX + 8;
  let current = fallback;

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= spyLine) {
      current = id;
    }
  }

  const doc = document.documentElement;
  const atBottom =
    window.innerHeight + window.scrollY >= doc.scrollHeight - 4;
  if (atBottom) {
    for (let i = ids.length - 1; i >= 0; i -= 1) {
      if (document.getElementById(ids[i])) return ids[i];
    }
  }

  return current;
}

/** Tracks which landing section sits under the fixed navbar. */
export function useActiveSection(ids: readonly string[] = PUBLIC_SECTION_IDS) {
  const [active, setActive] = useState(ids[0] || "home");
  const idsKey = ids.join(",");

  useEffect(() => {
    if (!ids.length) return;

    let frame = 0;
    const compute = () => {
      const next = readActiveSection(ids);
      setActive((prev) => (prev === next ? prev : next));
    };

    const onScrollOrResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    };

    compute();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    document.addEventListener("scroll", onScrollOrResize, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", onScrollOrResize);

    const main = document.querySelector("main");
    main?.addEventListener("scroll", onScrollOrResize, { passive: true });

    const observer = new MutationObserver(onScrollOrResize);
    observer.observe(main || document.body, { childList: true, subtree: true });

    // Home sections load via next/dynamic — retry until they exist.
    const retries = [100, 400, 1000, 2500].map((ms) =>
      window.setTimeout(compute, ms),
    );

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      document.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      main?.removeEventListener("scroll", onScrollOrResize);
      observer.disconnect();
      retries.forEach((timer) => window.clearTimeout(timer));
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ids, idsKey]);

  useEffect(() => {
    if (!ids.length) return;
    const hash = window.location.hash.replace("#", "");
    if (hash && ids.includes(hash)) {
      const t = window.setTimeout(() => scrollToSection(hash), 50);
      return () => window.clearTimeout(t);
    }
  }, [ids, idsKey]);

  return { active, setActive };
}
