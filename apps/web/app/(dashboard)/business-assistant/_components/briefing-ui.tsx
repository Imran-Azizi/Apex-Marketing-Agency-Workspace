"use client";

import { Badge } from "@/components/ui/badge";
import type { BriefingAction, BusinessAssistantPriority } from "./types";
import { PRIORITY_LABELS } from "./types";
import { withEnglishDigits } from "./display";

function priorityVariant(priority?: string) {
  if (priority === "HIGH") return "destructive" as const;
  if (priority === "MEDIUM") return "warning" as const;
  return "secondary" as const;
}

export function ActionItem({ action }: { action: BriefingAction }) {
  const priority = (action.priority || "MEDIUM") as BusinessAssistantPriority;
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="font-medium leading-relaxed">
          {withEnglishDigits(action.title || action.what)}
        </p>
        <Badge variant={priorityVariant(priority)}>
          اولویت {PRIORITY_LABELS[priority] || priority}
        </Badge>
        {action.timeframe ? (
          <Badge variant="outline">{withEnglishDigits(action.timeframe)}</Badge>
        ) : null}
      </div>
      <dl className="space-y-1.5 text-muted-foreground">
        <div>
          <dt className="inline font-medium text-foreground">چه کاری: </dt>
          <dd className="inline">{withEnglishDigits(action.what)}</dd>
        </div>
        {action.why ? (
          <div>
            <dt className="inline font-medium text-foreground">چرا: </dt>
            <dd className="inline">{withEnglishDigits(action.why)}</dd>
          </div>
        ) : null}
        {action.problemOrOpportunity ? (
          <div>
            <dt className="inline font-medium text-foreground">مسئله / فرصت: </dt>
            <dd className="inline">
              {withEnglishDigits(action.problemOrOpportunity)}
            </dd>
          </div>
        ) : null}
        {action.impact ? (
          <div>
            <dt className="inline font-medium text-foreground">اثر مورد انتظار: </dt>
            <dd className="inline">{withEnglishDigits(action.impact)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function BulletCard({
  title,
  items,
  empty,
  tone,
}: {
  title: React.ReactNode;
  items?: string[];
  empty?: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const border =
    tone === "good"
      ? "border-emerald-500/30"
      : tone === "warn"
        ? "border-amber-500/30"
        : "border-border/70";
  return (
    <section className={`rounded-lg border bg-card p-4 ${border}`}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items?.length ? (
        <ul className="list-inside list-disc space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>{withEnglishDigits(item)}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {empty || "موردی ثبت نشده است."}
        </p>
      )}
    </section>
  );
}
