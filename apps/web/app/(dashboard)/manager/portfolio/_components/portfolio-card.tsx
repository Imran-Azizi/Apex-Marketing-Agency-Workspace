"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PortfolioActions } from "./portfolio-actions";
import { PortfolioThumbnail } from "./portfolio-thumbnail";
import type { PortfolioAdminItem } from "./types";

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
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-start shadow-sm md:hidden"
    >
      <div className="relative">
        <PortfolioThumbnail
          thumbnailUrl={item.thumbnailUrl}
          title={item.title}
          onPreview={onPreview}
        />
        <Badge
          variant={published ? "success" : "secondary"}
          className="absolute start-3 top-3 z-10 shadow-sm"
        >
          {published ? "فعال" : "غیرفعال"}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 text-sm font-semibold">{item.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">{categoryLabel}</p>
        <p className="text-[11px] text-muted-foreground">
          ترتیب {item.sortOrder} · {formatDate(item.publishedAt || item.createdAt)}
        </p>
        <div className="mt-auto pt-2">
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
