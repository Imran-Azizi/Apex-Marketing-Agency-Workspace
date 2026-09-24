import type { ReactNode } from "react";
import { PublicReveal } from "@/components/public/public-reveal";
import { cn } from "@/lib/utils";

export function PublicSection({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-20 overflow-visible bg-transparent", className)}
    >
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8 lg:py-24",
          contentClassName,
        )}
      >
        <PublicReveal
          as="header"
          className="mx-auto mb-7 max-w-2xl overflow-visible text-center sm:mb-14"
        >
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold tracking-wide text-brand sm:mb-3">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-2.5 whitespace-pre-wrap text-pretty text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base sm:leading-8 line-clamp-4 sm:line-clamp-none">
              {description}
            </p>
          ) : null}
        </PublicReveal>
        {children}
      </div>
    </section>
  );
}
