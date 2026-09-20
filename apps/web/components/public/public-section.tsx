import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PublicSection({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  tone = "default",
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 border-t border-border/50",
        tone === "muted" ? "bg-muted/20" : "bg-transparent",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <header className="mx-auto mb-7 max-w-2xl text-center sm:mb-14">
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
        </header>
        {children}
      </div>
    </section>
  );
}
