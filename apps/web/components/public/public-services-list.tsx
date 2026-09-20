"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { PublicService } from "@/lib/services";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ServiceCardsGrid } from "@/components/public/service-cards";

export function PublicServicesList({
  previewLimit = 3,
  initialServices,
}: {
  previewLimit?: number;
  initialServices?: PublicService[] | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const data = initialServices || [];
  const items = showAll ? data : data.slice(0, previewLimit);
  const hasMore = data.length > previewLimit;

  if (data.length === 0) {
    return (
      <EmptyState
        title="خدمتی منتشر نشده است"
        description="به‌زودی خدمات جدید در این بخش نمایش داده می‌شوند."
      />
    );
  }

  return (
    <>
      <ServiceCardsGrid services={items} />

      {hasMore ? (
        <div className="mt-6 flex justify-center sm:mt-8">
          <Button
            type="button"
            variant="brand"
            className="h-11 w-full max-w-xs gap-2 rounded-xl px-5 sm:h-10 sm:w-auto sm:rounded-full"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "نمایش کمتر" : "مشاهده همه خدمات"}
            {!showAll ? <ArrowLeft className="h-4 w-4 shrink-0" /> : null}
          </Button>
        </div>
      ) : null}
    </>
  );
}
