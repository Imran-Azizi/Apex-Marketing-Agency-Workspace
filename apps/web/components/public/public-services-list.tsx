"use client";

import { useRef, useState } from "react";
import {
  PUBLIC_SERVICES_PREVIEW_LIMIT,
  type PublicService,
} from "@/lib/services";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ServiceCardsGrid } from "@/components/public/service-cards";

export function PublicServicesList({
  previewLimit = PUBLIC_SERVICES_PREVIEW_LIMIT,
  initialServices,
}: {
  previewLimit?: number;
  initialServices?: PublicService[] | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const extraRef = useRef<HTMLDivElement>(null);
  const data = initialServices || [];
  const limit = Math.max(1, previewLimit);
  const preview = data.slice(0, limit);
  const extra = data.slice(limit);
  const hasMore = extra.length > 0;

  if (data.length === 0) {
    return (
      <EmptyState
        title="خدمتی منتشر نشده است"
        description="به‌زودی خدمات جدید در این بخش نمایش داده می‌شوند."
      />
    );
  }

  function handleToggle() {
    const next = !showAll;
    setShowAll(next);
    if (!next) {
      document
        .getElementById("services")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    requestAnimationFrame(() => {
      extraRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <>
      <ServiceCardsGrid services={preview} />

      {showAll && hasMore ? (
        <div
          ref={extraRef}
          className="mt-3.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 sm:mt-5"
        >
          <ServiceCardsGrid services={extra} startIndex={limit} />
        </div>
      ) : null}

      {hasMore ? (
        <div className="mt-6 flex justify-center sm:mt-8">
          <Button
            type="button"
            variant={showAll ? "outline" : "brand"}
            size="lg"
            aria-expanded={showAll}
            className="public-lift h-11 w-full max-w-xs rounded-xl px-8 sm:h-11 sm:w-auto sm:min-w-[10.5rem] sm:rounded-full"
            onClick={handleToggle}
          >
            {showAll ? "نمایش کمتر" : "مشاهده همه خدمات"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
