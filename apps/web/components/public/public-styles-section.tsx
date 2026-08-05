"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicSection } from "@/components/public/public-section";

interface Style {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  service: { id: string; name: string } | null;
}

export function PublicStylesSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-styles"],
    queryFn: () => apiGet<Style[]>("/public/styles"),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <PublicSection
      id="styles"
      eyebrow="سبک‌ها"
      title="سبک‌های ویدیو"
      description="انواع سبک تولید ویدیو متناسب با هویت و هدف برند شما"
    >
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="بارگذاری سبک‌ها ناموفق بود"
          description="لطفاً بعداً دوباره تلاش کنید."
        />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState title="سبکی ثبت نشده است" />
      ) : null}

      {data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((style) => (
            <article
              key={style.id}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-md"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-brand/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  {style.name}
                </h3>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-brand">
                  <Sparkles className="h-4 w-4" />
                </span>
              </div>
              {style.description ? (
                <p className="text-sm leading-7 text-muted-foreground">
                  {style.description}
                </p>
              ) : null}
              {style.service ? (
                <Badge variant="outline" className="mt-4 font-normal">
                  {style.service.name}
                </Badge>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </PublicSection>
  );
}
