"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  ImageIcon,
  Link2,
  Loader2,
  Mic,
  Square,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  UploadProgress,
  type UploadStatus,
} from "@/components/loading/upload-progress";
import {
  detectReferenceProvider,
  filePreviewUrl,
  formatDurationLabel,
  formatFileSize,
  isValidReferenceUrl,
  readVideoDuration,
  uploadFileWithProgress,
} from "@/lib/upload";
import {
  UPLOAD_PURPOSE,
  getMediaFolderLabel,
  mergeUploadStorageMeta,
} from "@/lib/media-manager";

export type ClientAssetItem = {
  id: string;
  name: string;
  kind: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string;
  url?: string | null;
  meta?: Record<string, unknown> | null;
};

type AssetKind =
  | "LOGO"
  | "PRODUCT_IMAGE"
  | "VIDEO"
  | "BRANDBOOK"
  | "REFERENCE"
  | "PRONUNCIATION";

type UploadSlot = {
  kind: AssetKind;
  title: string;
  description: string;
  accept: string;
  multiple: boolean;
  icon: ReactNode;
  extensionsHint: string;
};

const SLOTS: UploadSlot[] = [
  {
    kind: "LOGO",
    title: "لوگوی برند",
    description: "نسخه‌های مختلف لوگو را آپلود کنید",
    accept: ".svg,.png,.ai,.eps,.psd,image/svg+xml,image/png",
    multiple: true,
    icon: <ImageIcon className="h-5 w-5" />,
    extensionsHint: "SVG, PNG, AI, EPS, PSD",
  },
  {
    kind: "PRODUCT_IMAGE",
    title: "تصاویر محصول / خدمت",
    description: "چند تصویر با کشیدن و رها کردن",
    accept: "image/*,.jpg,.jpeg,.png,.webp,.gif",
    multiple: true,
    icon: <FileImage className="h-5 w-5" />,
    extensionsHint: "JPG, PNG, WEBP, GIF",
  },
  {
    kind: "VIDEO",
    title: "ویدیوهای موجود",
    description: "ویدیوهای قبلی برای مرجع تولید",
    accept: "video/*,.mp4,.mov,.webm,.mkv",
    multiple: true,
    icon: <FileVideo className="h-5 w-5" />,
    extensionsHint: "MP4, MOV, WEBM",
  },
  {
    kind: "BRANDBOOK",
    title: "برندبوک / کاتالوگ / اسناد",
    description: "مستندات برند و فایل‌های ارائه",
    accept: ".pdf,.docx,.pptx,application/pdf",
    multiple: true,
    icon: <FileText className="h-5 w-5" />,
    extensionsHint: "PDF, DOCX, PPTX",
  },
  {
    kind: "PRONUNCIATION",
    title: "فایل صوتی",
    description: "اختیاری — آپلود یا ضبط مستقیم",
    accept: "audio/*,.mp3,.wav,.m4a",
    multiple: true,
    icon: <FileAudio className="h-5 w-5" />,
    extensionsHint: "MP3, WAV, M4A",
  },
];

type PendingUpload = {
  id: string;
  kind: AssetKind;
  name: string;
  progress: number;
  loaded: number;
  total: number;
  status: UploadStatus;
  error?: string;
};

/** Upload gate state for project creation (submit button). */
export type AssetUploadState = {
  isUploading: boolean;
  hasFailed: boolean;
  activeCount: number;
  failedCount: number;
  /** True only when nothing is in-flight or failed. */
  canSubmit: boolean;
};

export const IDLE_ASSET_UPLOAD_STATE: AssetUploadState = {
  isUploading: false,
  hasFailed: false,
  activeCount: 0,
  failedCount: 0,
  canSubmit: true,
};

type ClientAssetsUploaderProps = {
  assets: ClientAssetItem[];
  selectedIds: string[];
  onSelectedChange: (ids: string[] | ((prev: string[]) => string[])) => void;
  onRefresh: () => void;
  /** Notifies parent when uploads start/finish/fail so submit can be gated. */
  onUploadStateChange?: (state: AssetUploadState) => void;
};

function kindIcon(kind: string, mime?: string | null) {
  if (kind === "REFERENCE") return <Link2 className="h-4 w-4" />;
  if (kind === "VIDEO" || mime?.startsWith("video/"))
    return <FileVideo className="h-4 w-4" />;
  if (
    kind === "PRONUNCIATION" ||
    kind === "AUDIO" ||
    mime?.startsWith("audio/")
  )
    return <FileAudio className="h-4 w-4" />;
  if (kind === "BRANDBOOK" || kind === "CATALOG" || mime?.includes("pdf"))
    return <FileText className="h-4 w-4" />;
  return <FileImage className="h-4 w-4" />;
}

function extensionAllowed(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.replace("/*", "/"));
    return type === token;
  });
}

function AssetThumb({
  asset,
  localUrl,
}: {
  asset: ClientAssetItem;
  localUrl?: string | null;
}) {
  const isImage =
    asset.mimeType?.startsWith("image/") ||
    /\.(png|jpe?g|jfif|jpe|jif|gif|webp|svg)$/i.test(asset.name);
  const isVideo =
    asset.mimeType?.startsWith("video/") || asset.kind === "VIDEO";
  const isAudio =
    asset.mimeType?.startsWith("audio/") ||
    asset.kind === "PRONUNCIATION" ||
    asset.kind === "AUDIO";

  const url =
    localUrl ||
    (asset.storageKey && !asset.storageKey.startsWith("ref://")
      ? filePreviewUrl(asset.storageKey, asset.meta) ||
        (typeof asset.url === "string" ? asset.url : null)
      : typeof asset.url === "string"
        ? asset.url
        : null);

  if (asset.kind === "REFERENCE") {
    const metaUrl =
      typeof asset.meta?.url === "string" ? asset.meta.url : asset.name;
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Link2 className="h-5 w-5" />
        <span className="sr-only">{metaUrl}</span>
      </div>
    );
  }

  if (isImage && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={asset.name}
        className="h-14 w-14 rounded-md object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          if (process.env.NODE_ENV !== "production") {
            console.warn("[client-asset] image failed:", url);
          }
        }}
      />
    );
  }
  if (isVideo && url) {
    return (
      <video
        src={url}
        className="h-14 w-14 rounded-md object-cover"
        muted
        playsInline
      />
    );
  }
  if (isAudio && url) {
    return (
      <div className="flex h-14 w-28 items-center">
        <audio src={url} controls className="h-8 w-full" />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
      {kindIcon(asset.kind, asset.mimeType)}
    </div>
  );
}

function DropZone({
  slot,
  busy,
  onFiles,
}: {
  slot: UploadSlot;
  busy: boolean;
  onFiles: (files: FileList | File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
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
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border border-dashed p-4 transition-colors",
        dragOver ? "border-brand bg-brand/5" : "border-border bg-muted/20",
        busy && "opacity-70",
      )}
    >
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : slot.icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-medium">{slot.title}</div>
          <p className="text-xs text-muted-foreground">{slot.description}</p>
          <p className="text-[11px] text-muted-foreground">
            {slot.extensionsHint}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          <UploadCloud className="h-4 w-4" />
          انتخاب فایل
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={slot.accept}
          multiple={slot.multiple}
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function AudioRecorder({
  disabled,
  onRecorded,
}: {
  disabled?: boolean;
  onRecorded: (file: File) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!window.MediaRecorder &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `pronunciation-${Date.now()}.${ext}`, {
          type: mime,
        });
        onRecorded(file);
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("دسترسی به میکروفون ممکن نیست");
    }
  }

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant={recording ? "destructive" : "outline"}
      disabled={disabled}
      onClick={() => (recording ? stop() : start())}
    >
      {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {recording ? "توقف ضبط" : "ضبط صدا"}
    </Button>
  );
}

export function ClientAssetsUploader({
  assets,
  selectedIds,
  onSelectedChange,
  onRefresh,
  onUploadStateChange,
}: ClientAssetsUploaderProps) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>(
    {},
  );
  const [refUrl, setRefUrl] = useState("");
  const [refLabel, setRefLabel] = useState("");
  const [refError, setRefError] = useState<string | null>(null);
  const [refBusy, setRefBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const uploadState = useMemo((): AssetUploadState => {
    const active = pending.filter(
      (p) => p.status === "uploading" || p.status === "processing" || p.status === "idle",
    );
    const failed = pending.filter((p) => p.status === "error");
    const isUploading = active.length > 0 || refBusy;
    const hasFailed = failed.length > 0;
    return {
      isUploading,
      hasFailed,
      activeCount: active.length + (refBusy ? 1 : 0),
      failedCount: failed.length,
      canSubmit: !isUploading && !hasFailed,
    };
  }, [pending, refBusy]);

  useEffect(() => {
    onUploadStateChange?.(uploadState);
  }, [uploadState, onUploadStateChange]);

  useEffect(() => {
    return () => {
      onUploadStateChange?.(IDLE_ASSET_UPLOAD_STATE);
    };
  }, [onUploadStateChange]);

  const busyKinds = useMemo(
    () =>
      new Set(
        pending
          .filter(
            (p) =>
              p.status === "uploading" ||
              p.status === "processing" ||
              p.status === "idle",
          )
          .map((p) => p.kind),
      ),
    [pending],
  );

  const grouped = useMemo(() => {
    const map: Record<string, ClientAssetItem[]> = {};
    for (const slot of SLOTS) map[slot.kind] = [];
    map.REFERENCE = [];
    map.OTHER = [];
    for (const a of assets) {
      if (map[a.kind]) map[a.kind].push(a);
      else if (a.kind === "CATALOG") map.BRANDBOOK.push(a);
      else if (a.kind === "AUDIO") map.PRONUNCIATION.push(a);
      else map.OTHER.push(a);
    }
    return map;
  }, [assets]);

  const toggleSelected = useCallback(
    (id: string, checked: boolean) => {
      onSelectedChange((prev) =>
        checked
          ? Array.from(new Set([...prev, id]))
          : prev.filter((x) => x !== id),
      );
    },
    [onSelectedChange],
  );

  async function persistAsset(payload: {
    kind: AssetKind;
    name: string;
    storageKey: string;
    mimeType?: string;
    sizeBytes?: number;
    meta?: Record<string, unknown>;
  }) {
    const created = await apiPost<ClientAssetItem>("/portal/assets", payload);
    onSelectedChange((prev) => Array.from(new Set([...prev, created.id])));
    onRefresh();
    return created;
  }

  function updatePending(
    tempId: string,
    patch: Partial<PendingUpload>,
  ) {
    setPending((prev) =>
      prev.map((p) => (p.id === tempId ? { ...p, ...patch } : p)),
    );
  }

  async function uploadOne(kind: AssetKind, file: File) {
    const tempId = `${kind}-${file.name}-${Date.now()}-${Math.random()}`;
    setPending((prev) => [
      ...prev,
      {
        id: tempId,
        kind,
        name: file.name,
        progress: 0,
        loaded: 0,
        total: file.size,
        status: "uploading",
      },
    ]);

    try {
      const meta: Record<string, unknown> = {};
      if (kind === "VIDEO") {
        const duration = await readVideoDuration(file);
        if (duration != null) meta.durationSec = duration;
      }

      const up = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.PORTAL_ASSET,
          assetKind: kind,
        },
        (pct, detail) => {
          updatePending(tempId, {
            progress: pct,
            loaded: detail?.loaded ?? 0,
            total: detail?.total ?? file.size,
            status: "uploading",
          });
        },
      );

      updatePending(tempId, {
        progress: 100,
        loaded: file.size,
        total: file.size,
        status: "processing",
      });

      const created = await persistAsset({
        kind,
        name: up.name || file.name,
        storageKey: up.key,
        mimeType: up.mimeType || file.type,
        sizeBytes: up.sizeBytes ?? file.size,
        meta: mergeUploadStorageMeta(meta, up),
      });

      const blobUrl = URL.createObjectURL(file);
      setLocalPreviews((prev) => ({ ...prev, [created.id]: blobUrl }));
      setPending((prev) => prev.filter((p) => p.id !== tempId));
      toast.success(`${file.name} ذخیره شد`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "آپلود ناموفق";
      updatePending(tempId, {
        error: message,
        status: "error",
        progress: 0,
      });
      toast.error(message);
    }
  }

  async function handleFiles(kind: AssetKind, fileList: FileList | File[]) {
    const slot = SLOTS.find((s) => s.kind === kind);
    const files = Array.from(fileList).filter((file) => {
      if (slot && !extensionAllowed(file, slot.accept)) {
        toast.error(`فرمت ${file.name} برای این بخش مجاز نیست`);
        return false;
      }
      return true;
    });
    if (!files.length) return;
    // Parallel uploads — each file tracks its own progress independently
    await Promise.all(files.map((file) => uploadOne(kind, file)));
  }

  async function addReference() {
    const url = refUrl.trim();
    if (!isValidReferenceUrl(url)) {
      setRefError(
        "لینک معتبر نیست. یوتیوب، ویمئو، گوگل درایو یا آدرس مستقیم ویدیو را وارد کنید.",
      );
      return;
    }
    setRefError(null);
    setRefBusy(true);
    try {
      const provider = detectReferenceProvider(url);
      await persistAsset({
        kind: "REFERENCE",
        name: refLabel.trim() || url,
        storageKey: `ref://${encodeURIComponent(url)}`,
        mimeType: "text/uri-list",
        sizeBytes: 0,
        meta: { url, provider },
      });
      setRefUrl("");
      setRefLabel("");
      toast.success("لینک مرجع ذخیره شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره لینک");
    } finally {
      setRefBusy(false);
    }
  }

  async function removeAsset(id: string) {
    setRemovingId(id);
    try {
      await apiDelete(`/portal/assets/${id}`);
      onSelectedChange((prev) => prev.filter((x) => x !== id));
      onRefresh();
      toast.success("فایل حذف شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حذف ناموفق");
    } finally {
      setRemovingId(null);
    }
  }

  function dismissPending(id: string) {
    setPending((prev) => prev.filter((x) => x.id !== id));
  }

  function renderAssetList(list: ClientAssetItem[]) {
    if (!list.length) {
      return (
        <p className="text-xs text-muted-foreground">
          هنوز فایلی اضافه نشده است.
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {list.map((a) => {
          const durationSec =
            typeof a.meta?.durationSec === "number" ? a.meta.durationSec : null;
          const refUrlValue =
            typeof a.meta?.url === "string"
              ? a.meta.url
              : a.storageKey?.startsWith("ref://")
                ? decodeURIComponent(a.storageKey.slice(6))
                : null;
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-background p-2.5"
            >
              <Checkbox
                checked={selectedIds.includes(a.id)}
                onCheckedChange={(c) => toggleSelected(a.id, !!c)}
              />
              <AssetThumb asset={a} localUrl={localPreviews[a.id]} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                  <span>{formatFileSize(a.sizeBytes)}</span>
                  {a.storageKey && !a.storageKey.startsWith("ref://") ? (
                    <span className="rounded bg-muted px-1.5 py-0.5">
                      {getMediaFolderLabel(a.storageKey, {
                        mimeType: a.mimeType,
                        meta: a.meta,
                      })}
                    </span>
                  ) : null}
                  {durationSec != null && (
                    <span>{formatDurationLabel(durationSec)}</span>
                  )}
                  {refUrlValue && (
                    <a
                      href={refUrlValue}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-brand underline-offset-2 hover:underline"
                      dir="ltr"
                    >
                      {refUrlValue}
                    </a>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                disabled={removingId === a.id || uploadState.isUploading}
                onClick={() => removeAsset(a.id)}
                aria-label="حذف"
              >
                {removingId === a.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      {!uploadState.canSubmit ? (
        <div
          className={cn(
            "rounded-xl border px-3.5 py-3 text-sm",
            uploadState.hasFailed
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-brand/30 bg-brand/5 text-foreground",
          )}
          role="status"
        >
          {uploadState.isUploading ? (
            <p>
              در حال آپلود {uploadState.activeCount.toLocaleString("fa-AF", { numberingSystem: "latn" })} فایل — تا پایان آپلود امکان ساخت پروژه وجود ندارد.
            </p>
          ) : (
            <p>
              {uploadState.failedCount.toLocaleString("fa-AF", { numberingSystem: "latn" })} فایل آپلود نشد. لطفاً خطا را برطرف کنید یا مورد ناموفق را حذف کنید.
            </p>
          )}
        </div>
      ) : null}

      {SLOTS.map((slot) => (
        <div key={slot.kind} className="space-y-3">
          <DropZone
            slot={slot}
            busy={busyKinds.has(slot.kind)}
            onFiles={(files) => {
              void handleFiles(slot.kind, files);
            }}
          />
          {slot.kind === "PRONUNCIATION" && (
            <div className="flex justify-end">
              <AudioRecorder
                disabled={busyKinds.has("PRONUNCIATION")}
                onRecorded={(file) => {
                  void handleFiles("PRONUNCIATION", [file]);
                }}
              />
            </div>
          )}
          {pending
            .filter((p) => p.kind === slot.kind)
            .map((p) => (
              <div key={p.id} className="relative">
                <UploadProgress
                  fileName={p.name}
                  progress={p.progress}
                  status={p.status}
                  errorMessage={p.error}
                  detail={
                    p.status === "uploading" && p.total > 0
                      ? `${formatFileSize(p.loaded)} / ${formatFileSize(p.total)}`
                      : p.status === "processing"
                        ? "در حال ذخیره در سرور..."
                        : undefined
                  }
                />
                {p.status === "error" ? (
                  <div className="mt-1.5 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => dismissPending(p.id)}
                    >
                      حذف از لیست
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          {renderAssetList(grouped[slot.kind] || [])}
        </div>
      ))}

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium">ویدیو مرجع (لینک)</div>
            <p className="text-xs text-muted-foreground">
              یوتیوب، ویمئو، گوگل درایو یا لینک مستقیم ویدیو
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">آدرس لینک</Label>
            <Input
              dir="ltr"
              placeholder="https://..."
              value={refUrl}
              disabled={refBusy || uploadState.isUploading}
              onChange={(e) => {
                setRefUrl(e.target.value);
                setRefError(null);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              عنوان (اختیاری)
            </Label>
            <Input
              placeholder="مثال: ویدیو رفرنس برند"
              value={refLabel}
              disabled={refBusy || uploadState.isUploading}
              onChange={(e) => setRefLabel(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={refBusy || uploadState.isUploading}
              onClick={() => {
                void addReference();
              }}
            >
              {refBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "افزودن لینک"
              )}
            </Button>
          </div>
        </div>
        {refError && <p className="text-xs text-destructive">{refError}</p>}
        {renderAssetList(grouped.REFERENCE || [])}
      </div>

      {(grouped.OTHER?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <Label>سایر دارایی‌ها</Label>
          {renderAssetList(grouped.OTHER)}
        </div>
      )}
    </div>
  );
}
