"use client";

import Link from "next/link";
import { ArrowLeft, Clapperboard } from "lucide-react";
import {
  serviceImageSrc,
  serviceTitle,
  type PublicService,
} from "@/lib/services";
import { formatCurrency, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/media/cover-image";

function orderLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

function ServiceImage({
  src,
  alt,
  priority,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
}) {
  return (
    <CoverImage
      src={src}
      alt={alt}
      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
      quality={72}
      priority={priority}
      className="[@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-500 [@media(hover:hover)]:group-hover:scale-[1.03]"
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/15 via-muted to-background">
          <Clapperboard className="h-8 w-8 text-brand/70 sm:h-10 sm:w-10" />
        </div>
      }
    />
  );
}

export function ServiceCardsGrid({
  services,
  className,
}: {
  services: PublicService[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3",
        className,
      )}
    >
      {services.map((service, index) => (
        <ServiceCard key={service.id} service={service} index={index} />
      ))}
    </div>
  );
}

export function ServiceCard({
  service,
  index,
}: {
  service: PublicService;
  index: number;
}) {
  const title = serviceTitle(service);
  const imageSrc = serviceImageSrc(service);
  const ctaHref = service.ctaHref?.trim() || null;
  const ctaLabel = service.ctaLabel?.trim() || "جزئیات بیشتر";

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:rounded-3xl",
        "[content-visibility:auto] [contain-intrinsic-size:auto_360px]",
        "[@media(hover:hover)]:transition-[transform,box-shadow,border-color] [@media(hover:hover)]:duration-300",
        "[@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-brand/35",
        "[@media(hover:hover)]:hover:shadow-lg [@media(hover:hover)]:hover:shadow-brand/5",
        "motion-safe:animate-public-fade motion-reduce:animate-none",
      )}
      style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted sm:aspect-[16/10]">
        <ServiceImage src={imageSrc} alt={title} priority={false} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-80" />
        <Badge
          variant="secondary"
          className="absolute start-2.5 top-2.5 border-0 bg-background/92 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground shadow-sm sm:start-3 sm:top-3 sm:text-xs"
        >
          {orderLabel(index)}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:gap-3 sm:p-6">
        <div className="space-y-1.5 sm:space-y-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h3>
          {service.startingPrice ? (
            <p className="text-sm font-medium text-brand">
              از {formatCurrency(Number(service.startingPrice))}
            </p>
          ) : null}
        </div>

        {service.description ? (
          <p className="flex-1 text-sm leading-6 text-muted-foreground sm:leading-7 line-clamp-4 sm:line-clamp-none">
            {service.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {ctaHref ? (
          <div className="mt-0.5 flex justify-stretch border-t border-border/60 pt-3 sm:mt-1 sm:justify-end sm:pt-4">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-10 w-full gap-1.5 rounded-xl sm:h-9 sm:w-auto sm:rounded-full"
            >
              <Link href={ctaHref} prefetch={false}>
                {ctaLabel}
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
