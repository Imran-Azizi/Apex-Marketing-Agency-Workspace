"use client";

import { useEffect, useRef, useState } from "react";
import { Film, ImagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  uploadFileWithProgress,
  formatFileSize,
  UPLOAD_PURPOSE,
} from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function PortfolioMediaUploader({
  kind,
  fileKey,
  previewUrl,
  disabled,
  onChange,
}: {
  kind: "video" | "image";
  fileKey: string | null;
  previewUrl: string | null;
  disabled?: boolean;
  onChange: (next: { key: string | null; url: string | null }) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isVideo = kind === "video";

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (isVideo && !file.type.startsWith("video/")) {
      toast.error("فقط فایل ویدیویی مجاز است");
      return;
    }
    if (!isVideo && !file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری مجاز است");
      return;
    }
    if (!isVideo && file.size > MAX_IMAGE_BYTES) {
      toast.error("حجم تصویر نباید بیشتر از ۸ مگابایت باشد");
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setUploadProgress(0);
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: isVideo
            ? UPLOAD_PURPOSE.PORTFOLIO_VIDEO
            : UPLOAD_PURPOSE.PORTFOLIO_THUMBNAIL,
        },
        (pct) => setUploadProgress(pct),
      );
      onChange({
        key: uploaded.key,
        url: uploaded.url || previewUrl,
      });
      toast.success(isVideo ? "ویدیو بارگذاری شد" : "تصویر بارگذاری شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "آپلود ناموفق بود");
      setLocalPreview(null);
    } finally {
      setUploadProgress(null);
    }
  }

  const previewSrc = localPreview || previewUrl;
  const busy = disabled || uploadProgress != null;

  return (
    <div className="space-y-2" dir="rtl">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-dashed border-border/80 bg-muted/20",
          dragOver && "border-brand bg-brand/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) handleFile(e.dataTransfer.files?.[0] || null);
        }}
      >
        {previewSrc ? (
          <div className="relative aspect-video">
            {isVideo ? (
              <video
                src={previewSrc}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="پیش‌نمایش تصویر"
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                تغییر فایل
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={busy}
                onClick={() => {
                  if (localPreview) URL.revokeObjectURL(localPreview);
                  setLocalPreview(null);
                  onChange({ key: null, url: null });
                }}
              >
                <X className="h-3.5 w-3.5" />
                حذف
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full flex-col items-center gap-2 px-4 py-10 text-center"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              {isVideo ? <Film className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
            </span>
            <span className="text-sm font-medium">
              {isVideo
                ? "ویدیو را بکشید و رها کنید یا انتخاب کنید"
                : "تصویر بندانگشتی را انتخاب کنید"}
            </span>
            <span className="text-xs text-muted-foreground">
              {isVideo
                ? "MP4، WEBM و فرمت‌های ویدیویی مشابه"
                : `JPG، PNG، WEBP — ۱۶:۹ — حداکثر ${formatFileSize(MAX_IMAGE_BYTES)}`}
            </span>
          </button>
        )}
        {uploadProgress != null ? (
          <div className="absolute inset-x-4 bottom-4 rounded-full bg-background/90 p-2 shadow">
            <div className="mb-1 flex justify-between text-[11px]">
              <span>در حال آپلود…</span>
              <span className="tabular-nums">{uploadProgress}٪</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={isVideo ? "video/*" : "image/png,image/jpeg,image/webp,image/gif"}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          handleFile(e.target.files?.[0] || null);
          e.target.value = "";
        }}
      />
      {fileKey ? (
        <p className="sr-only">
          {isVideo ? "ویدیو بارگذاری شده است" : "تصویر بارگذاری شده است"}
        </p>
      ) : null}
    </div>
  );
}

export function isPortfolioUploadBusy(progress: number | null) {
  return progress != null;
}
