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
        "grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <PortfolioCard key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}
