"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import {
  getCustomTabListClass,
  getCustomTabTriggerClass,
} from "@/components/shared/tab-styles";
import {
  canEditContentVersion,
  canSendVersionToCustomer,
  versionSendBlockReason,
} from "@/lib/content-version";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Circle,
  Code2,
  GitCompare,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  XCircle,
  MessageSquareWarning,
} from "lucide-react";
import { toast } from "sonner";
import { ALERT_BANNER, ALERT_ICON } from "@/lib/theme-tones";
import {
  NarrationFinalView,
  ScenarioFinalView,
  StoryboardFinalView,
} from "@/components/projects/ai-content-views";
import {
  CustomerFeedbackPanel,
  type ApprovalTimelineItem,
  type CustomerFeedbackItem,
} from "@/components/projects/customer-feedback-panel";

type StepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

interface WorkflowStep {
  key: string;
  label: string;
  status: StepStatus;
  error?: string | null;
  warning?: boolean;
}

interface AiWorkflow {
  id: string;
  status: string;
  steps: WorkflowStep[];
  contentVersionId?: string | null;
  error?: string | null;
  createdAt: string;
}

interface ContentVersion {
  id: string;
  versionNumber: number;
  kind: string;
  status: string;
  isLocked?: boolean;
  publishedToClient: boolean;
  publishedAt?: string | null;
  changeNotes?: string | null;
  rejectionReason?: string | null;
  scenario?: unknown;
  narration?: unknown;
  storyboard?: unknown;
  extras?: Record<string, unknown> | null;
  createdAt: string;
  feedback?: CustomerFeedbackItem[];
  approvals?: ApprovalTimelineItem[];
}

interface AiOverview {
  currentWorkflow?: AiWorkflow | null;
  processingStatus: string;
  generatedContentCount: number;
  customerFeedback?: CustomerFeedbackItem[];
  approvalTimeline?: ApprovalTimelineItem[];
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  EDITED: "ویرایش‌شده",
  UNDER_REVIEW: "در حال بررسی",
  PENDING_CUSTOMER_APPROVAL: "در انتظار تأیید مشتری",
  REVISION_REQUESTED: "درخواست اصلاح",
  APPROVED: "تأییدشده",
  REJECTED: "رد شده",
  SUPERSEDED: "بایگانی",
  IDLE: "آماده",
  PENDING: "در صف",
  RUNNING: "در حال تولید",
  COMPLETED: "تکمیل",
  FAILED: "ناموفق",
  PARTIAL: "ناقص",
};

function statusBadgeVariant(
  status: string,
): "brand" | "success" | "warning" | "destructive" | "secondary" {
  if (status === "APPROVED" || status === "COMPLETED") return "success";
  if (
    status === "REJECTED" ||
    status === "FAILED" ||
    status === "REVISION_REQUESTED"
  )
    return "destructive";
  if (
    status === "RUNNING" ||
    status === "EDITED" ||
    status === "UNDER_REVIEW" ||
    status === "PENDING" ||
    status === "PENDING_CUSTOMER_APPROVAL"
  )
    return "warning";
  if (status === "DRAFT") return "brand";
  return "secondary";
}

function friendlyError(raw?: string | null): string | null {
  if (!raw) return null;
  const text = String(raw);
  if (/insufficient_quota|RESOURCE_EXHAUSTED|quota|سهمیه|اعتبار/i.test(text)) {
    return "سهمیه یا اعتبار سرویس AI تمام شده است. حساب OpenRouter را بررسی کنید.";
  }
  if (/invalid.?api.?key|API_KEY_INVALID|incorrect api key|کلید API/i.test(text)) {
    return "کلید API نامعتبر است. OPENROUTER_API_KEY را در سرور بررسی کنید.";
  }
  if (/timeout|طول کشید|AbortError/i.test(text)) {
    return "پاسخ هوش مصنوعی بیش از حد طول کشید. دوباره تلاش کنید.";
  }
  if (/rate.?limit|HTTP 429|محدودیت نرخ/i.test(text) && !/insufficient_quota/i.test(text)) {
    return "محدودیت نرخ درخواست. کمی بعد دوباره تلاش کنید.";
  }
  if (/model.?not.?found|HTTP 404|NOT_FOUND|در دسترس نیست/i.test(text)) {
    return "مدل درخواستی در دسترس نیست. مدل پیش‌فرض یا پشتیبان را بررسی کنید.";
  }
  if (/unavailable|ECONNREFUSED|در دسترس نیست|ارتباط با/i.test(text)) {
    return "سرویس AI موقتاً در دسترس نیست. دوباره تلاش کنید.";
  }
  if (text.includes("{") || text.length > 180) {
    return "خطا در تولید محتوا. دوباره تلاش کنید.";
  }
  return text;
}

function prettyJson(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stripTechnicalFields(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const clone = { ...(value as Record<string, unknown>) };
  delete clone.error;
  delete clone.fallbackError;
  delete clone.raw;
  delete clone.projectId;
  delete clone.versions;
  delete clone.recommendedTone;
  delete clone.recommendedScenarioId;
  delete clone.imagePrompts;
  delete clone.videoPrompts;
  delete clone.openaiImagePrompts;
  delete clone.soraVideoPrompts;
  return clone;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "COMPLETED")
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  if (status === "RUNNING")
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-600" />;
  if (status === "FAILED")
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  return <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />;
}

function ContentBlocks({
  value,
  dir = "rtl",
}: {
  value: unknown;
  dir?: "rtl" | "ltr";
}) {
  const cleaned = stripTechnicalFields(value);
  if (cleaned == null) {
    return <p className="text-sm text-muted-foreground">محتوایی ثبت نشده</p>;
  }
  if (typeof cleaned === "string") {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-8" dir={dir}>
        {cleaned}
      </p>
    );
  }
  if (typeof cleaned !== "object") {
    return <p className="text-sm">{String(cleaned)}</p>;
  }

  const obj = cleaned as Record<string, unknown>;
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : obj;

  if (typeof raw.script === "string" || typeof obj.script === "string") {
    return <NarrationFinalView value={value} dir={dir} />;
  }

  if (
    Array.isArray(raw.scenarios) ||
    raw.title ||
    raw.concept ||
    raw.hook ||
    raw.storyFlow
  ) {
    return <ScenarioFinalView value={value} dir={dir} />;
  }

  if (Array.isArray(raw.storyboard) || Array.isArray(obj.storyboard)) {
    return <StoryboardFinalView value={value} />;
  }

  const entries = Object.entries(obj).filter(
    ([k, v]) =>
      v != null &&
      v !== "" &&
      ![
        "projectId",
        "error",
        "fallbackError",
        "raw",
        "scenarios",
        "hooks",
        "scenes",
        "videoScenario",
        "versions",
      ].includes(k),
  );

  return (
    <div className="space-y-3" dir={dir}>
      {entries.map(([key, val]) => (
        <div key={key} className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {key}
          </p>
          {typeof val === "string" || typeof val === "number" ? (
            <p className="whitespace-pre-wrap text-sm leading-7">{String(val)}</p>
          ) : Array.isArray(val) ? (
            <ul className="list-disc space-y-1 pe-4 text-sm leading-6 text-muted-foreground">
              {val.map((item, i) => (
                <li key={i}>
                  {typeof item === "string" ? item : prettyJson(item)}
                </li>
              ))}
            </ul>
          ) : (
            <pre
              className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-[11px]"
              dir="ltr"
            >
              {prettyJson(val)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProjectAiAssistant({
  projectId,
  initialPanel = "content",
}: {
  projectId: string;
  initialPanel?: "content" | "feedback";
}) {
  const qc = useQueryClient();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [workspacePanel, setWorkspacePanel] = useState<"content" | "feedback">(
    initialPanel,
  );
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentVersion | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [editScenario, setEditScenario] = useState("");
  const [editNarration, setEditNarration] = useState("");
  const [editStoryboard, setEditStoryboard] = useState("");
  const [contentTab, setContentTab] = useState<
    "scenario" | "narration" | "storyboard"
  >("scenario");
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    setWorkspacePanel(initialPanel);
  }, [initialPanel]);

  const overviewQ = useQuery({
    queryKey: ["ai-overview", projectId],
    queryFn: () => apiGet<AiOverview>(`/ai/${projectId}/overview`),
    refetchInterval: (q) =>
      q.state.data?.processingStatus === "RUNNING" ||
      q.state.data?.processingStatus === "PENDING"
        ? 2000
        : false,
  });

  const versionsQ = useQuery({
    queryKey: ["ai-versions", projectId],
    queryFn: () => apiGet<ContentVersion[]>(`/ai/${projectId}/versions`),
    refetchInterval: () =>
      overviewQ.data?.processingStatus === "RUNNING" ||
      overviewQ.data?.processingStatus === "PENDING"
        ? 2500
        : false,
  });

  const workflowsQ = useQuery({
    queryKey: ["ai-workflows", projectId],
    queryFn: () => apiGet<AiWorkflow[]>(`/ai/${projectId}/workflows`),
    refetchInterval: (q) => {
      const running = q.state.data?.some(
        (w) => w.status === "RUNNING" || w.status === "PENDING",
      );
      return running ? 2000 : false;
    },
  });

  const versions = versionsQ.data || [];
  const selected =
    versions.find((v) => v.id === selectedVersionId) || versions[0] || null;

  useEffect(() => {
    if (!selectedVersionId && versions[0]) setSelectedVersionId(versions[0].id);
  }, [versions, selectedVersionId]);

  useEffect(() => {
    const wf = overviewQ.data?.currentWorkflow;
    if (wf?.contentVersionId) setSelectedVersionId(wf.contentVersionId);
  }, [overviewQ.data?.currentWorkflow, overviewQ.data?.processingStatus]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["ai-overview", projectId] });
    qc.invalidateQueries({ queryKey: ["ai-versions", projectId] });
    qc.invalidateQueries({ queryKey: ["ai-workflows", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const generateMut = useMutation({
    mutationFn: () =>
      apiPost<{ version?: ContentVersion; async?: boolean }>(
        `/ai/${projectId}/generate`,
        {},
      ),
    onSuccess: (data) => {
      toast.success(data?.async ? "تولید در پس‌زمینه شروع شد" : "محتوا تولید شد");
      if (data?.version?.id) setSelectedVersionId(data.version.id);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در تولید"),
  });

  const regenerateMut = useMutation({
    mutationFn: () =>
      apiPost<{ version?: ContentVersion; async?: boolean }>(
        `/ai/${projectId}/regenerate`,
        { changeNotes: "تولید مجدد نتیجه توسط مدیر" },
      ),
    onSuccess: (data) => {
      toast.success(data?.async ? "تولید مجدد شروع شد" : "نتیجه جدید تولید شد");
      if (data?.version?.id) setSelectedVersionId(data.version.id);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("نسخه‌ای انتخاب نشده");
      return apiPatch(`/ai/${projectId}/versions/${selected.id}`, {
        scenario: tryParseJson(editScenario),
        narration: tryParseJson(editNarration),
        storyboard: tryParseJson(editStoryboard),
        changeNotes: "ویرایش دستی مدیر",
      });
    },
    onSuccess: () => {
      toast.success("ذخیره شد");
      setEditOpen(false);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const deleteMut = useMutation({
    mutationFn: (versionId: string) =>
      apiDelete(`/ai/${projectId}/versions/${versionId}`),
    onSuccess: (_data, versionId) => {
      toast.success("نسخه حذف شد");
      setDeleteTarget(null);
      if (selectedVersionId === versionId) {
        const next = versions.find((v) => v.id !== versionId);
        setSelectedVersionId(next?.id || null);
      }
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در حذف"),
  });

  const sendMut = useMutation({
    mutationFn: (versionId: string) =>
      apiPost(`/ai/${projectId}/versions/${versionId}/send-for-approval`, {}),
    onSuccess: () => {
      toast.success("محتوا برای تأیید مشتری ارسال شد");
      setSendConfirmOpen(false);
      invalidateAll();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ارسال برای تأیید ناموفق بود"),
  });

  const compareQ = useQuery({
    queryKey: ["ai-compare", projectId, compareLeft, compareRight],
    queryFn: () =>
      apiGet<{ left: ContentVersion; right: ContentVersion }>(
        `/ai/${projectId}/versions/compare?left=${compareLeft}&right=${compareRight}`,
      ),
    enabled: compareOpen && !!compareLeft && !!compareRight,
  });

  const activeWorkflow =
    overviewQ.data?.currentWorkflow ||
    workflowsQ.data?.find(
      (w) => w.status === "RUNNING" || w.status === "PENDING",
    ) ||
    workflowsQ.data?.[0] ||
    null;

  const isBusy =
    generateMut.isPending ||
    regenerateMut.isPending ||
    overviewQ.data?.processingStatus === "RUNNING" ||
    overviewQ.data?.processingStatus === "PENDING";

  const pipelineNotice = useMemo(() => {
    const workflowFailed = activeWorkflow?.status === "FAILED";
    const fromWorkflow = friendlyError(activeWorkflow?.error);
    const fromExtras = friendlyError(
      (selected?.extras?.fallbackNotice as string) ||
        (selected?.extras?.fallbackError as string) ||
        null,
    );
    const usedFallback =
      selected?.extras?.usedFallback === true ||
      selected?.extras?.provider === "mock-fallback";
    return {
      usedFallback,
      failed: workflowFailed,
      message: fromWorkflow || fromExtras,
      isQuota: /سهمیه|quota|صورتحساب|اعتبار/i.test(fromWorkflow || fromExtras || ""),
      canRetry: workflowFailed || usedFallback,
    };
  }, [activeWorkflow?.error, activeWorkflow?.status, selected?.extras]);

  const narrationDir = useMemo(() => {
    const n = selected?.narration as { language?: string } | null;
    const lang = n?.language || "";
    if (lang === "en" || lang.startsWith("en")) return "ltr" as const;
    return "rtl" as const;
  }, [selected]);

  const contentValue = useMemo(() => {
    if (!selected) return null;
    if (contentTab === "scenario") return selected.scenario;
    if (contentTab === "narration") return selected.narration;
    return selected.storyboard;
  }, [selected, contentTab]);

  const steps = useMemo(() => {
    const raw = activeWorkflow?.steps || [];
    const allowed = new Set([
      "read_project",
      "scenario",
      "narration",
      "storyboard",
      "finalize",
    ]);
    const filtered = raw.filter((s) => allowed.has(s.key));
    return filtered.length > 0 ? filtered : raw;
  }, [activeWorkflow?.steps]);
  const completedSteps = steps.filter((s) => s.status === "COMPLETED").length;
  const progressPct = steps.length
    ? Math.round((completedSteps / steps.length) * 100)
    : 0;

  const contentStageStatus = useMemo(() => {
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.status]));
    return (
      [
        { key: "scenario", label: "سناریو", status: byKey.scenario || "PENDING" },
        { key: "narration", label: "نریشن", status: byKey.narration || "PENDING" },
        {
          key: "storyboard",
          label: "استوری‌بورد",
          status: byKey.storyboard || "PENDING",
        },
      ] as const
    );
  }, [steps]);

  const canEdit = !!selected && canEditContentVersion(selected);

  const sendBlockReason = selected ? versionSendBlockReason(selected) : null;
  const canSendForApproval = !!selected && canSendVersionToCustomer(selected);

  const feedbackCount = overviewQ.data?.customerFeedback?.length || 0;

  if (overviewQ.isLoading || versionsQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-[28rem] rounded-2xl" />
        </div>
      </div>
    );
  }

  const overview = overviewQ.data;

  return (
    <div className="space-y-4" dir="rtl">
      <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">
              فضای کاری تولید محتوا
            </h3>
            <Badge
              variant={statusBadgeVariant(overview?.processingStatus || "IDLE")}
              className="font-normal"
            >
              {STATUS_LABEL[overview?.processingStatus || "IDLE"]}
            </Badge>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            تولید حرفه‌ای سناریو، نریشن و استوری‌بورد بر اساس بریف پروژه — در سه
            مرحله پشت‌سرهم
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="فضای کاری هوش مصنوعی"
            className={getCustomTabListClass("segmented")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={workspacePanel === "content"}
              onClick={() => setWorkspacePanel("content")}
              className={getCustomTabTriggerClass(
                workspacePanel === "content",
                "segmented",
              )}
            >
              محتوا
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspacePanel === "feedback"}
              onClick={() => setWorkspacePanel("feedback")}
              className={getCustomTabTriggerClass(
                workspacePanel === "feedback",
                "segmented",
                "inline-flex items-center gap-1.5",
              )}
            >
              <MessageSquareWarning className="h-3.5 w-3.5" />
              بازخورد مشتری
              {feedbackCount > 0 && (
                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                  {feedbackCount.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                </span>
              )}
            </button>
          </div>
          <Button
            variant="brand"
            size="lg"
            className="h-11 shrink-0 gap-2 px-6"
            disabled={isBusy}
            onClick={() => generateMut.mutate()}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isBusy ? "در حال تولید…" : "تولید محتوا"}
          </Button>
        </div>
      </header>

      {(pipelineNotice.failed || pipelineNotice.usedFallback) &&
        pipelineNotice.message && (
        <div
          role="alert"
          className={cn(
            "flex gap-3 rounded-2xl border px-4 py-3.5",
            pipelineNotice.failed
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : ALERT_BANNER,
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              pipelineNotice.failed ? "text-destructive" : ALERT_ICON,
            )}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">
              {pipelineNotice.failed
                ? "تولید محتوا ناموفق بود"
                : "سرویس AI موقتاً در دسترس نبود"}
            </p>
            <p
              className={cn(
                "text-sm leading-6",
                pipelineNotice.failed
                  ? "text-destructive/90"
                  : "opacity-90",
              )}
            >
              {pipelineNotice.message}
            </p>
            {pipelineNotice.canRetry && (
              <Button
                variant={pipelineNotice.failed ? "destructive" : "outline"}
                size="sm"
                className="mt-1 gap-1.5"
                disabled={isBusy}
                onClick={() => regenerateMut.mutate()}
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                تلاش مجدد
              </Button>
            )}
          </div>
        </div>
      )}

      {isBusy && steps.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">خط تولید محتوا</p>
              <p className="text-xs text-muted-foreground">
                سناریو ← نریشن ← استوری‌بورد
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {progressPct.toLocaleString("fa-AF", { numberingSystem: "latn" })}٪
            </span>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {contentStageStatus.map((stage, index) => (
              <li
                key={stage.key}
                className={cn(
                  "rounded-xl border px-3.5 py-3 transition-colors",
                  stage.status === "RUNNING" && "border-brand/40 bg-brand/5",
                  stage.status === "COMPLETED" &&
                    "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
                  stage.status === "FAILED" &&
                    "border-destructive/30 bg-destructive/5",
                  stage.status === "PENDING" && "border-border/60 bg-muted/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-[11px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border/70">
                    {(index + 1).toLocaleString("fa-AF", {
                      numberingSystem: "latn",
                    })}
                  </span>
                  <StepIcon status={stage.status} />
                  <span
                    className={cn(
                      "text-sm",
                      stage.status === "RUNNING" && "font-medium text-foreground",
                      stage.status === "PENDING" && "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {workspacePanel === "feedback" ? (
        <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
          <CustomerFeedbackPanel
            feedback={overview?.customerFeedback || []}
            timeline={overview?.approvalTimeline || []}
            onSelectVersion={(versionId) => {
              setSelectedVersionId(versionId);
              setWorkspacePanel("content");
            }}
          />
        </div>
      ) : (
      <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold">نسخه‌ها</p>
              <p className="text-[11px] text-muted-foreground">
                {(overview?.generatedContentCount || versions.length).toLocaleString(
                  "fa-AF",
                )}{" "}
                نسخه
              </p>
            </div>
            {versions.length >= 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={() => {
                  setCompareLeft(versions[1]?.id || versions[0].id);
                  setCompareRight(versions[0].id);
                  setCompareOpen(true);
                }}
              >
                <GitCompare className="h-3.5 w-3.5" />
                مقایسه
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {versions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
                <Sparkles className="h-7 w-7 text-muted-foreground/35" />
                <p className="text-sm text-muted-foreground">هنوز محتوایی نیست</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {versions.map((v) => {
                  const active = selected?.id === v.id;
                  const locked =
                    v.status === "APPROVED" ||
                    (v.status === "PENDING_CUSTOMER_APPROVAL" &&
                      v.publishedToClient) ||
                    (v.status === "REVISION_REQUESTED" && v.isLocked);
                  const sendable = canSendVersionToCustomer(v);
                  return (
                    <li key={v.id}>
                      <div
                        className={cn(
                          "group relative flex items-stretch gap-0.5 rounded-xl transition-colors",
                          active
                            ? "bg-brand/10 ring-1 ring-brand/25"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedVersionId(v.id)}
                          className="min-w-0 flex-1 rounded-xl px-3 py-2.5 pe-1 text-start"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold tabular-nums">
                              نسخه {v.versionNumber.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                            </span>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <Badge
                                variant={statusBadgeVariant(v.status)}
                                className="text-[10px] font-normal"
                              >
                                {STATUS_LABEL[v.status] || v.status}
                              </Badge>
                              {(v.status === "APPROVED" ||
                                (v.status === "PENDING_CUSTOMER_APPROVAL" &&
                                  v.publishedToClient)) && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-normal"
                                >
                                  قفل محتوا
                                </Badge>
                              )}
                              {v.status === "PENDING_CUSTOMER_APPROVAL" &&
                                v.publishedToClient && (
                                  <Badge
                                    variant="brand"
                                    className="text-[10px] font-normal"
                                  >
                                    ارسال‌شده به مشتری
                                  </Badge>
                                )}
                              {sendable &&
                                !(
                                  v.status === "PENDING_CUSTOMER_APPROVAL" &&
                                  v.publishedToClient
                                ) && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                  >
                                    آماده ارسال
                                  </Badge>
                                )}
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDate(v.createdAt)}
                          </p>
                        </button>
                        {!locked && (
                          <div className="flex items-center pe-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteMut.isPending}
                              title="حذف نسخه"
                              aria-label={`حذف نسخه ${v.versionNumber}`}
                              className={cn(
                                "h-8 w-8 shrink-0 rounded-lg text-muted-foreground transition-all",
                                "opacity-100 hover:bg-destructive/10 hover:text-destructive",
                                "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
                                active && "sm:opacity-100",
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(v);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="text-base font-medium">آماده تولید محتوا</p>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                با یک کلیک، سناریو، نریشن و استوری‌بورد حرفه‌ای از بریف پروژه ساخته
                می‌شود. قبل از ارسال به مشتری، خروجی را بازبینی و ویرایش کنید.
              </p>
              <Button
                variant="brand"
                className="mt-1 gap-2"
                disabled={isBusy}
                onClick={() => generateMut.mutate()}
              >
                <Sparkles className="h-4 w-4" />
                شروع تولید
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    نسخه {selected.versionNumber.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                  </p>
                  {selected.changeNotes && (
                    <p className="truncate text-xs text-muted-foreground">
                      {selected.changeNotes}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!canEdit}
                    onClick={() => {
                      setEditScenario(prettyJson(selected.scenario));
                      setEditNarration(prettyJson(selected.narration));
                      setEditStoryboard(prettyJson(selected.storyboard));
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    ویرایش
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={isBusy}
                    onClick={() => regenerateMut.mutate()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    تولید مجدد
                  </Button>
                  <Button
                    variant="brand"
                    size="sm"
                    className="gap-1.5"
                    disabled={!canSendForApproval || sendMut.isPending}
                    title={sendBlockReason || undefined}
                    onClick={() => setSendConfirmOpen(true)}
                  >
                    {sendMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    ارسال برای تأیید مشتری
                  </Button>
                </div>
              </div>

              {selected.status === "REVISION_REQUESTED" &&
                selected.rejectionReason && (
                  <div className={cn("mx-4 mt-4 flex gap-3 px-3.5 py-3 sm:mx-5", ALERT_BANNER)}>
                    <MessageSquareWarning className={cn("mt-0.5 h-4 w-4 shrink-0", ALERT_ICON)} />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">بازخورد مشتری برای این نسخه</p>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {selected.rejectionReason}
                      </p>
                      <button
                        type="button"
                        className="text-xs font-medium text-brand underline-offset-2 hover:underline"
                        onClick={() => setWorkspacePanel("feedback")}
                      >
                        مشاهده همه بازخوردها
                      </button>
                    </div>
                  </div>
                )}

              {selected.status === "PENDING_CUSTOMER_APPROVAL" &&
                selected.publishedToClient && (
                <div className="mx-4 mt-4 rounded-xl border border-brand/20 bg-brand/5 px-3.5 py-3 text-sm text-foreground sm:mx-5">
                  این نسخه برای مشتری ارسال شده و در انتظار تأیید است.
                  {selected.publishedAt && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      ارسال‌شده در {formatDate(selected.publishedAt)}
                    </span>
                  )}
                </div>
              )}

              {selected.status === "PENDING_CUSTOMER_APPROVAL" &&
                !selected.publishedToClient && (
                <div className="mx-4 mt-4 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground sm:mx-5">
                  این نسخه قبلاً برای مشتری ارسال شده بود. می‌توانید دوباره
                  ارسال کنید تا در پورتال مشتری فعال شود.
                </div>
              )}

              {selected.status === "SUPERSEDED" && (
                <div className="mx-4 mt-4 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground sm:mx-5">
                  این نسخه در بایگانی است و هنوز برای مشتری ارسال نشده یا نسخه
                  جدیدتری جایگزین آن شده است. در صورت نیاز می‌توانید همین نسخه را
                  برای تأیید مشتری ارسال کنید.
                </div>
              )}

              <div
                className={cn(
                  getCustomTabListClass("line"),
                  "items-center gap-1 px-3 sm:px-4",
                )}
              >
                <div
                  role="tablist"
                  aria-label="بخش‌های محتوا"
                  className="flex min-w-0 flex-1 items-center gap-0 border-0 bg-transparent p-0 shadow-none"
                >
                  {(
                    [
                      ["scenario", "سناریو"],
                      ["narration", "نریشن"],
                      ["storyboard", "استوری‌بورد"],
                    ] as const
                  ).map(([id, label]) => {
                    const active = contentTab === id && !showRawJson;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setContentTab(id);
                          setShowRawJson(false);
                        }}
                        className={getCustomTabTriggerClass(
                          active,
                          "line",
                          "text-sm",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRawJson((v) => !v)}
                  className={cn(
                    "mb-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                    showRawJson
                      ? "bg-brand/10 font-medium text-brand"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <Code2 className="h-3 w-3" />
                  JSON
                </button>
              </div>

              <div className="min-h-[24rem] flex-1 overflow-auto p-4 sm:p-6">
                {showRawJson ? (
                  <pre
                    className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground"
                    dir="ltr"
                  >
                    {prettyJson(stripTechnicalFields(contentValue)) || "—"}
                  </pre>
                ) : (
                  <ContentBlocks
                    value={contentValue}
                    dir={
                      contentTab === "narration"
                        ? narrationDir
                        : contentTab === "storyboard"
                          ? "ltr"
                          : "rtl"
                    }
                  />
                )}
              </div>
            </>
          )}
        </section>
      </div>
      )}

      <Dialog
        open={sendConfirmOpen}
        onOpenChange={(open) => {
          if (!sendMut.isPending) setSendConfirmOpen(open);
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ارسال برای تأیید مشتری</DialogTitle>
            <DialogDescription className="leading-6">
              {selected
                ? `نسخه ${selected.versionNumber.toLocaleString("fa-AF", { numberingSystem: "latn" })} برای مشتری ارسال می‌شود و وضعیت آن به «در انتظار تأیید مشتری» تغییر می‌کند.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={sendMut.isPending}
              onClick={() => setSendConfirmOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="brand"
              className="gap-2"
              disabled={sendMut.isPending || !selected}
              onClick={() => {
                if (selected) sendMut.mutate(selected.id);
              }}
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

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteMut.isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حذف نسخه</DialogTitle>
            <DialogDescription className="leading-6">
              {deleteTarget
                ? `نسخه ${deleteTarget.versionNumber.toLocaleString("fa-AF", { numberingSystem: "latn" })} برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={deleteMut.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={deleteMut.isPending || !deleteTarget}
              onClick={() => {
                if (deleteTarget) deleteMut.mutate(deleteTarget.id);
              }}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف نسخه
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>ویرایش محتوا</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {[
              ["سناریو", editScenario, setEditScenario],
              ["نریشن", editNarration, setEditNarration],
              ["استوری‌بورد", editStoryboard, setEditStoryboard],
            ].map(([label, value, setter]) => (
              <div key={label as string} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {label as string} (JSON)
                </p>
                <Textarea
                  className="min-h-[100px] font-mono text-xs"
                  dir="ltr"
                  value={value as string}
                  onChange={(e) =>
                    (setter as (v: string) => void)(e.target.value)
                  }
                />
              </div>
            ))}
            <Button
              variant="brand"
              className="w-full gap-2"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              ذخیره پیش‌نویس
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              مقایسه نسخه‌ها
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["چپ", compareLeft, setCompareLeft],
              ["راست", compareRight, setCompareRight],
            ].map(([label, value, setter]) => (
              <div key={label as string} className="space-y-2">
                <p className="text-xs text-muted-foreground">{label as string}</p>
                <Select
                  value={value as string}
                  onValueChange={setter as (v: string) => void}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        نسخه {v.versionNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {compareQ.data && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(["left", "right"] as const).map((side) => {
                const v = compareQ.data![side];
                return (
                  <div key={side} className="space-y-2 rounded-xl border p-3">
                    <p className="text-sm font-semibold">
                      نسخه {v.versionNumber}
                    </p>
                    <ContentBlocks value={v.scenario} />
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
