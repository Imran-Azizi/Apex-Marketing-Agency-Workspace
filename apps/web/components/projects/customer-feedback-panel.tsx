"use client";

import { formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  MessageSquareWarning,
  Send,
  Clock3,
} from "lucide-react";
import {
  ALERT_BANNER,
  ALERT_ICON,
  STATUS_PIGMENT,
  SUCCESS_ICON,
} from "@/lib/theme-tones";

export type CustomerFeedbackItem = {
  id: string;
  body: string;
  createdAt: string;
  contentVersion?: {
    id: string;
    versionNumber: number;
    status: string;
  } | null;
};

export type ApprovalTimelineItem = {
  id: string;
  type: string;
  decision: string;
  comment?: string | null;
  actorType: string;
  createdAt: string;
  contentVersionId?: string | null;
};

const DECISION_LABEL: Record<string, string> = {
  APPROVED: "تأیید",
  CHANGES_REQUESTED: "درخواست اصلاح",
  REJECTED: "رد",
  RETURNED: "بازگشت",
};

export function CustomerFeedbackPanel({
  feedback,
  timeline,
  onSelectVersion,
}: {
  feedback: CustomerFeedbackItem[];
  timeline: ApprovalTimelineItem[];
  onSelectVersion?: (versionId: string) => void;
}) {
  const hasFeedback = feedback.length > 0;
  const hasTimeline = timeline.length > 0;

  if (!hasFeedback && !hasTimeline) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
        <MessageSquareWarning className="h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm font-medium">هنوز بازخورد مشتری ثبت نشده</p>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          پس از ارسال محتوا و پاسخ مشتری، بازخورد و تاریخچه تأیید اینجا نمایش داده
          می‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {hasFeedback && (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold">بازخورد مشتری</h4>
          <ul className="space-y-3">
            {feedback.map((item) => (
              <li
                key={item.id}
                className={cn("p-4", ALERT_BANNER)}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {item.contentVersion && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand hover:underline"
                      onClick={() =>
                        item.contentVersion &&
                        onSelectVersion?.(item.contentVersion.id)
                      }
                    >
                      نسخه{" "}
                      {item.contentVersion.versionNumber.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                    </button>
                  )}
                  <Badge variant="warning" className="font-normal">
                    درخواست اصلاح
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {item.body}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  پس از اعمال تغییرات، نسخه جدید بسازید یا بازتولید کنید و دوباره
                  برای مشتری ارسال کنید.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasTimeline && (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold">تاریخچه تأیید</h4>
          <ol className="relative space-y-0 border-s border-border/70 ms-3">
            {timeline.map((event) => {
              const isApprove = event.decision === "APPROVED";
              const isRevision = event.decision === "CHANGES_REQUESTED";
              return (
                <li key={event.id} className="relative pb-5 ps-5 last:pb-0">
                  <span
                    className={cn(
                      "absolute -start-[7px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-background",
                      isApprove
                        ? STATUS_PIGMENT.success
                        : isRevision
                          ? STATUS_PIGMENT.warning
                          : "bg-muted-foreground/50",
                    )}
                  />
                  <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isApprove ? (
                        <CheckCircle2 className={cn("h-3.5 w-3.5", SUCCESS_ICON)} />
                      ) : isRevision ? (
                        <MessageSquareWarning className={cn("h-3.5 w-3.5", ALERT_ICON)} />
                      ) : event.type === "MANAGER_CONTENT" ? (
                        <Send className="h-3.5 w-3.5 text-brand" />
                      ) : (
                        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <p className="text-sm font-medium">
                        {event.type === "MANAGER_CONTENT"
                          ? "ارسال توسط مدیر"
                          : "اقدام مشتری"}
                        {" — "}
                        {DECISION_LABEL[event.decision] || event.decision}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                    {event.comment && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {event.comment}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
