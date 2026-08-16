"use client";

import { useEffect, useState } from "react";

/** Landing sections used by public header internal navigation. */
export const PUBLIC_SECTION_IDS = [
  "home",
  "services",
  "portfolio",
  "narrators",
] as const;

export type PublicSectionId = (typeof PUBLIC_SECTION_IDS)[number];

const HEADER_OFFSET_PX = 72;

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

/** Tracks which landing section is in view for active nav state. */
export function useActiveSection(ids: readonly string[] = PUBLIC_SECTION_IDS) {
  const [active, setActive] = useState(ids[0] || "home");

  useEffect(() => {
    if (!ids.length) return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.55],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  useEffect(() => {
    if (!ids.length) return;
    const hash = window.location.hash.replace("#", "");
    if (hash && ids.includes(hash)) {
      // Defer so section layout is ready after navigation/redirect
      const t = window.setTimeout(() => scrollToSection(hash), 50);
      return () => window.clearTimeout(t);
    }
  }, [ids]);

  return active;
}
