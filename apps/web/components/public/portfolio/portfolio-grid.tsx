"use client";

import { cn } from "@/lib/utils";
import type { PublicPortfolioItem } from "@/lib/portfolio";
import { PortfolioCard } from "./portfolio-card";

export function PortfolioGrid({
  items,
  className,
}: {
  items: PublicPortfolioItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-5 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <PortfolioCard key={item.id} item={item} />
      ))}
    </div>
  );
}
