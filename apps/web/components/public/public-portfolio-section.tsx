"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { apiGet } from "@/lib/api";
import {
  MIXED_SLUG,
  PUBLIC_PREVIEW_LIMIT,
  type PublicPortfolioList,
  type PublicPortfolioTabs,
} from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/loading/error-state";
import { PublicSection } from "@/components/public/public-section";
import { PortfolioCategoryTabs } from "@/components/public/portfolio/portfolio-category-tabs";
import { PortfolioGrid } from "@/components/public/portfolio/portfolio-grid";

export function PublicPortfolioSection() {
  const [category, setCategory] = useState(MIXED_SLUG);
  const [expanded, setExpanded] = useState(false);

  const tabsQ = useQuery({
    queryKey: ["public-portfolio-tabs"],
    queryFn: () => apiGet<PublicPortfolioTabs>("/public/portfolio/categories"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const listQ = useQuery({
    queryKey: ["public-portfolio", category],
    queryFn: () =>
      apiGet<PublicPortfolioList>(
        `/public/portfolio?category=${encodeURIComponent(category)}`,
      ),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const tabs = tabsQ.data?.tabs || [];
  const items = listQ.data?.items || [];
  const total = listQ.data?.total ?? items.length;
  const visible = expanded ? items : items.slice(0, PUBLIC_PREVIEW_LIMIT);
  const canShowMore = total > PUBLIC_PREVIEW_LIMIT;
  const isMixed = category === MIXED_SLUG;
  const loading = tabsQ.isLoading || listQ.isLoading;
  const error = tabsQ.error || listQ.error;

  const emptyCopy = useMemo(() => {
    if (isMixed) {
      return {
        title: "هنوز نمونه‌کاری برای کتگوری مختلط انتخاب نشده است",
        description:
          "آثار این بخش توسط تیم اپیکس انتخاب می‌شوند و به‌زودی اینجا قرار می‌گیرند.",
      };
    }
    return {
      title: "در این کتگوری هنوز نمونه‌کاری اضافه نشده است",
      description: "به‌زودی ویدیوهای این دسته در نمونه های کاری نمایش داده می‌شوند.",
    };
  }, [isMixed]);

  function handleCategoryChange(next: string) {
    setCategory(next);
    setExpanded(false);
  }

  return (
    <PublicSection id="portfolio" title="نمونه های کاری">
      {tabs.length > 0 ? (
        <PortfolioCategoryTabs
          tabs={tabs}
          value={category}
          onChange={handleCategoryChange}
        />
      ) : loading ? (
        <div className="mx-auto mb-10 flex max-w-5xl gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card"
            >
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error && !loading ? (
        <ErrorState
          title="دریافت نمونه‌کارها با مشکل مواجه شد"
          description="اتصال را بررسی کنید و دوباره تلاش کنید."
          retryLabel="تلاش مجدد"
          onRetry={() => {
            void tabsQ.refetch();
            void listQ.refetch();
          }}
        />
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
            <Film className="h-7 w-7 text-brand" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {emptyCopy.title}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            {emptyCopy.description}
          </p>
        </div>
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <div
          key={category}
          className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
        >
          <div id="portfolio-grid" role="tabpanel">
            <PortfolioGrid items={visible} />
          </div>
          {canShowMore ? (
            <div className="mt-8 flex justify-center">
              <Button
                variant={expanded ? "outline" : "brand"}
                size="lg"
                className="min-w-[10.5rem] rounded-full px-8"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "نمایش کمتر" : "مشاهده بیشتر"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </PublicSection>
  );
}
