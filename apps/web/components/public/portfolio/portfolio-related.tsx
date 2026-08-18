"use client";

import { Film } from "lucide-react";
import type { PublicPortfolioItem } from "@/lib/portfolio";
import { PortfolioGrid } from "./portfolio-grid";

export function PortfolioRelated({
  items,
  categoryName,
}: {
  items: PublicPortfolioItem[];
  categoryName?: string | null;
}) {
  return (
    <section
      aria-labelledby="related-videos-heading"
      className="border-t border-border/60 pt-10 sm:pt-12"
    >
      <header className="mb-7 sm:mb-8">
        <p className="mb-2 text-xs font-semibold tracking-wide text-brand">
          {categoryName || "نمونه های کاری"}
        </p>
        <h2
          id="related-videos-heading"
          className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
        >
          ویدیوهای مرتبط
        </h2>
      </header>

      {items.length > 0 ? (
        <PortfolioGrid items={items} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
            <Film className="h-7 w-7 text-brand" aria-hidden />
          </div>
          <h3 className="text-base font-semibold text-foreground sm:text-lg">
            ویدیوی مرتبط دیگری در این کتگوری نیست
          </h3>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            به‌زودی آثار بیشتری از این دسته در نمونه های کاری قرار می‌گیرد.
          </p>
        </div>
      )}
    </section>
  );
}
