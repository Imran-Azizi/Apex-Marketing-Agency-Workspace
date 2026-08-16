"use client";

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
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <header className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          {eyebrow ? (
            <p className="mb-3 text-xs font-semibold tracking-wide text-brand">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-3 text-pretty text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
              {description}
            </p>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
}
