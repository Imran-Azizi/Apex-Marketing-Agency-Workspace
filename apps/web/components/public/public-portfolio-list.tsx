"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { PortfolioCategoryTabs } from "@/components/public/portfolio/portfolio-category-tabs";
import { PortfolioGrid } from "@/components/public/portfolio/portfolio-grid";
import { cn } from "@/lib/utils";

const STALE_MS = 5 * 60_000;

export function PublicPortfolioListView({
  initialTabs,
  initialList,
}: {
  initialTabs?: PublicPortfolioTabs | null;
  initialList?: PublicPortfolioList | null;
}) {
  const [category, setCategory] = useState(MIXED_SLUG);
  const [expanded, setExpanded] = useState(false);

  const tabsQ = useQuery({
    queryKey: ["public-portfolio-tabs"],
    queryFn: () => apiGet<PublicPortfolioTabs>("/public/portfolio/categories"),
    staleTime: STALE_MS,
    initialData: initialTabs ?? undefined,
    initialDataUpdatedAt: Date.now(),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const listQ = useQuery({
    queryKey: ["public-portfolio", category],
    queryFn: () =>
      apiGet<PublicPortfolioList>(
        `/public/portfolio?category=${encodeURIComponent(category)}`,
      ),
    staleTime: STALE_MS,
    initialData:
      category === MIXED_SLUG ? (initialList ?? undefined) : undefined,
    initialDataUpdatedAt:
      category === MIXED_SLUG ? Date.now() : undefined,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const tabs = tabsQ.data?.tabs || [];
  const items = listQ.data?.items || [];
  const total = listQ.data?.total ?? items.length;
  const visible = expanded ? items : items.slice(0, PUBLIC_PREVIEW_LIMIT);
  const canShowMore = total > PUBLIC_PREVIEW_LIMIT;
  const isMixed = category === MIXED_SLUG;
  const bootLoading =
    (tabsQ.isLoading && !tabsQ.data) || (listQ.isLoading && !listQ.data);
  const refreshing = listQ.isFetching && !bootLoading && Boolean(listQ.data);
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
    <>
      {tabs.length > 0 ? (
        <PortfolioCategoryTabs
          tabs={tabs}
          value={category}
          onChange={handleCategoryChange}
        />
      ) : bootLoading ? (
        <div className="mx-auto mb-7 flex max-w-5xl gap-2 overflow-hidden sm:mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-xl sm:h-11 sm:w-32" />
          ))}
        </div>
      ) : null}

      {bootLoading ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card"
            >
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-3.5 sm:p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error && !bootLoading ? (
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

      {!bootLoading && !error && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 sm:mb-4 sm:h-14 sm:w-14">
            <Film className="h-6 w-6 text-brand sm:h-7 sm:w-7" aria-hidden />
          </div>
          <h3 className="text-base font-semibold text-foreground sm:text-lg">
            {emptyCopy.title}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground sm:leading-7">
            {emptyCopy.description}
          </p>
        </div>
      ) : null}

      {!bootLoading && !error && visible.length > 0 ? (
        <div
          key={category}
          className={cn(
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
            refreshing && "opacity-70 transition-opacity",
          )}
        >
          <div id="portfolio-grid" role="tabpanel">
            <PortfolioGrid items={visible} />
          </div>
          {canShowMore ? (
            <div className="mt-6 flex justify-center sm:mt-8">
              <Button
                variant={expanded ? "outline" : "brand"}
                size="lg"
                className="public-lift h-11 w-full max-w-xs rounded-xl px-8 sm:h-11 sm:w-auto sm:min-w-[10.5rem] sm:rounded-full"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "نمایش کمتر" : "مشاهده بیشتر"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
