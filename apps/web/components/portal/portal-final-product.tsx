"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  allowDownload?: boolean;
  canPlay?: boolean;
  canDownload?: boolean;
  accessLocked?: boolean;
  accessStatus?: string | null;
  accessMessage?: string | null;
};

type PortalFinalProductProps = {
  videos: PortalFinalVideo[];
  watermarkedVideos?: PortalFinalVideo[];
  cleanVideos?: PortalFinalVideo[];
  projectTitle?: string;
  projectCode?: string;
  revisionUsed?: number;
  revisionMax?: number;
  /** Show revision request (not completion). */
  canRequestRevision?: boolean;
  /** Customer may approve the received final product. */
  canApproveFinal?: boolean;
  /** @deprecated Prefer canApproveFinal — kept for compatibility. */
  canConfirmClean?: boolean;
  approving?: boolean;
  onApproveFinal?: (payload: {
    videoType: "CLEAN" | "WATERMARKED";
    fileId?: string;
  }) => void;
  /** @deprecated Prefer onApproveFinal */
  onApproveClean?: (payload: { videoType: "CLEAN"; fileId?: string }) => void;
  onRequestRevision?: () => void;
  paymentDetailsHref?: string;
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

export function PortalFinalProduct({
  videos,
  watermarkedVideos,
  cleanVideos,
  projectTitle,
  projectCode,
  revisionUsed,
  revisionMax,
  canRequestRevision,
  canApproveFinal,
  canConfirmClean,
  approving,
  onApproveFinal,
  onApproveClean,
  onRequestRevision,
  paymentDetailsHref = "/portal",
}: PortalFinalProductProps) {
  const split = splitVideos(videos);
  const watermarked = watermarkedVideos?.length
    ? watermarkedVideos
    : split.watermarked;
  const clean = cleanVideos?.length ? cleanVideos : split.clean;
  const total = watermarked.length + clean.length;
  const [viewer, setViewer] = useState<PortalFinalVideo | null>(null);
  const cleanVideo = clean[0] ?? null;
  const watermarkedVideo = watermarked[0] ?? null;
  const cleanLocked =
    !!cleanVideo &&
    (cleanVideo.accessLocked === true || cleanVideo.canPlay === false);
  const showApprove =
    !!(canApproveFinal ?? canConfirmClean) &&
    !!(onApproveFinal || onApproveClean);
  const showActions = showApprove || !!canRequestRevision;

  const handleApprove = () => {
    if (cleanVideo && !cleanLocked) {
      const payload = { videoType: "CLEAN" as const, fileId: cleanVideo.id };
      if (onApproveFinal) onApproveFinal(payload);
      else onApproveClean?.(payload);
      return;
    }
    const fileId = cleanVideo?.id || watermarkedVideo?.id;
    const payload = {
      videoType: (cleanVideo ? "CLEAN" : "WATERMARKED") as
        | "CLEAN"
        | "WATERMARKED",
      fileId,
    };
    if (onApproveFinal) onApproveFinal(payload);
    else if (cleanVideo) onApproveClean?.({ videoType: "CLEAN", fileId: cleanVideo.id });
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

  return (
    <div className="space-y-4" dir="rtl">
      <header className="space-y-1 text-start">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            محصول نهایی پروژه
          </h2>
          {revisionUsed != null && revisionMax != null ? (
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
          ویدیوهای نهایی پروژه در این بخش قابل مشاهده و دریافت هستند
          {projectTitle ? (
            <>
              {" "}
              —{" "}
              <span className="font-medium text-foreground">{projectTitle}</span>
            </>
          ) : null}
          .
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch md:gap-4">
        <VersionCard
          variant="WATERMARKED"
          title={VIDEO_TYPE_LABELS.WATERMARKED}
          video={watermarkedVideo}
          emptyLabel="هنوز ارسال نشده"
          paymentDetailsHref={paymentDetailsHref}
          onView={setViewer}
        />
        <VersionCard
          variant="CLEAN"
          title={VIDEO_TYPE_LABELS.CLEAN}
          video={cleanVideo}
          emptyLabel="هنوز ارسال نشده"
          paymentDetailsHref={paymentDetailsHref}
          onView={setViewer}
        />
      </div>

      {showActions ? (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex flex-wrap gap-2">
            {showApprove ? (
              <Button
                variant="brand"
                size="sm"
                className="h-9 gap-1.5"
                disabled={approving}
                onClick={handleApprove}
              >
                {approving ? (
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
                className="h-9 gap-1.5"
                disabled={approving}
                onClick={onRequestRevision}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                درخواست اصلاح
              </Button>
            ) : null}
          </div>
          {showApprove ? (
            <p className="text-[11px] leading-5 text-muted-foreground">
              {cleanVideo && !cleanLocked
                ? "با تأیید نسخه بدون واترمارک، پروژه تکمیل می‌شود."
                : "با تأیید، محصول نهایی پذیرفته می‌شود و مرحله بعدی گردش‌کار فعال می‌گردد."}
            </p>
          ) : null}
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
    </div>
  );
}

function VersionCard({
  variant,
  title,
  video,
  emptyLabel,
  paymentDetailsHref,
  onView,
}: {
  variant: FinalVideoType;
  title: string;
  video: PortalFinalVideo | null;
  emptyLabel: string;
  paymentDetailsHref: string;
  onView: (video: PortalFinalVideo) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  const locked =
    !!video &&
    variant === "CLEAN" &&
    (video.accessLocked === true || video.canPlay === false);

  const canPlay =
    !!video &&
    (variant === "WATERMARKED" ||
      (!locked && video.canPlay !== false));

  const canDownload =
    !!video &&
    !locked &&
    (variant === "WATERMARKED"
      ? true
      : video.canDownload === true || video.allowDownload === true);

  const dateValue = video?.sentAt || video?.createdAt || null;
  const stream = canPlay && video ? mediaStreamUrl(video.id) : "";
  const thumbSrc = stream ? `${stream}#t=0.5` : "";

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm",
        locked
          ? "border-amber-500/25"
          : "border-border/70",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5 text-start">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {!video ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            ناموجود
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            <Lock className="h-3 w-3" />
            قفل‌شده
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            آماده
          </span>
        )}
      </div>

      {/* Preview */}
      <div className="bg-muted/30 p-3">
        <div className="relative overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-black/5 dark:ring-white/5">
          {!video ? (
            <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
              <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                <Film className="h-5 w-5 opacity-40" />
                <p className="text-[11px]">{emptyLabel}</p>
              </div>
            </div>
          ) : canPlay ? (
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
              <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border/60 transition-transform group-hover:scale-105">
                  <Play className="h-4 w-4 fill-current ps-0.5" />
                </span>
              </span>
            </button>
          ) : (
            <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-300 via-neutral-200 to-neutral-300 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800">
              <div className="absolute inset-0 scale-110 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.35),transparent_55%)] blur-sm" />
              <div className="absolute inset-0 bg-background/35 backdrop-blur-[2px]" />
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-background/95 text-amber-700 shadow-sm dark:text-amber-300">
                  <Lock className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  دسترسی قفل است
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info + actions */}
      <div className="flex flex-1 flex-col gap-3 px-3.5 pb-3.5 text-start">
        {video ? (
          <>
            <div className="space-y-2">
              <p
                className="line-clamp-2 text-sm font-semibold leading-snug"
                title={video.name}
              >
                {video.name}
              </p>

              <dl className="grid grid-cols-2 gap-2 text-[11px]">
                <InfoCell label="مدت" value={formatDuration(durationSec)} />
                <InfoCell
                  label="حجم"
                  value={
                    video.sizeBytes != null
                      ? formatFileSize(video.sizeBytes)
                      : "—"
                  }
                />
                <InfoCell
                  label="تاریخ"
                  value={dateValue ? formatDate(dateValue) : "—"}
                  className="col-span-2"
                />
              </dl>

              {locked ? (
                <p className="rounded-lg bg-amber-500/5 px-2.5 py-2 text-[11px] leading-5 text-muted-foreground">
                  {video.accessMessage ||
                    (video.accessStatus === "LOCKED_APPROVAL"
                      ? "پرداخت تکمیل شده — در انتظار تأیید تحویل مدیر."
                      : "پس از تسویه پرداخت، پخش و دانلود فعال می‌شود.")}
                </p>
              ) : null}
            </div>

            <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
                    مشاهده جزئیات پرداخت
                  </Link>
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
                disabled={!canDownload || downloading}
                onClick={async () => {
                  if (!canDownload || !video) return;
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
          </>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </p>
        )}
      </div>
    </article>
  );
}

function InfoCell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted/40 px-2.5 py-1.5",
        className,
      )}
    >
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}
