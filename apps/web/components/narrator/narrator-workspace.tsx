"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import {
  uploadFileWithProgress,
} from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import {
  NARRATION_AUDIO_ACCEPT,
  validateNarrationAudioFile,
} from "@/lib/narration-audio";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NarrationAudioVersions,
  type NarrationTakeRecord,
} from "@/components/narration/narration-audio-versions";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Mic2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ALERT_BANNER, ALERT_ICON, SUCCESS_ICON } from "@/lib/theme-tones";
import { isNarrationApproved, NARRATION_APPROVED_LABEL } from "@/lib/narrator";

type NarrationStatus =
  | "PENDING_NARRATION"
  | "RECORDING_IN_PROGRESS"
  | "NARRATION_SUBMITTED"
  | "APPROVED"
  | "REVISION_REQUESTED";

type NarratorWorkspace = {
  id: string;
  projectId: string;
  status: NarrationStatus;
  title: string | null;
  script: string;
  assignedAt: string | null;
  deadline: string | null;
  revisionNotes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  audioFile?: {
    id: string;
    name: string;
    storageKey: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt: string;
  } | null;
  takes?: NarrationTakeRecord[];
};

const STATUS_LABEL: Record<NarrationStatus, string> = {
  PENDING_NARRATION: "در انتظار ضبط",
  RECORDING_IN_PROGRESS: "در حال ضبط",
  NARRATION_SUBMITTED: "ارسال‌شده",
  APPROVED: NARRATION_APPROVED_LABEL,
  REVISION_REQUESTED: "نیاز به اصلاح",
};

function statusVariant(
  status: NarrationStatus,
): "brand" | "success" | "warning" | "destructive" | "secondary" {
  if (status === "APPROVED") return "success";
  if (status === "REVISION_REQUESTED") return "destructive";
  if (status === "NARRATION_SUBMITTED" || status === "RECORDING_IN_PROGRESS")
    return "warning";
  return "brand";
}

function isOverdue(deadline?: string | null, status?: NarrationStatus) {
  if (!deadline || status === "APPROVED" || status === "NARRATION_SUBMITTED")
    return false;
  return new Date(deadline).getTime() < Date.now();
}

export function NarratorWorkspace({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const workspaceQ = useQuery({
    queryKey: ["narrator-workspace", projectId],
    queryFn: () =>
      apiGet<NarratorWorkspace>(`/narration/workspace/${projectId}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["narrator-workspace", projectId] });
    qc.invalidateQueries({ queryKey: ["narration-my-tasks"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const startMut = useMutation({
    mutationFn: () => apiPost(`/narration/projects/${projectId}/start`, {}),
    onSuccess: () => {
      toast.success("ضبط آغاز شد");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const submitMut = useMutation({
    mutationFn: async (file: File) => {
      const validation = validateNarrationAudioFile(file);
      if (!validation.ok) {
        throw new Error(validation.message);
      }
      setUploadPct(0);
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.NARRATION_AUDIO,
          projectId,
        },
        setUploadPct,
      );
      return apiPost(`/narration/projects/${projectId}/submit`, {
        storageKey: uploaded.key,
        name: uploaded.name || file.name,
        mimeType: uploaded.mimeType || file.type,
        sizeBytes: uploaded.sizeBytes || file.size,
        storageMeta: uploaded.storageMeta || undefined,
      });
    },
    onSuccess: () => {
      toast.success("فایل نریشن ارسال شد");
      setUploadPct(null);
      invalidate();
    },
    onError: (e) => {
      setUploadPct(null);
      toast.error(e instanceof Error ? e.message : "آپلود ناموفق بود");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (takeId: string) =>
      apiDelete(`/narration/projects/${projectId}/takes/${takeId}`),
    onSuccess: () => {
      toast.success("فایل صوتی حذف شد. می‌توانید فایل جایگزین آپلود کنید.");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف فایل ناموفق بود"),
  });

  const data = workspaceQ.data;
  const overdue = isOverdue(data?.deadline, data?.status);
  const canUpload = useMemo(
    () =>
      !!data &&
      [
        "PENDING_NARRATION",
        "RECORDING_IN_PROGRESS",
        "REVISION_REQUESTED",
      ].includes(data.status),
    [data],
  );
  const canDeleteAudio = useMemo(
    () =>
      !!data &&
      data.status !== "APPROVED" &&
      [
        "PENDING_NARRATION",
        "RECORDING_IN_PROGRESS",
        "NARRATION_SUBMITTED",
        "REVISION_REQUESTED",
      ].includes(data.status),
    [data],
  );

  const audioVersions = useMemo((): NarrationTakeRecord[] => {
    if (!data) return [];
    if (data.takes?.length) return data.takes;
    if (!data.audioFile) return [];
    return [
      {
        id: data.audioFile.id,
        version: 1,
        createdAt: data.audioFile.createdAt,
        isCurrent: true,
        audioFile: data.audioFile,
      },
    ];
  }, [data]);

  if (workspaceQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (workspaceQ.isError || !data) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-20 text-center"
        dir="rtl"
      >
        <Mic2 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-base font-semibold">این نریشن در دسترس نیست</p>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          ممکن است هنوز توسط مدیر ارسال نشده باشد یا دسترسی شما لغو شده باشد.
        </p>
        <Button variant="outline" className="mt-2 gap-2" asChild>
          <Link href="/narrator/dashboard">
            <ArrowRight className="h-4 w-4" />
            بازگشت به میز کار
          </Link>
        </Button>
      </div>
    );
  }

  const heading = data.title?.trim() || "متن نریشن";

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5" dir="rtl">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2 h-8 gap-1.5 px-2 text-muted-foreground"
            asChild
          >
            <Link href="/narrator/dashboard">
              <ArrowRight className="h-3.5 w-3.5" />
              میز کار
            </Link>
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Badge
              variant={statusVariant(data.status)}
              className="h-6 font-normal"
            >
              {STATUS_LABEL[data.status]}
            </Badge>
            {overdue && (
              <Badge variant="destructive" className="h-6 font-normal">
                مهلت گذشته
              </Badge>
            )}
          </div>
        </div>

        <h1 className="text-lg font-bold leading-8 tracking-tight sm:text-2xl sm:leading-tight">
          {heading}
        </h1>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
          {data.assignedAt && (
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="truncate">
                تاریخ دریافت: {formatDate(data.assignedAt)}
              </span>
            </span>
          )}
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0",
              overdue && "text-destructive",
            )}
          >
            <Clock3 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="truncate">
              مهلت: {data.deadline ? formatDate(data.deadline) : "—"}
            </span>
          </span>
        </div>

        {(data.status === "PENDING_NARRATION" || canUpload) && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {data.status === "PENDING_NARRATION" && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 sm:h-9 sm:flex-none"
                disabled={startMut.isPending}
                onClick={() => startMut.mutate()}
              >
                <Mic2 className="h-3.5 w-3.5 shrink-0" />
                شروع ضبط
              </Button>
            )}
            {canUpload && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept={NARRATION_AUDIO_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) submitMut.mutate(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="brand"
                  size="sm"
                  className={cn(
                    "h-10 gap-1.5 sm:h-9 sm:flex-none",
                    data.status !== "PENDING_NARRATION" && "col-span-2 sm:col-span-1",
                  )}
                  disabled={submitMut.isPending || deleteMut.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {submitMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {audioVersions.length > 0 ? "آپلود جایگزین" : "آپلود نریشن"}
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      {data.status === "REVISION_REQUESTED" && data.revisionNotes && (
        <div className={cn("flex gap-2.5 px-3.5 py-3.5 sm:gap-3 sm:px-4 sm:py-4", ALERT_BANNER)}>
          <AlertTriangle
            className={cn("mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5", ALERT_ICON)}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">درخواست اصلاح</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-7 sm:mt-1.5 sm:text-sm sm:leading-8">
              {data.revisionNotes}
            </p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-muted/30 px-3.5 py-2.5 sm:px-6 sm:py-3">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">
            متن نریشن
          </p>
        </div>
        <div className="px-3.5 py-5 sm:px-8 sm:py-10">
          {data.script ? (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.95] text-foreground sm:text-lg sm:leading-[2.2]">
              {data.script}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              متن نریشن در دسترس نیست.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-3.5 sm:p-5">
        <p className="text-sm font-semibold">
          {audioVersions.length > 1
            ? `نسخه‌های فایل صوتی (${audioVersions.length.toLocaleString("fa-AF", { numberingSystem: "latn" })})`
            : "فایل صوتی ارسالی"}
        </p>

        {uploadPct != null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>در حال آپلود…</span>
              <span className="tabular-nums">
                {uploadPct.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                ٪
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          </div>
        )}

        <NarrationAudioVersions
          takes={audioVersions}
          currentFileId={data.audioFile?.id}
          approved={isNarrationApproved(data.status)}
          deletingTakeId={deleteMut.isPending ? deleteMut.variables ?? null : null}
          onDelete={
            canDeleteAudio
              ? async (take) => {
                  await deleteMut.mutateAsync(take.id);
                }
              : undefined
          }
        />

        {data.status === "NARRATION_SUBMITTED" && audioVersions.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className={cn("h-3.5 w-3.5", SUCCESS_ICON)} />
            فایل ارسال شد و در انتظار بررسی مدیر است. در صورت اشتباه، می‌توانید حذف و جایگزین کنید.
          </p>
        )}
      </section>
    </div>
  );
}
