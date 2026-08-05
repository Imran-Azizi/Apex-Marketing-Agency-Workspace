"use client";

import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  CircleDot,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { cn, formatDate, formatTime } from "@/lib/utils";
import {
  getProjectStatusLabel,
} from "@/lib/project-status";
import { resolveCurrentStageLabel } from "@/lib/project-progress";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { computeManagerMetrics, assigneeName } from "./compute-metrics";
import {
  EmptyInline,
  KpiCard,
  KpiSkeletonGrid,
  PriorityDot,
  SectionShell,
} from "./widgets";
import type {
  DashboardSummary,
  DatePreset,
  DateRange,
  ManagerProject,
} from "./types";

const BusinessCharts = lazy(() =>
  import("./charts").then((m) => ({ default: m.BusinessCharts })),
);

const FINANCE_ICONS: LucideIcon[] = [
  Wallet,
  TrendingUp,
  Banknote,
  Receipt,
  Activity,
  PiggyBank,
];

const PROJECT_KPI_ICONS: LucideIcon[] = [
  FolderKanban,
  Activity,
  CheckCircle2,
  Clock3,
  CircleDot,
];

function useNowClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function DateFilters({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (next: DateRange) => void;
}) {
  const presets: Array<{ key: DatePreset; label: string }> = [
    { key: "all", label: "همه" },
    { key: "today", label: "امروز" },
    { key: "week", label: "این هفته" },
    { key: "month", label: "این ماه" },
    { key: "year", label: "امسال" },
    { key: "custom", label: "بازه سفارشی" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="فیلتر بازه زمانی داشبورد"
      >
        {presets.map((p) => (
          <Button
            key={p.key}
            type="button"
            size="sm"
            variant={range.preset === p.key ? "brand" : "outline"}
            className="rounded-full"
            aria-pressed={range.preset === p.key}
            onClick={() =>
              onChange({
                preset: p.key,
                from: p.key === "custom" ? range.from : null,
                to: p.key === "custom" ? range.to : null,
              })
            }
          >
            {p.label}
          </Button>
        ))}
      </div>
      {range.preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            از تاریخ
            <Input
              type="date"
              className="h-9 w-auto"
              value={range.from ? range.from.toISOString().slice(0, 10) : ""}
              onChange={(e) =>
                onChange({
                  ...range,
                  from: e.target.value ? new Date(e.target.value) : null,
                })
              }
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            تا تاریخ
            <Input
              type="date"
              className="h-9 w-auto"
              value={range.to ? range.to.toISOString().slice(0, 10) : ""}
              onChange={(e) =>
                onChange({
                  ...range,
                  to: e.target.value ? new Date(e.target.value) : null,
                })
              }
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function ManagerDashboard() {
  const now = useNowClock();
  const [range, setRange] = useState<DateRange>({
    preset: "all",
    from: null,
    to: null,
  });

  const me = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const summary = useQuery({
    queryKey: ["dashboard-summary", "MANAGER"],
    queryFn: () => apiGet<DashboardSummary>("/projects/dashboard-summary"),
  });

  const projects = useQuery({
    queryKey: ["projects-home", "MANAGER"],
    queryFn: () => apiGet<ManagerProject[]>("/projects"),
  });

  const metrics = useMemo(() => {
    if (!projects.data) return null;
    return computeManagerMetrics({
      projects: projects.data,
      summary: summary.data,
      range,
    });
  }, [projects.data, summary.data, range]);

  const isLoading = projects.isLoading || summary.isLoading;
  const isError = projects.isError && !projects.data;

  const managerName = me.data?.fullName || "مدیر";
  const systemOk = !projects.isError && !summary.isError;

  if (isError) {
    return (
      <EmptyState
        title="بارگذاری داشبورد ناموفق بود"
        description="اتصال به سرور برقرار نشد. صفحه را تازه‌سازی کنید."
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-slide sm:space-y-6" dir="rtl">
      <header className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                داشبورد مدیریت
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  systemOk
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-destructive/30 bg-destructive/10 text-destructive",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    systemOk ? "bg-emerald-500" : "bg-destructive",
                  )}
                  aria-hidden
                />
                {systemOk ? "سیستم آنلاین" : "خطا در همگام‌سازی"}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
              خوش آمدید، {managerName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(now)} · {formatTime(now)}
            </p>
          </div>
          <DateFilters range={range} onChange={setRange} />
        </div>
      </header>

      {isLoading ? (
        <SectionShell
          title="نمای مالی"
          description="خلاصه اجرایی درآمد، دریافت و سود"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-2xl" />
            ))}
          </div>
        </SectionShell>
      ) : metrics?.finance?.available ? (
        <SectionShell
          title="نمای مالی"
          description="خلاصه اجرایی درآمد، دریافت و سود — فقط پرداخت‌های تأییدشده"
          className="border-brand/15 bg-gradient-to-bl from-brand/[0.06] via-card to-card"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.finance.cards.map((card, i) => (
              <KpiCard
                key={card.key}
                metric={card}
                icon={FINANCE_ICONS[i % FINANCE_ICONS.length]}
              />
            ))}
          </div>
        </SectionShell>
      ) : null}

      {isLoading || !metrics ? (
        <KpiSkeletonGrid count={5} />
      ) : (
        <SectionShell
          title="شاخص‌های پروژه"
          description="وضعیت کلی سبد پروژه‌ها"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metrics.kpis.projects.map((m, i) => (
              <KpiCard
                key={m.key}
                metric={m}
                icon={PROJECT_KPI_ICONS[i % PROJECT_KPI_ICONS.length]}
              />
            ))}
          </div>
        </SectionShell>
      )}

      {metrics ? (
        <Suspense
          fallback={
            <div className="grid gap-4 xl:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[320px] rounded-2xl" />
              ))}
            </div>
          }
        >
          <BusinessCharts metrics={metrics} />
        </Suspense>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] rounded-2xl" />
          ))}
        </div>
      )}

      <SectionShell
        title="پروژه‌های اخیر"
        description="آخرین به‌روزرسانی‌ها با مرحله، پیشرفت و مهلت"
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/projects">
              همه پروژه‌ها
              <ArrowUpRight className="ms-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        {isLoading || !metrics ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : metrics.recentProjects.length === 0 ? (
          <EmptyInline message="پروژه‌ای در این بازه یافت نشد." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>پروژه</TableHead>
                  <TableHead>مشتری</TableHead>
                  <TableHead>ادیتور</TableHead>
                  <TableHead>مرحله</TableHead>
                  <TableHead>اولویت</TableHead>
                  <TableHead>پیشرفت</TableHead>
                  <TableHead>مهلت</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>به‌روزرسانی</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentProjects.map((p) => {
                  const overdue =
                    !!p.deadlineAt &&
                    p.status !== "COMPLETED" &&
                    p.status !== "CANCELED" &&
                    new Date(p.deadlineAt) < new Date();
                  const priority = overdue
                    ? "critical"
                    : p.deadlineAt &&
                        new Date(p.deadlineAt).getTime() - Date.now() <
                          2 * 86400000
                      ? "high"
                      : "medium";
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="min-w-[140px]">
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.crmCustomer?.personName || "—"}
                      </TableCell>
                      <TableCell>{assigneeName(p, "EDITOR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {resolveCurrentStageLabel(
                            p.progress,
                            getProjectStatusLabel(p.status),
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PriorityDot priority={priority} />
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <ProjectProgressBar
                          progress={p.progress}
                          status={p.status}
                          variant="compact"
                          showTitle={false}
                        />
                      </TableCell>
                      <TableCell>
                        {p.deadlineAt ? formatDate(p.deadlineAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "COMPLETED"
                              ? "success"
                              : p.status === "CANCELED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {getProjectStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(p.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/projects/${p.id}`}>باز کردن</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionShell>
    </div>
  );
}
