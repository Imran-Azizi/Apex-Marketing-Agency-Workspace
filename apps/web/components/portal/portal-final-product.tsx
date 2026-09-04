"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/media/video-player";
import { mediaStreamUrl } from "@/lib/media";
import { VIDEO_TYPE_LABELS, type FinalVideoType } from "@/lib/final-product";
import { downloadMediaFile, formatFileSize } from "@/lib/upload";
import { cn, formatDate } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  Download,
  Eye,
  Film,
  Loader2,
  Lock,
  MessageSquare,
  PackageCheck,
  Play,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export type PortalFinalVideo = {
  id: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  version?: number;
  createdAt?: string;
  videoType?: string;
  videoTypeLabel?: string | null;
  status?: string;
  statusLabel?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  isNewForCustomer?: boolean;
  allowDownload?: boolean;
  canPlay?: boolean;
  canDownload?: boolean;
  accessLocked?: boolean;
  accessStatus?: string | null;
  accessMessage?: string | null;
  revisionNotes?: string | null;
};

type PortalFinalProductProps = {
  videos: PortalFinalVideo[];
  watermarkedVideos?: PortalFinalVideo[];
  cleanVideos?: PortalFinalVideo[];
  projectTitle?: string;
  projectCode?: string;
  revisionUsed?: number;
  revisionMax?: number;
  projectCompleted?: boolean;
  awaitingFinalDecision?: boolean;
  cleanUnlocked?: boolean;
  approvingFileId?: string | null;
  requestingFileId?: string | null;
  onApproveFinal?: (payload: {
    videoType: "CLEAN" | "WATERMARKED";
    fileId: string;
  }) => void;
  onRequestRevision?: (payload: {
    fileId: string;
    body: string;
  }) => void | Promise<void>;
  paymentDetailsHref?: string;
  projectId?: string;
  onVideoViewed?: () => void;
};

const PORTAL_STATUS_LABEL: Record<string, string> = {
  APPROVED_BY_CUSTOMER: "تأیید شده",
  REVISION_REQUESTED: "در انتظار اصلاح",
  SENT_TO_CUSTOMER: "در انتظار تأیید",
  VIEWED_BY_CUSTOMER: "در انتظار تأیید",
};

function resolveType(video: PortalFinalVideo): FinalVideoType {
  return (video.videoType || "WATERMARKED") as FinalVideoType;
}

function splitVideos(videos: PortalFinalVideo[]) {
  const watermarked: PortalFinalVideo[] = [];
  const clean: PortalFinalVideo[] = [];
  for (const video of videos) {
    if (resolveType(video) === "CLEAN") clean.push(video);
    else watermarked.push(video);
  }
  return { watermarked, clean };
}

function sortPortalVideos(videos: PortalFinalVideo[]): PortalFinalVideo[] {
  return [...videos].sort((a, b) => {
    const aNew = a.isNewForCustomer === true;
    const bNew = b.isNewForCustomer === true;
    if (aNew !== bNew) return aNew ? -1 : 1;
    const aSent = a.sentAt || a.createdAt || "";
    const bSent = b.sentAt || b.createdAt || "";
    const sentCmp = new Date(bSent).getTime() - new Date(aSent).getTime();
    if (sentCmp !== 0) return sentCmp;
    return (b.version ?? 0) - (a.version ?? 0);
  });
}

function isPendingCustomerDecision(video: PortalFinalVideo): boolean {
  const status = video.status || "";
  if (status === "APPROVED_BY_CUSTOMER") return false;
  if (status === "REVISION_REQUESTED") return false;
  return (
    status === "SENT_TO_CUSTOMER" ||
    status === "VIEWED_BY_CUSTOMER" ||
    status === "" ||
    !status
  );
}

/**
 * Top row = newest watermarked + newest clean (side by side), regardless of
 * whether the manager sent them in the exact same API call / second.
 * Everything else stays under «ارسال‌های قبلی».
 */
function splitLatestDeliveryBatch(
  watermarked: PortalFinalVideo[],
  clean: PortalFinalVideo[],
): {
  latestWatermarked: PortalFinalVideo | null;
  latestClean: PortalFinalVideo | null;
  previousWatermarked: PortalFinalVideo[];
  previousClean: PortalFinalVideo[];
} {
  const sortedWm = sortPortalVideos(watermarked);
  const sortedClean = sortPortalVideos(clean);
  const latestWatermarked = sortedWm[0] ?? null;
  const latestClean = sortedClean[0] ?? null;
  const featuredIds = new Set(
    [latestWatermarked?.id, latestClean?.id].filter(Boolean) as string[],
  );

  return {
    latestWatermarked,
    latestClean,
    previousWatermarked: sortedWm.filter((v) => !featuredIds.has(v.id)),
    previousClean: sortedClean.filter((v) => !featuredIds.has(v.id)),
  };
}

function isVideoNew(
  video: PortalFinalVideo,
  viewedIds: Set<string>,
): boolean {
  return video.isNewForCustomer === true && !viewedIds.has(video.id);
}

function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec <= 0) {
    return "—";
  }
  const sec = Math.round(totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = m.toLocaleString("fa-AF", { numberingSystem: "latn" });
  const ss = s.toLocaleString("fa-AF", {
    numberingSystem: "latn",
    minimumIntegerDigits: 2,
  });
  return `${mm}:${ss}`;
}

function portalStatusBadge(
  video: PortalFinalVideo,
  variant: FinalVideoType,
  isNew: boolean,
  locked: boolean,
): { label: string; tone: "brand" | "success" | "warning" | "secondary" | "destructive" } {
  if (locked) return { label: "قفل شده", tone: "warning" };
  if (isNew) return { label: "جدید", tone: "brand" };
  const status = video.status || "";
  if (status === "APPROVED_BY_CUSTOMER") {
    return { label: "تأیید شده", tone: "success" };
  }
  if (status === "REVISION_REQUESTED") {
    return { label: "در انتظار اصلاح", tone: "destructive" };
  }
  if (status === "SENT_TO_CUSTOMER" || status === "VIEWED_BY_CUSTOMER") {
    return { label: "در انتظار تأیید", tone: "secondary" };
  }
  return {
    label: PORTAL_STATUS_LABEL[status] || video.statusLabel || "آماده",
    tone: "secondary",
  };
}

function canApproveVideo(
  video: PortalFinalVideo,
  variant: FinalVideoType,
  opts: {
    projectCompleted: boolean;
    awaitingFinalDecision: boolean;
    cleanUnlocked: boolean;
  },
): boolean {
  if (!video) return false;
  if (video.status === "APPROVED_BY_CUSTOMER") return false;
  if (video.status === "REVISION_REQUESTED") return false;
  if (!isPendingCustomerDecision(video)) return false;

  const locked =
    variant === "CLEAN" &&
    (video.accessLocked === true || video.canPlay === false);
  if (locked) return false;

  if (variant === "CLEAN") {
    return opts.cleanUnlocked;
  }

  // Once clean delivery is unlocked, package confirmation must use the clean file.
  if (opts.cleanUnlocked) return false;

  // Watermarked: allow for any pending delivery (including extra sends after
  // WAITING_PAYMENT / prior approval), not only the initial decision window.
  void opts.projectCompleted;
  void opts.awaitingFinalDecision;
  return true;
}

function canRequestRevisionVideo(
  video: PortalFinalVideo,
  _variant: FinalVideoType,
  opts: {
    projectCompleted: boolean;
    awaitingFinalDecision: boolean;
    revisionUsed: number;
    revisionMax: number;
  },
): boolean {
  if (!video) return false;
  if (video.status === "APPROVED_BY_CUSTOMER") return false;
  if (video.status === "REVISION_REQUESTED") return false;
  if (opts.revisionUsed >= opts.revisionMax) return false;
  if (!isPendingCustomerDecision(video)) return false;
  // Locked clean may still be rejected so the customer can request changes
  // on newly sent deliveries without needing payment unlock first.
  void opts.projectCompleted;
  void opts.awaitingFinalDecision;
  return true;
}

export function PortalFinalProduct({
  videos,
  watermarkedVideos,
  cleanVideos,
  projectTitle,
  projectCode,
  revisionUsed = 0,
  revisionMax = 0,
  projectCompleted = false,
  awaitingFinalDecision = false,
  cleanUnlocked = false,
  approvingFileId,
  requestingFileId,
  onApproveFinal,
  onRequestRevision,
  paymentDetailsHref = "/portal",
  projectId,
  onVideoViewed,
}: PortalFinalProductProps) {
  const split = splitVideos(videos);
  const watermarked = sortPortalVideos(
    watermarkedVideos?.length ? watermarkedVideos : split.watermarked,
  );
  const clean = sortPortalVideos(
    cleanVideos?.length ? cleanVideos : split.clean,
  );
  const total = watermarked.length + clean.length;
  const {
    latestWatermarked,
    latestClean,
    previousWatermarked,
    previousClean,
  } = splitLatestDeliveryBatch(watermarked, clean);
  const hasLatestRow = !!(latestWatermarked || latestClean);
  const hasPrevious =
    previousWatermarked.length > 0 || previousClean.length > 0;
  const [viewer, setViewer] = useState<PortalFinalVideo | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => new Set());
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<PortalFinalVideo | null>(
    null,
  );
  const [revisionBody, setRevisionBody] = useState("");

  const newCount = useMemo(
    () =>
      [...watermarked, ...clean].filter((v) => isVideoNew(v, viewedIds)).length,
    [watermarked, clean, viewedIds],
  );

  const handleView = useCallback(
    async (video: PortalFinalVideo) => {
      setViewer(video);
      if (
        !projectId ||
        !isVideoNew(video, viewedIds) ||
        viewedIds.has(video.id)
      ) {
        return;
      }
      try {
        await apiPost(`/portal/projects/${projectId}/final-videos/${video.id}/view`);
        setViewedIds((prev) => new Set(prev).add(video.id));
        onVideoViewed?.();
      } catch {
        // Playback still works if tracking fails.
      }
    },
    [projectId, viewedIds, onVideoViewed],
  );

  const openRevision = (video: PortalFinalVideo) => {
    setRevisionTarget(video);
    setRevisionBody("");
    setRevisionOpen(true);
  };

  const submitRevision = async () => {
    if (!revisionTarget || !revisionBody.trim()) {
      toast.error("توضیح تغییرات الزامی است");
      return;
    }
    try {
      await onRequestRevision?.({
        fileId: revisionTarget.id,
        body: revisionBody.trim(),
      });
      setRevisionOpen(false);
      setRevisionTarget(null);
      setRevisionBody("");
    } catch {
      // Parent handles toast on error.
    }
  };

  if (total === 0) {
    return (
      <div
        dir="rtl"
        className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/15 px-4 py-10 text-center"
      >
        <PackageCheck className="h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm font-medium">محصول نهایی هنوز آماده نیست</p>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          وقتی مدیر پروژه ویدیوی نهایی را برایتان ارسال کند، اینجا نمایش داده
          می‌شود.
        </p>
      </div>
    );
  }

  const actionOpts = {
    projectCompleted,
    awaitingFinalDecision,
    cleanUnlocked,
    revisionUsed,
    revisionMax,
  };

  return (
    <div className="space-y-5" dir="rtl">
      <header className="space-y-2 text-start">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            محصول نهایی پروژه
          </h2>
          {revisionMax > 0 ? (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-normal"
            >
              اصلاحات {revisionUsed}/{revisionMax}
            </Badge>
          ) : null}
          {projectCode ? (
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[10px] font-normal"
            >
              <bdi dir="ltr">{projectCode}</bdi>
            </Badge>
          ) : null}
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          هر ویدیو را جداگانه مشاهده، تأیید یا درخواست اصلاح کنید
          {projectTitle ? (
            <>
              {" "}
              —{" "}
              <span className="font-medium text-foreground">{projectTitle}</span>
            </>
          ) : null}
          .
        </p>
        {newCount > 0 ? (
          <p className="rounded-xl border border-brand/25 bg-brand/5 px-3 py-2.5 text-xs leading-6 text-foreground">
            {newCount.toLocaleString("fa-AF")} ویدیوی جدید برای مشاهده دارید.
            ویدیوهای جدید در ردیف بالای صفحه با برچسب «جدید» مشخص شده‌اند.
          </p>
        ) : null}
      </header>

      {hasLatestRow ? (
        <LatestDeliveryRow
          watermarked={latestWatermarked}
          clean={latestClean}
          viewedIds={viewedIds}
          actionOpts={actionOpts}
          approvingFileId={approvingFileId}
          requestingFileId={requestingFileId}
          paymentDetailsHref={paymentDetailsHref}
          onView={handleView}
          onApprove={onApproveFinal}
          onRequestRevision={openRevision}
        />
      ) : null}

      {hasPrevious ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <h3 className="shrink-0 text-sm font-semibold text-muted-foreground">
              ارسال‌های قبلی
            </h3>
            <div className="h-px flex-1 bg-border/70" />
          </div>

          <VideoSection
            title={VIDEO_TYPE_LABELS.WATERMARKED}
            variant="WATERMARKED"
            videos={previousWatermarked}
            emptyLabel="موردی در ارسال‌های قبلی نیست"
            hideWhenEmpty
            viewedIds={viewedIds}
            actionOpts={actionOpts}
            approvingFileId={approvingFileId}
            requestingFileId={requestingFileId}
            paymentDetailsHref={paymentDetailsHref}
            onView={handleView}
            onApprove={onApproveFinal}
            onRequestRevision={openRevision}
          />

          <VideoSection
            title={VIDEO_TYPE_LABELS.CLEAN}
            variant="CLEAN"
            videos={previousClean}
            emptyLabel="موردی در ارسال‌های قبلی نیست"
            hideWhenEmpty
            viewedIds={viewedIds}
            actionOpts={actionOpts}
            approvingFileId={approvingFileId}
            requestingFileId={requestingFileId}
            paymentDetailsHref={paymentDetailsHref}
            onView={handleView}
            onApprove={onApproveFinal}
            onRequestRevision={openRevision}
          />
        </div>
      ) : null}

      <Dialog
        open={!!viewer}
        onOpenChange={(open) => {
          if (!open) setViewer(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-w-3xl gap-3 p-4 text-start sm:p-5"
        >
          <DialogHeader className="space-y-1 text-start sm:text-start">
            <DialogTitle className="line-clamp-2 text-base">
              {viewer?.name || "پخش ویدیو"}
            </DialogTitle>
          </DialogHeader>
          {viewer ? (
            <VideoPlayer
              src={mediaStreamUrl(viewer.id)}
              title={viewer.name}
              className="rounded-xl"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent dir="rtl" className="text-start sm:max-w-md">
          <DialogHeader className="space-y-1 text-start sm:text-start">
            <DialogTitle>درخواست اصلاح ویدیو</DialogTitle>
          </DialogHeader>
          {revisionTarget ? (
            <p className="text-xs leading-6 text-muted-foreground">
              {VIDEO_TYPE_LABELS[resolveType(revisionTarget)]} — نسخه{" "}
              {revisionTarget.version ?? "—"}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="final-revision-body">توضیح تغییرات</Label>
            <Textarea
              id="final-revision-body"
              dir="rtl"
              rows={4}
              value={revisionBody}
              onChange={(e) => setRevisionBody(e.target.value)}
              placeholder="لطفاً تغییرات مورد نظر برای این ویدیو را بنویسید..."
              className="text-start"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="brand"
              onClick={submitRevision}
              disabled={
                !!requestingFileId ||
                !revisionBody.trim() ||
                !revisionTarget
              }
            >
              {requestingFileId === revisionTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "ارسال درخواست"
              )}
            </Button>
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LatestDeliveryRow({
  watermarked,
  clean,
  viewedIds,
  actionOpts,
  approvingFileId,
  requestingFileId,
  paymentDetailsHref,
  onView,
  onApprove,
  onRequestRevision,
}: {
  watermarked: PortalFinalVideo | null;
  clean: PortalFinalVideo | null;
  viewedIds: Set<string>;
  actionOpts: {
    projectCompleted: boolean;
    awaitingFinalDecision: boolean;
    cleanUnlocked: boolean;
    revisionUsed: number;
    revisionMax: number;
  };
  approvingFileId?: string | null;
  requestingFileId?: string | null;
  paymentDetailsHref: string;
  onView: (video: PortalFinalVideo) => void;
  onApprove?: (payload: {
    videoType: "CLEAN" | "WATERMARKED";
    fileId: string;
  }) => void;
  onRequestRevision: (video: PortalFinalVideo) => void;
}) {
  const cards: Array<{ video: PortalFinalVideo; variant: FinalVideoType }> = [];
  if (watermarked) cards.push({ video: watermarked, variant: "WATERMARKED" });
  if (clean) cards.push({ video: clean, variant: "CLEAN" });
  if (cards.length === 0) return null;

  const anyNew = cards.some(({ video }) => isVideoNew(video, viewedIds));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">آخرین ارسال مدیر</h3>
        {anyNew ? (
          <Badge variant="brand" className="h-5 px-2 text-[10px]">
            جدید
          </Badge>
        ) : null}
        <span className="text-[11px] text-muted-foreground">
          نسخه دارای واترمارک و بدون واترمارک در یک ردیف
        </span>
      </div>

      <div
        className={cn(
          "rounded-2xl border p-3 sm:p-4",
          anyNew
            ? "border-brand/35 bg-brand/[0.03] ring-1 ring-brand/10"
            : "border-border/70 bg-muted/10",
        )}
      >
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            cards.length > 1 && "md:grid-cols-2",
          )}
        >
          {cards.map(({ video, variant }) => (
            <div key={video.id} className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                {VIDEO_TYPE_LABELS[variant]}
              </p>
              <VideoCard
                variant={variant}
                video={video}
                isNew={isVideoNew(video, viewedIds)}
                canApprove={canApproveVideo(video, variant, actionOpts)}
                canRequestRevision={canRequestRevisionVideo(
                  video,
                  variant,
                  actionOpts,
                )}
                isApproving={approvingFileId === video.id}
                isRequesting={requestingFileId === video.id}
                paymentDetailsHref={paymentDetailsHref}
                onView={onView}
                onApprove={onApprove}
                onRequestRevision={onRequestRevision}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoSection({
  title,
  variant,
  videos,
  emptyLabel,
  hideWhenEmpty = false,
  viewedIds,
  actionOpts,
  approvingFileId,
  requestingFileId,
  paymentDetailsHref,
  onView,
  onApprove,
  onRequestRevision,
}: {
  title: string;
  variant: FinalVideoType;
  videos: PortalFinalVideo[];
  emptyLabel: string;
  hideWhenEmpty?: boolean;
  viewedIds: Set<string>;
  actionOpts: {
    projectCompleted: boolean;
    awaitingFinalDecision: boolean;
    cleanUnlocked: boolean;
    revisionUsed: number;
    revisionMax: number;
  };
  approvingFileId?: string | null;
  requestingFileId?: string | null;
  paymentDetailsHref: string;
  onView: (video: PortalFinalVideo) => void;
  onApprove?: (payload: {
    videoType: "CLEAN" | "WATERMARKED";
    fileId: string;
  }) => void;
  onRequestRevision: (video: PortalFinalVideo) => void;
}) {
  if (hideWhenEmpty && videos.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {videos.length === 0 ? (
        <EmptyVideoCard emptyLabel={emptyLabel} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              variant={variant}
              video={video}
              isNew={isVideoNew(video, viewedIds)}
              canApprove={canApproveVideo(video, variant, actionOpts)}
              canRequestRevision={canRequestRevisionVideo(
                video,
                variant,
                actionOpts,
              )}
              isApproving={approvingFileId === video.id}
              isRequesting={requestingFileId === video.id}
              paymentDetailsHref={paymentDetailsHref}
              onView={onView}
              onApprove={onApprove}
              onRequestRevision={onRequestRevision}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyVideoCard({ emptyLabel }: { emptyLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/10 px-4 py-8 text-center">
      <Film className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{emptyLabel}</p>
    </div>
  );
}

function VideoCard({
  variant,
  video,
  isNew,
  canApprove,
  canRequestRevision,
  isApproving,
  isRequesting,
  paymentDetailsHref,
  onView,
  onApprove,
  onRequestRevision,
}: {
  variant: FinalVideoType;
  video: PortalFinalVideo;
  isNew: boolean;
  canApprove: boolean;
  canRequestRevision: boolean;
  isApproving: boolean;
  isRequesting: boolean;
  paymentDetailsHref: string;
  onView: (video: PortalFinalVideo) => void;
  onApprove?: (payload: {
    videoType: "CLEAN" | "WATERMARKED";
    fileId: string;
  }) => void;
  onRequestRevision: (video: PortalFinalVideo) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  const locked =
    variant === "CLEAN" &&
    (video.accessLocked === true || video.canPlay === false);

  const canPlay =
    variant === "WATERMARKED" ||
    (!locked && video.canPlay !== false);

  const canDownload =
    !locked &&
    (variant === "WATERMARKED"
      ? true
      : video.canDownload === true || video.allowDownload === true);

  const dateValue = video.sentAt || video.createdAt || null;
  const stream = canPlay ? mediaStreamUrl(video.id) : "";
  const thumbSrc = stream ? `${stream}#t=0.5` : "";
  const statusBadge = portalStatusBadge(video, variant, isNew, locked);
  const showDecisionActions = canApprove || canRequestRevision;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md",
        locked
          ? "border-amber-500/30"
          : isNew
            ? "border-brand/45 ring-1 ring-brand/15"
            : video.status === "APPROVED_BY_CUSTOMER"
              ? "border-emerald-500/25"
              : "border-border/70",
      )}
    >
      <div className="relative bg-neutral-950">
        {canPlay ? (
          <button
            type="button"
            onClick={() => onView(video)}
            className="group relative block w-full text-start"
            aria-label="مشاهده ویدیو"
          >
            <video
              src={thumbSrc}
              preload="metadata"
              muted
              playsInline
              className="aspect-video w-full object-cover"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setDurationSec(d);
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/35">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-foreground shadow-lg ring-1 ring-black/10 transition-transform group-hover:scale-105">
                <Play className="h-5 w-5 fill-current ps-0.5" />
              </span>
            </span>
          </button>
        ) : (
          <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-300 via-neutral-200 to-neutral-300 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800">
            <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
            <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/30 bg-background/95 text-amber-700 shadow-sm dark:text-amber-300">
                <Lock className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                دسترسی قفل است
              </span>
            </div>
          </div>
        )}

        <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
          <Badge variant={statusBadge.tone} className="h-5 px-2 text-[10px] shadow-sm">
            {statusBadge.label}
          </Badge>
          {video.version != null ? (
            <Badge variant="secondary" className="h-5 px-2 text-[10px] shadow-sm">
              نسخه {video.version}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 text-start">
        <div className="space-y-2">
          <p
            className="line-clamp-2 text-sm font-semibold leading-snug"
            title={video.name}
          >
            {video.name}
          </p>

          <dl className="grid grid-cols-3 gap-2 text-[11px]">
            <MetaTile label="مدت" value={formatDuration(durationSec)} />
            <MetaTile
              label="حجم"
              value={
                video.sizeBytes != null ? formatFileSize(video.sizeBytes) : "—"
              }
            />
            <MetaTile
              label="تاریخ"
              value={dateValue ? formatDate(dateValue) : "—"}
            />
          </dl>

          {locked ? (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {video.accessMessage ||
                "پس از تسویه پرداخت، پخش و دانلود فعال می‌شود."}
            </p>
          ) : null}

          {video.status === "REVISION_REQUESTED" && video.revisionNotes ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">درخواست اصلاح: </span>
              {video.revisionNotes}
            </p>
          ) : null}

          {video.status === "APPROVED_BY_CUSTOMER" ? (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              این ویدیو تأیید شده است.
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            {canPlay ? (
              <Button
                size="sm"
                variant="brand"
                className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
                onClick={() => onView(video)}
              >
                <Eye className="h-3.5 w-3.5" />
                مشاهده ویدیو
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
                asChild
              >
                <Link href={paymentDetailsHref}>
                  <Wallet className="h-3.5 w-3.5" />
                  جزئیات پرداخت
                </Link>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
              disabled={!canDownload || downloading}
              onClick={async () => {
                if (!canDownload) return;
                setDownloading(true);
                try {
                  await downloadMediaFile(video.id, video.name);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "دانلود ناموفق بود",
                  );
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : locked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              دانلود ویدیو
            </Button>
          </div>

          {showDecisionActions ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <p className="mb-2 text-[10px] font-medium text-muted-foreground">
                تأیید یا رد این ویدیو
              </p>
              {canApprove && variant === "CLEAN" ? (
                <p className="mb-2 text-[11px] leading-5 text-muted-foreground">
                  با تأیید نسخه بدون واترمارک، در صورت تسویه کامل پرداخت، پروژه
                  تکمیل می‌شود.
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                {canApprove ? (
                  <Button
                    variant="brand"
                    size="sm"
                    className="h-9 flex-1 gap-1.5 text-xs"
                    disabled={isApproving || isRequesting}
                    onClick={() =>
                      onApprove?.({
                        videoType: variant,
                        fileId: video.id,
                      })
                    }
                  >
                    {isApproving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    تأیید
                  </Button>
                ) : null}
                {canRequestRevision ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 gap-1.5 text-xs"
                    disabled={isApproving || isRequesting}
                    onClick={() => onRequestRevision(video)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    رد / درخواست اصلاح
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/45 px-2.5 py-2">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-xs font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}
