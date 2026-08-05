"use client";

import { useQuery } from "@tanstack/react-query";
import { Clapperboard, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicSection } from "@/components/public/public-section";

interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startingPrice: string | null;
  revisionCount: number;
}

export function PublicServicesSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-services"],
    queryFn: () => apiGet<Service[]>("/public/services"),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <PublicSection
      id="services"
      eyebrow="خدمات"
      title="خدمات تولید محتوا و ویدیو"
      description="از ایده تا تحویل نهایی — بسته‌های حرفه‌ای متناسب با نیاز برند شما"
      tone="muted"
    >
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="بارگذاری خدمات ناموفق بود"
          description="لطفاً بعداً دوباره تلاش کنید."
        />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState title="خدمتی ثبت نشده است" />
      ) : null}

      {data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((service) => (
            <article
              key={service.id}
              className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition-transform group-hover:scale-105">
                <Clapperboard className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {service.name}
              </h3>
              {service.startingPrice ? (
                <p className="mt-1 text-sm font-medium text-brand">
                  از {formatCurrency(Number(service.startingPrice))}
                </p>
              ) : null}
              {service.description ? (
                <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">
                  {service.description}
                </p>
              ) : (
                <div className="flex-1" />
              )}
              <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-4">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="brand" className="font-normal">
                  {service.revisionCount.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}{" "}
                  دور بازبینی
                </Badge>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </PublicSection>
  );
}
