"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import {
  uploadFileWithProgress,
} from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
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
  APPROVED: "تأییدشده",
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
    <div className="mx-auto max-w-4xl space-y-5" dir="rtl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-me-2 h-8 gap-1.5 px-2 text-muted-foreground"
            asChild
          >
            <Link href="/narrator/dashboard">
              <ArrowRight className="h-3.5 w-3.5" />
              میز کار
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {heading}
            </h1>
            <Badge variant={statusVariant(data.status)} className="font-normal">
              {STATUS_LABEL[data.status]}
            </Badge>
            {overdue && (
              <Badge variant="destructive" className="font-normal">
                مهلت گذشته
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {data.assignedAt && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 shrink-0" />
                تاریخ دریافت: {formatDate(data.assignedAt)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 shrink-0" />
              مهلت: {data.deadline ? formatDate(data.deadline) : "—"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.status === "PENDING_NARRATION" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={startMut.isPending}
              onClick={() => startMut.mutate()}
            >
              <Mic2 className="h-3.5 w-3.5" />
              شروع ضبط
            </Button>
          )}
          {canUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
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
                className="gap-1.5"
                disabled={submitMut.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {submitMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                آپلود نریشن
              </Button>
            </>
          )}
        </div>
      </header>

      {data.status === "REVISION_REQUESTED" && data.revisionNotes && (
        <div className={cn("flex gap-3 px-4 py-4", ALERT_BANNER)}>
          <AlertTriangle
            className={cn("mt-0.5 h-5 w-5 shrink-0", ALERT_ICON)}
          />
          <div>
            <p className="text-sm font-semibold">درخواست اصلاح</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-8">
              {data.revisionNotes}
            </p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">متن نریشن</p>
        </div>
        <div className="px-4 py-6 sm:px-8 sm:py-10">
          {data.script ? (
            <p className="whitespace-pre-wrap text-[17px] leading-[2.1] text-foreground sm:text-lg sm:leading-[2.2]">
              {data.script}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              متن نریشن در دسترس نیست.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
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
        />

        {data.status === "NARRATION_SUBMITTED" && audioVersions.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className={cn("h-3.5 w-3.5", SUCCESS_ICON)} />
            فایل ارسال شد و در انتظار بررسی مدیر است.
          </p>
        )}
      </section>
    </div>
  );
}
