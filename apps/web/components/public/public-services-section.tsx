"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PublicService } from "@/lib/services";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PublicSection } from "@/components/public/public-section";
import { ServiceCardsGrid } from "@/components/public/service-cards";

export function PublicServicesSection({
  previewLimit = 3,
}: {
  previewLimit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-services"],
    queryFn: () => apiGet<PublicService[]>("/public/services"),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const items = showAll
    ? data || []
    : (data || []).slice(0, previewLimit);
  const hasMore = (data?.length || 0) > previewLimit;

  return (
    <PublicSection
      id="services"
      eyebrow="خدمات"
      title="خدمات ما"
      description="خدمات شرکت اپیکس، ساخت ویدیوهای تبلیغاتی است که با استفاده از موشن گرافیک، فوتیج‌های ارسالی و سرویس‌های هوش مصنوعی تولید می‌شوند."
      tone="muted"
    >
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
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
        <EmptyState
          title="خدمتی منتشر نشده است"
          description="به‌زودی خدمات جدید در این بخش نمایش داده می‌شوند."
        />
      ) : null}

      {items.length > 0 ? <ServiceCardsGrid services={items} /> : null}

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            variant="brand"
            className="gap-2 rounded-full px-5"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "نمایش کمتر" : "مشاهده همه خدمات"}
            {!showAll ? <ArrowLeft className="h-4 w-4" /> : null}
          </Button>
        </div>
      ) : null}
    </PublicSection>
  );
}
