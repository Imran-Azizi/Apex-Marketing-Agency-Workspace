"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { videoStorageThumbnailUrl } from "@/lib/media";
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
  const [src, setSrc] = useState("");
  const [poster, setPoster] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item?.id) {
      setSrc("");
      setPoster(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setSrc("");
    setError(null);
    setLoading(true);
    setPoster(
      item.hasThumbnail ? videoStorageThumbnailUrl(item.id) : undefined,
    );

    apiGet<PlaybackPayload>(`/video-storage/${item.id}/playback`)
      .then((data) => {
        if (cancelled) return;
        if (!data?.playbackUrl) {
          setError("آدرس پخش ویدیو دریافت نشد");
          return;
        }
        setSrc(data.playbackUrl);
        if (data.thumbnailUrl) setPoster(data.thumbnailUrl);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "آماده‌سازی پخش ویدیو ناموفق بود",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item?.id, item?.hasThumbnail]);

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
        {item ? (
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

            {loading && !src ? (
              <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/30">
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  در حال آماده‌سازی پخش…
                </div>
              </div>
            ) : null}

            {error && !src ? (
              <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/30 px-4 text-center text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {src ? (
              <VideoPlayer
                key={`${item.id}-${src}`}
                src={src}
                poster={poster}
                title={item.title}
                autoPlay
              />
            ) : null}

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
