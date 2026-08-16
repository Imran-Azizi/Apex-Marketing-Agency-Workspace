"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Mic2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { formatFileSize, filePreviewUrl } from "@/lib/upload";

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
  className?: string;
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
  };
}

export function NarrationAudioVersions({
  takes,
  currentFileId,
  emptyMessage = "هنوز فایل صوتی آپلود نشده است",
  onDownload,
  className,
}: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const versions = useMemo(() => {
    const normalized = takes
      .map((take) => normalizeTake(take, currentFileId))
      .filter((take) => take.file);
    return normalized.sort((a, b) => b.version - a.version);
  }, [takes, currentFileId]);

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
      {versions.map((take) => {
        const file = take.file!;
        const previewUrl = filePreviewUrl(file.storageKey);
        const isDownloading = downloadingId === file.id;

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
                    {versions.length > 1
                      ? `نسخه ${faNum(take.version)}`
                      : "نریشن تأییدشده"}
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
              {previewUrl && onDownload ? (
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
              ) : previewUrl ? (
                <Button variant="ghost" size="sm" asChild>
                  <a href={previewUrl} download={file.name}>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </div>
            {previewUrl ? (
              <div dir="ltr" className="w-full">
                <audio
                  controls
                  preload="metadata"
                  className="h-10 w-full"
                  src={previewUrl}
                  aria-label={`پخش نسخه ${take.version}`}
                >
                  مرورگر شما از پخش صوت پشتیبانی نمی‌کند.
                </audio>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                پیش‌نمایش در دسترس نیست
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
