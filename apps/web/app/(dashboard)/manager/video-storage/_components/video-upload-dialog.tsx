"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  uploadFileWithProgress,
  formatFileSize,
  UPLOAD_PURPOSE,
} from "@/lib/upload";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { VideoStorageItem } from "./types";

const ACCEPTED =
  "video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv,.m4v";

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

/** Capture a lightweight JPEG poster frame from a local video file. */
function captureVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => URL.revokeObjectURL(url);

    const finish = (blob: Blob | null) => {
      cleanup();
      resolve(blob);
    };

    video.onerror = () => finish(null);

    video.onloadeddata = () => {
      const seekTo =
        Number.isFinite(video.duration) && video.duration > 1
          ? Math.min(1.2, video.duration * 0.12)
          : 0.1;
      const onSeeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const maxW = 640;
          const scale = w > maxW ? maxW / w : 1;
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            finish(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.82);
        } catch {
          finish(null);
        }
      };
      video.onseeked = onSeeked;
      try {
        video.currentTime = seekTo;
      } catch {
        onSeeked();
      }
    };

    video.src = url;
  });
}

export function VideoUploadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: VideoStorageItem) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setFile(null);
      setTitle("");
      setDescription("");
      setProgress(null);
      setSaving(false);
      setDragOver(false);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  function pickFile(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith("video/") && !/\.(mp4|webm|mov|mkv|m4v)$/i.test(next.name)) {
      toast.error("فقط فایل ویدیویی مجاز است");
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    setFile(next);
    setLocalPreview(URL.createObjectURL(next));
    if (!title.trim()) {
      setTitle(next.name.replace(/\.[^.]+$/, "").slice(0, 200));
    }
  }

  async function handleSubmit() {
    if (!file) {
      toast.error("یک فایل ویدیو انتخاب کنید");
      return;
    }
    if (!title.trim()) {
      toast.error("عنوان ویدیو الزامی است");
      return;
    }

    setSaving(true);
    setProgress(0);
    abortRef.current = new AbortController();

    try {
      const durationSeconds = await readVideoDuration(file);
      const [uploaded, thumbBlob] = await Promise.all([
        uploadFileWithProgress(
          file,
          { purpose: UPLOAD_PURPOSE.VIDEO_STORAGE },
          (pct) => setProgress(Math.min(92, pct * 0.92)),
        ),
        captureVideoThumbnail(file),
      ]);

      let thumbnailKey: string | null = null;
      if (thumbBlob) {
        try {
          const thumbFile = new File([thumbBlob], "thumbnail.jpg", {
            type: "image/jpeg",
          });
          const thumbUploaded = await uploadFileWithProgress(
            thumbFile,
            { purpose: UPLOAD_PURPOSE.VIDEO_STORAGE_THUMBNAIL },
            (pct) => setProgress(92 + pct * 0.06),
          );
          thumbnailKey = thumbUploaded.key;
        } catch {
          // Server may still extract a frame via ffmpeg.
        }
      }

      setProgress(99);
      const created = await apiPost<VideoStorageItem>("/video-storage", {
        title: title.trim(),
        description: description.trim() || null,
        storageKey: uploaded.key,
        thumbnailKey,
        originalFilename: file.name,
        mimeType: uploaded.mimeType || file.type || null,
        sizeBytes: uploaded.sizeBytes || file.size,
        durationSeconds,
      });

      toast.success("ویدیو با موفقیت آپلود شد");
      onCreated(created);
      onOpenChange(false);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        toast.message("آپلود لغو شد");
      } else {
        toast.error(e instanceof Error ? e.message : "آپلود ناموفق بود");
      }
    } finally {
      setSaving(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  const busy = saving || progress != null;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto text-start sm:max-w-lg"
        dir="rtl"
      >
        <DialogHeader className="text-start">
          <DialogTitle>آپلود ویدیو</DialogTitle>
          <DialogDescription>
            فایل را بکشید و رها کنید یا از سیستم انتخاب کنید. فرمت‌های مجاز: MP4،
            WebM، MOV، MKV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              if (!busy) pickFile(e.dataTransfer.files?.[0] || null);
            }}
          >
            {localPreview ? (
              <div className="relative aspect-video">
                <video
                  src={localPreview}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  controls
                />
                {!busy ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute end-3 top-3 h-8 w-8 rounded-full"
                    onClick={() => {
                      if (localPreview) URL.revokeObjectURL(localPreview);
                      setLocalPreview(null);
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="flex w-full flex-col items-center gap-2 px-4 py-10 text-center"
                onClick={() => inputRef.current?.click()}
              >
                <span className="rounded-full bg-muted p-3">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </span>
                <span className="text-sm font-medium">انتخاب یا رها کردن ویدیو</span>
                <span className="text-xs text-muted-foreground">
                  حداکثر حجم طبق تنظیمات سیستم
                </span>
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              disabled={busy}
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
          </div>

          {file ? (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Film className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0">{formatFileSize(file.size)}</span>
            </div>
          ) : null}

          {progress != null ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>در حال آپلود…</span>
                <span>{Math.round(progress)}٪</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="vs-title">عنوان</Label>
            <Input
              id="vs-title"
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vs-desc">توضیحات (اختیاری)</Label>
            <Textarea
              id="vs-desc"
              value={description}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24 rounded-xl"
              maxLength={4000}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="brand"
            disabled={busy || !file}
            onClick={handleSubmit}
            className="rounded-xl"
          >
            {busy ? "در حال ذخیره…" : "ثبت ویدیو"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
