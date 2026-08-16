"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { portfolioPublicStreamUrl } from "@/lib/media";
import { formatDate } from "@/lib/utils";
import { VideoPlayer } from "@/components/media/video-player";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicSection } from "@/components/public/public-section";

type PublicPortfolioItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string | null;
  serviceName: string | null;
  video: {
    id: string | null;
    mimeType: string;
    streamPath: string;
  };
};

export function PublicPortfolioSection({
  previewLimit = 6,
}: {
  previewLimit?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-portfolio"],
    queryFn: () => apiGet<PublicPortfolioItem[]>("/public/portfolio"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const items = (data || []).slice(0, previewLimit);

  return (
    <PublicSection
      id="portfolio"
      eyebrow="نمونه‌کارها"
      title="آثار منتخب اپیکس"
      description="مجموعه‌ای از پروژه‌های تکمیل‌شده برای نمایش کیفیت تولید ویدیو و هویت بصری برندها"
    >
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="بارگذاری نمونه‌کارها ناموفق بود"
          description="لطفاً کمی بعد دوباره تلاش کنید."
        />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState
          title="هنوز نمونه‌کاری منتشر نشده است"
          description="به‌زودی آثار منتخب اینجا نمایش داده می‌شوند."
        />
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-md"
            >
              <div className="border-b border-border/60 bg-black">
                <VideoPlayer
                  src={portfolioPublicStreamUrl(item.id)}
                  title={item.title}
                  className="rounded-none"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.serviceName ? (
                    <Badge variant="outline" className="font-normal">
                      {item.serviceName}
                    </Badge>
                  ) : null}
                  {item.publishedAt ? (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(item.publishedAt)}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </PublicSection>
  );
}
