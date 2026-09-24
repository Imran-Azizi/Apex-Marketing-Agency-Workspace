"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AlertTriangle, Film, Loader2, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export interface VideoPlayerProps {
  /** Playback URL. Attached only after the user clicks Play (unless autoPlay). */
  src?: string | null;
  /**
   * Optional lazy resolver — called on first Play when you need a signed CDN
   * URL. Falls back to `src` if omitted or if it throws.
   */
  getSrc?: () => Promise<string>;
  poster?: string | null;
  className?: string;
  title?: string;
  /** Begin playback as soon as the player mounts (e.g. user opened a preview dialog). */
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  /**
   * @deprecated Prefer click-to-play. Treated like autoPlay for compatibility.
   */
  eager?: boolean;
  /** MIME type hint for the browser (defaults to video/mp4). */
  type?: string;
  /** Buffering overlay label (only after Play). */
  loadingLabel?: string;
  /** Accessible label for the play control. */
  playLabel?: string;
  /**
   * Public-facing deterrence: hide native Download, block context menu / drag,
   * disable PiP & remote playback. Not DRM — screen capture remains possible.
   */
  protect?: boolean;
}

function resolveSourceType(type?: string): string | undefined {
  const mime = String(type || "")
    .trim()
    .toLowerCase();
  if (!mime || mime === "application/octet-stream") return undefined;
  if (!mime.startsWith("video/")) return undefined;
  if (mime === "video/x-m4v" || mime === "video/mpeg") return "video/mp4";
  return mime;
}

function PosterBackdrop({
  poster,
  title,
}: {
  poster?: string | null;
  title?: string;
}) {
  if (poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt={title || ""}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    );
  }

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "radial-gradient(circle at 30% 22%, hsl(var(--brand) / 0.28), transparent 52%), linear-gradient(165deg, #1a1f28 0%, #0c1016 52%, #16120e 100%)",
      }}
      aria-hidden
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.14]">
        <Film className="h-16 w-16 text-white sm:h-20 sm:w-20" />
      </div>
    </div>
  );
}

function PlayOverlay({
  onPlay,
  label,
  disabled,
}: {
  onPlay: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "group absolute inset-0 z-20 flex items-center justify-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        disabled && "pointer-events-none",
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-black/25 transition-opacity duration-200 group-hover:opacity-90" />
      <span
        className={cn(
          "relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full sm:h-[5rem] sm:w-[5rem]",
          "bg-brand text-brand-foreground shadow-[0_10px_28px_rgba(0,0,0,0.45)]",
          "ring-1 ring-black/10 transition-transform duration-200",
          "group-hover:scale-105 group-active:scale-95",
          disabled && "opacity-70",
        )}
      >
        <Play
          className="h-7 w-7 fill-current ps-0.5 sm:h-8 sm:w-8"
          aria-hidden
        />
      </span>
    </button>
  );
}

/**
 * System-wide HTML5 video player.
 *
 * Idle: poster/placeholder + centered Play — no media network request.
 * After Play: attaches `src`, streams via HTTP range when available, and shows
 * a compact buffering chip only while genuinely waiting.
 */
export function VideoPlayer({
  src,
  getSrc,
  poster,
  className,
  title,
  autoPlay = false,
  muted,
  loop = false,
  controls = true,
  eager = false,
  type = "video/mp4",
  loadingLabel = "در حال آماده‌سازی پخش",
  playLabel = "پخش ویدیو",
  protect = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const autoStartedRef = useRef(false);

  const shouldAutoStart = Boolean(autoPlay || eager);
  const [phase, setPhase] = useState<"idle" | "playing">(
    shouldAutoStart ? "playing" : "idle",
  );
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceType = resolveSourceType(type);

  const clearWaiting = useCallback(() => {
    if (waitingTimer.current) {
      clearTimeout(waitingTimer.current);
      waitingTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearWaiting(), [clearWaiting]);

  const tryPlay = useCallback(async (el: HTMLVideoElement) => {
    try {
      await el.play();
      return true;
    } catch {
      return false;
    }
  }, []);

  const startPlayback = useCallback(
    async (fromUserGesture: boolean) => {
      const requestId = ++requestIdRef.current;
      setError(null);
      setPhase("playing");
      setBusy(true);

      let nextSrc = String(src || "").trim();

      if (getSrc) {
        try {
          const resolved = String((await getSrc()) || "").trim();
          if (resolved) nextSrc = resolved;
        } catch (err) {
          if (requestId !== requestIdRef.current) return;
          if (!nextSrc) {
            setBusy(false);
            setError(
              err instanceof Error
                ? err.message
                : "آماده‌سازی پخش ویدیو ناموفق بود",
            );
            return;
          }
        }
      }

      if (requestId !== requestIdRef.current) return;

      if (!nextSrc) {
        setBusy(false);
        setError("آدرس پخش ویدیو در دسترس نیست.");
        return;
      }

      setActiveSrc(nextSrc);

      // Play after React commits the <video src>.
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          if (requestId !== requestIdRef.current) return;
          const el = videoRef.current;
          if (!el) return;
          if (fromUserGesture || shouldAutoStart) {
            void tryPlay(el).finally(() => {
              if (requestId === requestIdRef.current) setBusy(false);
            });
          } else {
            setBusy(false);
          }
        });
      });
    },
    [getSrc, src, shouldAutoStart, tryPlay],
  );

  // Reset when the logical source changes.
  useEffect(() => {
    clearWaiting();
    setError(null);
    setBusy(false);
    setActiveSrc(null);
    autoStartedRef.current = false;
    requestIdRef.current += 1;

    if (shouldAutoStart) {
      setPhase("playing");
    } else {
      setPhase("idle");
    }
  }, [src, shouldAutoStart, clearWaiting]);

  // Auto-start once per src identity (preview dialogs / ambient).
  useEffect(() => {
    if (!shouldAutoStart) return;
    if (autoStartedRef.current) return;
    if (!src && !getSrc) return;
    autoStartedRef.current = true;
    void startPlayback(false);
  }, [shouldAutoStart, src, getSrc, startPlayback]);

  const handleRetry = () => {
    setError(null);
    setActiveSrc(null);
    autoStartedRef.current = false;
    void startPlayback(true);
  };

  const blockContextMenu = useCallback(
    (event: MouseEvent) => {
      if (!protect) return;
      event.preventDefault();
    },
    [protect],
  );

  if (!src && !getSrc) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-muted/30 text-sm text-muted-foreground",
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

  const showPlayOverlay = phase === "idle" && !error;
  const showBusyChip = phase === "playing" && busy && !error;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl bg-black",
        protect && "select-none",
        className,
      )}
      onContextMenu={blockContextMenu}
    >
      <div className="relative aspect-video w-full max-w-full bg-black">
        {!activeSrc ? <PosterBackdrop poster={poster} title={title} /> : null}

        {activeSrc ? (
          <video
            ref={videoRef}
            key={activeSrc}
            poster={poster || undefined}
            title={title}
            controls={controls}
            controlsList={
              protect ? "nodownload noremoteplayback noplaybackrate" : undefined
            }
            disablePictureInPicture={protect}
            disableRemotePlayback={protect}
            playsInline
            preload="auto"
            muted={muted ?? shouldAutoStart}
            loop={loop}
            draggable={false}
            className={cn(
              "absolute inset-0 h-full w-full max-w-full bg-black object-contain",
              protect && "pointer-events-auto",
            )}
            onContextMenu={blockContextMenu}
            onDragStart={protect ? (e) => e.preventDefault() : undefined}
            onLoadStart={() => setBusy(true)}
            onLoadedMetadata={() => setBusy(false)}
            onLoadedData={() => setBusy(false)}
            onCanPlay={() => {
              clearWaiting();
              setBusy(false);
            }}
            onWaiting={() => {
              clearWaiting();
              waitingTimer.current = setTimeout(() => setBusy(true), 320);
            }}
            onPlaying={() => {
              clearWaiting();
              setBusy(false);
            }}
            onError={() => {
              clearWaiting();
              setBusy(false);
              setError(
                "فایل ویدیو در دسترس نیست یا فرمت آن پشتیبانی نمی‌شود.",
              );
            }}
          >
            <source
              src={activeSrc}
              {...(sourceType ? { type: sourceType } : {})}
            />
            مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
          </video>
        ) : null}

        {showPlayOverlay ? (
          <PlayOverlay
            onPlay={() => void startPlayback(true)}
            label={playLabel}
          />
        ) : null}

        {showBusyChip ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-white backdrop-blur-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs font-medium tracking-wide">
                {loadingLabel}
              </span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center text-white">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <p className="text-sm font-medium">پخش ویدیو ممکن نشد</p>
              <p className="text-xs text-white/70">{error}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-1 gap-1.5"
                onClick={handleRetry}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                تلاش مجدد
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function VideoPlayerSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("aspect-video w-full rounded-xl", className)} />;
}

/** Lightweight static poster tile — never mounts a video element. */
export function VideoPosterTile({
  poster,
  title,
  className,
  onClick,
  children,
}: {
  poster?: string | null;
  title?: string;
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const content = (
    <>
      <PosterBackdrop poster={poster} title={title} />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-1 ring-black/10 transition-transform duration-200 group-hover:scale-105 sm:h-14 sm:w-14">
          <Play className="h-5 w-5 fill-current ps-0.5 sm:h-6 sm:w-6" />
        </span>
      </span>
      {children}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={title ? `پخش ${title}` : "پخش ویدیو"}
        className={cn(
          "group relative block aspect-video w-full overflow-hidden bg-neutral-950 text-start",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-neutral-950",
        className,
      )}
    >
      {content}
    </div>
  );
}
