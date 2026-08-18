"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  uploadFileWithProgress,
  formatFileSize,
  UPLOAD_PURPOSE,
} from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function CustomerUploader({
  imageUrl,
  imageKey,
  disabled,
  onChange,
}: {
  imageUrl: string | null;
  imageKey: string | null;
  disabled?: boolean;
  onChange: (next: { imageKey: string | null; imageUrl: string | null }) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری مجاز است");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("حجم تصویر نباید بیشتر از ۸ مگابایت باشد");
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setUploadProgress(0);
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        { purpose: UPLOAD_PURPOSE.CUSTOMER_IMAGE },
        (pct) => setUploadProgress(pct),
      );
      onChange({
        imageKey: uploaded.key,
        imageUrl: uploaded.url || imageUrl,
      });
      toast.success("تصویر بارگذاری شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "آپلود تصویر ناموفق بود");
      setLocalPreview(null);
    } finally {
      setUploadProgress(null);
    }
  }

  const previewSrc = localPreview || imageUrl;
  const busy = disabled || uploadProgress != null;

  return (
    <div className="space-y-2">
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
          if (!busy) handleImageFile(e.dataTransfer.files?.[0] || null);
        }}
      >
        {previewSrc ? (
          <div className="relative aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="پیش‌نمایش تصویر مشتری"
              className="h-full w-full object-cover"
            />
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
                تغییر تصویر
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
                  onChange({ imageKey: null, imageUrl: null });
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
              <ImagePlus className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">
              تصویر را بکشید و رها کنید یا انتخاب کنید
            </span>
            <span className="text-xs text-muted-foreground">
              JPG، PNG، WEBP — نسبت پیشنهادی ۴:۳ — حداکثر{" "}
              {formatFileSize(MAX_IMAGE_BYTES)}
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
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          handleImageFile(e.target.files?.[0] || null);
          e.target.value = "";
        }}
      />
      {imageKey ? (
        <p className="sr-only">تصویر مشتری بارگذاری شده است</p>
      ) : null}
    </div>
  );
}
