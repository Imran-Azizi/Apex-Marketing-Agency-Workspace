"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ImagePlus,
  Music,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  uploadFileWithProgress,
  formatFileSize,
  UPLOAD_PURPOSE,
} from "@/lib/upload";
import type { UploadPurpose } from "@/lib/media-manager";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LANDING_IMAGE_MAX_BYTES,
  evaluateImageGuideMatch,
  formatImageDimensions,
  readImageNaturalSize,
  simplifyAspectRatio,
  type ImageGuideMatch,
  type LandingImageSizeSpec,
} from "@/lib/landing-image-guide";

const LIMITS = {
  image: LANDING_IMAGE_MAX_BYTES,
  video: 120 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
} as const;

const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/gif,image/*",
  video: "video/*",
  audio: "audio/*",
} as const;

const PURPOSE: Record<"image" | "video" | "audio", UploadPurpose> = {
  image: UPLOAD_PURPOSE.LANDING_IMAGE,
  video: UPLOAD_PURPOSE.LANDING_VIDEO,
  audio: UPLOAD_PURPOSE.LANDING_AUDIO,
};

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}

function ImageGuideRow({
  guide,
  compact,
}: {
  guide: LandingImageSizeSpec;
  compact?: boolean;
}) {
  const ratio = simplifyAspectRatio(guide.width, guide.height);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-start gap-1.5",
        compact ? "mb-1.5" : "mb-2",
      )}
      dir="rtl"
    >
      <MetaChip>
        <span dir="ltr">{formatImageDimensions(guide.width, guide.height)}</span>
      </MetaChip>
      <MetaChip>
        نسبت <span dir="ltr">{ratio.label}</span>
      </MetaChip>
      <MetaChip>حداکثر {formatFileSize(LANDING_IMAGE_MAX_BYTES)}</MetaChip>
    </div>
  );
}

function ImageMismatchNotice({
  match,
  compact,
}: {
  match: ImageGuideMatch;
  compact?: boolean;
}) {
  if (match.ok || !match.message) return null;
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] text-amber-950 dark:text-amber-100",
        compact ? "px-2 py-1.5 text-[9px]" : "px-2.5 py-2 text-[10px]",
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      <div className="min-w-0 space-y-0.5 leading-relaxed">
        <p>
          <span className="text-muted-foreground">پیشنهادی:</span>{" "}
          <span className="font-medium tabular-nums" dir="ltr">
            {formatImageDimensions(
              match.recommendedWidth,
              match.recommendedHeight,
            )}
          </span>
          <span className="mx-1.5 text-border">·</span>
          <span className="text-muted-foreground">آپلودشده:</span>{" "}
          <span className="font-medium tabular-nums" dir="ltr">
            {formatImageDimensions(match.uploadedWidth, match.uploadedHeight)}
          </span>
        </p>
        <p className="opacity-90">
          نسبت تصویر با اندازه پیشنهادی هم‌خوان نیست. در صورت امکان تصویر مناسب‌تری
          آپلود کنید.
        </p>
      </div>
    </div>
  );
}

export function LandingMediaUploader({
  kind,
  src,
  storageKey,
  disabled,
  onChange,
  hint,
  imageGuide,
  compact,
}: {
  kind: "image" | "video" | "audio";
  src: string | null;
  storageKey: string | null;
  disabled?: boolean;
  onChange: (next: { key: string | null; url: string | null }) => void;
  hint?: string;
  /** Recommended pixel size for image slots (ignored for video/audio). */
  imageGuide?: LandingImageSizeSpec | null;
  compact?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<ImageGuideMatch | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => {
    if (!src && !localPreview) setMismatch(null);
  }, [src, localPreview]);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith(`${kind}/`)) {
      toast.error("نوع فایل مجاز نیست");
      return;
    }
    if (file.size > LIMITS[kind]) {
      toast.error(`حجم فایل نباید بیشتر از ${formatFileSize(LIMITS[kind])} باشد`);
      return;
    }

    if (kind === "image" && imageGuide) {
      const natural = await readImageNaturalSize(file);
      if (natural) {
        const match = evaluateImageGuideMatch(
          natural.width,
          natural.height,
          imageGuide,
        );
        setMismatch(match.ok ? null : match);
      } else {
        setMismatch(null);
      }
    } else {
      setMismatch(null);
    }

    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setProgress(0);
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        { purpose: PURPOSE[kind] },
        (pct) => setProgress(pct),
      );
      onChange({ key: uploaded.key, url: uploaded.url || src });
      toast.success("فایل بارگذاری شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "آپلود ناموفق بود");
      setLocalPreview(null);
      setMismatch(null);
    } finally {
      setProgress(null);
    }
  }

  const preview = localPreview || src;
  const busy = disabled || progress != null;
  const Icon = kind === "video" ? Video : kind === "audio" ? Music : ImagePlus;
  const hasMedia = Boolean(storageKey || src || localPreview);

  return (
    <div className="w-full space-y-2">
      {kind === "image" && imageGuide ? (
        <ImageGuideRow guide={imageGuide} compact={compact} />
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0] || null);
        }}
        className={cn(
          // Full-width frame — avoid aspect-ratio + max-height (that shrinks width).
          "group relative w-full overflow-hidden rounded-lg border bg-muted/20 transition-colors",
          kind === "audio"
            ? "min-h-[88px]"
            : compact
              ? "aspect-[2/1] min-h-[96px]"
              : "aspect-[2/1] min-h-[120px]",
          dragOver
            ? "border-brand bg-brand/[0.06] ring-2 ring-brand/20"
            : "border-border/70",
          !preview && "border-dashed",
        )}
      >
        {kind === "image" && preview ? (
          <button
            type="button"
            className="relative h-full w-full"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="برای جایگزینی کلیک کنید"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 to-transparent pb-2.5 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-full bg-background/95 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm">
                کلیک برای جایگزینی
              </span>
            </span>
          </button>
        ) : kind === "video" && preview ? (
          <button
            type="button"
            className="relative h-full w-full"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="برای جایگزینی کلیک کنید"
          >
            <video
              src={preview}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="none"
            />
            <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 to-transparent pb-2.5 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-full bg-background/95 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm">
                کلیک برای جایگزینی
              </span>
            </span>
          </button>
        ) : kind === "audio" && preview ? (
          <div className="flex h-full items-center justify-center p-3">
            <audio src={preview} controls className="w-full" />
          </div>
        ) : (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 py-4 text-center"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm ring-1 ring-border/60">
              <Icon className="h-4 w-4" />
            </span>
            <span className="block text-[11px] font-medium text-foreground">
              {hint || "برای انتخاب کلیک کنید"}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              یا فایل را بکشید و رها کنید
            </span>
          </button>
        )}

        {progress != null ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs tabular-nums">{progress}%</span>
          </div>
        ) : null}
      </div>

      {mismatch ? (
        <ImageMismatchNotice match={mismatch} compact={compact} />
      ) : null}

      {hasMedia ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => {
              setLocalPreview(null);
              setMismatch(null);
              onChange({ key: null, url: null });
            }}
          >
            <X className="h-3.5 w-3.5" />
            حذف
          </Button>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
    </div>
  );
}
