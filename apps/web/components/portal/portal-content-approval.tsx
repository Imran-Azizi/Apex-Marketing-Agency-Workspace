"use client";

import { useState, type ReactNode } from "react";
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
import {
  Check,
  CheckCircle2,
  Clock3,
  MessageSquare,
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
  SUPERSEDED: "بایگانی",
};

function statusVariant(
  status?: string,
): "brand" | "success" | "warning" | "secondary" | "destructive" {
  if (status === "APPROVED") return "success";
  if (status === "PENDING_CUSTOMER_APPROVAL") return "warning";
  if (status === "REVISION_REQUESTED") return "destructive";
  return "secondary";
}

function ScenarioPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  return <ScenarioFinalView value={value} dir="rtl" />;
}

function NarrationPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const lang = typeof obj?.language === "string" ? obj.language : "";
  const dir = lang.startsWith("en") ? "ltr" : "rtl";
  return <NarrationFinalView value={value} dir={dir} />;
}

function StoryboardPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  return <StoryboardFinalView value={value} />;
}

function ContentBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">{title}</p>
      {children}
    </div>
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

  const pending = versions.filter(
    (v) =>
      v.status === "PENDING_CUSTOMER_APPROVAL" ||
      (!v.status && !v.isLocked),
  );
  const history = versions.filter((v) => !pending.some((p) => p.id === v.id));

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

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-6 py-14 text-center">
        <Sparkles className="h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm font-medium">هنوز محتوایی برای تأیید ارسال نشده</p>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          پس از آماده‌سازی توسط تیم APEX، سناریو، نریشن و استوری‌بورد اینجا نمایش
          داده می‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">تأیید محتوا</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            بازبینی سناریو، نریشن و استوری‌بورد و ثبت تأیید یا درخواست اصلاح
          </p>
        </div>
        <Badge variant="outline" className="font-normal tabular-nums">
          اصلاح {revisionUsed.toLocaleString("fa-AF", { numberingSystem: "latn" })}/
          {revisionMax.toLocaleString("fa-AF", { numberingSystem: "latn" })}
        </Badge>
      </div>

      {pending.length === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-6 text-muted-foreground">
            در حال حاضر محتوایی در انتظار تأیید شما نیست. نسخه‌های قبلی در پایین
            قابل مشاهده هستند.
          </p>
        </div>
      )}

      {pending.map((v) => (
        <section
          key={v.id}
          id={`content-approval-${v.id}`}
          className="space-y-4 rounded-2xl border border-brand/25 bg-card p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">
                  نسخه {v.versionNumber.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                </h4>
                <Badge variant={statusVariant(v.status)} className="font-normal">
                  {STATUS_LABEL[v.status || "PENDING_CUSTOMER_APPROVAL"] ||
                    "در انتظار تأیید شما"}
                </Badge>
                <Badge variant="brand" className="font-normal">
                  نسخه ارسالی فعال
                </Badge>
              </div>
              {v.publishedAt && (
                <p className="text-xs text-muted-foreground">
                  ارسال‌شده برای تأیید در {formatDate(v.publishedAt)}
                </p>
              )}
              {v.changeNotes && (
                <p className="text-xs text-muted-foreground">{v.changeNotes}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="brand"
                className="gap-1.5"
                disabled={approving || requesting || submitting}
                onClick={() => onApprove(v.id)}
              >
                <Check className="h-4 w-4" />
                تأیید
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={approving || requesting || submitting}
                onClick={() => openRevision(v.id)}
              >
                <MessageSquare className="h-4 w-4" />
                درخواست اصلاح
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {v.scenario != null && (
              <ContentBlock title="سناریو">
                <ScenarioPreview value={v.scenario} />
              </ContentBlock>
            )}
            {v.narration != null && (
              <ContentBlock title="نریشن">
                <NarrationPreview value={v.narration} />
              </ContentBlock>
            )}
            {v.storyboard != null && (
              <ContentBlock title="استوری‌بورد">
                <StoryboardPreview value={v.storyboard} />
              </ContentBlock>
            )}
          </div>
        </section>
      ))}

      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            تاریخچه نسخه‌ها
          </p>
          {history.map((v) => (
            <section
              key={v.id}
              className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    نسخه {v.versionNumber.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                  </p>
                  <Badge
                    variant={statusVariant(v.status)}
                    className="font-normal"
                  >
                    {STATUS_LABEL[v.status || ""] || v.status || "—"}
                  </Badge>
                  {v.status === "APPROVED" && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تأیید مشتری
                    </span>
                  )}
                </div>
                {v.publishedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    {v.status === "PENDING_CUSTOMER_APPROVAL" && v.publishedToClient
                      ? `ارسال‌شده برای تأیید در ${formatDate(v.publishedAt)}`
                      : `ارسال‌شده در ${formatDate(v.publishedAt)}`}
                  </p>
                )}
              </div>
              {v.rejectionReason && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3.5 py-3 text-sm leading-7 text-amber-950">
                  {v.rejectionReason}
                </div>
              )}
              <div className="grid gap-3">
                {v.scenario != null && (
                  <ContentBlock title="سناریو">
                    <ScenarioPreview value={v.scenario} />
                  </ContentBlock>
                )}
                {v.narration != null && (
                  <ContentBlock title="نریشن">
                    <NarrationPreview value={v.narration} />
                  </ContentBlock>
                )}
                {v.storyboard != null && (
                  <ContentBlock title="استوری‌بورد">
                    <StoryboardPreview value={v.storyboard} />
                  </ContentBlock>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

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
