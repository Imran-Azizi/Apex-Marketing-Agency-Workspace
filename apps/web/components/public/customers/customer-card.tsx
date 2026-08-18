"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Building2, UserRound } from "lucide-react";
import {
  customerImageSrc,
  type ShowcaseCustomer,
} from "@/lib/customers";
import { cn } from "@/lib/utils";

function CustomerImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 via-muted to-background">
        <UserRound className="h-6 w-6 text-brand/70" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.05]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function CustomerDescription({
  text,
  onExpandedChange,
}: {
  text: string;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className="mt-2 w-full text-start">
      <p
        ref={textRef}
        className={cn(
          "min-w-0 text-[13px] leading-6 text-muted-foreground transition-[max-height] duration-300 ease-out",
          expanded ? "line-clamp-none" : "line-clamp-2",
        )}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-brand transition-colors hover:text-brand/80"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((value) => {
              const next = !value;
              onExpandedChange?.(next);
              return next;
            });
          }}
        >
          {expanded ? "مشاهده کمتر" : "مشاهده بیشتر"}
        </button>
      ) : null}
    </div>
  );
}

export function CustomerCard({
  customer,
  index = 0,
  className,
  onExpandedChange,
  header,
  footer,
}: {
  customer: ShowcaseCustomer;
  index?: number;
  className?: string;
  onExpandedChange?: (expanded: boolean) => void;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const imageSrc = customerImageSrc(customer);

  return (
    <article
      dir="rtl"
      className={cn(
        "group relative flex h-full flex-col items-center rounded-2xl border border-border/70 bg-card px-3.5 pb-3.5 pt-4 text-start shadow-sm",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md hover:shadow-brand/5",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      {header}
      <div
        className={cn(
          "relative size-[4.5rem] shrink-0 overflow-hidden rounded-full sm:size-20",
          "border border-brand/25 bg-muted",
          "ring-2 ring-background ring-offset-2 ring-offset-card",
          "transition-[border-color] duration-300 group-hover:border-brand/45",
        )}
      >
        <CustomerImage src={imageSrc} alt={customer.name} />
      </div>

      <div className="mt-3 flex min-w-0 w-full flex-1 flex-col">
        <h3 className="truncate text-center text-sm font-semibold leading-6 tracking-tight text-foreground sm:text-[15px]">
          {customer.name}
        </h3>
        <p className="mt-0.5 flex items-center justify-center gap-1 text-xs font-medium text-brand">
          <Building2 className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{customer.companyName}</span>
        </p>
        {customer.description ? (
          <CustomerDescription
            text={customer.description}
            onExpandedChange={onExpandedChange}
          />
        ) : null}
        {footer ? <div className="mt-auto w-full pt-3">{footer}</div> : null}
      </div>
    </article>
  );
}
