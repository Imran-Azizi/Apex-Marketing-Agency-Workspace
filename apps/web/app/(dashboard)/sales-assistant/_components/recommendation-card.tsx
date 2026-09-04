"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toEnglishDigits } from "@/lib/utils";
import type { SalesAssistantRecommendation } from "./types";
import { PRIORITY_LABELS, customerLabel, formatCount } from "./types";

function priorityVariant(priority: string) {
  if (priority === "HIGH") return "destructive" as const;
  if (priority === "MEDIUM") return "warning" as const;
  return "secondary" as const;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <span className="font-medium text-foreground">{label}: </span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

export function RecommendationCard({
  rec,
  onAct,
  acting,
  canAct,
}: {
  rec: SalesAssistantRecommendation;
  canAct?: boolean;
  acting?: boolean;
  onAct?: (action: "DONE" | "DISMISSED" | "IN_PROGRESS") => void;
}) {
  const name = customerLabel(rec);
  const days =
    rec.daysInStage != null
      ? toEnglishDigits(String(Math.round(Number(rec.daysInStage) * 10) / 10))
      : null;

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold leading-relaxed">{name}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={priorityVariant(rec.priority)}>
                اولویت {PRIORITY_LABELS[rec.priority] || rec.priority}
              </Badge>
              <Badge variant="outline">{rec.pipelineStageLabel}</Badge>
              <Badge variant="secondary">{rec.kindLabel}</Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <Field label="وضعیت فروش">{rec.pipelineStageLabel}</Field>
          {rec.whatHappened ? (
            <Field label="چه اتفاقی افتاده">
              {toEnglishDigits(rec.whatHappened)}
            </Field>
          ) : null}
          <Field label="چرا مهم است">{toEnglishDigits(rec.reason)}</Field>
          <Field label="پیشنهاد اقدام">
            {toEnglishDigits(rec.recommendedAction)}
          </Field>
          {days != null ? (
            <Field label="مدت در این وضعیت">{`${days} روز`}</Field>
          ) : null}
          <Field label="زمان پیشنهادی پیگیری">
            {rec.suggestedFollowUp || "به زودی"}
          </Field>
        </div>

        {rec.suggestedMessage ? (
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="mb-1 font-medium">نمونه پیام</p>
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {toEnglishDigits(rec.suggestedMessage)}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {rec.customer ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/crm/${rec.customer.id}`}>مشاهده مشتری</Link>
            </Button>
          ) : null}
          {canAct && onAct ? (
            <>
              <Button
                size="sm"
                disabled={acting}
                onClick={() => onAct("IN_PROGRESS")}
              >
                پیگیری مشتری
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={acting}
                onClick={() => onAct("DONE")}
              >
                انجام شد
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={acting}
                onClick={() => onAct("DISMISSED")}
              >
                رد
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "urgent" | "follow" | "opportunity" | "neutral";
}) {
  const toneClass =
    tone === "urgent"
      ? "border-destructive/30 bg-destructive/5"
      : tone === "follow"
        ? "border-amber-500/30 bg-amber-500/5"
        : tone === "opportunity"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/70 bg-card";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" dir="ltr">
        {formatCount(value)}
      </p>
    </div>
  );
}
