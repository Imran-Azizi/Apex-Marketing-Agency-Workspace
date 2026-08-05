"use client";

import { CheckCircle2, FileUp, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/loading/spinner";

export type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

interface UploadProgressProps {
  fileName?: string;
  progress?: number;
  status?: UploadStatus;
  errorMessage?: string;
  className?: string;
  /** Loaded bytes label e.g. "12 MB / 40 MB" */
  detail?: string;
}

const statusLabel: Record<UploadStatus, string> = {
  idle: "آماده آپلود",
  uploading: "در حال آپلود...",
  processing: "در حال پردازش...",
  success: "آپلود موفق",
  error: "آپلود ناموفق",
};

/** Professional upload progress panel for files, media, and documents. */
export function UploadProgress({
  fileName,
  progress = 0,
  status = "uploading",
  errorMessage,
  className,
  detail,
}: UploadProgressProps) {
  const pct = Math.max(0, Math.min(100, progress));
  const busy = status === "uploading" || status === "processing";

  return (
    <div
      dir="rtl"
      className={cn(
        "rounded-xl border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            status === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            status === "error" && "bg-destructive/10 text-destructive",
            busy && "bg-brand/10 text-brand",
            status === "idle" && "bg-muted text-muted-foreground",
          )}
        >
          {status === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : status === "error" ? (
            <XCircle className="h-5 w-5" />
          ) : busy ? (
            <Spinner size="sm" className="text-brand" />
          ) : (
            <FileUp className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {fileName || statusLabel[status]}
            </p>
            {busy ? (
              <span className="shrink-0 tabular-nums text-xs font-medium text-brand">
                {Math.round(pct)}٪
              </span>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {status === "error" && errorMessage
              ? errorMessage
              : detail || statusLabel[status]}
          </p>

          {(busy || status === "success") && (
            <Progress
              value={status === "success" ? 100 : pct}
              indeterminate={status === "processing" && pct <= 0}
              className="h-1.5"
            />
          )}
        </div>
      </div>
    </div>
  );
}
