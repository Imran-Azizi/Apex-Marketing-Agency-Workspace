"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { PublicService } from "@/lib/services";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { PublicSection } from "@/components/public/public-section";
import { ServiceCardsGrid } from "@/components/public/service-cards";

export function PublicServicesSection({
  previewLimit = 3,
  initialServices,
  description,
}: {
  previewLimit?: number;
  initialServices?: PublicService[] | null;
  description?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const data = initialServices || [];
  const items = showAll ? data : data.slice(0, previewLimit);
  const hasMore = data.length > previewLimit;

  return (
    <PublicSection
      id="services"
      eyebrow="خدمات"
      title="خدمات ما"
      description={description || undefined}
      tone="muted"
    >
      {data.length === 0 ? (
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
