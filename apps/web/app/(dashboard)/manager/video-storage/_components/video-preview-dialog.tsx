"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/media/video-player";
import { apiGet } from "@/lib/api";
import {
  videoStorageStreamUrl,
  videoStorageThumbnailUrl,
} from "@/lib/media";
import { formatDateTime } from "@/lib/utils";
import { formatFileSize } from "@/lib/upload";
import {
  STATUS_LABELS,
  formatDuration,
  type VideoStorageItem,
} from "./types";

type PlaybackPayload = {
  playbackUrl: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
};

export function VideoPreviewDialog({
  item,
  open,
  onOpenChange,
  showOwner,
}: {
  item: VideoStorageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showOwner?: boolean;
}) {
  const streamSrc = item?.id ? videoStorageStreamUrl(item.id) : "";
  const listPlayback = item?.playbackUrl?.trim() || "";
  const fallbackSrc = listPlayback || streamSrc;
  const poster =
    (item?.thumbnailUrl && /^https?:\/\//i.test(item.thumbnailUrl)
      ? item.thumbnailUrl
      : null) ||
    (item?.id && item.hasThumbnail
      ? videoStorageThumbnailUrl(item.id)
      : undefined);

  const getSrc = useCallback(async () => {
    if (!item?.id) return fallbackSrc;
    // Prefer a fresh CDN URL when available; never block the idle poster on it.
    try {
      const data = await apiGet<PlaybackPayload>(
        `/video-storage/${item.id}/playback`,
      );
      if (data?.playbackUrl) return data.playbackUrl;
    } catch {
      // Fall back to list/stream URL — still range-capable.
    }
    return fallbackSrc;
  }, [item?.id, fallbackSrc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto text-start sm:max-w-3xl"
        dir="rtl"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="pe-8">{item?.title}</DialogTitle>
          <DialogDescription className="leading-6">
            {item?.description || "پیش‌نمایش ویدیوی ذخیره‌شده"}
          </DialogDescription>
        </DialogHeader>
        {item && open ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{STATUS_LABELS[item.status]}</Badge>
              {item.inPortfolio ? (
                <Badge variant="outline">
                  {item.publishedPublic
                    ? "منتشر در وبسایت عمومی"
                    : "در نمونه‌کارها"}
                </Badge>
              ) : null}
            </div>

            <VideoPlayer
              key={item.id}
              src={fallbackSrc}
              getSrc={getSrc}
              poster={poster || undefined}
              title={item.title}
              type={item.mimeType || "video/mp4"}
            />

            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {showOwner ? (
                <p>آپلود توسط: {item.uploadedBy?.fullName || "نامشخص"}</p>
              ) : null}
              <p>تاریخ: {formatDateTime(item.createdAt)}</p>
              <p>مدت: {formatDuration(item.durationSeconds)}</p>
              <p>حجم: {formatFileSize(item.sizeBytes || 0)}</p>
              <p className="sm:col-span-2 truncate">
                فایل: {item.originalFilename}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
