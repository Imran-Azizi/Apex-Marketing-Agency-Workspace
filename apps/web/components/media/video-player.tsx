"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
  autoPlay?: boolean;
}

/**
 * Professional HTML5 video player with loading / error states.
 * Native controls cover play/pause, volume, progress, fullscreen.
 * Uses authenticated stream URLs (cookies) with Range seeking support.
 */
export function VideoPlayer({
  src,
  poster,
  className,
  title,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [src]);

  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <Film className="h-8 w-8 opacity-50" />
          <p>ویدیویی برای پخش موجود نیست</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-black", className)}>
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-xs">در حال بارگذاری ویدیو…</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-w-sm flex-col items-center gap-2 text-center text-white">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-medium">پخش ویدیو ممکن نشد</p>
            <p className="text-xs text-white/70">{error}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={poster}
        title={title}
        controls
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        className="aspect-video w-full bg-black"
        onLoadStart={() => {
          setLoading(true);
          setError(null);
        }}
        onLoadedData={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError("فایل ویدیو در دسترس نیست یا دسترسی محدود شده است.");
        }}
      >
        مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
      </video>
    </div>
  );
}

export function VideoPlayerSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("aspect-video w-full rounded-xl", className)} />;
}
