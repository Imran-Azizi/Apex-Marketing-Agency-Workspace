"use client";

import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/upload";
import { VideoStorageActions } from "./video-storage-actions";
import { VideoCardThumbnail } from "./video-card-thumbnail";
import {
  STATUS_LABELS,
  formatDuration,
  type VideoStorageItem,
  type VideoStorageStatus,
} from "./types";

function statusVariant(
  status: VideoStorageStatus,
): "secondary" | "warning" | "brand" | "success" {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "IN_PORTFOLIO":
      return "brand";
    case "UNDER_REVIEW":
      return "warning";
    default:
      return "secondary";
  }
}

export function VideoStorageCard({
  item,
  showOwner,
  canEdit,
  canDelete,
  canSendPortfolio,
  sendPending,
  onPreview,
  onEdit,
  onDelete,
  onSendPortfolio,
}: {
  item: VideoStorageItem;
  showOwner?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canSendPortfolio?: boolean;
  sendPending?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendPortfolio: () => void;
}) {
  const portfolioLabel = item.publishedPublic
    ? "منتشر در وبسایت"
    : item.inPortfolio
      ? "در نمونه‌کارها"
      : null;

  return (
    <article
      dir="rtl"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-start shadow-sm transition-shadow hover:border-border hover:shadow-md"
    >
      <button
        type="button"
        onClick={onPreview}
        className="relative aspect-video w-full overflow-hidden text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        aria-label={`پخش ${item.title}`}
      >
        <VideoCardThumbnail item={item} />

        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/45 via-transparent to-black/10 opacity-90 transition group-hover:from-black/55">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-[2px] transition group-hover:scale-105">
            <Play className="ms-0.5 h-5 w-5 fill-current" />
          </span>
        </div>

        <Badge
          variant={statusVariant(item.status)}
          className={cn("absolute start-3 top-3 z-10 shadow-sm")}
        >
          {STATUS_LABELS[item.status]}
        </Badge>

        <span className="absolute bottom-3 end-3 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
          {formatDuration(item.durationSeconds)}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5">
            {item.title}
          </h3>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {showOwner ? (
              <>
                <span className="text-foreground/80">
                  {item.uploadedBy?.fullName || "نامشخص"}
                </span>
                <span className="mx-1.5 text-border">·</span>
              </>
            ) : null}
            <span>{formatDateTime(item.createdAt)}</span>
            <span className="mx-1.5 text-border">·</span>
            <span>{formatFileSize(item.sizeBytes || 0)}</span>
          </p>
          {portfolioLabel ? (
            <Badge variant="outline" className="mt-1 text-[10px] font-normal">
              {portfolioLabel}
            </Badge>
          ) : null}
        </div>

        <div className="mt-auto border-t border-border/60 pt-3">
          <VideoStorageActions
            item={item}
            canEdit={canEdit}
            canDelete={canDelete}
            canSendPortfolio={canSendPortfolio}
            sendPending={sendPending}
            onPreview={onPreview}
            onEdit={onEdit}
            onDelete={onDelete}
            onSendPortfolio={onSendPortfolio}
          />
        </div>
      </div>
    </article>
  );
}
