"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import {
  uploadFileWithProgress,
  formatFileSize,
  readVideoDuration,
  formatDurationLabel,
} from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import {
  ACCEPTED_VIDEO_TYPES,
  validateFinalVideoFile,
  VIDEO_TYPE_LABELS,
  type FinalVideoItem,
  type FinalVideoType,
} from "@/lib/final-product";
import { mediaStreamUrl } from "@/lib/media";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/media/video-player";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Droplets,
  Eye,
  Film,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Replace,
  Send,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

type UploadPhase =
  | "idle"
  | "ready"
  | "uploading"
  | "saved"
  | "success"
  | "error";

type SlotState = {
  file: File | null;
  previewUrl: string | null;
  durationSec: number | null;
  phase: UploadPhase;
  progress: number;
  loaded: number;
  total: number;
  startedAt: number | null;
  error: string | null;
  completedAt: string | null;
  saved: FinalVideoItem | null;
};

const emptySlot = (saved: FinalVideoItem | null = null): SlotState => ({
  file: null,
  previewUrl: null,
  durationSec: null,
  phase: saved ? "saved" : "idle",
  progress: 0,
  loaded: 0,
  total: 0,
  startedAt: null,
  error: null,
  completedAt: saved?.createdAt || null,
  saved,
});

function revokePreview(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "—";
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "چند لحظه";
  if (seconds < 60) return `${Math.ceil(seconds)} ثانیه`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return s > 0 ? `${m} دقیقه و ${s} ثانیه` : `${m} دقیقه`;
}

async function pickFileIntoSlot(
  file: File,
  setSlot: Dispatch<SetStateAction<SlotState>>,
) {
  const err = validateFinalVideoFile(file);
  if (err) {
    toast.error(err);
    return;
  }
  const durationSec = await readVideoDuration(file);
  setSlot((prev) => {
    revokePreview(prev.previewUrl);
    return {
      ...prev,
      file,
      previewUrl: URL.createObjectURL(file),
      durationSec,
      phase: "ready",
      progress: 0,
      loaded: 0,
      total: file.size,
      startedAt: null,
      error: null,
      completedAt: null,
    };
  });
}

function UploadProgressPanel({ state }: { state: SlotState }) {
  const elapsedMs = state.startedAt != null ? Date.now() - state.startedAt : 0;
  const speed =
    elapsedMs > 400 && state.loaded > 0 ? state.loaded / (elapsedMs / 1000) : 0;
  const remainingBytes = Math.max(0, state.total - state.loaded);
  const etaSec = speed > 0 ? remainingBytes / speed : 0;

  return (
    <div className="space-y-3 rounded-xl border border-brand/20 bg-brand/5 p-3.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-brand">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          در حال ارسال ویدیو…
        </span>
        <span className="tabular-nums font-semibold text-foreground">
          {state.progress}٪
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${state.progress}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
        <div>
          <p className="mb-0.5 text-[10px] opacity-70">حجم</p>
          <p className="tabular-nums text-foreground">
            {formatFileSize(state.loaded)} / {formatFileSize(state.total)}
          </p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] opacity-70">سرعت</p>
          <p className="tabular-nums text-foreground" dir="ltr">
            {formatSpeed(speed)}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="mb-0.5 text-[10px] opacity-70">باقی‌مانده</p>
          <p className="text-foreground">{formatEta(etaSec)}</p>
        </div>
      </div>
    </div>
  );
}

function PremiumUploadCard({
  type,
  state,
  disabled,
  onPick,
  onClear,
  onRetry,
  onPreviewSaved,
}: {
  type: FinalVideoType;
  state: SlotState;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  onRetry?: () => void;
  onPreviewSaved?: (item: FinalVideoItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const isWatermarked = type === "WATERMARKED";
  const label = VIDEO_TYPE_LABELS[type];
  const description = isWatermarked
    ? "ویدیوی دارای واترمارک برای بررسی اولیه مشتری"
    : "نسخه نهایی بدون واترمارک برای تحویل به مشتری";
  const Icon = isWatermarked ? Droplets : Film;
  const uploading = state.phase === "uploading";
  const locked = disabled || uploading;
  const displaySaved =
    (state.phase === "saved" || state.phase === "success") && state.saved;
  const displayLocal =
    state.file &&
    (state.phase === "ready" ||
      state.phase === "uploading" ||
      state.phase === "error");

  const handleFiles = (list: FileList | null) => {
    const file = list?.[0];
    if (!file || locked) return;
    onPick(file);
  };

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300",
        dragOver && "border-brand ring-2 ring-brand/20",
        state.phase === "error" && "border-destructive/40",
        (state.phase === "success" || state.phase === "saved") &&
          "border-brand/35",
        state.phase === "idle" &&
          "border-border/70 hover:border-brand/40 hover:shadow-md",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3 border-b px-4 py-3.5 sm:px-5",
          isWatermarked
            ? "border-brand/15 bg-gradient-to-l from-brand/10 via-brand/5 to-transparent"
            : "border-border/60 bg-gradient-to-l from-muted/60 via-muted/20 to-transparent",
        )}
      >
        <span
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
            isWatermarked
              ? "bg-brand text-brand-foreground"
              : "bg-foreground/90 text-background",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold tracking-tight sm:text-base">
              {label}
            </h4>
            <Badge variant={isWatermarked ? "brand" : "secondary"}>
              {isWatermarked ? "واترمارک" : "نهایی"}
            </Badge>
            {state.phase === "saved" || state.phase === "success" ? (
              <Badge
                variant="outline"
                className="gap-1 border-brand/30 text-brand"
              >
                <CheckCircle2 className="h-3 w-3" />
                ارسال‌شده
              </Badge>
            ) : null}
            {state.phase === "uploading" ? (
              <Badge variant="secondary">در حال ارسال</Badge>
            ) : null}
            {state.phase === "error" ? (
              <Badge variant="destructive">ناموفق</Badge>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        {state.phase === "idle" ? (
          <div
            role="button"
            tabIndex={0}
            aria-label={`انتخاب ${label}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!locked) inputRef.current?.click();
              }
            }}
            onClick={() => !locked && inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center transition-all duration-200",
              dragOver
                ? "scale-[1.01] border-brand bg-brand/5"
                : "border-border/70 bg-muted/15 hover:border-brand/50 hover:bg-muted/25",
              locked && "pointer-events-none opacity-60",
            )}
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
              <Upload className="h-6 w-6 text-brand" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">فایل را بکشید و رها کنید</p>
              <p className="text-xs text-muted-foreground">
                یا برای انتخاب از دستگاه کلیک کنید
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Badge variant="outline" className="font-normal">
                MP4 · MOV · MKV · WebM
              </Badge>
            </div>
          </div>
        ) : null}

        {displayLocal ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-black">
              {state.previewUrl ? (
                <video
                  src={state.previewUrl}
                  className="aspect-video w-full object-contain"
                  muted
                  playsInline
                  preload="metadata"
                  controls={state.phase !== "uploading"}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center">
                  <Film className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p
                className="truncate text-sm font-medium"
                title={state.file!.name}
              >
                {state.file!.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {formatFileSize(state.file!.size)}
                </span>
                {state.durationSec != null ? (
                  <span>{formatDurationLabel(state.durationSec)}</span>
                ) : null}
              </div>
            </div>

            {state.phase === "uploading" ? (
              <UploadProgressPanel state={state} />
            ) : null}

            {state.phase === "error" ? (
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">ارسال ویدیو ناموفق بود</p>
                    <p className="mt-0.5 opacity-90">
                      {state.error || "دوباره تلاش کنید."}
                    </p>
                  </div>
                </div>
                {onRetry ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={locked}
                    onClick={onRetry}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    تلاش مجدد
                  </Button>
                ) : null}
              </div>
            ) : null}

            {state.phase === "ready" || state.phase === "error" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={locked}
                  onClick={() => inputRef.current?.click()}
                >
                  <Replace className="h-3.5 w-3.5" />
                  تغییر فایل
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  disabled={locked}
                  onClick={onClear}
                >
                  <X className="h-3.5 w-3.5" />
                  حذف
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {displaySaved && !displayLocal ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-border/60">
              <VideoPlayer
                src={mediaStreamUrl(state.saved!.id)}
                title={state.saved!.name}
              />
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isWatermarked ? "brand" : "secondary"}>
                  {label}
                </Badge>
                <Badge
                  variant={
                    state.saved!.status === "APPROVED"
                      ? "success"
                      : state.saved!.status === "REVISION_REQUESTED"
                        ? "warning"
                        : "outline"
                  }
                >
                  {state.saved!.statusLabel || "آپلود شده"}
                </Badge>
                {state.saved!.version != null ? (
                  <Badge variant="outline">نسخه {state.saved!.version}</Badge>
                ) : null}
              </div>
              <p
                className="mt-2 truncate text-sm font-medium"
                title={state.saved!.name}
              >
                {state.saved!.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {state.saved!.sizeBytes != null ? (
                  <span className="tabular-nums">
                    {formatFileSize(state.saved!.sizeBytes)}
                  </span>
                ) : null}
                {state.saved!.createdAt ? (
                  <span>{formatDate(state.saved!.createdAt)}</span>
                ) : null}
              </div>
            </div>

            {state.saved!.status === "REVISION_REQUESTED" &&
            state.saved!.revisionNotes ? (
              <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <MessageSquareWarning className="h-3.5 w-3.5 text-warning" />
                  اصلاحات درخواستی مدیر
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                  {state.saved!.revisionNotes}
                </p>
              </div>
            ) : null}

            {(state.phase === "success" || state.phase === "saved") && (
              <div className="flex items-start gap-2 rounded-xl border border-brand/25 bg-brand/5 px-3 py-2.5 text-xs text-brand">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">ویدیو با موفقیت ارسال شد</p>
                  {state.completedAt || state.saved?.createdAt ? (
                    <p className="mt-0.5 text-brand/80">
                      {formatDate(state.completedAt || state.saved!.createdAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={locked}
                onClick={() => state.saved && onPreviewSaved?.(state.saved)}
              >
                <Eye className="h-3.5 w-3.5" />
                پیش‌نمایش
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={locked}
                onClick={() => inputRef.current?.click()}
              >
                <Replace className="h-3.5 w-3.5" />
                آپلود نسخه جدید
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                disabled={locked}
                onClick={onClear}
              >
                <X className="h-3.5 w-3.5" />
                حذف
              </Button>
            </div>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_VIDEO_TYPES}
          className="sr-only"
          disabled={locked}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </article>
  );
}

function latestByType(
  items: FinalVideoItem[] | undefined,
  type: FinalVideoType,
): FinalVideoItem | null {
  if (!items?.length) return null;
  const ofType = items.filter((i) => i.videoType === type);
  if (!ofType.length) return null;
  return ofType.reduce((best, cur) =>
    (cur.version || 0) > (best.version || 0) ? cur : best,
  );
}

function EditorVersionHistory({ items }: { items?: FinalVideoItem[] }) {
  if (!items?.length) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h4 className="text-sm font-semibold">تاریخچه نسخه‌های محصول نهایی</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          همه نسخه‌ها بدون حذف یا جایگزینی نگهداری می‌شوند.
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-xl border border-border/60 bg-muted/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      item.status === "APPROVED"
                        ? "success"
                        : item.status === "REVISION_REQUESTED"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {item.statusLabel || item.status}
                  </Badge>
                  <Badge variant="secondary">
                    {item.videoTypeLabel || item.videoType}
                  </Badge>
                  <Badge variant="outline">نسخه {item.version}</Badge>
                  {index === 0 ? <Badge variant="brand">جدیدترین</Badge> : null}
                </div>
                <p className="mt-2 truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {formatDate(item.createdAt)}
                  </span>
                  {item.sizeBytes != null ? (
                    <span>{formatFileSize(item.sizeBytes)}</span>
                  ) : null}
                </div>
              </div>
            </div>
            {item.status === "REVISION_REQUESTED" && item.revisionNotes ? (
              <div className="border-t border-warning/30 bg-warning/5 px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <MessageSquareWarning className="h-3.5 w-3.5 text-warning" />
                  بازخورد مدیر
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                  {item.revisionNotes}
                </p>
              </div>
            ) : null}
            <div className="border-t border-border/50 p-3">
              <VideoPlayer src={mediaStreamUrl(item.id)} title={item.name} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FinalVideoUploader({
  projectId,
  disabled,
  existingItems,
  onUploaded,
}: {
  projectId: string;
  disabled?: boolean;
  existingItems?: FinalVideoItem[];
  onUploaded?: () => void;
}) {
  const qc = useQueryClient();
  const existingWm = latestByType(existingItems, "WATERMARKED");
  const existingClean = latestByType(existingItems, "CLEAN");

  const [wm, setWm] = useState<SlotState>(() => emptySlot(existingWm));
  const [clean, setClean] = useState<SlotState>(() => emptySlot(existingClean));
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<FinalVideoItem | null>(null);
  const wmRef = useRef(wm);
  const cleanRef = useRef(clean);
  wmRef.current = wm;
  cleanRef.current = clean;

  useEffect(() => {
    setWm((prev) => {
      if (
        prev.phase === "uploading" ||
        prev.phase === "ready" ||
        prev.phase === "error"
      ) {
        return prev;
      }
      if (prev.previewUrl && prev.phase !== "saved") {
        revokePreview(prev.previewUrl);
      }
      return emptySlot(existingWm);
    });
  }, [existingWm?.id, existingWm?.createdAt]);

  useEffect(() => {
    setClean((prev) => {
      if (
        prev.phase === "uploading" ||
        prev.phase === "ready" ||
        prev.phase === "error"
      ) {
        return prev;
      }
      if (prev.previewUrl && prev.phase !== "saved") {
        revokePreview(prev.previewUrl);
      }
      return emptySlot(existingClean);
    });
  }, [existingClean?.id, existingClean?.createdAt]);

  useEffect(() => {
    return () => {
      revokePreview(wmRef.current.previewUrl);
      revokePreview(cleanRef.current.previewUrl);
    };
  }, []);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["final-products", projectId] });
    qc.invalidateQueries({ queryKey: ["production-task", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["editor-projects"] });
    qc.invalidateQueries({ queryKey: ["editor-dashboard"] });
    onUploaded?.();
  }, [qc, projectId, onUploaded]);

  const clearSlot = (setSlot: Dispatch<SetStateAction<SlotState>>) => {
    setSlot((prev) => {
      revokePreview(prev.previewUrl);
      return emptySlot(null);
    });
  };

  const uploadOne = async (
    type: FinalVideoType,
    file: File,
    setSlot: Dispatch<SetStateAction<SlotState>>,
  ) => {
    const err = validateFinalVideoFile(file);
    if (err) {
      setSlot((s) => ({ ...s, phase: "error", error: err }));
      throw new Error(err);
    }
    setSlot((s) => ({
      ...s,
      phase: "uploading",
      progress: 0,
      loaded: 0,
      total: file.size,
      startedAt: Date.now(),
      error: null,
      completedAt: null,
    }));
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.PRODUCTION_FINAL,
          projectId,
          videoType: type,
        },
        (pct, detail) =>
          setSlot((s) => ({
            ...s,
            phase: "uploading",
            progress: pct,
            loaded: detail?.loaded ?? s.loaded,
            total: detail?.total ?? s.total,
            error: null,
          })),
      );
      const result = await apiPost<{ file?: FinalVideoItem }>(
        `/production/projects/${projectId}/final-products/upload`,
        {
          videoType: type,
          storageKey: uploaded.key,
          name: uploaded.name || file.name,
          mimeType: uploaded.mimeType || file.type,
          sizeBytes: uploaded.sizeBytes || file.size,
          notes: notes.trim() || undefined,
          storageMeta: uploaded.storageMeta || undefined,
        },
      );
      const savedFile =
        result && typeof result === "object" && "file" in result
          ? (result as { file?: FinalVideoItem }).file || null
          : null;
      setSlot((s) => {
        revokePreview(s.previewUrl);
        const fallbackSaved: FinalVideoItem = savedFile || {
          id: `temp-${type}`,
          name: uploaded.name || file.name,
          kind: type === "CLEAN" ? "CLEAN_FINAL" : "WATERMARKED_FINAL",
          videoType: type,
          videoTypeLabel: VIDEO_TYPE_LABELS[type],
          status: "PENDING_REVIEW",
          statusLabel: "در انتظار بررسی",
          version: 1,
          mimeType: uploaded.mimeType || file.type,
          sizeBytes: uploaded.sizeBytes || file.size,
          createdAt: new Date().toISOString(),
        };
        return {
          ...emptySlot(fallbackSaved),
          phase: "success",
          progress: 100,
          completedAt: new Date().toISOString(),
          saved: fallbackSaved,
        };
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "ارسال ناموفق بود";
      setSlot((s) => ({
        ...s,
        phase: "error",
        progress: 0,
        error: message,
      }));
      throw e;
    }
  };

  const uploadMut = useMutation({
    mutationFn: async (only?: FinalVideoType) => {
      const wmFile = wmRef.current.file;
      const cleanFile = cleanRef.current.file;
      const runWm =
        (!only || only === "WATERMARKED") &&
        wmFile &&
        (wmRef.current.phase === "ready" || wmRef.current.phase === "error");
      const runClean =
        (!only || only === "CLEAN") &&
        cleanFile &&
        (cleanRef.current.phase === "ready" ||
          cleanRef.current.phase === "error");

      if (!runWm && !runClean) {
        throw new Error("حداقل یک ویدیو برای ارسال انتخاب کنید");
      }
      if (runWm && wmFile) await uploadOne("WATERMARKED", wmFile, setWm);
      if (runClean && cleanFile) await uploadOne("CLEAN", cleanFile, setClean);
    },
    onSuccess: () => {
      toast.success("ویدیو با موفقیت ارسال شد");
      setNotes("");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ارسال ناموفق بود"),
  });

  const busy = uploadMut.isPending || disabled;
  const canSubmit =
    wm.phase === "ready" ||
    wm.phase === "error" ||
    clean.phase === "ready" ||
    clean.phase === "error";

  return (
    <section className="space-y-5" dir="rtl">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <PremiumUploadCard
          type="WATERMARKED"
          state={wm}
          disabled={busy}
          onPick={(file) => pickFileIntoSlot(file, setWm)}
          onClear={() => clearSlot(setWm)}
          onRetry={() => uploadMut.mutate("WATERMARKED")}
          onPreviewSaved={setPreview}
        />
        <PremiumUploadCard
          type="CLEAN"
          state={clean}
          disabled={busy}
          onPick={(file) => pickFileIntoSlot(file, setClean)}
          onClear={() => clearSlot(setClean)}
          onRetry={() => uploadMut.mutate("CLEAN")}
          onPreviewSaved={setPreview}
        />
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="final-notes">یادداشت برای مدیر (اختیاری)</Label>
          <Textarea
            id="final-notes"
            rows={2}
            dir="rtl"
            className="text-start"
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="توضیح کوتاه درباره تغییرات یا نسخه…"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] leading-5 text-muted-foreground">
            MP4، MOV، MKV، WebM
          </p>
          <Button
            variant="brand"
            disabled={busy || !canSubmit}
            onClick={() => uploadMut.mutate(undefined)}
            className="gap-2 rounded-xl px-5 shadow-sm"
          >
            {uploadMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {uploadMut.isPending ? "در حال ارسال…" : "ارسال ویدیو"}
          </Button>
        </div>
      </div>

      <EditorVersionHistory items={existingItems} />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl text-start sm:max-w-3xl" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{preview?.name || "پیش‌نمایش"}</DialogTitle>
            <DialogDescription>
              {preview?.videoTypeLabel ||
                (preview?.videoType
                  ? VIDEO_TYPE_LABELS[preview.videoType as FinalVideoType]
                  : "")}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <VideoPlayer
              src={mediaStreamUrl(preview.id)}
              title={preview.name}
              autoPlay
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
