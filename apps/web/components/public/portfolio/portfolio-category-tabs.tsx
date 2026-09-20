"use client";

import { useEffect, useRef } from "react";
import { getCustomTabListClass, getCustomTabTriggerClass } from "@/components/ui/tabs";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { cn } from "@/lib/utils";
import type { PublicPortfolioTab } from "@/lib/portfolio";

export function PortfolioCategoryTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: PublicPortfolioTab[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const node = activeRef.current;
    if (!node) return;
    node.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [value]);

  function move(currentSlug: string, delta: number) {
    const index = tabs.findIndex((tab) => tab.slug === currentSlug);
    if (index < 0) return;
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next) {
      onChange(next.slug);
      requestAnimationFrame(() => {
        document.getElementById(`portfolio-tab-${next.slug}`)?.focus();
      });
    }
  }

  return (
    <HorizontalScroll
      bordered={false}
      className="mx-auto mb-6 max-w-5xl sm:mb-10"
      viewportClassName="pb-0"
    >
      <div
        role="tablist"
        aria-label="کتگوری‌های نمونه های کاری"
        className={cn(
          getCustomTabListClass("premium"),
          "flex w-max min-w-full justify-start gap-1 p-1.5 sm:justify-center",
        )}
      >
        {tabs.map((tab) => {
          const active = value === tab.slug;
          return (
            <button
              key={tab.slug}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="portfolio-grid"
              id={`portfolio-tab-${tab.slug}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.slug)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  move(tab.slug, 1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  move(tab.slug, -1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  if (tabs[0]) onChange(tabs[0].slug);
                } else if (event.key === "End") {
                  event.preventDefault();
                  const last = tabs[tabs.length - 1];
                  if (last) onChange(last.slug);
                }
              }}
              className={cn(
                getCustomTabTriggerClass(active, "premium"),
                "h-10 shrink-0 px-3 text-xs sm:h-auto sm:px-4 sm:text-sm",
              )}
            >
              {tab.name}
            </button>
          );
        })}
      </div>
    </HorizontalScroll>
  );
}
