"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type RevealTag = "div" | "section" | "header" | "article" | "aside" | "footer" | "span";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scroll-triggered reveal for the public site.
 * Plays once when the element enters the viewport; respects reduced motion.
 */
export function usePublicReveal<T extends HTMLElement = HTMLElement>(
  delayMs = 0,
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          frame = window.requestAnimationFrame(() => setVisible(true));
          observer.disconnect();
          break;
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const style =
    delayMs > 0
      ? ({ "--public-reveal-delay": `${delayMs}ms` } as CSSProperties)
      : undefined;

  return {
    ref,
    className: cn("public-reveal", visible && "is-visible"),
    style,
  };
}

export function PublicReveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: RevealTag;
}) {
  const reveal = usePublicReveal<HTMLElement>(delay);
  return createElement(
    as,
    {
      ref: reveal.ref,
      className: cn(reveal.className, className),
      style: reveal.style,
    },
    children,
  );
}
