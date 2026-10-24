"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, type TaskStats } from "./types";

const CARDS = [
  {
    key: "total" as const,
    label: "کل وظایف",
    icon: ClipboardList,
    accent: "text-brand bg-brand/10 border-brand/25",
  },
  {
    key: "pending" as const,
    label: "در انتظار پذیرش",
    icon: Hourglass,
    accent: "text-muted-foreground bg-muted border-border",
  },
  {
    key: "inProgress" as const,
    label: "در حال انجام",
    icon: Loader2,
    accent: "text-amber-700 bg-warning/15 border-warning/25 dark:text-amber-300",
  },
  {
    key: "completed" as const,
    label: "در انتظار تأیید",
    icon: Clock3,
    accent: "text-sky-700 bg-sky-500/10 border-sky-500/20 dark:text-sky-300",
  },
  {
    key: "approved" as const,
    label: "تکمیل‌شده",
    icon: CheckCircle2,
    accent: "text-success bg-success/10 border-success/20",
  },
  {
    key: "overdue" as const,
    label: "گذشته از مهلت",
    icon: AlertTriangle,
    accent: "text-destructive bg-destructive/10 border-destructive/20",
  },
] as const;

export function TaskStatsCards({
  stats,
  loading,
  onSelect,
  activeKey,
}: {
  stats?: TaskStats | null;
  loading?: boolean;
  onSelect?: (key: (typeof CARDS)[number]["key"] | null) => void;
  activeKey?: string | null;
}) {
  if (loading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.25rem] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];
        const active = activeKey === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelect?.(active ? null : card.key)}
            className={cn(
              "group flex w-full items-center justify-start gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-start",
              "shadow-sm transition-all duration-200",
              "hover:-translate-y-px hover:border-brand/25 hover:shadow-md",
              active && "border-brand/40 ring-2 ring-brand/20",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                card.accent,
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-start">
              <p className="text-[11px] font-medium text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-0.5 text-[1.55rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {formatCount(value)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
