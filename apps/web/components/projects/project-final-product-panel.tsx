"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import {
  FINAL_STATUS_LABELS,
  VIDEO_TYPE_LABELS,
  type FinalProductsPayload,
  type FinalVideoItem,
  type FinalVideoStatus,
  type FinalVideoType,
} from "@/lib/final-product";
import {
  downloadMediaFile,
  downloadStoredFile,
  formatFileSize,
} from "@/lib/upload";
import { mediaStreamUrl } from "@/lib/media";
import { formatDate, cn } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { FinalVideoUploader } from "@/components/projects/final-video-uploader";
import { VideoPlayer } from "@/components/media/video-player";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  Film,
  Loader2,
  PackageCheck,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  PublishToPortfolioDialog,
  type ProjectPortfolioState,
} from "@/components/projects/publish-to-portfolio-dialog";

function statusVariant(
  status: string,
): "brand" | "secondary" | "outline" | "destructive" | "success" | "warning" {
  if (status === "REVISION_REQUESTED") return "warning";
  if (status === "APPROVED_BY_CUSTOMER") return "success";
  if (status === "SENT_TO_CUSTOMER" || status === "VIEWED_BY_CUSTOMER")
    return "brand";
  if (status === "APPROVED") return "secondary";
  if (status === "UPLOADED") return "outline";
  return "outline";
}

function ManagerVideoCard({
  item,
  selectable,
  selected,
  onToggle,
  onPreview,
  onApprove,
  onRequestRevision,
  reviewing,
}: {
  item: FinalVideoItem;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
  onPreview: (item: FinalVideoItem) => void;
  onApprove?: (item: FinalVideoItem) => void;
  onRequestRevision?: (item: FinalVideoItem) => void;
  reviewing?: boolean;
}) {
  const type = (item.videoType || "WATERMARKED") as FinalVideoType;
  const typeLabel =
    item.videoTypeLabel || VIDEO_TYPE_LABELS[type] || String(item.videoType);
  const statusLabel =
    item.statusLabel ||
    FINAL_STATUS_LABELS[item.status as FinalVideoStatus] ||
    item.status;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (item.storageKey) {
        await downloadStoredFile(item.storageKey, item.name);
      } else {
        await downloadMediaFile(item.id, item.name);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "دانلود ناموفق بود");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-all",
        selected ? "border-brand ring-1 ring-brand/30" : "border-border/70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {selectable ? (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggle?.(item.id)}
                aria-label={`انتخاب ${typeLabel}`}
              />
            ) : null}
            <Badge variant={type === "WATERMARKED" ? "brand" : "secondary"}>
              {typeLabel}
            </Badge>
            <Badge variant={statusVariant(item.status)}>{statusLabel}</Badge>
            <Badge variant="outline">نسخه {item.version}</Badge>
          </div>
          <p className="truncate text-sm font-medium" title={item.name}>
            {item.name}
          </p>
        </div>
        <Film className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
      <div className="p-3 sm:p-4">
        <VideoPlayer src={mediaStreamUrl(item.id)} title={item.name} />
      </div>
      <dl className="grid gap-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span>{item.uploadedByName || "ادیتور"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{item.createdAt ? formatDate(item.createdAt) : "—"}</span>
        </div>
        <div className="tabular-nums">
          {item.sizeBytes != null ? formatFileSize(item.sizeBytes) : "—"}
        </div>
      </dl>
      {item.status === "REVISION_REQUESTED" && item.revisionNotes ? (
        <div className="border-t border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-xs font-medium text-foreground">
            توضیحات اصلاح مدیر
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
            {item.revisionNotes}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onPreview(item)}
        >
          <Eye className="h-3.5 w-3.5" />
          پیش‌نمایش
        </Button>
        {["UPLOADED", "PENDING_REVIEW"].includes(item.status) ? (
          <>
            <Button
              size="sm"
              variant="brand"
              className="gap-1.5"
              disabled={reviewing}
              onClick={() => onApprove?.(item)}
            >
              {reviewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              تأیید
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={reviewing}
              onClick={() => onRequestRevision?.(item)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              درخواست اصلاح
            </Button>
          </>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={downloading}
          onClick={handleDownload}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          دانلود
        </Button>
        {item.status === "APPROVED_BY_CUSTOMER" ? (
          <Badge variant="success" className="ms-auto self-center">
            {item.statusLabel || "ویدیو تایید شد"}
          </Badge>
        ) : item.sentToCustomer ? (
          <Badge variant="brand" className="ms-auto self-center">
            ارسال‌شده
          </Badge>
        ) : null}
      </div>
    </article>
  );
}

export function ProjectFinalProductPanel({
  projectId,
  roleCode,
}: {
  projectId: string;
  roleCode?: string | null;
}) {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const isManager = hasPermission(
    me?.permissions,
    ["video.approve", "video.send"],
    roleCode,
  );
  const canPublishPortfolio = hasPermission(
    me?.permissions,
    "portfolio.publish",
    roleCode,
  );
  const isEditor = roleCode === "EDITOR";

  const [selected, setSelected] = useState<string[]>([]);
  const [allowDownload, setAllowDownload] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [preview, setPreview] = useState<FinalVideoItem | null>(null);
  const [filter, setFilter] = useState<"all" | "WATERMARKED" | "CLEAN">("all");
  const [reviewTarget, setReviewTarget] = useState<{
    item: FinalVideoItem;
    decision: "APPROVE" | "REQUEST_REVISION";
  } | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");

  const dataQ = useQuery({
    queryKey: ["final-products", projectId],
    queryFn: () =>
      apiGet<FinalProductsPayload>(
        `/production/projects/${projectId}/final-products`,
      ),
    refetchInterval: isManager ? 15_000 : false,
  });

  const portfolioQ = useQuery({
    queryKey: ["portfolio-project", projectId],
    queryFn: () =>
      apiGet<ProjectPortfolioState>(`/portfolio/projects/${projectId}`),
    enabled: canPublishPortfolio && !!projectId,
  });

  const sendMut = useMutation({
    mutationFn: () =>
      apiPost(`/production/projects/${projectId}/final-products/send`, {
        fileIds: selected,
        allowDownload,
      }),
    onSuccess: () => {
      toast.success("ویدیو برای مشتری ارسال شد");
      setSendOpen(false);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["final-products", projectId] });
      qc.invalidateQueries({ queryKey: ["production-task", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ارسال ناموفق بود"),
  });

  const reviewMut = useMutation({
    mutationFn: ({
      item,
      decision,
      notes,
    }: {
      item: FinalVideoItem;
      decision: "APPROVE" | "REQUEST_REVISION";
      notes?: string;
    }) =>
      apiPost(
        `/production/projects/${projectId}/final-products/${item.id}/review`,
        { decision, notes },
      ),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === "APPROVE"
          ? "ویدیوی نهایی تأیید شد"
          : "درخواست اصلاح برای ادیتور ارسال شد",
      );
      setReviewTarget(null);
      setRevisionNotes("");
      qc.invalidateQueries({ queryKey: ["final-products", projectId] });
      qc.invalidateQueries({ queryKey: ["production-task", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "ثبت نتیجه بررسی ناموفق بود",
      ),
  });

  const items = dataQ.data?.items || [];
  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.videoType === filter);
  }, [items, filter]);

  const pendingSelectable = items.filter(
    (i) => i.status === "APPROVED" && !i.sentToCustomer,
  );

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (dataQ.isLoading) {
    return (
      <div className="space-y-4" dir="rtl" aria-busy="true">
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        {!isEditor ? <Skeleton className="h-24 w-full rounded-2xl" /> : null}
      </div>
    );
  }

  if (dataQ.isError || !dataQ.data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        بارگذاری محصول نهایی ناموفق بود.
      </div>
    );
  }

  const { counts, task } = dataQ.data;

  // Editor: only the two upload cards (videos live inside each card)
  if (isEditor) {
    return (
      <div className="text-start" dir="rtl">
        <FinalVideoUploader
          projectId={projectId}
          disabled={task?.status === "COMPLETED"}
          existingItems={items}
        />
      </div>
    );
  }

  // Manager (and other roles): review + send workflow
  return (
    <div className="space-y-5 text-start" dir="rtl">
      <header className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <PackageCheck className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-semibold tracking-tight">
              محصول نهایی
            </h3>
            <Badge variant="outline">{dataQ.data.project.code}</Badge>
          </div>
          <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
            بررسی و ارسال ویدیوهای نهایی برای مشتری
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-muted-foreground">
            <span>کل: {counts.total}</span>
            <span>· واترمارک: {counts.watermarked}</span>
            <span>· بدون واترمارک: {counts.clean}</span>
            <span>· ارسال‌شده: {counts.sent}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canPublishPortfolio ? (
            portfolioQ.data?.portfolio?.status === "PUBLISHED" ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setPortfolioOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4 text-success" />
                در نمونه‌کارها
              </Button>
            ) : (
              <Button
                variant="outline"
                className="gap-2"
                disabled={!portfolioQ.data?.canPublish}
                title={
                  portfolioQ.data?.canPublish
                    ? undefined
                    : "فقط پس از تکمیل پروژه و وجود ویدیوی نهایی واجد شرایط"
                }
                onClick={() => setPortfolioOpen(true)}
              >
                <Sparkles className="h-4 w-4 text-brand" />
                ارسال به نمونه‌کارها
              </Button>
            )
          ) : null}
          <Button
            variant="brand"
            className="gap-2"
            disabled={selected.length === 0}
            onClick={() => setSendOpen(true)}
          >
            <Send className="h-4 w-4" />
            ارسال برای مشتری
            {selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        </div>
      </header>

      {pendingSelectable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(pendingSelectable.map((i) => i.id))}
          >
            انتخاب همهٔ ارسال‌نشده
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
          >
            لغو انتخاب
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "همه"],
            ["WATERMARKED", VIDEO_TYPE_LABELS.WATERMARKED],
            ["CLEAN", VIDEO_TYPE_LABELS.CLEAN],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? "brand" : "outline"}
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
          <PackageCheck className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            هنوز ویدیوی نهایی آپلود نشده است
          </p>
          <p className="max-w-md text-xs leading-6 text-muted-foreground">
            پس از ارسال توسط ادیتور، ویدیوها اینجا نمایش داده می‌شوند.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => (
            <ManagerVideoCard
              key={item.id}
              item={item}
              selectable={item.status === "APPROVED" && !item.sentToCustomer}
              selected={selected.includes(item.id)}
              onToggle={toggle}
              onPreview={setPreview}
              onApprove={(video) =>
                setReviewTarget({ item: video, decision: "APPROVE" })
              }
              onRequestRevision={(video) =>
                setReviewTarget({
                  item: video,
                  decision: "REQUEST_REVISION",
                })
              }
              reviewing={
                reviewMut.isPending && reviewTarget?.item.id === item.id
              }
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!reviewTarget}
        onOpenChange={(open) => {
          if (!open && !reviewMut.isPending) {
            setReviewTarget(null);
            setRevisionNotes("");
          }
        }}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>
              {reviewTarget?.decision === "APPROVE"
                ? "تأیید ویدیوی نهایی"
                : "درخواست اصلاح ویدیوی نهایی"}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {reviewTarget?.decision === "APPROVE"
                ? `نسخه ${reviewTarget.item.version} از ${reviewTarget.item.videoTypeLabel || "ویدیوی نهایی"} تأیید می‌شود. این نسخه سپس برای ارسال به مشتری آماده خواهد بود.`
                : `توضیحات اصلاح برای نسخه ${reviewTarget?.item.version || ""} ثبت و به ادیتور اطلاع داده می‌شود.`}
            </DialogDescription>
          </DialogHeader>
          {reviewTarget?.decision === "REQUEST_REVISION" ? (
            <div className="space-y-2">
              <Label htmlFor="final-revision-notes">توضیحات اصلاح</Label>
              <Textarea
                id="final-revision-notes"
                rows={5}
                value={revisionNotes}
                disabled={reviewMut.isPending}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="اصلاحات مورد نیاز را دقیق و شفاف بنویسید..."
              />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="outline"
              disabled={reviewMut.isPending}
              onClick={() => {
                setReviewTarget(null);
                setRevisionNotes("");
              }}
            >
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={
                reviewMut.isPending ||
                !reviewTarget ||
                (reviewTarget.decision === "REQUEST_REVISION" &&
                  !revisionNotes.trim())
              }
              onClick={() => {
                if (!reviewTarget) return;
                reviewMut.mutate({
                  ...reviewTarget,
                  notes:
                    reviewTarget.decision === "REQUEST_REVISION"
                      ? revisionNotes.trim()
                      : undefined,
                });
              }}
            >
              {reviewMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : reviewTarget?.decision === "APPROVE" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {reviewTarget?.decision === "APPROVE"
                ? "تأیید نهایی"
                : "ارسال درخواست"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>ارسال برای مشتری</DialogTitle>
            <DialogDescription>
              {selected.length} ویدیوی انتخاب‌شده در پورتال مشتری نمایش داده
              می‌شود و اعلان برای مشتری ارسال می‌گردد.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <Checkbox
              id="allow-dl"
              checked={allowDownload}
              onCheckedChange={(v) => setAllowDownload(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="allow-dl" className="text-sm font-medium">
                باز کردن دانلود قبل از تسویه
              </Label>
              <p className="text-xs leading-5 text-muted-foreground">
                معمولاً پس از تسویه کامل، دانلود نسخه بدون واترمارک خودکار فعال
                می‌شود. این گزینه فقط برای باز کردن زودتر دانلود است.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={sendMut.isPending}
              onClick={() => sendMut.mutate()}
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

      {canPublishPortfolio ? (
        <PublishToPortfolioDialog
          projectId={projectId}
          open={portfolioOpen}
          onOpenChange={setPortfolioOpen}
          initial={portfolioQ.data}
        />
      ) : null}
    </div>
  );
}
