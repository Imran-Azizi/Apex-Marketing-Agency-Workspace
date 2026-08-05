"use client";

import { Badge } from "@/components/ui/badge";
import { CreateProjectButton } from "@/components/portal/create-project-button";
import { formatPersianDateLong } from "@/lib/portal-dashboard";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  customerName: string;
  canCreateProject: boolean;
  accountStatus?: string;
  className?: string;
};

export function DashboardHeader({
  customerName,
  canCreateProject,
  accountStatus = "حساب فعال",
  className,
}: DashboardHeaderProps) {
  const firstName = customerName.trim().split(/\s+/)[0] || customerName;

  return (
    <div
      dir="rtl"
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-bl from-card via-card to-brand/[0.06] p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className="pointer-events-none absolute -start-16 -top-16 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -end-10 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2 text-start">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="h-6 border-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              {accountStatus}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatPersianDateLong()}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            خوش آمدید {firstName}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            مرکز کنترل پروژه‌ها، پرداخت‌ها و به‌روزرسانی‌های حساب{" "}
            <span className="font-medium text-foreground">{customerName}</span>
          </p>
        </div>

        <CreateProjectButton
          canCreate={canCreateProject}
          size="lg"
          className="h-11 shrink-0 px-5 text-sm font-semibold shadow-md shadow-brand/20"
        />
      </div>
    </div>
  );
}
