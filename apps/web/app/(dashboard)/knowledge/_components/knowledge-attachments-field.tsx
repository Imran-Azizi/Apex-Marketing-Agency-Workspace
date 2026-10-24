"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  FileImage,
  FileText,
  FileVideo,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  apiDelete,
  ApiError,
  resolveAssetSrc,
  type ApiEnvelope,
} from "@/lib/api";
import { formatFileSize } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  UploadProgress,
  type UploadStatus,
} from "@/components/loading/upload-progress";
import type { KnowledgeAttachment } from "./types";

const ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md";

const MAX_BYTES = 100 * 1024 * 1024;

type PendingItem = {
  id: string;
  file: File;
  previewUrl: string | null;
  kind: "IMAGE" | "VIDEO" | "DOCUMENT" | "OTHER";
  status: UploadStatus;
  progress: number;
  loaded: number;
  total: number;
  error?: string;
};

export type KnowledgeAttachmentsFieldHandle = {
  /** Upload idle/error items to entry. Returns false if any failed. */
  uploadPending: (entryId: string) => Promise<boolean>;
  hasPending: () => boolean;
  isBusy: () => boolean;
  clear: () => void;
};

function sniffKind(file: File): PendingItem["kind"] {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return "IMAGE";
  if (t.startsWith("video/")) return "VIDEO";
  if (
    t.includes("pdf") ||
    t.includes("document") ||
    t.includes("sheet") ||
    t.includes("presentation") ||
    t.startsWith("text/")
  ) {
    return "DOCUMENT";
  }
  return "OTHER";
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "IMAGE") return <FileImage className="h-4 w-4" />;
  if (kind === "VIDEO") return <FileVideo className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

async function uploadOne(
  file: File,
  entryId: string,
  onProgress: (pct: number, loaded: number, total: number) => void,
) {
  const fd = new FormData();
  fd.append("file", file);
  await api.post<ApiEnvelope<unknown>>(
    `/knowledge/${entryId}/attachments`,
    fd,
    {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      transformRequest: [
        (body, headers) => {
          if (headers && typeof headers === "object") {
            delete (headers as Record<string, unknown>)["Content-Type"];
          }
          return body;
        },
      ],
      onUploadProgress: (event) => {
        const total = event.total || file.size || 0;
        if (!total) return;
        const pct = Math.min(100, Math.round((event.loaded / total) * 100));
        onProgress(pct, event.loaded, total);
      },
    },
  );
}

export type KnowledgeAttachmentsFieldProps = {
  entryId?: string | null;
  existing?: KnowledgeAttachment[];
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onExistingChanged?: () => void;
};

export const KnowledgeAttachmentsField = forwardRef<
  KnowledgeAttachmentsFieldHandle,
  KnowledgeAttachmentsFieldProps
>(function KnowledgeAttachmentsField(
  {
    entryId,
    existing = [],
    disabled,
    onBusyChange,
    onExistingChanged,
  },
  ref,
) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<PendingItem[]>([]);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const busy = items.some(
    (i) => i.status === "uploading" || i.status === "processing",
  );

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<PendingItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const uploadPending = useCallback(
    async (targetEntryId: string) => {
      const queue = itemsRef.current.filter(
        (i) => i.status === "idle" || i.status === "error",
      );
      if (!queue.length) return true;

      let ok = true;
      for (const item of queue) {
        patchItem(item.id, {
          status: "uploading",
          progress: 0,
          error: undefined,
        });
        try {
          await uploadOne(item.file, targetEntryId, (pct, loaded, total) => {
            patchItem(item.id, {
              status: "uploading",
              progress: pct,
              loaded,
              total,
            });
          });
          patchItem(item.id, {
            status: "success",
            progress: 100,
            loaded: item.file.size,
            total: item.file.size,
          });
        } catch (err) {
          ok = false;
          patchItem(item.id, {
            status: "error",
            progress: 0,
            error:
              err instanceof ApiError ? err.message : "آپلود ناموفق بود",
          });
        }
      }
      return ok;
    },
    [patchItem],
  );

  useImperativeHandle(
    ref,
    () => ({
      uploadPending,
      hasPending: () =>
        itemsRef.current.some(
          (i) => i.status === "idle" || i.status === "error",
        ),
      isBusy: () =>
        itemsRef.current.some(
          (i) => i.status === "uploading" || i.status === "processing",
        ),
      clear: () => {
        for (const item of itemsRef.current) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        setItems([]);
      },
    }),
    [uploadPending],
  );

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length) return;

      const next: PendingItem[] = [];
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          toast.error(`«${file.name}» بیش از ۱۰۰ مگابایت است`);
          continue;
        }
        const kind = sniffKind(file);
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: kind === "IMAGE" ? URL.createObjectURL(file) : null,
          kind,
          status: "idle",
          progress: 0,
          loaded: 0,
          total: file.size,
        });
      }
      if (!next.length) return;

      setItems((prev) => [...prev, ...next]);

      if (!entryId) return;

      const succeededIds = new Set<string>();
      let failCount = 0;
      for (const item of next) {
        patchItem(item.id, { status: "uploading", progress: 0 });
        try {
          await uploadOne(item.file, entryId, (pct, loaded, total) => {
            patchItem(item.id, {
              status: "uploading",
              progress: pct,
              loaded,
              total,
            });
          });
          patchItem(item.id, {
            status: "success",
            progress: 100,
            loaded: item.file.size,
            total: item.file.size,
          });
          succeededIds.add(item.id);
        } catch (err) {
          failCount += 1;
          patchItem(item.id, {
            status: "error",
            progress: 0,
            error:
              err instanceof ApiError ? err.message : "آپلود ناموفق بود",
          });
        }
      }

      if (succeededIds.size > 0) {
        toast.success(
          succeededIds.size === 1
            ? "فایل بارگذاری شد"
            : `${succeededIds.size} فایل بارگذاری شد`,
        );
        setItems((prev) =>
          prev.filter((item) => {
            if (succeededIds.has(item.id)) {
              if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
              return false;
            }
            return true;
          }),
        );
        onExistingChanged?.();
      }
      if (failCount > 0 && succeededIds.size === 0) {
        toast.error("آپلود فایل‌ها ناموفق بود");
      }
    },
    [entryId, onExistingChanged, patchItem],
  );

  function removePending(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function removeExisting(attachmentId: string) {
    if (!entryId) return;
    setRemovingId(attachmentId);
    try {
      await apiDelete(`/knowledge/${entryId}/attachments/${attachmentId}`);
      toast.success("پیوست حذف شد");
      onExistingChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف پیوست");
    } finally {
      setRemovingId(null);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    if (e.dataTransfer.files?.length) {
      void addFiles(e.dataTransfer.files);
    }
  }

  const tracked = items.filter(
    (i) =>
      i.status === "uploading" ||
      i.status === "processing" ||
      i.status === "success",
  );
  const overallPct =
    busy && tracked.length
      ? Math.round(
          tracked.reduce((sum, i) => sum + i.progress, 0) / tracked.length,
        )
      : 0;

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId} className="flex items-center gap-2 text-sm">
          <Upload className="h-4 w-4" />
          فایل، تصویر یا ویدیو
        </Label>
        <span className="text-[11px] text-muted-foreground">
          چند فایل · حداکثر ۱۰۰ مگابایت
        </span>
      </div>

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border/70 bg-background/60 hover:border-primary/40 hover:bg-muted/40",
          (disabled || busy) && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium">
          انتخاب چند فایل یا رها کردن اینجا
        </span>
        <span className="text-xs text-muted-foreground">
          تصویر، ویدیو، PDF و اسناد اداری
        </span>
      </button>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {busy && (
        <div className="space-y-1.5 rounded-lg border bg-card px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">پیشرفت کلی آپلود</span>
            <span className="tabular-nums font-medium text-primary">
              {overallPct}٪
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            if (item.status === "idle") {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-2.5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <KindIcon kind={item.kind} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)} · آماده آپلود
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    disabled={disabled || busy}
                    onClick={() => removePending(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            }

            return (
              <div key={item.id} className="space-y-1">
                <UploadProgress
                  fileName={item.file.name}
                  progress={item.progress}
                  status={item.status}
                  errorMessage={item.error}
                  detail={
                    item.status === "uploading" && item.total > 0
                      ? `${formatFileSize(item.loaded)} / ${formatFileSize(item.total)}`
                      : item.status === "success"
                        ? formatFileSize(item.file.size)
                        : undefined
                  }
                />
                {(item.status === "error" ||
                  (item.status === "success" && !entryId)) && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => removePending(item.id)}
                    >
                      حذف از لیست
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {existing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            پیوست‌های ذخیره‌شده
          </p>
          {existing.map((att) => {
            const src = resolveAssetSrc({
              url: att.url,
              storageKey: att.storageKey,
            });
            return (
              <div
                key={att.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-2.5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {att.kind === "IMAGE" && src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <KindIcon kind={att.kind} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{att.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(att.sizeBytes)} · {att.kind}
                  </p>
                </div>
                {entryId ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-destructive"
                    disabled={removingId === att.id || disabled || busy}
                    onClick={() => void removeExisting(att.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
