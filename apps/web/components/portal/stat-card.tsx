"use client";

import type { ComponentType } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  trend?: string;
  className?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-md",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-transparent via-brand/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconClassName ?? "bg-brand/10 text-brand",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
        {typeof value === "number"
          ? value.toLocaleString("fa-AF", { numberingSystem: "latn" })
          : value}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
