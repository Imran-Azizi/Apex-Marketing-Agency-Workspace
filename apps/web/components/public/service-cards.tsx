"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import {
  serviceImageSrc,
  servicePath,
  serviceTitle,
  type PublicService,
} from "@/lib/services";
import { formatCurrency, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/media/cover-image";
import { usePublicReveal } from "@/components/public/public-reveal";

function orderLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

/** Collapse noisy whitespace so card previews read cleanly. */
function normalizeServiceCopy(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/** Keep paragraph breaks for the expanded view; tidy excess spaces. */
function formatExpandedServiceCopy(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Build a short RTL-friendly excerpt that ends on a word boundary
 * instead of cutting mid-phrase with CSS ellipsis.
 */
function serviceDescriptionExcerpt(text: string, maxChars = 120) {
  const normalized = normalizeServiceCopy(text);
  if (normalized.length <= maxChars) {
    return { preview: normalized, truncated: false };
  }

  const slice = normalized.slice(0, maxChars);
  const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("،"));
  const preview = (breakAt > Math.floor(maxChars * 0.45) ? slice.slice(0, breakAt) : slice).trimEnd();
  return { preview, truncated: true };
}

function ServiceDescription({ text }: { text: string }) {
  const textId = useId();
  const [expanded, setExpanded] = useState(false);
  const previewSource = normalizeServiceCopy(text);
  const fullCopy = formatExpandedServiceCopy(text);
  const { preview, truncated } = serviceDescriptionExcerpt(previewSource);
  const showToggle = truncated || expanded;

  return (
    <div className="flex min-h-[5.25rem] min-w-0 flex-1 flex-col sm:min-h-[5.75rem]">
      <p
        id={textId}
        className={cn(
          "min-w-0 text-start text-[13px] leading-7 text-muted-foreground sm:text-sm sm:leading-7",
          "transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded
            ? "whitespace-pre-line break-words"
            : "overflow-hidden break-words",
        )}
      >
        {expanded ? fullCopy : preview}
        {!expanded && truncated ? (
          <span aria-hidden className="text-muted-foreground">
            …
          </span>
        ) : null}
      </p>
      {showToggle ? (
        <button
          type="button"
          className={cn(
            "pointer-events-auto relative z-[2] mt-2 self-start",
            "text-[12px] font-semibold tracking-tight text-brand",
            "underline-offset-4 transition-colors duration-200",
            "hover:text-brand/80 hover:underline",
            "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          )}
          aria-expanded={expanded}
          aria-controls={textId}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? "مشاهده کمتر" : "مشاهده بیشتر"}
        </button>
      ) : null}
    </div>
  );
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
      className="[@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-500 [@media(hover:hover)]:ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:group-hover:scale-[1.04]"
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/15 via-muted to-background">
          <Clapperboard className="h-8 w-8 text-brand/70 transition-transform duration-300 group-hover:scale-105 sm:h-10 sm:w-10" />
        </div>
      }
    />
  );
}

export function ServiceCardsGrid({
  services,
  className,
  startIndex = 0,
}: {
  services: PublicService[];
  className?: string;
  /** Offset for order badges / reveal stagger when rendering a continuation grid. */
  startIndex?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3",
        className,
      )}
    >
      {services.map((service, index) => (
        <ServiceCard
          key={service.id}
          service={service}
          index={startIndex + index}
        />
      ))}
    </div>
  );
}

export function ServiceCard({
  service,
  index,
  interactive = true,
}: {
  service: PublicService;
  index: number;
  /** When false, renders a non-linking preview (e.g. catalog dialog). */
  interactive?: boolean;
}) {
  const title = serviceTitle(service);
  const imageSrc = serviceImageSrc(service);
  const detailHref = service.slug ? servicePath(service.slug) : "/#services";
  const reveal = usePublicReveal<HTMLElement>(Math.min(index, 5) * 70);

  const shellClassName = cn(
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:rounded-3xl",
    interactive && "cursor-pointer",
    "[content-visibility:auto] [contain-intrinsic-size:auto_360px]",
    "[@media(hover:hover)]:transition-[transform,box-shadow,border-color] [@media(hover:hover)]:duration-300 [@media(hover:hover)]:ease-[cubic-bezier(0.22,1,0.36,1)]",
    interactive &&
      "[@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:border-brand/35",
    interactive &&
      "[@media(hover:hover)]:hover:shadow-lg [@media(hover:hover)]:hover:shadow-brand/5",
  );

  return (
    <article
      ref={reveal.ref}
      data-service-index={index}
      className={cn(shellClassName, reveal.className)}
      style={reveal.style}
    >
      {interactive ? (
        <Link
          href={detailHref}
          prefetch={false}
          aria-label={`مشاهده ${title}`}
          className={cn(
            "absolute inset-0 z-0 rounded-[inherit] outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        />
      ) : null}

      <div className="pointer-events-none relative aspect-[16/10] overflow-hidden bg-muted sm:aspect-[16/10]">
        <ServiceImage src={imageSrc} alt={title} priority={false} />
        <Badge
          variant="secondary"
          className="absolute start-2.5 top-2.5 z-[1] border-0 bg-background/92 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground shadow-sm sm:start-3 sm:top-3 sm:text-xs"
        >
          {orderLabel(index)}
        </Badge>
      </div>

      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col gap-3 p-4 sm:gap-3.5 sm:p-6">
        <div className="space-y-1.5 sm:space-y-2">
          <h3 className="text-balance text-base font-semibold leading-7 tracking-tight text-foreground transition-colors duration-200 group-hover:text-brand sm:text-lg sm:leading-8">
            {title}
          </h3>
          {service.startingPrice ? (
            <p className="text-sm font-medium text-brand">
              از {formatCurrency(Number(service.startingPrice))}
            </p>
          ) : null}
        </div>

        {service.description ? (
          <ServiceDescription text={service.description} />
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-auto flex justify-center border-t border-border/60 pt-3 sm:pt-4">
          <span
            className={cn(
              "public-lift inline-flex h-10 min-w-[9.5rem] items-center justify-center rounded-xl px-5",
              "border border-brand/30 bg-brand/10 text-sm font-semibold tracking-tight text-brand shadow-sm shadow-brand/10",
              "sm:h-9 sm:min-w-[10rem] sm:rounded-full sm:px-6",
              "transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "[@media(hover:hover)]:group-hover:border-brand/45 [@media(hover:hover)]:group-hover:bg-brand/15",
              "[@media(hover:hover)]:group-hover:shadow-md [@media(hover:hover)]:group-hover:shadow-brand/15",
            )}
            aria-hidden
          >
            جزئیات بیشتر
          </span>
        </div>
      </div>
    </article>
  );
}
