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
  /** MIME type hint for the browser (defaults to video/mp4). */
  type?: string;
}

/**
 * Professional HTML5 video player with loading / error states.
 * `src` is attached only when the player is near the viewport so large
 * files do not download on first paint. preload=metadata keeps bandwidth
 * low until the user presses play.
 */
export function VideoPlayer({
  src,
  poster,
  className,
  title,
  autoPlay = false,
  type = "video/mp4",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(autoPlay);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setError(null);
    if (autoPlay) setArmed(true);
    return () => {
      if (waitingTimer.current) clearTimeout(waitingTimer.current);
    };
  }, [src, autoPlay]);

  useEffect(() => {
    if (armed || autoPlay) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setArmed(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [armed, autoPlay]);

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

  const mediaSrc = armed ? src : undefined;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden rounded-xl bg-black", className)}
    >
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-xs">در حال آماده‌سازی ویدیو…</span>
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
        key={armed ? src : "poster"}
        src={mediaSrc}
        poster={poster}
        title={title}
        controls
        playsInline
        preload={autoPlay ? "auto" : "none"}
        autoPlay={autoPlay}
        className="aspect-video w-full max-w-full bg-black object-contain"
        onLoadStart={() => {
          if (!armed) return;
          setLoading(true);
          setError(null);
        }}
        onLoadedMetadata={() => setLoading(false)}
        onLoadedData={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => {
          if (waitingTimer.current) clearTimeout(waitingTimer.current);
          waitingTimer.current = setTimeout(() => setLoading(true), 400);
        }}
        onPlaying={() => {
          if (waitingTimer.current) clearTimeout(waitingTimer.current);
          setLoading(false);
        }}
        onError={() => {
          if (!armed) return;
          setLoading(false);
          setError("فایل ویدیو در دسترس نیست یا فرمت آن پشتیبانی نمی‌شود.");
        }}
      >
        {mediaSrc ? <source src={mediaSrc} type={type} /> : null}
        مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
      </video>
    </div>
  );
}

export function VideoPlayerSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("aspect-video w-full rounded-xl", className)} />;
}
