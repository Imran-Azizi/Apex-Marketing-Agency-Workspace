"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Mic2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDateTime } from "@/lib/utils";
import {
  formatFileSize,
  filePreviewUrl,
  fetchAuthenticatedFileBlobUrl,
} from "@/lib/upload";
import { NARRATION_APPROVED_LABEL } from "@/lib/narrator";
import { isLikelyBrowserPlayableAudio } from "@/lib/narration-audio";
import { SUCCESS_ICON } from "@/lib/theme-tones";

export type NarrationAudioFile = {
  id: string;
  name: string;
  storageKey: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  version?: number | null;
  createdAt: string;
};

export type NarrationTakeRecord = {
  id: string;
  version: number;
  createdAt: string;
  isCurrent?: boolean;
  audioFile?: NarrationAudioFile | null;
  projectFile?: NarrationAudioFile | null;
};

type Props = {
  takes: NarrationTakeRecord[];
  currentFileId?: string | null;
  emptyMessage?: string;
  onDownload?: (file: NarrationAudioFile) => Promise<void>;
  /** When set, shows a Delete control that opens a confirmation dialog. */
  onDelete?: (take: NarrationTakeRecord, file: NarrationAudioFile) => Promise<void>;
  /** Which takes may be deleted (defaults to all when onDelete is provided). */
  canDeleteTake?: (take: NarrationTakeRecord) => boolean;
  deletingTakeId?: string | null;
  className?: string;
  /** Manager-confirmed audio only — never set from upload alone. */
  approved?: boolean;
};

function faNum(n: number) {
  return n.toLocaleString("fa-AF", { numberingSystem: "latn" });
}

function normalizeTake(
  take: NarrationTakeRecord,
  currentFileId?: string | null,
) {
  const file = take.audioFile ?? take.projectFile ?? null;
  return {
    id: take.id,
    version: take.version,
    createdAt: take.createdAt,
    isCurrent:
      take.isCurrent ?? Boolean(file?.id && file.id === currentFileId),
    file,
    raw: take,
  };
}

/**
 * Load narration audio through the authenticated API (cookies + panel header),
 * then play from a blob: URL. Native <audio src=API> fails cross-origin for
 * panel sessions (Editor), while axios credentialed fetch succeeds.
 */
function NarrationAudioPlayer({
  file,
  versionLabel,
}: {
  file: NarrationAudioFile;
  versionLabel: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const likelyPlayable = isLikelyBrowserPlayableAudio(
    file.mimeType,
    file.name,
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setFailed(false);
    setSrc(null);

    void fetchAuthenticatedFileBlobUrl(file.storageKey, file.mimeType)
      .then((url) => {
        if (cancelled) {
          if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          setFailed(true);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.storageKey, file.mimeType]);

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex h-10 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 text-xs text-muted-foreground"
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        در حال آماده‌سازی پخش…
      </div>
    );
  }

  if (!src || failed) {
    return (
      <p className="text-xs leading-5 text-muted-foreground" dir="rtl">
        بارگذاری پخش ناموفق بود؛ فایل را دانلود کنید.
      </p>
    );
  }

  return (
    <div dir="ltr" className="w-full space-y-1.5">
      <audio
        key={src}
        controls
        preload="metadata"
        src={src}
        className="h-10 w-full"
        aria-label={`پخش نسخه ${versionLabel}`}
        onError={() => setFailed(true)}
      />
      {!likelyPlayable ? (
        <p className="text-xs leading-5 text-muted-foreground" dir="rtl">
          ممکن است این فرمت در همه مرورگرها پخش نشود؛ در صورت نیاز دانلود کنید.
        </p>
      ) : null}
    </div>
  );
}

export function NarrationAudioVersions({
  takes,
  currentFileId,
  emptyMessage = "هنوز فایل صوتی آپلود نشده است",
  onDownload,
  onDelete,
  canDeleteTake,
  deletingTakeId = null,
  className,
  approved = false,
}: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    take: NarrationTakeRecord;
    file: NarrationAudioFile;
    version: number;
  } | null>(null);

  const versions = useMemo(() => {
    const normalized = takes
      .map((take) => normalizeTake(take, currentFileId))
      .filter((take) => take.file);
    return normalized.sort((a, b) => b.version - a.version);
  }, [takes, currentFileId]);

  const isDeleting = Boolean(deletingTakeId);

  if (!versions.length) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground",
          className,
        )}
      >
        <Mic2 className="h-4 w-4 shrink-0" />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {approved ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CheckCircle2 className={cn("h-4 w-4 shrink-0", SUCCESS_ICON)} />
          {NARRATION_APPROVED_LABEL}
        </p>
      ) : null}
      {versions.map((take) => {
        const file = take.file!;
        const downloadUrl = filePreviewUrl(file.storageKey);
        const isDownloading = downloadingId === file.id;
        const allowDelete =
          Boolean(onDelete) &&
          !approved &&
          (canDeleteTake ? canDeleteTake(take.raw) : true);
        const takeDeleting = deletingTakeId === take.id;
        const canPlay = Boolean(file.storageKey);

        return (
          <article
            key={take.id}
            dir="rtl"
            className={cn(
              "space-y-3 rounded-xl border p-4",
              take.isCurrent
                ? "border-brand/40 bg-brand/5 shadow-sm"
                : "border-border/60 bg-muted/20",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    {`نسخه ${faNum(take.version)}`}
                  </p>
                  {take.isCurrent && versions.length > 1 ? (
                    <Badge variant="brand" className="text-[11px]">
                      نسخه فعلی
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(take.createdAt)}
                  {file.sizeBytes != null && (
                    <>
                      {" · "}
                      {formatFileSize(file.sizeBytes)}
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {allowDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    aria-label={`حذف نسخه ${take.version}`}
                    title="حذف فایل صوتی"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setDeleteTarget({
                        take: take.raw,
                        file,
                        version: take.version,
                      })
                    }
                  >
                    {takeDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : null}
                {onDownload ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDownloading}
                    aria-label={`دانلود نسخه ${take.version}`}
                    onClick={async () => {
                      setDownloadingId(file.id);
                      try {
                        await onDownload(file);
                      } finally {
                        setDownloadingId(null);
                      }
                    }}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : downloadUrl ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={downloadUrl} download={file.name}>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            {canPlay ? (
              <NarrationAudioPlayer
                file={file}
                versionLabel={faNum(take.version)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                پیش‌نمایش در دسترس نیست
              </p>
            )}
          </article>
        );
      })}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف فایل صوتی</DialogTitle>
            <DialogDescription className="leading-6">
              {deleteTarget
                ? `نسخه ${faNum(deleteTarget.version)} (${deleteTarget.file.name}) برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting || !deleteTarget || !onDelete}
              onClick={async () => {
                if (!deleteTarget || !onDelete) return;
                try {
                  await onDelete(deleteTarget.take, deleteTarget.file);
                  setDeleteTarget(null);
                } catch {
                  /* Parent shows toast; keep dialog open for retry */
                }
              }}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف فایل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
