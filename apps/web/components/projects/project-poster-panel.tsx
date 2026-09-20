"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import {
  POSTER_STATUS_LABELS,
  validatePosterFile,
  ACCEPTED_POSTER_TYPES,
  type PosterItem,
  type PosterStatus,
  type PostersPayload,
} from "@/lib/poster";
import {
  downloadMediaFile,
  downloadStoredFile,
  formatFileSize,
  uploadFileWithProgress,
} from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { mediaStreamUrl } from "@/lib/media";
import { formatDate, cn } from "@/lib/utils";
import { hasPermission, canReviewProjectPosters, canSendProjectPosters } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  ImageIcon,
  Loader2,
  MessageSquareWarning,
  Replace,
  Send,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

function statusVariant(
  status: string,
): "brand" | "secondary" | "outline" | "destructive" | "success" | "warning" {
  if (status === "REJECTED") return "destructive";
  if (status === "APPROVED") return "success";
  if (status === "SENT_TO_CUSTOMER") return "brand";
  if (status === "PENDING_REVIEW") return "warning";
  return "outline";
}

function posterStatusLabel(item: PosterItem) {
  return (
    item.statusLabel ||
    POSTER_STATUS_LABELS[item.status as PosterStatus] ||
    item.status
  );
}

function PosterPreview({
  fileId,
  name,
  className,
}: {
  fileId: string;
  name: string;
  className?: string;
}) {
  return (
    <img
      src={mediaStreamUrl(fileId)}
      alt={name}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}

function PosterCard({
  item,
  canReview,
  canSend,
  onPreview,
  onApprove,
  onReject,
  onSend,
  reviewing,
  sending,
}: {
  item: PosterItem;
  canReview?: boolean;
  canSend?: boolean;
  onPreview: (item: PosterItem) => void;
  onApprove?: (item: PosterItem) => void;
  onReject?: (item: PosterItem) => void;
  onSend?: (item: PosterItem) => void;
  reviewing?: boolean;
  sending?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const pending = item.status === "PENDING_REVIEW";
  const approved = item.status === "APPROVED";
  const sent = item.status === "SENT_TO_CUSTOMER";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (item.storageKey) {
        await downloadStoredFile(item.storageKey, item.name);
      } else {
        await downloadMediaFile(item.fileId, item.name);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "دانلود ناموفق بود");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge
              variant={statusVariant(item.status)}
              className="max-w-full text-[10px] sm:text-xs"
            >
              {posterStatusLabel(item)}
            </Badge>
            <Badge variant="outline" className="text-[10px] sm:text-xs">
              نسخه {item.version}
            </Badge>
            {item.isLatest ? (
              <Badge variant="brand" className="text-[10px] sm:text-xs">
                جدیدترین
              </Badge>
            ) : null}
            {item.isLatestDelivered ? (
              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                نسخه ارسال‌شده
              </Badge>
            ) : null}
          </div>
          <p
            className="break-all text-xs font-medium leading-5 sm:truncate sm:break-normal sm:text-sm sm:leading-normal"
            title={item.name}
          >
            {item.name}
          </p>
        </div>
        <ImageIcon className="mt-0.5 hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
      </div>
      <div className="bg-muted/20 p-2.5 sm:p-4">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-neutral-950">
          <div className="flex aspect-[4/3] items-center justify-center sm:aspect-video">
            <PosterPreview fileId={item.fileId} name={item.name} />
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 border-t border-border/60 px-3 py-2.5 text-[11px] text-muted-foreground sm:grid-cols-3 sm:px-4 sm:py-3 sm:text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{item.uploadedByName || "ادیتور"}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {item.createdAt ? formatDate(item.createdAt) : "—"}
          </span>
        </div>
        <div className="col-span-2 tabular-nums sm:col-span-1">
          {item.sizeBytes != null ? formatFileSize(item.sizeBytes) : "—"}
        </div>
      </dl>
      {item.status === "REJECTED" && item.rejectionReason ? (
        <div className="border-t border-destructive/30 bg-destructive/5 px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-xs font-medium text-foreground">دلیل رد مدیریت</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
            {item.rejectionReason}
          </p>
        </div>
      ) : null}
      {item.notes ? (
        <div className="border-t border-border/50 px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-xs font-medium">یادداشت ادیتور</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
            {item.notes}
          </p>
        </div>
      ) : null}
      {sent && item.deliveredAt ? (
        <div className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground sm:px-4 sm:py-2.5">
          ارسال به مشتری: {formatDate(item.deliveredAt)}
          {item.deliveredByName ? ` · ${item.deliveredByName}` : ""}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 border-t border-border/60 px-3 py-2.5 sm:flex sm:flex-wrap sm:px-4 sm:py-3">
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 sm:h-8"
          onClick={() => onPreview(item)}
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          پیش‌نمایش
        </Button>
        {canReview && pending ? (
          <>
            <Button
              size="sm"
              variant="brand"
              className="h-9 gap-1.5 sm:h-8"
              disabled={reviewing}
              onClick={() => onApprove?.(item)}
            >
              {reviewing ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              )}
              تایید پوستر
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 sm:h-8"
              disabled={reviewing}
              onClick={() => onReject?.(item)}
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              رد پوستر
            </Button>
          </>
        ) : null}
        {canSend && (approved || sent) ? (
          <Button
            size="sm"
            variant="brand"
            className="col-span-2 h-9 gap-1.5 sm:col-span-1 sm:h-8"
            disabled={sending}
            onClick={() => onSend?.(item)}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 shrink-0" />
            )}
            {sent ? "ارسال مجدد به مشتری" : "ارسال به مشتری"}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 sm:h-8"
          disabled={downloading}
          onClick={handleDownload}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 shrink-0" />
          )}
          دانلود
        </Button>
      </div>
    </article>
  );
}

function EditorPosterUploader({
  projectId,
  disabled,
  blockedReason,
  onUploaded,
}: {
  projectId: string;
  disabled?: boolean;
  blockedReason?: string | null;
  onUploaded?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pick = (next: File | null) => {
    if (!next) return;
    const err = validatePosterFile(next);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(next);
    setError(null);
    setProgress(0);
    setLoaded(0);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next);
    });
  };

  const clear = () => {
    setFile(null);
    setError(null);
    setProgress(0);
    setLoaded(0);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("ابتدا یک پوستر انتخاب کنید");
      const err = validatePosterFile(file);
      if (err) throw new Error(err);
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.PRODUCTION_POSTER,
          projectId,
        },
        (pct, detail) => {
          setProgress(pct);
          setLoaded(detail?.loaded ?? file.size);
        },
      );
      return apiPost(`/production/projects/${projectId}/posters`, {
        storageKey: uploaded.key,
        name: uploaded.name || file.name,
        mimeType: uploaded.mimeType || file.type,
        sizeBytes: uploaded.sizeBytes || file.size,
        notes: notes.trim() || undefined,
        storageMeta: uploaded.storageMeta || undefined,
      });
    },
    onSuccess: () => {
      toast.success("پوستر برای بررسی مدیریت ارسال شد");
      setNotes("");
      clear();
      onUploaded?.();
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "ارسال ناموفق بود";
      setError(message);
      toast.error(message);
    },
  });

  const locked = disabled || uploadMut.isPending;

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm sm:space-y-4 sm:p-5">
      <div>
        <h4 className="text-sm font-semibold">ارسال پوستر جدید</h4>
        <p className="mt-1 hidden text-xs leading-6 text-muted-foreground sm:block">
          پوستر پس از ارسال به‌صورت خودکار برای مشتری نمایش داده نمی‌شود و باید
          ابتدا توسط مدیریت تأیید شود.
        </p>
      </div>

      {blockedReason ? (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs leading-6 text-muted-foreground">
          {blockedReason}
        </div>
      ) : null}

      {!file ? (
        <div
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-label="انتخاب پوستر"
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
            const next = e.dataTransfer.files?.[0];
            if (next && !locked) pick(next);
          }}
          className={cn(
            "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-4 py-6 text-center transition-all sm:min-h-[180px] sm:gap-3 sm:py-8",
            dragOver
              ? "border-brand bg-brand/5"
              : "border-border/70 bg-muted/15 hover:border-brand/50",
            locked && "pointer-events-none opacity-60",
          )}
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60 sm:h-14 sm:w-14">
            <Upload className="h-5 w-5 text-brand sm:h-6 sm:w-6" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">تصویر پوستر را انتخاب کنید</p>
            <p className="text-xs text-muted-foreground">
              JPG · PNG · WebP · GIF
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={file.name}
                className="mx-auto max-h-80 w-full object-contain"
              />
            ) : null}
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          {uploadMut.isPending ? (
            <div className="space-y-2 rounded-xl border border-brand/20 bg-brand/5 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-brand">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  در حال ارسال…
                </span>
                <span className="tabular-nums font-semibold">{progress}٪</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {formatFileSize(loaded)} / {formatFileSize(file.size)}
              </p>
            </div>
          ) : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
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
              disabled={locked}
              onClick={clear}
            >
              <X className="h-3.5 w-3.5" />
              حذف
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="poster-notes">یادداشت برای مدیر (اختیاری)</Label>
        <Textarea
          id="poster-notes"
          rows={2}
          dir="rtl"
          value={notes}
          disabled={locked}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="توضیح کوتاه درباره پوستر…"
        />
      </div>

      <div className="flex justify-stretch sm:justify-end">
        <Button
          variant="brand"
          className="h-10 w-full gap-2 sm:h-9 sm:w-auto"
          disabled={locked || !file}
          onClick={() => uploadMut.mutate()}
        >
          {uploadMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          ارسال برای بررسی مدیریت
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_POSTER_TYPES}
        className="sr-only"
        disabled={locked}
        onChange={(e) => {
          pick(e.target.files?.[0] || null);
          e.target.value = "";
        }}
      />
    </section>
  );
}

export function ProjectPosterPanel({
  projectId,
  roleCode,
}: {
  projectId: string;
  roleCode?: string | null;
}) {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const resolvedRole = roleCode ?? me?.role ?? null;
  const canReview = canReviewProjectPosters(me?.permissions, resolvedRole);
  const canSend = canSendProjectPosters(me?.permissions, resolvedRole);
  const canUpload = hasPermission(
    me?.permissions,
    ["poster.upload", "video.upload"],
    resolvedRole,
  );
  const isEditor = resolvedRole === "EDITOR";

  const [preview, setPreview] = useState<PosterItem | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    item: PosterItem;
    decision: "APPROVE" | "REJECT";
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [sendTarget, setSendTarget] = useState<PosterItem | null>(null);

  const dataQ = useQuery({
    queryKey: ["project-posters", projectId],
    queryFn: () =>
      apiGet<PostersPayload>(`/production/projects/${projectId}/posters`),
    refetchInterval: canReview ? 15_000 : false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-posters", projectId] });
    qc.invalidateQueries({ queryKey: ["production-task", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const reviewMut = useMutation({
    mutationFn: ({
      item,
      decision,
      reason,
    }: {
      item: PosterItem;
      decision: "APPROVE" | "REJECT";
      reason?: string;
    }) => {
      if (!canReview) {
        throw new Error("فقط مدیر می‌تواند پوستر را بررسی کند");
      }
      return apiPost(
        `/production/projects/${projectId}/posters/${item.id}/review`,
        { decision, reason },
      );
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === "APPROVE"
          ? "پوستر تأیید شد"
          : "پوستر رد شد و به ادیتور اطلاع داده شد",
      );
      setReviewTarget(null);
      setRejectReason("");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ثبت نتیجه بررسی ناموفق بود"),
  });

  const sendMut = useMutation({
    mutationFn: (item: PosterItem) => {
      if (!canSend) {
        throw new Error("فقط مدیر می‌تواند پوستر را برای مشتری ارسال کند");
      }
      return apiPost(
        `/production/projects/${projectId}/posters/${item.id}/send`,
        {
          resend: item.status === "SENT_TO_CUSTOMER",
        },
      );
    },
    onSuccess: () => {
      toast.success("پوستر برای مشتری ارسال شد");
      setSendTarget(null);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ارسال ناموفق بود"),
  });

  if (dataQ.isLoading) {
    return (
      <div className="space-y-4" dir="rtl" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (dataQ.isError || !dataQ.data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        بارگذاری پوسترها ناموفق بود.
      </div>
    );
  }

  const items = dataQ.data.items || [];
  const pendingExists = items.some((i) => i.status === "PENDING_REVIEW");
  const latestRejected = items.find(
    (i) => i.isLatest && i.status === "REJECTED",
  );

  return (
    <div className="space-y-3 text-start sm:space-y-5" dir="rtl">
      <header className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ImageIcon className="h-4 w-4 shrink-0 text-brand sm:h-5 sm:w-5" />
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">
              اپلود پوستر
            </h3>
            <Badge variant="outline" className="text-[10px] sm:text-xs">
              {dataQ.data.project.code}
            </Badge>
          </div>
          <p className="hidden text-sm leading-6 text-muted-foreground sm:block">
            {isEditor
              ? "پوستر را بارگذاری کنید تا مدیریت آن را بررسی کند. پس از تأیید، مدیر می‌تواند آن را برای مشتری ارسال کند."
              : "پوسترهای ارسال‌شده توسط ادیتور را بررسی، تأیید یا رد کنید و نسخه تأییدشده را برای مشتری بفرستید."}
          </p>
          <div className="flex flex-wrap gap-x-2 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
            <span>کل: {dataQ.data.counts.total}</span>
            <span>· در انتظار: {dataQ.data.counts.pending}</span>
            <span>· تأییدشده: {dataQ.data.counts.approved}</span>
            <span>· ارسال‌شده: {dataQ.data.counts.sent}</span>
          </div>
        </div>
      </header>

      {isEditor && latestRejected?.rejectionReason ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <MessageSquareWarning className="h-4 w-4 text-destructive" />
            پوستر نسخه {latestRejected.version} رد شد
          </div>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
            دلیل: {latestRejected.rejectionReason}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            نسخه قبلی در تاریخچه باقی می‌ماند. می‌توانید پوستر اصلاح‌شده را
            به‌عنوان نسخه جدید ارسال کنید.
          </p>
        </div>
      ) : null}

      {canUpload && isEditor ? (
        <EditorPosterUploader
          projectId={projectId}
          disabled={pendingExists}
          blockedReason={
            pendingExists
              ? "یک پوستر در انتظار بررسی مدیریت است. پس از تأیید یا رد می‌توانید نسخه جدید بفرستید."
              : null
          }
          onUploaded={invalidate}
        />
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center sm:px-6 sm:py-16">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">هنوز پوستری آپلود نشده است</p>
          <p className="max-w-md text-xs leading-6 text-muted-foreground">
            {isEditor
              ? "برای شروع، تصویر پوستر را انتخاب و برای بررسی مدیریت ارسال کنید."
              : "پس از ارسال توسط ادیتور، پوسترها اینجا نمایش داده می‌شوند."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              canReview={canReview}
              canSend={canSend}
              onPreview={setPreview}
              onApprove={
                canReview
                  ? (poster) =>
                      setReviewTarget({ item: poster, decision: "APPROVE" })
                  : undefined
              }
              onReject={
                canReview
                  ? (poster) =>
                      setReviewTarget({ item: poster, decision: "REJECT" })
                  : undefined
              }
              onSend={canSend ? setSendTarget : undefined}
              reviewing={
                reviewMut.isPending && reviewTarget?.item.id === item.id
              }
              sending={sendMut.isPending && sendTarget?.id === item.id}
            />
          ))}
        </div>
      )}

      <Dialog
        open={canReview && !!reviewTarget}
        onOpenChange={(open) => {
          if (!open && !reviewMut.isPending) {
            setReviewTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>
              {reviewTarget?.decision === "APPROVE"
                ? "تایید پوستر"
                : "رد پوستر"}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {reviewTarget?.decision === "APPROVE"
                ? `نسخه ${reviewTarget.item.version} تأیید می‌شود و سپس می‌توان آن را برای مشتری ارسال کرد.`
                : "دلیل رد برای ادیتور نمایش داده می‌شود تا نسخه جدید ارسال کند. نسخه فعلی در تاریخچه باقی می‌ماند."}
            </DialogDescription>
          </DialogHeader>
          {reviewTarget?.decision === "REJECT" ? (
            <div className="space-y-2">
              <Label htmlFor="poster-reject-reason">دلیل رد</Label>
              <Textarea
                id="poster-reject-reason"
                rows={5}
                value={rejectReason}
                disabled={reviewMut.isPending}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="دلیل رد را دقیق بنویسید…"
              />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="outline"
              disabled={reviewMut.isPending}
              onClick={() => {
                setReviewTarget(null);
                setRejectReason("");
              }}
            >
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={
                reviewMut.isPending ||
                !reviewTarget ||
                (reviewTarget.decision === "REJECT" && !rejectReason.trim())
              }
              onClick={() => {
                if (!reviewTarget) return;
                reviewMut.mutate({
                  ...reviewTarget,
                  reason:
                    reviewTarget.decision === "REJECT"
                      ? rejectReason.trim()
                      : undefined,
                });
              }}
            >
              {reviewMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : reviewTarget?.decision === "APPROVE" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {reviewTarget?.decision === "APPROVE" ? "تأیید" : "ثبت رد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={canSend && !!sendTarget}
        onOpenChange={(open) => {
          if (!open && !sendMut.isPending) setSendTarget(null);
        }}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>
              {sendTarget?.status === "SENT_TO_CUSTOMER"
                ? "ارسال مجدد به مشتری"
                : "ارسال به مشتری"}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {sendTarget?.status === "SENT_TO_CUSTOMER"
                ? "این پوستر قبلاً ارسال شده است. در صورت تأیید، دوباره در پورتال مشتری نمایش داده می‌شود و اعلان جدید ارسال می‌گردد."
                : `نسخه ${sendTarget?.version || ""} پس از ارسال در پورتال مشتری قابل مشاهده خواهد بود.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="outline"
              disabled={sendMut.isPending}
              onClick={() => setSendTarget(null)}
            >
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={sendMut.isPending || !sendTarget}
              onClick={() => sendTarget && sendMut.mutate(sendTarget)}
              className="gap-2"
            >
              {sendMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              تأیید و ارسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl text-start sm:max-w-3xl" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{preview?.name || "پیش‌نمایش پوستر"}</DialogTitle>
            <DialogDescription>
              {preview ? posterStatusLabel(preview) : ""}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="overflow-hidden rounded-xl border bg-muted/20">
              <PosterPreview fileId={preview.fileId} name={preview.name} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
