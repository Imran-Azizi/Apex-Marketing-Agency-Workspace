"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Music, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import {
  uploadFileWithProgress,
  formatFileSize,
  UPLOAD_PURPOSE,
} from "@/lib/upload";
import type { UploadPurpose } from "@/lib/media-manager";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIMITS = {
  image: 8 * 1024 * 1024,
  video: 120 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
} as const;

const ACCEPT = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
} as const;

const PURPOSE: Record<"image" | "video" | "audio", UploadPurpose> = {
  image: UPLOAD_PURPOSE.LANDING_IMAGE,
  video: UPLOAD_PURPOSE.LANDING_VIDEO,
  audio: UPLOAD_PURPOSE.LANDING_AUDIO,
};

export function LandingMediaUploader({
  kind,
  src,
  storageKey,
  disabled,
  onChange,
  hint,
}: {
  kind: "image" | "video" | "audio";
  src: string | null;
  storageKey: string | null;
  disabled?: boolean;
  onChange: (next: { key: string | null; url: string | null }) => void;
  hint?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

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
    } finally {
      setProgress(null);
    }
  }

  const preview = localPreview || src;
  const busy = disabled || progress != null;
  const Icon = kind === "video" ? Video : kind === "audio" ? Music : ImagePlus;

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0] || null);
        }}
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed bg-muted/30",
          kind === "audio" ? "min-h-[88px]" : "aspect-video",
          dragOver && "border-brand bg-brand/5",
        )}
      >
        {kind === "image" && preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : kind === "video" && preview ? (
          <video src={preview} className="h-full w-full object-cover" muted playsInline preload="none" />
        ) : kind === "audio" && preview ? (
          <div className="flex h-full items-center justify-center p-3">
            <audio src={preview} controls className="w-full" />
          </div>
        ) : (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-xs text-muted-foreground"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Icon className="h-6 w-6" />
            {hint || "برای بارگذاری کلیک کنید یا فایل را رها کنید"}
          </button>
        )}
        {progress != null ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
            {progress}%
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 rounded-lg text-xs"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          انتخاب فایل
        </Button>
        {storageKey || src ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 rounded-lg text-xs"
            disabled={busy}
            onClick={() => {
              setLocalPreview(null);
              onChange({ key: null, url: null });
            }}
          >
            <X className="h-3.5 w-3.5" />
            حذف
          </Button>
        ) : null}
      </div>
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
