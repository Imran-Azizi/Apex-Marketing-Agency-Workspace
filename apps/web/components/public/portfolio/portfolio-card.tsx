"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { portfolioWorkPath, type PublicPortfolioItem } from "@/lib/portfolio";

export function PortfolioCard({
  item,
  className,
}: {
  item: PublicPortfolioItem;
  className?: string;
}) {
  const categoryName = item.category?.name;

  return (
    <article className={cn("h-full", className)}>
      <Link
        href={portfolioWorkPath(item.slug)}
        aria-label={`مشاهده ${item.title}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm outline-none transition-all duration-300 hover:border-brand/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-1"
      >
        <span className="relative block aspect-video w-full overflow-hidden bg-muted">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
            />
          ) : (
            <span
              className="absolute inset-0 bg-gradient-to-br from-muted via-card to-brand/20"
              aria-hidden
            />
          )}
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
            aria-hidden
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-black/35 ring-4 ring-white/10 transition-transform duration-300 motion-safe:group-hover:scale-110">
              <Play className="h-6 w-6 fill-current ps-0.5" aria-hidden />
            </span>
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-1.5 p-4">
          {categoryName ? (
            <span className="text-[11px] font-medium tracking-wide text-brand">
              {categoryName}
            </span>
          ) : null}
          <span className="line-clamp-1 text-base font-semibold tracking-tight text-foreground">
            {item.title}
          </span>
          {item.description ? (
            <span className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {item.description}
            </span>
          ) : null}
          {item.publishedAt ? (
            <span className="mt-auto pt-1 text-xs text-muted-foreground/90">
              {formatDate(item.publishedAt)}
            </span>
          ) : null}
        </span>
      </Link>
    </article>
  );
}
