"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check,
  CheckCircle2,
  Clapperboard,
  FileText,
  MessageSquare,
  Mic2,
  Sparkles,
} from "lucide-react";
import {
  NarrationFinalView,
  ScenarioFinalView,
  StoryboardFinalView,
} from "@/components/projects/ai-content-views";

export type PortalContentVersion = {
  id: string;
  kind: string;
  versionNumber: number;
  status?: string;
  isLocked: boolean;
  publishedAt: string | null;
  publishedToClient?: boolean;
  scenario?: unknown;
  narration?: unknown;
  storyboard?: unknown;
  rejectionReason?: string | null;
  changeNotes?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_CUSTOMER_APPROVAL: "در انتظار تأیید شما",
  APPROVED: "تأییدشده",
  REVISION_REQUESTED: "درخواست اصلاح",
};

function statusVariant(
  status?: string,
): "brand" | "success" | "warning" | "secondary" | "destructive" {
  if (status === "APPROVED") return "success";
  if (status === "PENDING_CUSTOMER_APPROVAL") return "warning";
  if (status === "REVISION_REQUESTED") return "destructive";
  return "secondary";
}

function isCustomerVisibleVersion(v: PortalContentVersion): boolean {
  if (v.status === "SUPERSEDED") return false;
  if (v.publishedToClient === false) return false;
  return (
    v.publishedToClient === true ||
    v.status === "PENDING_CUSTOMER_APPROVAL" ||
    v.status === "APPROVED" ||
    v.status === "REVISION_REQUESTED"
  );
}

function ScenarioPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  return <ScenarioFinalView value={value} dir="rtl" embedded />;
}

function NarrationPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const lang = typeof obj?.language === "string" ? obj.language : "";
  const dir = lang.startsWith("en") ? "ltr" : "rtl";
  return <NarrationFinalView value={value} dir={dir} embedded />;
}

function StoryboardPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  return <StoryboardFinalView value={value} embedded />;
}

type ContentSectionId = "scenario" | "narration" | "storyboard";

const SECTION_META: Record<
  ContentSectionId,
  { label: string; icon: typeof FileText }
> = {
  scenario: { label: "سناریو", icon: FileText },
  narration: { label: "نریشن", icon: Mic2 },
  storyboard: { label: "استوری‌بورد", icon: Clapperboard },
};

function ContentSectionsTabs({
  scenario,
  narration,
  storyboard,
}: {
  scenario?: unknown;
  narration?: unknown;
  storyboard?: unknown;
}) {
  const sections = useMemo(() => {
    const next: Array<{ id: ContentSectionId; node: ReactNode }> = [];
    if (scenario != null) {
      next.push({
        id: "scenario",
        node: <ScenarioPreview value={scenario} />,
      });
    }
    if (narration != null) {
      next.push({
        id: "narration",
        node: <NarrationPreview value={narration} />,
      });
    }
    if (storyboard != null) {
      next.push({
        id: "storyboard",
        node: <StoryboardPreview value={storyboard} />,
      });
    }
    return next;
  }, [scenario, narration, storyboard]);

  const [tab, setTab] = useState<string>(sections[0]?.id ?? "scenario");
  const activeTab = sections.some((s) => s.id === tab)
    ? tab
    : (sections[0]?.id ?? "scenario");

  if (sections.length === 0) return null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={setTab}
      dir="rtl"
      className="min-w-0 space-y-3"
    >
      <TabsList
        variant="segmented"
        aria-label="بخش‌های محتوا برای تأیید"
        className={cn(
          "grid h-11 w-full",
          sections.length === 1 && "grid-cols-1",
          sections.length === 2 && "grid-cols-2",
          sections.length >= 3 && "grid-cols-3",
        )}
      >
        {sections.map((s) => {
          const meta = SECTION_META[s.id];
          const Icon = meta.icon;
          return (
            <TabsTrigger
              key={s.id}
              value={s.id}
              variant="segmented"
              className="gap-1.5 px-1.5 text-[11px] sm:px-3 sm:text-sm"
            >
              <Icon className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
              {meta.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {sections.map((s) => (
        <TabsContent
          key={s.id}
          value={s.id}
          className="mt-0 min-w-0 rounded-xl border border-border/60 bg-background/80 p-3.5 focus-visible:ring-0 sm:p-4"
        >
          {s.node}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function PortalContentApproval({
  versions,
  revisionUsed,
  revisionMax,
  onApprove,
  onRequestRevision,
  approving,
  requesting,
}: {
  versions: PortalContentVersion[];
  revisionUsed: number;
  revisionMax: number;
  onApprove: (versionId: string) => void;
  onRequestRevision: (payload: {
    versionId: string;
    reason: string;
    body: string;
  }) => void | Promise<void>;
  approving?: boolean;
  requesting?: boolean;
}) {
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Portal only shows content the manager sent — never drafts or بایگانی.
  const visible = useMemo(
    () =>
      [...versions]
        .filter(isCustomerVisibleVersion)
        .sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  );

  const pending = visible.filter(
    (v) =>
      v.status === "PENDING_CUSTOMER_APPROVAL" ||
      (!v.status && !v.isLocked),
  );

  // When something awaits approval, show only that package.
  // Otherwise show the latest sent package (approved / revision).
  const activePackages =
    pending.length > 0
      ? pending
      : visible.length > 0
        ? [visible[0]]
        : [];

  const openRevision = (id: string) => {
    setTargetId(id);
    setReason("");
    setBody("");
    setRevisionOpen(true);
  };

  const submitRevision = async () => {
    if (!targetId || !body.trim()) return;
    setSubmitting(true);
    try {
      await onRequestRevision({
        versionId: targetId,
        reason: reason.trim(),
        body: body.trim(),
      });
      setRevisionOpen(false);
      setReason("");
      setBody("");
      setTargetId(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (activePackages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-6 py-14 text-center">
        <Sparkles className="h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm font-medium">هنوز محتوایی برای تأیید ارسال نشده</p>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          پس از ارسال توسط مدیر پروژه، سناریو، نریشن و استوری‌بورد اینجا نمایش داده
          می‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">تأیید محتوا</h3>
          <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
            محتوایی که مدیر برای شما ارسال کرده را بازبینی کنید
          </p>
        </div>
        <Badge variant="outline" className="font-normal tabular-nums">
          اصلاح{" "}
          {revisionUsed.toLocaleString("fa-AF", { numberingSystem: "latn" })}/
          {revisionMax.toLocaleString("fa-AF", { numberingSystem: "latn" })}
        </Badge>
      </div>

      {activePackages.map((v) => {
        const awaitingDecision =
          v.status === "PENDING_CUSTOMER_APPROVAL" ||
          (!v.status && !v.isLocked);
        const approved = v.status === "APPROVED";

        return (
          <section
            key={v.id}
            id={`content-approval-${v.id}`}
            className={cn(
              "space-y-3 rounded-2xl border bg-card p-3.5 shadow-sm sm:space-y-4 sm:p-5",
              awaitingDecision
                ? "border-brand/25"
                : approved
                  ? "border-emerald-500/25"
                  : "border-border/70",
            )}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">
                  نسخه{" "}
                  {v.versionNumber.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}
                </h4>
                <Badge
                  variant={statusVariant(v.status)}
                  className="font-normal"
                >
                  {STATUS_LABEL[v.status || "PENDING_CUSTOMER_APPROVAL"] ||
                    "ارسال‌شده توسط مدیر"}
                </Badge>
                {awaitingDecision ? (
                  <Badge
                    variant="brand"
                    className="hidden font-normal sm:inline-flex"
                  >
                    ارسال‌شده برای تأیید
                  </Badge>
                ) : null}
                {approved ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    تأیید شما ثبت شد
                  </span>
                ) : null}
              </div>
              {v.publishedAt ? (
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {awaitingDecision
                    ? `ارسال‌شده برای تأیید در ${formatDate(v.publishedAt)}`
                    : `ارسال‌شده در ${formatDate(v.publishedAt)}`}
                </p>
              ) : null}
              {v.changeNotes ? (
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {v.changeNotes}
                </p>
              ) : null}
              {v.rejectionReason ? (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3.5 py-3 text-sm leading-7 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {v.rejectionReason}
                </div>
              ) : null}

              {awaitingDecision ? (
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button
                    size="sm"
                    variant="brand"
                    className="h-10 gap-1.5 sm:h-9"
                    disabled={approving || requesting || submitting}
                    onClick={() => onApprove(v.id)}
                  >
                    <Check className="h-4 w-4" />
                    تأیید
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 gap-1.5 sm:h-9"
                    disabled={approving || requesting || submitting}
                    onClick={() => openRevision(v.id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    درخواست اصلاح
                  </Button>
                </div>
              ) : null}
            </div>

            <ContentSectionsTabs
              scenario={v.scenario}
              narration={v.narration}
              storyboard={v.storyboard}
            />
          </section>
        );
      })}

      <Dialog
        open={revisionOpen}
        onOpenChange={(open) => {
          if (!requesting) setRevisionOpen(open);
        }}
      >
        <DialogContent dir="rtl" className="text-start sm:max-w-md">
          <DialogHeader className="space-y-1 text-start sm:text-start">
            <DialogTitle>درخواست اصلاح</DialogTitle>
            <DialogDescription className="leading-6">
              لطفاً دلیل و توضیحات تغییرات را وارد کنید. بدون بازخورد امکان ارسال
              وجود ندارد.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="revision-reason">دلیل اصلاح</Label>
              <Input
                id="revision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثلاً: تغییر CTA یا لحن نریشن"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revision-body">توضیحات / بازخورد</Label>
              <Textarea
                id="revision-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="تغییرات مورد نظر را با جزئیات بنویسید..."
                className={cn(!body.trim() && "border-destructive/40")}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={requesting || submitting}
              onClick={() => setRevisionOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={requesting || submitting || !body.trim()}
              onClick={() => void submitRevision()}
            >
              ارسال درخواست اصلاح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
