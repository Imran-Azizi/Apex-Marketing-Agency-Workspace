"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PortfolioActions } from "./portfolio-actions";
import { PortfolioThumbnail } from "./portfolio-thumbnail";
import type { PortfolioAdminItem } from "./types";

/** Compact horizontal list row for small screens (replaces large cards). */
export function PortfolioCard({
  item,
  canEdit,
  canDelete,
  publishPending,
  onPreview,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  item: PortfolioAdminItem;
  canEdit: boolean;
  canDelete: boolean;
  publishPending?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const published = item.status === "PUBLISHED";
  const categoryLabel =
    item.categories.map((category) => category.name).join("، ") || "بدون کتگوری";

  return (
    <article
      dir="rtl"
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 text-start shadow-sm md:hidden"
    >
      <div className="relative h-14 w-[4.75rem] shrink-0 overflow-hidden rounded-lg">
        <PortfolioThumbnail
          thumbnailUrl={item.thumbnailUrl}
          title={item.title}
          onPreview={onPreview}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold leading-snug">
            {item.title}
          </h3>
          <Badge
            variant={published ? "success" : "secondary"}
            className="shrink-0 font-normal"
          >
            {published ? "فعال" : "غیرفعال"}
          </Badge>
        </div>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {categoryLabel}
          {item.inMixed ? " · در مختلط" : ""}
        </p>
        <p className="text-[11px] text-muted-foreground">
          ترتیب {item.sortOrder} · {formatDate(item.publishedAt || item.createdAt)}
        </p>
        <div className="pt-0.5">
          <PortfolioActions
            item={item}
            canEdit={canEdit}
            canDelete={canDelete}
            publishPending={publishPending}
            onPreview={onPreview}
            onEdit={onEdit}
            onTogglePublish={onTogglePublish}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}
