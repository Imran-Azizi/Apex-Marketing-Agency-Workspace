"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type FinancialCardProps = {
  title: string;
  amount: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  status?: string;
  statusTone?: "neutral" | "success" | "warning" | "brand";
  highlight?: boolean;
  className?: string;
};

const statusToneClass: Record<
  NonNullable<FinancialCardProps["statusTone"]>,
  string
> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  brand: "bg-brand/10 text-brand",
};

export function FinancialCard({
  title,
  amount,
  icon: Icon,
  iconClassName,
  status,
  statusTone = "neutral",
  highlight,
  className,
}: FinancialCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-all duration-200 hover:border-brand/20 hover:shadow-md",
        highlight && "border-brand/30 bg-brand/[0.03] ring-1 ring-brand/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            iconClassName ?? "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {status && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              statusToneClass[statusTone],
            )}
          >
            {status}
          </span>
        )}
      </div>
      <p className="mt-3 text-[11px] font-medium text-muted-foreground">{title}</p>
      <p
        className={cn(
          "mt-1 truncate text-lg font-bold tracking-tight",
          highlight && "text-brand",
        )}
      >
        <bdi dir="ltr" className="inline-block max-w-full truncate">
          {amount}
        </bdi>
      </p>
    </div>
  );
}
