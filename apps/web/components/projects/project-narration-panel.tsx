"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  uploadFileWithProgress,
  downloadStoredFile,
  downloadMediaFile,
} from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import {
  CurrencyField,
  validateCurrencyInput,
} from "@/components/shared/currency-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mic2,
  RefreshCw,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { ALERT_BANNER, ALERT_CALLOUT, ALERT_ICON } from "@/lib/theme-tones";
import {
  NarrationAudioVersions,
  type NarrationTakeRecord,
} from "@/components/narration/narration-audio-versions";

type NarrationStatus =
  | "PENDING_NARRATION"
  | "RECORDING_IN_PROGRESS"
  | "NARRATION_SUBMITTED"
  | "APPROVED"
  | "REVISION_REQUESTED";

type NarrationTask = {
  id: string;
  projectId: string;
  status: NarrationStatus;
  deadline?: string | null;
  assignedAmount?: string | number | null;
  revisionNotes?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  narrationScriptSnapshot?: unknown;
  narratorUser?: { id: string; fullName: string; email: string } | null;
  narratorTeamProfile?: {
    id: string;
    displayName: string;
    realName?: string | null;
  } | null;
  assignedBy?: { id: string; fullName: string } | null;
  audioFile?: {
    id: string;
    name: string;
    storageKey: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt: string;
  } | null;
  takes?: Array<{
    id: string;
    version: number;
    createdAt: string;
    projectFile?: {
      id: string;
      name: string;
      storageKey: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
      createdAt: string;
    } | null;
    uploadedBy?: { id: string; fullName: string } | null;
  }>;
  contentVersion?: {
    id: string;
    versionNumber: number;
    status: string;
    isLocked: boolean;
    narration?: unknown;
  } | null;
  project?: { id: string; code: string; title: string; status: string };
};

type NarratorProfile = {
  id: string;
  displayName: string;
  realName?: string | null;
  user: { id: string; fullName: string; email: string; isActive: boolean };
  rates?: Array<{ amount: string | number; isActive?: boolean }>;
};

const STATUS_LABEL: Record<NarrationStatus, string> = {
  PENDING_NARRATION: "در انتظار نریشن",
  RECORDING_IN_PROGRESS: "در حال ضبط",
  NARRATION_SUBMITTED: "ارسال‌شده",
  APPROVED: "تأییدشده",
  REVISION_REQUESTED: "درخواست اصلاح",
};

function displayStatusLabel(
  status: NarrationStatus,
  sentToNarrator: boolean,
): string {
  if (!sentToNarrator && status === "PENDING_NARRATION") {
    return "در انتظار ارسال به نریتور";
  }
  return STATUS_LABEL[status];
}

const STATUS_STEPS: NarrationStatus[] = [
  "PENDING_NARRATION",
  "RECORDING_IN_PROGRESS",
  "NARRATION_SUBMITTED",
  "APPROVED",
];

function statusVariant(
  status: NarrationStatus,
): "brand" | "success" | "warning" | "destructive" | "secondary" {
  if (status === "APPROVED") return "success";
  if (status === "REVISION_REQUESTED") return "destructive";
  if (status === "NARRATION_SUBMITTED" || status === "RECORDING_IN_PROGRESS")
    return "warning";
  return "brand";
}

function scriptText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "script" in value) {
    const s = (value as { script?: unknown }).script;
    if (typeof s === "string") return s;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isOverdue(deadline?: string | null, status?: NarrationStatus) {
  if (!deadline || status === "APPROVED" || status === "NARRATION_SUBMITTED")
    return false;
  return new Date(deadline).getTime() < Date.now();
}

function StatusTracker({ status }: { status: NarrationStatus }) {
  const activeIdx =
    status === "REVISION_REQUESTED"
      ? 2
      : Math.max(0, STATUS_STEPS.indexOf(status));

  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= activeIdx && status !== "REVISION_REQUESTED";
        const current = i === activeIdx;
        return (
          <li
            key={step}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-center text-xs",
              done || current
                ? "border-brand/30 bg-brand/5 text-foreground"
                : "border-border/60 text-muted-foreground",
              status === "REVISION_REQUESTED" && i === 2 && ALERT_CALLOUT,
            )}
          >
            <p className="font-medium">{STATUS_LABEL[step]}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function ProjectNarrationPanel({
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
    ["projects.assign", "narration.approve", "narration.edit", "narration.revise"],
    roleCode,
  );
  const isNarrator = roleCode === "NARRATOR";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [narratorId, setNarratorId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [narrationCost, setNarrationCost] = useState("");
  const [narrationCostError, setNarrationCostError] = useState<string>();
  const [revisionNotes, setRevisionNotes] = useState("");

  const taskQ = useQuery({
    queryKey: ["narration-task", projectId],
    queryFn: () =>
      apiGet<NarrationTask | null>(`/narration/projects/${projectId}`),
  });

  const narratorsQ = useQuery({
    queryKey: ["narration-narrators"],
    queryFn: () => apiGet<NarratorProfile[]>("/narration/narrators"),
    enabled: isManager && assignOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["narration-task", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["narration-my-tasks"] });
  };

  const assignMut = useMutation({
    mutationFn: () => {
      const costError = validateCurrencyInput(narrationCost, "هزینه نریشن");
      if (costError) {
        setNarrationCostError(costError);
        throw new Error(costError);
      }
      return apiPost(`/narration/projects/${projectId}/assign`, {
        narratorProfileId: narratorId,
        deadline: deadline || undefined,
        narrationCost: narrationCost.replace(/,/g, "").trim(),
      });
    },
    onSuccess: () => {
      toast.success("نریشن به نریتور ارسال شد");
      setAssignOpen(false);
      setNarrationCost("");
      setNarrationCostError(undefined);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const deadlineMut = useMutation({
    mutationFn: (value: string) =>
      apiPatch(`/narration/projects/${projectId}/deadline`, {
        deadline: value,
      }),
    onSuccess: () => {
      toast.success("مهلت به‌روز شد");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const startMut = useMutation({
    mutationFn: () => apiPost(`/narration/projects/${projectId}/start`, {}),
    onSuccess: () => invalidate(),
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

  const acceptMut = useMutation({
    mutationFn: () => apiPost(`/narration/projects/${projectId}/accept`, {}),
    onSuccess: () => {
      toast.success("نریشن تأیید شد");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const revisionMut = useMutation({
    mutationFn: () =>
      apiPost(`/narration/projects/${projectId}/request-revision`, {
        notes: revisionNotes,
      }),
    onSuccess: () => {
      toast.success("درخواست اصلاح ثبت شد");
      setRevisionOpen(false);
      setRevisionNotes("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const task = taskQ.data;
  const sentToNarrator = !!task?.narratorUser;
  const script = useMemo(
    () =>
      scriptText(
        task?.narrationScriptSnapshot || task?.contentVersion?.narration,
      ),
    [task],
  );
  const overdue = isOverdue(task?.deadline, task?.status);
  const canUpload =
    !!task &&
    sentToNarrator &&
    (isNarrator || isManager) &&
    [
      "PENDING_NARRATION",
      "RECORDING_IN_PROGRESS",
      "REVISION_REQUESTED",
    ].includes(task.status);

  const audioVersions = useMemo((): NarrationTakeRecord[] => {
    if (!task) return [];
    if (task.takes?.length) {
      return task.takes.map((take) => ({
        id: take.id,
        version: take.version,
        createdAt: take.createdAt,
        projectFile: take.projectFile ?? undefined,
      }));
    }
    if (!task.audioFile) return [];
    return [
      {
        id: task.audioFile.id,
        version: 1,
        createdAt: task.audioFile.createdAt,
        isCurrent: true,
        projectFile: task.audioFile,
      },
    ];
  }, [task]);

  const handleAudioDownload = async (file: {
    id: string;
    name: string;
    storageKey: string;
  }) => {
    if (file.storageKey) {
      await downloadStoredFile(file.storageKey, file.name);
    } else {
      await downloadMediaFile(file.id, file.name);
    }
    toast.success("فایل صوتی با موفقیت دانلود شد");
  };

  if (taskQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (taskQ.isError && isNarrator) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
        <Mic2 className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">
          این نریشن هنوز به شما ارسال نشده است
        </p>
        <p className="max-w-md text-xs leading-6 text-muted-foreground">
          پس از ارسال توسط مدیر، پروژه در میز کار نریتور و این بخش در دسترس قرار
          می‌گیرد.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <header className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">
              مدیریت ضبط نریشن
            </h3>
            {task && (
              <Badge
                variant={statusVariant(task.status)}
                className="font-normal"
              >
                {displayStatusLabel(task.status, sentToNarrator)}
              </Badge>
            )}
            {task && !sentToNarrator && isManager && (
              <Badge variant="warning" className="font-normal">
                هنوز ارسال نشده
              </Badge>
            )}
            {task?.contentVersion?.isLocked && (
              <Badge variant="secondary" className="font-normal">
                محتوای قفل‌شده
              </Badge>
            )}
            {overdue && (
              <Badge variant="destructive" className="font-normal">
                مهلت گذشته
              </Badge>
            )}
          </div>
        </div>
        {isManager && (
          <Button
            variant="brand"
            className="gap-2"
            onClick={() => setAssignOpen(true)}
          >
            <UserRound className="h-4 w-4" />
            {task?.narratorUser
              ? "تغییر نریتور / ارسال مجدد"
              : "ارسال به نریتور"}
          </Button>
        )}
      </header>

      {!task ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
          <Mic2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">تکلیف نریشن هنوز ایجاد نشده</p>
          <p className="max-w-md text-xs leading-6 text-muted-foreground">
            پس از تأیید محتوای مشتری، متن نریشن اینجا آماده می‌شود. ارسال به
            نریتور فقط با تأیید مدیر انجام می‌شود.
          </p>
          {isManager && (
            <Button
              variant="brand"
              className="mt-2 gap-2"
              onClick={() => setAssignOpen(true)}
            >
              <UserRound className="h-4 w-4" />
              ارسال به نریتور
            </Button>
          )}
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              پیشرفت مرحله
            </p>
            <StatusTracker status={task.status} />
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 lg:col-span-1">
              <p className="text-sm font-semibold">جزئیات ارسال</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">نریتور</p>
                  <p className="font-medium">
                    {task.narratorTeamProfile?.displayName ||
                      task.narratorUser?.fullName ||
                      "هنوز ارسال نشده"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    مهلت ارسال
                  </p>
                  <p
                    className={cn("font-medium", overdue && "text-destructive")}
                  >
                    {task.deadline ? formatDate(task.deadline) : "—"}
                  </p>
                </div>
                {task.assignedBy && sentToNarrator && (
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      ارسال‌کننده
                    </p>
                    <p>{task.assignedBy.fullName}</p>
                  </div>
                )}
                {task.assignedAmount != null && sentToNarrator && (
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      هزینه نریشن
                    </p>
                    <p className="font-semibold text-brand">
                      {formatCurrency(Number(task.assignedAmount))}
                    </p>
                  </div>
                )}
                {isManager && (
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="deadline-edit">به‌روزرسانی مهلت</Label>
                    <div className="flex gap-2">
                      <Input
                        id="deadline-edit"
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        disabled={!deadline || deadlineMut.isPending}
                        onClick={() => deadlineMut.mutate(deadline)}
                      >
                        ذخیره
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">متن نریشن تأییدشده</p>
                {task.contentVersion && (
                  <Badge variant="secondary" className="font-normal">
                    نسخه{" "}
                    {task.contentVersion.versionNumber.toLocaleString("fa-AF", {
                      numberingSystem: "latn",
                    })}
                  </Badge>
                )}
              </div>
              {script ? (
                <div className="max-h-72 overflow-auto rounded-xl bg-muted/40 p-4">
                  <p className="whitespace-pre-wrap text-[15px] leading-8">
                    {script}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  متن نریشن در دسترس نیست
                </p>
              )}
            </section>
          </div>

          {task.status === "REVISION_REQUESTED" && task.revisionNotes && (
            <div className={cn("flex gap-3 px-4 py-3.5", ALERT_BANNER)}>
              <AlertTriangle
                className={cn("mt-0.5 h-4 w-4 shrink-0", ALERT_ICON)}
              />
              <div>
                <p className="text-sm font-medium">درخواست اصلاح مدیر</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-7">
                  {task.revisionNotes}
                </p>
              </div>
            </div>
          )}

          <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {audioVersions.length > 1
                  ? `نسخه‌های فایل صوتی (${audioVersions.length.toLocaleString("fa-AF", { numberingSystem: "latn" })})`
                  : "فایل صوتی"}
              </p>
              <div className="flex flex-wrap gap-2">
                {isNarrator && task.status === "PENDING_NARRATION" && (
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
                {isManager && task.status === "NARRATION_SUBMITTED" && (
                  <>
                    <Button
                      variant="brand"
                      size="sm"
                      className="gap-1.5"
                      disabled={acceptMut.isPending}
                      onClick={() => acceptMut.mutate()}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تأیید نریشن
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setRevisionOpen(true)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      درخواست اصلاح
                    </Button>
                  </>
                )}
              </div>
            </div>

            {uploadPct != null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>در حال آپلود…</span>
                  <span className="tabular-nums">
                    {uploadPct.toLocaleString("fa-AF", {
                      numberingSystem: "latn",
                    })}
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
              currentFileId={task.audioFile?.id}
              onDownload={async (file) => {
                try {
                  await handleAudioDownload(file);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "دانلود ناموفق بود",
                  );
                  throw e;
                }
              }}
            />
          </section>
        </>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>ارسال نریشن به نریتور</DialogTitle>
            <DialogDescription className="leading-6">
              نریتور را انتخاب کنید و در صورت نیاز مهلت ارسال را مشخص کنید. تا
              زمان ثبت، نریتور اعلان یا دسترسی دریافت نمی‌کند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>نریتور</Label>
              <Select
                value={narratorId}
                onValueChange={(value) => {
                  setNarratorId(value);
                  const profile = (narratorsQ.data || []).find(
                    (n) => n.id === value,
                  );
                  const rate = profile?.rates?.[0]?.amount;
                  if (rate != null && rate !== "") {
                    setNarrationCost(String(rate));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب نریتور" />
                </SelectTrigger>
                <SelectContent>
                  {(narratorsQ.data || []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.displayName}
                      {n.realName ? ` — ${n.realName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CurrencyField
              id="narration-cost"
              label="هزینه نریشن"
              value={narrationCost}
              onChange={(v) => {
                setNarrationCost(v);
                if (narrationCostError) {
                  setNarrationCostError(
                    validateCurrencyInput(v, "هزینه نریشن"),
                  );
                }
              }}
              error={narrationCostError}
              required
              hint="مبلغ پرداختی به نریتور برای این پروژه"
            />
            <div className="space-y-1.5">
              <Label htmlFor="assign-deadline">مهلت (اختیاری)</Label>
              <Input
                id="assign-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={
                !narratorId || !narrationCost.trim() || assignMut.isPending
              }
              onClick={() => assignMut.mutate()}
            >
              {assignMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "ارسال به نریتور"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>درخواست اصلاح نریشن</DialogTitle>
            <DialogDescription className="leading-6">
              دلیل و توضیحات اصلاح برای نریتور الزامی است.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={5}
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            placeholder="مثلاً: لحن رسمی‌تر و سرعت کمی کمتر باشد..."
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={!revisionNotes.trim() || revisionMut.isPending}
              onClick={() => revisionMut.mutate()}
            >
              ارسال درخواست
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
