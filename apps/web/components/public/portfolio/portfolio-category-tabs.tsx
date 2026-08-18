"use client";

import { getCustomTabListClass, getCustomTabTriggerClass } from "@/components/ui/tabs";
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
    <div
      role="tablist"
      aria-label="کتگوری‌های نمونه های کاری"
      className={cn(
        getCustomTabListClass("premium"),
        "mx-auto mb-10 flex w-full max-w-5xl justify-start gap-1 overflow-x-auto overscroll-x-contain p-1.5",
        "flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:justify-center",
      )}
    >
      {tabs.map((tab) => {
        const active = value === tab.slug;
        return (
          <button
            key={tab.slug}
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
              "shrink-0",
            )}
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
