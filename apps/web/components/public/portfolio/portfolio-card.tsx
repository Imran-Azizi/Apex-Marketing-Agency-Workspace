"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  portfolioCardExcerpt,
  portfolioWorkPath,
  type PublicPortfolioItem,
} from "@/lib/portfolio";
import { CoverImage } from "@/components/media/cover-image";
import { usePublicReveal } from "@/components/public/public-reveal";

export function PortfolioCard({
  item,
  className,
  index = 0,
}: {
  item: PublicPortfolioItem;
  className?: string;
  index?: number;
}) {
  const router = useRouter();
  const categoryName = item.category?.name;
  const excerpt = portfolioCardExcerpt(item);
  const href = portfolioWorkPath(item.slug);
  const reveal = usePublicReveal<HTMLElement>(Math.min(index, 8) * 60);

  return (
    <article
      ref={reveal.ref}
      className={cn(
        "h-full [content-visibility:auto] [contain-intrinsic-size:auto_320px]",
        reveal.className,
        className,
      )}
      style={reveal.style}
    >
      <Link
        href={href}
        prefetch={false}
        aria-label={`مشاهده ${item.title}`}
        onPointerEnter={() => {
          router.prefetch(href);
        }}
        onFocus={() => {
          router.prefetch(href);
        }}
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "[@media(hover:hover)]:transition-[transform,box-shadow,border-color] [@media(hover:hover)]:duration-300 [@media(hover:hover)]:ease-[cubic-bezier(0.22,1,0.36,1)]",
          "[@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:border-brand/30",
          "[@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:hover:shadow-brand/5",
        )}
      >
        <span className="relative block aspect-video w-full overflow-hidden bg-muted">
          {item.thumbnailUrl ? (
            <CoverImage
              src={item.thumbnailUrl}
              alt={item.title}
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              quality={72}
              className="[@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-500 [@media(hover:hover)]:ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:motion-safe:group-hover:scale-[1.04]"
            />
          ) : (
            <span
              className="absolute inset-0 bg-gradient-to-br from-muted via-card to-brand/20"
              aria-hidden
            />
          )}
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent transition-opacity duration-300 group-hover:opacity-90"
            aria-hidden
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-black/35 ring-4 ring-white/10 sm:h-14 sm:w-14 [@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-300 [@media(hover:hover)]:ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:motion-safe:group-hover:scale-110">
              <Play
                className="h-5 w-5 fill-current ps-0.5 sm:h-6 sm:w-6"
                aria-hidden
              />
            </span>
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-1 p-3.5 sm:gap-1.5 sm:p-4">
          {categoryName ? (
            <span className="text-[11px] font-medium tracking-wide text-brand">
              {categoryName}
            </span>
          ) : null}
          <span className="line-clamp-1 text-[0.95rem] font-semibold tracking-tight text-foreground transition-colors duration-200 group-hover:text-brand sm:text-base">
            {item.title}
          </span>
          {excerpt ? (
            <span className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {excerpt}
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
