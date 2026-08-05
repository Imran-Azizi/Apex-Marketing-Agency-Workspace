"use client";

import { useEffect, useState } from "react";

export const PUBLIC_SECTION_IDS = [
  "home",
  "services",
  "styles",
  "narrators",
] as const;

export type PublicSectionId = (typeof PUBLIC_SECTION_IDS)[number];

export function scrollToSection(id: PublicSectionId | string) {
  const el = document.getElementById(id);
  if (!el) return;
  const headerOffset = 72;
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", `#${id}`);
}

/** Tracks which landing section is in view for active nav state. */
export function useActiveSection(ids: readonly string[] = PUBLIC_SECTION_IDS) {
  const [active, setActive] = useState(ids[0] || "home");

  useEffect(() => {
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
    const hash = window.location.hash.replace("#", "");
    if (hash && ids.includes(hash)) {
      // Defer so layout is ready
      requestAnimationFrame(() => scrollToSection(hash));
    }
  }, [ids]);

  return active;
}
