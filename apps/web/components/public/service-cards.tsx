"use client";

import { useState } from "react";
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

function orderLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

function ServiceImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/15 via-muted to-background">
        <Clapperboard className="h-10 w-10 text-brand/70" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      loading="lazy"
      onError={() => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[service-image] failed to load:", src);
        }
        setFailed(true);
      }}
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
    <div className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
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
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm",
        "transition-all duration-300 hover:-translate-y-1 hover:border-brand/35 hover:shadow-lg hover:shadow-brand/5",
        "animate-public-fade",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <ServiceImage src={imageSrc} alt={title} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-80" />
        <Badge
          variant="secondary"
          className="absolute start-3 top-3 border-0 bg-background/90 font-semibold tabular-nums text-foreground shadow-sm backdrop-blur"
        >
          {orderLabel(index)}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h3>
          {service.startingPrice ? (
            <p className="text-sm font-medium text-brand">
              از {formatCurrency(Number(service.startingPrice))}
            </p>
          ) : null}
        </div>

        {service.description ? (
          <p className="flex-1 text-sm leading-7 text-muted-foreground">
            {service.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          {service.revisionCount != null ? (
            <span className="text-xs text-muted-foreground">
              {service.revisionCount.toLocaleString("fa-AF", {
                numberingSystem: "latn",
              })}{" "}
              دور بازبینی
            </span>
          ) : (
            <span />
          )}
          {ctaHref ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
            >
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
